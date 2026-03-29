import { db, getDirectoryStatus } from "../shared/db";
import { scanLibrarySnapshot, writeSnapshotFiles } from "../shared/filesystem";
import { planQueueUpsert } from "../shared/queue";
import { buildPageKey, isSupportedUrl, normalizeUrl } from "../shared/url";
import type { ActivePageSummary, FullPageMetrics, QueueRecord, QueuedSnapshotPayload, SnapshotWriteRequest } from "../shared/types";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MHTML_MIME = "multipart/related";
const CAPTURE_VISIBLE_TAB_INTERVAL_MS = 650;
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

let lastVisibleCaptureAt = 0;
let visibleCaptureQueue: Promise<void> = Promise.resolve();
let offscreenDocumentPromise: Promise<void> | null = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    void maybeScheduleAutoCapture(tab);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void handleTabActivated(tabId);
});

async function handleMessage(message: unknown): Promise<unknown> {
  const typed = message as { type?: string; tagNames?: string[]; pageNote?: string };
  switch (typed.type) {
    case "getActivePageSummary":
      return getActivePageSummary();
    case "captureCurrentPage":
      return captureActiveTab("manual", { tagNames: typed.tagNames ?? [], pageNote: typed.pageNote ?? "" });
    case "processQueuedCaptures":
      return processQueuedCaptures();
    default:
      throw new Error("Unknown message type.");
  }
}

async function getActivePageSummary(): Promise<ActivePageSummary> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const directoryStatus = await getDirectoryStatus();
  const pendingQueueCount = await db.queue.count();

  if (!tab?.url || !isSupportedUrl(tab.url)) {
    return { isSupported: false, url: tab?.url, title: tab?.title, directoryStatus, pendingQueueCount };
  }

  const snapshot = await scanLibrarySnapshot();
  const pageKey = buildPageKey(tab.url);
  const page = snapshot.pages.find((item) => item.pageKey === pageKey) ?? null;
  const latestVersion = snapshot.versions.filter((item) => item.pageKey === pageKey).sort((a, b) => b.capturedAt - a.capturedAt)[0] ?? null;
  return { isSupported: true, url: tab.url, title: tab.title, page, latestVersion, directoryStatus, pendingQueueCount };
}

async function captureActiveTab(trigger: "manual" | "auto" | "queued", input?: { tagNames: string[]; pageNote: string }) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab available.");
  }
  return captureTab(tab, trigger, undefined, input);
}

async function maybeScheduleAutoCapture(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.url || !isSupportedUrl(tab.url) || !tab.id) {
    return;
  }

  const snapshot = await scanLibrarySnapshot();
  const pageKey = buildPageKey(tab.url);
  const latestVersion = snapshot.versions.filter((item) => item.pageKey === pageKey).sort((a, b) => b.capturedAt - a.capturedAt)[0];
  if (!latestVersion || Date.now() - latestVersion.capturedAt < SEVEN_DAYS) {
    return;
  }

  if (!tab.active) {
    await putQueueItem({
      id: crypto.randomUUID(),
      pageKey,
      pageId: pageKey,
      sourceUrl: tab.url,
      requestedAt: Date.now(),
      reason: "页面已超过 7 天，等待标签页可见后自动补存。",
      status: "awaiting-visibility",
      title: tab.title ?? tab.url,
      tabId: tab.id,
      windowId: tab.windowId
    });
    return;
  }

  await captureTab(tab, "auto");
}

async function handleTabActivated(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || !isSupportedUrl(tab.url) || !tab.id) {
    return;
  }
  const pageKey = buildPageKey(tab.url);
  const queueItem = (await db.queue.where("status").equals("awaiting-visibility").toArray()).find((item) => item.pageKey === pageKey);
  if (queueItem) {
    await captureTab(tab, "queued", queueItem.id);
    return;
  }
  await maybeScheduleAutoCapture(tab);
}

async function captureTab(tab: chrome.tabs.Tab, trigger: "manual" | "auto" | "queued", queueId?: string, input?: { tagNames: string[]; pageNote: string }) {
  if (!tab.id || !tab.url || !isSupportedUrl(tab.url) || typeof tab.windowId !== "number") {
    throw new Error("This page cannot be captured.");
  }

  const sourceUrl = tab.url;
  const normalizedUrl = normalizeUrl(sourceUrl);
  const pageKey = buildPageKey(sourceUrl);
  const capturedAt = Date.now();
  const content = await extractPageContent(tab.id, tab.title ?? sourceUrl, sourceUrl);

  if (!tab.active) {
    await putQueueItem(
      {
        id: crypto.randomUUID(),
        pageKey,
        pageId: pageKey,
        sourceUrl,
        requestedAt: Date.now(),
        reason: "标签页当前不可见，等待切回前台后完成截图。",
        status: "awaiting-visibility",
        title: content.title,
        tabId: tab.id,
        windowId: tab.windowId
      },
      queueId
    );
    return { status: "queued", reason: "awaiting-visibility" };
  }

  const [archiveHtmlDataUrl, pngDataUrl, fullPagePngDataUrl] = await Promise.all([
    captureArchiveHtml(tab.id, sourceUrl),
    captureVisiblePng(tab.windowId),
    captureFullPagePng(tab.id, tab.windowId)
  ]);

  const writeRequest: SnapshotWriteRequest = {
    pageId: pageKey,
    versionId: crypto.randomUUID(),
    pageKey,
    sourceUrl,
    normalizedUrl,
    title: content.title,
    capturedAt,
    trigger,
    pngDataUrl,
    fullPagePngDataUrl,
    archiveHtmlDataUrl,
    tags: input?.tagNames ?? [],
    pageNote: input?.pageNote ?? "",
    versionNote: "",
    extractedText: content.text
  };

  try {
    const result = await writeSnapshotFiles(writeRequest);
    if (queueId) {
      await db.queue.delete(queueId);
    }
    return { status: "saved", paths: result };
  } catch (error) {
    if (queueId) {
      await db.queue.delete(queueId);
    }
    if (!isDirectoryPermissionError(error)) {
      throw error;
    }

    const payload: QueuedSnapshotPayload = {
      pageId: pageKey,
      versionId: writeRequest.versionId,
      sourceUrl,
      normalizedUrl,
      pageKey,
      title: content.title,
      capturedAt,
      trigger,
      extractedText: content.text,
      pageNote: input?.pageNote ?? "",
      tagNames: input?.tagNames ?? [],
      pngDataUrl,
      fullPagePngDataUrl,
      archiveHtmlDataUrl
    };

    if (queueId) {
      await db.queue.delete(queueId);
    }

    await putQueueItem({
      id: crypto.randomUUID(),
      pageKey,
      pageId: pageKey,
      sourceUrl,
      requestedAt: Date.now(),
      reason: "目录授权失效，等待重新授权后写入本地。",
      status: "awaiting-permission",
      title: content.title,
      snapshotPayload: payload
    });
    return { status: "queued", reason: "awaiting-permission" };
  }
}

async function processQueuedCaptures() {
  const items = await db.queue.where("status").equals("awaiting-permission").sortBy("requestedAt");
  let processed = 0;
  for (const item of items) {
    if (!item.snapshotPayload) {
      continue;
    }
    try {
      await writeSnapshotFiles({
        pageId: item.snapshotPayload.pageId,
        versionId: item.snapshotPayload.versionId,
        pageKey: item.snapshotPayload.pageKey,
        sourceUrl: item.snapshotPayload.sourceUrl,
        normalizedUrl: item.snapshotPayload.normalizedUrl,
        title: item.snapshotPayload.title,
        capturedAt: item.snapshotPayload.capturedAt,
        trigger: item.snapshotPayload.trigger,
        pngDataUrl: item.snapshotPayload.pngDataUrl,
        fullPagePngDataUrl: item.snapshotPayload.fullPagePngDataUrl,
        archiveHtmlDataUrl: item.snapshotPayload.archiveHtmlDataUrl,
        tags: item.snapshotPayload.tagNames,
        pageNote: item.snapshotPayload.pageNote,
        versionNote: "",
        extractedText: item.snapshotPayload.extractedText
      });
      await db.queue.delete(item.id);
      processed += 1;
    } catch (error) {
      if (isDirectoryPermissionError(error)) {
        break;
      }
      throw error;
    }
  }
  return { processed };
}

async function putQueueItem(record: QueueRecord, preferredId?: string): Promise<void> {
  const existing = (await db.queue.where("status").equals(record.status).toArray()).sort((a, b) => a.requestedAt - b.requestedAt);
  const plan = planQueueUpsert(existing, record, preferredId);

  await db.transaction("rw", db.queue, async () => {
    if (plan.duplicateIds.length > 0) {
      await db.queue.bulkDelete(plan.duplicateIds);
    }
    await db.queue.put(plan.record);
  });
}

async function extractPageContent(tabId: number, fallbackTitle: string, fallbackUrl: string) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
      const text = document.body?.innerText ?? document.documentElement?.innerText ?? "";
      return {
        title: document.title || location.href,
        text: [document.title, metaDescription, text].join("\n").replace(/\s+/g, " ").trim().slice(0, 250000),
        url: location.href
      };
    }
  });
  return result.result ?? { title: fallbackTitle, text: "", url: fallbackUrl };
}

async function captureFullPagePng(tabId: number, windowId: number): Promise<string> {
  const [metricsResult] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const scrollingElement = document.scrollingElement ?? document.documentElement;
      return {
        totalHeight: Math.max(scrollingElement.scrollHeight, document.body?.scrollHeight ?? 0),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        devicePixelRatio: window.devicePixelRatio || 1,
        originalX: window.scrollX,
        originalY: window.scrollY
      };
    }
  });

  const metrics = metricsResult.result as FullPageMetrics | undefined;
  if (!metrics || metrics.totalHeight <= metrics.viewportHeight) {
    return captureVisiblePng(windowId);
  }

  const positions = buildCapturePositions(metrics.totalHeight, metrics.viewportHeight);
  const shots: Array<{ dataUrl: string; offsetY: number }> = [];

  try {
    for (const offsetY of positions) {
      await chrome.scripting.executeScript({ target: { tabId }, func: (y: number) => { window.scrollTo(0, y); }, args: [offsetY] });
      await wait(120);
      shots.push({ dataUrl: await captureVisiblePng(windowId), offsetY });
    }
  } finally {
    await chrome.scripting.executeScript({ target: { tabId }, func: (x: number, y: number) => { window.scrollTo(x, y); }, args: [metrics.originalX, metrics.originalY] });
  }

  await ensureOffscreenDocument();
  const response = (await chrome.runtime.sendMessage({
    scope: "offscreen",
    type: "composeLongScreenshot",
    payload: {
      totalHeight: metrics.totalHeight,
      viewportHeight: metrics.viewportHeight,
      viewportWidth: metrics.viewportWidth,
      devicePixelRatio: metrics.devicePixelRatio,
      shots
    }
  })) as { ok?: boolean; result?: { dataUrl: string }; error?: string };

  if (!response.ok || !response.result?.dataUrl) {
    throw new Error(response.error || "LONG_SCREENSHOT_COMPOSE_FAILED");
  }
  return response.result.dataUrl;
}

async function captureVisiblePng(windowId: number): Promise<string> {
  const release = visibleCaptureQueue;
  let releaseNext!: () => void;
  visibleCaptureQueue = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });

  await release;

  try {
    const elapsed = Date.now() - lastVisibleCaptureAt;
    if (elapsed < CAPTURE_VISIBLE_TAB_INTERVAL_MS) {
      await wait(CAPTURE_VISIBLE_TAB_INTERVAL_MS - elapsed);
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    lastVisibleCaptureAt = Date.now();
    return dataUrl;
  } finally {
    releaseNext();
  }
}

function buildCapturePositions(totalHeight: number, viewportHeight: number): number[] {
  const positions: number[] = [];
  let cursor = 0;
  while (cursor < totalHeight) {
    positions.push(cursor);
    if (cursor + viewportHeight >= totalHeight) {
      break;
    }
    cursor += viewportHeight;
  }
  const finalOffset = Math.max(0, totalHeight - viewportHeight);
  if (!positions.includes(finalOffset)) {
    positions.push(finalOffset);
  }
  return positions;
}

async function captureArchiveHtml(tabId: number, sourceUrl: string): Promise<string> {
  // Step 1: Get DOM HTML and trigger lazy-loads from tab context
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Swap lazy-load data attributes to trigger loading
      const lazyImgs = document.querySelectorAll<HTMLImageElement>('img[data-src], img[data-lazy-src]');
      for (const img of lazyImgs) {
        const lazySrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (lazySrc) { img.src = lazySrc; }
      }
      return {
        html: document.documentElement.outerHTML,
        url: location.href
      };
    }
  });
  const { html: pageHtml } = (result.result as { html: string; url: string }) ?? { html: "", url: sourceUrl };

  // Step 2: Inline external stylesheets as <style> tags
  const htmlWithInlinedCss = await inlineStylesheets(pageHtml, sourceUrl);

  // Step 3: Collect and inline external images as data URIs
  const htmlWithInlinedImages = await inlineImagesToDataUrls(htmlWithInlinedCss, sourceUrl);

  // Step 4: Wrap with archive header and return as data URL
  const date = new Date();
  const dateStr = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  }).format(date);
  const escapedTitle = (result.result as { html: string; url: string } | undefined)?.url ?? sourceUrl;
  const archiveHtml = buildArchiveHtml(htmlWithInlinedImages, sourceUrl, dateStr);

  return "data:text/html;charset=UTF-8," + encodeURIComponent(archiveHtml);
}

async function inlineImagesToDataUrls(html: string, baseUrl: string): Promise<string> {
  // Parse img src attributes from HTML string using regex
  // For each external image URL, try to fetch it and convert to data URI
  // Replace the src with data URI if fetch succeeds, otherwise keep original URL

  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  const matches: Array<{ full: string; url: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = imgSrcRegex.exec(html)) !== null) {
    const url = match[1];
    if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("javascript:") || url.startsWith("mailto:")) continue;
    if (url.startsWith("//")) {
      matches.push({ full: match[0], url: "https:" + url });
    } else if (url.startsWith("/")) {
      try {
        const base = new URL(baseUrl);
        matches.push({ full: match[0], url: base.origin + url });
      } catch { continue; }
    } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
      try {
        const base = new URL(baseUrl);
        matches.push({ full: match[0], url: new URL(url, base).href });
      } catch { continue; }
    } else {
      matches.push({ full: match[0], url });
    }
  }

  if (matches.length === 0) return html;

  // Fetch all images in parallel
  const results = await Promise.allSettled(
    matches.map(async ({ url }) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const arrayBuffer = await response.arrayBuffer();
        const contentType = response.headers.get("Content-Type") || "image/png";
        const base64 = arrayBufferToBase64(arrayBuffer);
        return { originalUrl: url, dataUrl: `data:${contentType};base64,${base64}` };
      } catch {
        return { originalUrl: url, dataUrl: url }; // fallback to original URL
      }
    })
  );

  // Build replacement map
  const replacements = new Map<string, string>();
  for (let i = 0; i < matches.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      replacements.set(matches[i].url, result.value.dataUrl);
    }
  }

  // Apply replacements using simple string replacement (no regex needed)
  let result = html;
  for (const [originalUrl, dataUrl] of replacements) {
    if (dataUrl !== originalUrl) {
      // Replace src attribute values with the data URL using string replacement
      // to avoid regex escaping issues with base64 data URLs (which contain +, =, / etc.)
      result = result.replaceAll(`src="${originalUrl}"`, `src="${dataUrl}"`);
      result = result.replaceAll(`src='${originalUrl}'`, `src='${dataUrl}'`);
    }
  }

  return result;
}

async function inlineStylesheets(html: string, baseUrl: string): Promise<string> {
  // Match <link rel="stylesheet" href="URL"> — handles any attribute order
  const linkRegex = /<link\b(?:[^>]*?\s+)?rel=["']stylesheet["'](?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>/gi;
  const matches: Array<{ full: string; url: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const full = match[0];
    let url = match[1];
    // Resolve relative URLs
    if (url.startsWith("//")) {
      url = "https:" + url;
    } else if (url.startsWith("/")) {
      try { url = new URL(baseUrl).origin + url; } catch { continue; }
    } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
      try { url = new URL(url, baseUrl).href; } catch { continue; }
    }
    matches.push({ full, url });
  }

  if (matches.length === 0) return html;

  // Fetch all stylesheets in parallel
  const results = await Promise.allSettled(
    matches.map(async ({ url }) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const text = await response.text();
        return { originalUrl: url, css: text };
      } catch {
        return { originalUrl: url, css: null };
      }
    })
  );

  // Build replacement map
  const replacements = new Map<string, string>();
  for (let i = 0; i < matches.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled" && result.value.css !== null) {
      replacements.set(matches[i].full, `<style>\n${result.value.css}\n</style>`);
    } else {
      replacements.set(matches[i].full, `<!-- stylesheet failed to load: ${matches[i].url} -->`);
    }
  }

  // Apply replacements
  let result = html;
  for (const [original, replacement] of replacements) {
    result = result.replace(original, replacement);
  }

  return result;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildArchiveHtml(bodyHtml: string, sourceUrl: string, capturedAt: string): string {
  // Extract just the <body> content or use full HTML
  const bodyMatch = bodyHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const innerBody = bodyMatch ? bodyMatch[1] : bodyHtml;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>存档: ${new URL(sourceUrl).hostname}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;background:#f5f3f0;color:#1a1a1a;font-size:14px;line-height:1.6}
  .archive-bar{background:#fff;border-bottom:1px solid rgba(0,0,0,.1);padding:8px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:9999;font-size:12px}
  .archive-bar .label{background:#b86f41;color:#fff;border-radius:4px;padding:2px 6px;font-weight:600;font-size:11px}
  .archive-bar .url{color:#6b6b6b;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;font-size:11px}
  .archive-bar .date{color:#999;font-size:11px;white-space:nowrap}
  .archive-bar a{color:#1a1a1a;text-decoration:none}
  .archive-bar a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="archive-bar">
  <span class="label">存档</span>
  <a href="${sourceUrl}" target="_blank" title="访问原始网页" class="url">${sourceUrl}</a>
  <span class="date">${capturedAt}</span>
</div>
${innerBody}
</body>
</html>`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function isDirectoryPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("DIRECTORY_PERMISSION_REQUIRED");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureOffscreenDocument(): Promise<void> {
  const runtimeWithContexts = chrome.runtime as typeof chrome.runtime & {
    getContexts?: (filter: { contextTypes?: string[]; documentUrls?: string[] }) => Promise<Array<{ contextType: string; documentUrl?: string }>>;
  };
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);

  if (runtimeWithContexts.getContexts) {
    const existingContexts = await runtimeWithContexts.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    if (existingContexts.length > 0) {
      return;
    }
  }

  if (!offscreenDocumentPromise) {
    offscreenDocumentPromise = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.BLOBS],
        justification: "Compose stitched full-page screenshots for local snapshot exports."
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("Only a single offscreen")) {
          throw error;
        }
      })
      .finally(() => {
        offscreenDocumentPromise = null;
      });
  }

  await offscreenDocumentPromise;
}


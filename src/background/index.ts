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

  const [mhtmlBlob, pngDataUrl, fullPagePngDataUrl] = await Promise.all([
    saveAsMhtml(tab.id),
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
    mhtmlBase64: await blobToBase64(mhtmlBlob),
    mhtmlMimeType: mhtmlBlob.type || DEFAULT_MHTML_MIME,
    pngDataUrl,
    fullPagePngDataUrl,
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
      mhtmlBase64: writeRequest.mhtmlBase64,
      mhtmlMimeType: writeRequest.mhtmlMimeType,
      pngDataUrl,
      fullPagePngDataUrl
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
        mhtmlBase64: item.snapshotPayload.mhtmlBase64,
        mhtmlMimeType: item.snapshotPayload.mhtmlMimeType,
        pngDataUrl: item.snapshotPayload.pngDataUrl,
        fullPagePngDataUrl: item.snapshotPayload.fullPagePngDataUrl,
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

async function saveAsMhtml(tabId: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    chrome.pageCapture.saveAsMHTML({ tabId }, (blob) => {
      if (chrome.runtime.lastError || !blob) {
        reject(new Error(chrome.runtime.lastError?.message || "Unable to create MHTML snapshot."));
        return;
      }
      resolve(blob);
    });
  });
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


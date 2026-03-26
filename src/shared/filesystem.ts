import JSZip from "jszip";
import { buildVersionSearchText } from "./search";
import { db, getDirectoryHandle, getDirectoryStatus, setDirectoryHandle, setDirectoryStatus } from "./db";
import type {
  DirectoryStatus,
  LibrarySnapshot,
  PageRecord,
  QueueRecord,
  SnapshotFileMeta,
  SnapshotWriteRequest,
  SnapshotWriteResult,
  TagRecord,
  VersionRecord
} from "./types";
import { buildSnapshotRelativeBase } from "./url";

const UISTASH_ROOT = "UIstash";

export async function chooseDirectoryHandle(): Promise<DirectoryStatus> {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  const permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") {
    await setDirectoryStatus("stale");
    return "stale";
  }

  await setDirectoryHandle(handle);
  return "granted";
}

export async function ensureDirectoryPermission(request = false): Promise<DirectoryStatus> {
  const handle = await getDirectoryHandle();
  if (!handle) {
    await setDirectoryStatus("missing");
    return "missing";
  }

  const permission = request
    ? await handle.requestPermission({ mode: "readwrite" })
    : await handle.queryPermission({ mode: "readwrite" });

  const nextStatus: DirectoryStatus = permission === "granted" ? "granted" : "stale";
  await setDirectoryStatus(nextStatus);
  return nextStatus;
}

export async function writeSnapshotFiles(request: SnapshotWriteRequest): Promise<SnapshotWriteResult> {
  const status = await ensureDirectoryPermission(false);
  if (status !== "granted") {
    throw new Error("DIRECTORY_PERMISSION_REQUIRED");
  }

  const root = await getDirectoryHandle();
  if (!root) {
    throw new Error("DIRECTORY_PERMISSION_REQUIRED");
  }

  if (!request.mhtmlBase64 || typeof request.mhtmlBase64 !== "string") {
    throw new Error("INVALID_MHTML_PAYLOAD");
  }

  const base = buildSnapshotRelativeBase(request.normalizedUrl, request.capturedAt);
  const baseDir = await ensureRelativeDirectory(root, base);
  const mhtmlPath = `${base}/page.mhtml`;
  const pngPath = `${base}/preview.png`;
  const fullPngPath = `${base}/full-page.png`;
  const metaPath = `${base}/meta.json`;

  await writeFile(baseDir, "page.mhtml", base64ToBlob(request.mhtmlBase64, request.mhtmlMimeType || "multipart/related"));
  await writeFile(baseDir, "preview.png", await dataUrlToBlob(request.pngDataUrl));
  await writeFile(baseDir, "full-page.png", await dataUrlToBlob(request.fullPagePngDataUrl));
  await writeFile(baseDir, "meta.json", new Blob([JSON.stringify(buildMeta(request, pngPath, fullPngPath), null, 2)], { type: "application/json" }));

  return { mhtmlPath, pngPath, fullPngPath, metaPath };
}

export async function scanLibrarySnapshot(): Promise<LibrarySnapshot> {
  const status = await ensureDirectoryPermission(false);
  const queue = await db.queue.toArray();
  if (status !== "granted") {
    return { pages: [], versions: [], tags: [], queue };
  }

  const root = await getDirectoryHandle();
  if (!root) {
    return { pages: [], versions: [], tags: [], queue };
  }

  let libraryRoot: FileSystemDirectoryHandle;
  try {
    libraryRoot = await root.getDirectoryHandle(UISTASH_ROOT);
  } catch {
    return { pages: [], versions: [], tags: [], queue };
  }

  const metaEntries = await collectMetaEntries(libraryRoot, UISTASH_ROOT);
  const tagMap = new Map<string, TagRecord>();
  const grouped = new Map<string, Array<{ meta: SnapshotFileMeta; metaPath: string; mhtmlPath: string }>>();

  for (const entry of metaEntries) {
    for (const tagName of entry.meta.tags ?? []) {
      const id = tagId(tagName);
      if (!tagMap.has(id)) {
        tagMap.set(id, { id, name: tagName, color: pickTagColor(tagName), createdAt: entry.meta.capturedAt });
      }
    }

    const existing = grouped.get(entry.meta.pageKey);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(entry.meta.pageKey, [entry]);
    }
  }

  const pages: PageRecord[] = [];
  const versions: VersionRecord[] = [];

  for (const [pageKey, entries] of grouped) {
    const sorted = [...entries].sort((a, b) => b.meta.capturedAt - a.meta.capturedAt);
    const latest = sorted[0].meta;
    const page: PageRecord = {
      id: pageKey,
      pageKey,
      normalizedUrl: latest.normalizedUrl,
      latestUrl: latest.sourceUrl,
      title: latest.title,
      tagIds: (latest.tags ?? []).map(tagId),
      note: latest.pageNote ?? "",
      createdAt: Math.min(...sorted.map((item) => item.meta.capturedAt)),
      updatedAt: Math.max(...sorted.map((item) => item.meta.capturedAt)),
      versionCount: sorted.length
    };
    pages.push(page);

    for (const item of sorted) {
      versions.push({
        id: item.meta.versionId,
        pageId: page.id,
        pageKey,
        sourceUrl: item.meta.sourceUrl,
        normalizedUrl: item.meta.normalizedUrl,
        title: item.meta.title,
        capturedAt: item.meta.capturedAt,
        trigger: item.meta.trigger,
        mhtmlPath: item.mhtmlPath,
        pngPath: item.meta.viewportImagePath,
        fullPngPath: item.meta.fullPageImagePath,
        metaPath: item.metaPath,
        extractedText: item.meta.extractedText ?? "",
        note: item.meta.versionNote ?? "",
        fileStatus: "ready",
        searchText: buildVersionSearchText({
          page,
          version: {
            sourceUrl: item.meta.sourceUrl,
            normalizedUrl: item.meta.normalizedUrl,
            title: item.meta.title,
            extractedText: item.meta.extractedText ?? "",
            note: item.meta.versionNote ?? ""
          },
          tagNames: item.meta.tags ?? []
        })
      });
    }
  }

  return {
    pages: pages.sort((a, b) => b.updatedAt - a.updatedAt),
    versions: versions.sort((a, b) => b.capturedAt - a.capturedAt),
    tags: [...tagMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    queue
  };
}

export async function updatePageMetadataOnDisk(pageKey: string, updates: { note?: string; tagNames?: string[] }): Promise<void> {
  const metas = await findPageMetaEntries(pageKey);
  await Promise.all(
    metas.map((entry) =>
      rewriteMetaFile(entry.metaPath, {
        ...entry.meta,
        pageNote: updates.note ?? entry.meta.pageNote,
        tags: updates.tagNames ?? entry.meta.tags
      })
    )
  );
}

export async function updateVersionMetadataOnDisk(versionId: string, updates: { note?: string }): Promise<void> {
  const snapshot = await scanLibrarySnapshot();
  const version = snapshot.versions.find((item) => item.id === versionId);
  if (!version) {
    throw new Error("Version not found.");
  }

  const meta = await readMetaJson(version.metaPath);
  await rewriteMetaFile(version.metaPath, {
    ...meta,
    versionNote: updates.note ?? meta.versionNote
  });
}

export async function readSnapshotFile(relativePath: string): Promise<File> {
  const handle = await getExistingFileHandle(relativePath);
  return handle.getFile();
}

export async function deleteSnapshotPath(relativePath: string): Promise<void> {
  const root = await getDirectoryHandle();
  if (!root) {
    return;
  }

  const parts = splitPath(relativePath);
  if (parts.length === 0) {
    return;
  }

  const fileName = parts.pop() as string;
  const directory = await walkDirectory(root, parts);
  if (!directory) {
    return;
  }

  try {
    await directory.removeEntry(fileName);
    await removeEmptyDirectories(root, parts);
  } catch {
    return;
  }
}

export async function deleteSnapshotDirectory(relativePath: string): Promise<void> {
  const root = await getDirectoryHandle();
  if (!root) {
    return;
  }

  const parts = splitPath(relativePath);
  if (parts.length === 0) {
    return;
  }

  const directoryName = parts.pop() as string;
  const parent = await walkDirectory(root, parts);
  if (!parent) {
    return;
  }

  try {
    await parent.removeEntry(directoryName, { recursive: true });
    await removeEmptyDirectories(root, parts);
  } catch {
    return;
  }
}

export function getVersionDirectoryPath(version: Pick<VersionRecord, "metaPath">): string {
  return dirname(version.metaPath);
}

export function getPageDirectoryPath(version: Pick<VersionRecord, "metaPath">): string {
  return dirname(dirname(version.metaPath));
}

export async function exportLibraryZip(input: {
  pages: PageRecord[];
  versions: VersionRecord[];
  tags: TagRecord[];
  queue: QueueRecord[];
  selectedTagId?: string | null;
}): Promise<Blob> {
  const status = await getDirectoryStatus();
  if (status !== "granted") {
    throw new Error("DIRECTORY_PERMISSION_REQUIRED");
  }

  const zip = new JSZip();
  const tagsById = new Map(input.tags.map((tag) => [tag.id, tag]));
  const includedPages = input.selectedTagId ? input.pages.filter((page) => page.tagIds.includes(input.selectedTagId)) : input.pages;
  const pageIds = new Set(includedPages.map((page) => page.id));
  const includedVersions = input.versions.filter((version) => pageIds.has(version.pageId));

  for (const version of includedVersions) {
    const [mhtmlFile, pngFile, fullPngFile, metaFile] = await Promise.all([
      readSnapshotFile(version.mhtmlPath),
      readSnapshotFile(version.pngPath),
      readSnapshotFile(version.fullPngPath),
      readSnapshotFile(version.metaPath)
    ]);
    zip.file(version.mhtmlPath, mhtmlFile);
    zip.file(version.pngPath, pngFile);
    zip.file(version.fullPngPath, fullPngFile);
    zip.file(version.metaPath, metaFile);
  }

  zip.file(
    "UIstash/export-meta.json",
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        selectedTagId: input.selectedTagId ?? null,
        tags: input.tags,
        pages: includedPages.map((page) => ({ ...page, tagNames: page.tagIds.map((id) => tagsById.get(id)?.name ?? "") })),
        versions: includedVersions,
        queue: input.queue.filter((item) => pageIds.has(item.pageId ?? ""))
      },
      null,
      2
    )
  );

  return zip.generateAsync({ type: "blob" });
}

export async function saveZipBlob(blob: Blob, suggestedName: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename: suggestedName, saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function collectMetaEntries(directory: FileSystemDirectoryHandle, relativePath: string): Promise<Array<{ meta: SnapshotFileMeta; metaPath: string; mhtmlPath: string }>> {
  const result: Array<{ meta: SnapshotFileMeta; metaPath: string; mhtmlPath: string }> = [];
  for await (const [name, handle] of directory.entries()) {
    const nextPath = `${relativePath}/${name}`;
    if (handle.kind === "directory") {
      result.push(...(await collectMetaEntries(handle, nextPath)));
      continue;
    }
    if (name !== "meta.json") {
      continue;
    }
    const file = await handle.getFile();
    const raw = JSON.parse(await file.text()) as SnapshotFileMeta;
    result.push({ meta: normalizeMeta(raw, nextPath), metaPath: nextPath, mhtmlPath: `${relativePath}/page.mhtml` });
  }
  return result;
}

async function findPageMetaEntries(pageKey: string): Promise<Array<{ meta: SnapshotFileMeta; metaPath: string }>> {
  const snapshot = await scanLibrarySnapshot();
  const metas: Array<{ meta: SnapshotFileMeta; metaPath: string }> = [];

  for (const version of snapshot.versions.filter((item) => item.pageKey === pageKey)) {
    metas.push({ meta: await readMetaJson(version.metaPath), metaPath: version.metaPath });
  }

  return metas;
}

async function rewriteMetaFile(relativePath: string, meta: SnapshotFileMeta): Promise<void> {
  const root = await getDirectoryHandle();
  if (!root) {
    throw new Error("DIRECTORY_PERMISSION_REQUIRED");
  }
  const parts = splitPath(relativePath);
  const fileName = parts.pop();
  if (!fileName) {
    throw new Error("INVALID_PATH");
  }
  const directory = await walkDirectory(root, parts);
  if (!directory) {
    throw new Error("FILE_NOT_FOUND");
  }
  await writeFile(directory, fileName, new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" }));
}

async function readMetaJson(relativePath: string): Promise<SnapshotFileMeta> {
  const file = await readSnapshotFile(relativePath);
  return JSON.parse(await file.text()) as SnapshotFileMeta;
}

async function getExistingFileHandle(relativePath: string): Promise<FileSystemFileHandle> {
  const root = await getDirectoryHandle();
  if (!root) {
    throw new Error("DIRECTORY_PERMISSION_REQUIRED");
  }

  const parts = splitPath(relativePath);
  const fileName = parts.pop();
  if (!fileName) {
    throw new Error("INVALID_PATH");
  }

  const directory = await walkDirectory(root, parts);
  if (!directory) {
    throw new Error("FILE_NOT_FOUND");
  }

  return directory.getFileHandle(fileName);
}

async function ensureRelativeDirectory(root: FileSystemDirectoryHandle, relativePath: string): Promise<FileSystemDirectoryHandle> {
  const parts = splitPath(relativePath);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

async function walkDirectory(root: FileSystemDirectoryHandle, parts: string[]): Promise<FileSystemDirectoryHandle | null> {
  let current = root;
  for (const part of parts) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  return current;
}

async function removeEmptyDirectories(root: FileSystemDirectoryHandle, parts: string[]): Promise<void> {
  for (let index = parts.length; index > 0; index -= 1) {
    const targetParts = parts.slice(0, index);
    const directoryName = targetParts[targetParts.length - 1];
    const parentParts = targetParts.slice(0, -1);
    const directory = await walkDirectory(root, targetParts);
    if (!directory) {
      continue;
    }

    let hasEntries = false;
    for await (const _entry of directory.entries()) {
      hasEntries = true;
      break;
    }

    if (hasEntries) {
      break;
    }

    const parent = await walkDirectory(root, parentParts);
    if (!parent) {
      break;
    }

    try {
      await parent.removeEntry(directoryName);
    } catch {
      break;
    }

    if (directoryName === UISTASH_ROOT) {
      break;
    }
  }
}

async function writeFile(handle: FileSystemDirectoryHandle, fileName: string, data: Blob): Promise<void> {
  if (!(data instanceof Blob) || data.size === 0) {
    throw new Error(`INVALID_FILE_PAYLOAD:${fileName}`);
  }

  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error("INVALID_PNG_PAYLOAD");
  }
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("INVALID_PNG_PAYLOAD");
  }
  return blob;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function buildMeta(request: SnapshotWriteRequest, pngPath: string, fullPngPath: string): SnapshotFileMeta {
  const capturedDate = new Date(request.capturedAt);
  return {
    pageId: request.pageId,
    versionId: request.versionId,
    pageKey: request.pageKey,
    title: request.title,
    sourceUrl: request.sourceUrl,
    normalizedUrl: request.normalizedUrl,
    capturedAt: request.capturedAt,
    capturedAtIso: capturedDate.toISOString(),
    capturedAtDisplay: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(capturedDate),
    trigger: request.trigger,
    tags: request.tags,
    pageNote: request.pageNote,
    versionNote: request.versionNote,
    extractedText: request.extractedText,
    viewportImagePath: pngPath,
    fullPageImagePath: fullPngPath
  };
}

function normalizeMeta(meta: SnapshotFileMeta, metaPath: string): SnapshotFileMeta {
  const basePath = metaPath.slice(0, -"/meta.json".length);
  return {
    ...meta,
    tags: meta.tags ?? [],
    pageNote: meta.pageNote ?? "",
    versionNote: meta.versionNote ?? "",
    extractedText: meta.extractedText ?? "",
    viewportImagePath: meta.viewportImagePath || `${basePath}/preview.png`,
    fullPageImagePath: meta.fullPageImagePath || `${basePath}/full-page.png`
  };
}

function splitPath(relativePath: string): string[] {
  return relativePath.split("/").filter(Boolean);
}

function dirname(relativePath: string): string {
  const parts = splitPath(relativePath);
  parts.pop();
  return parts.join("/");
}

function tagId(name: string): string {
  return `tag:${name.trim().toLowerCase()}`;
}

function pickTagColor(name: string): string {
  const palette = ["#b86f41", "#7794d8", "#729f84", "#a988bf", "#c1a35b", "#d38b8b"];
  const hash = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

export type CaptureTrigger = "manual" | "auto" | "queued";

export type QueueStatus = "awaiting-permission" | "awaiting-visibility";

export type DirectoryStatus = "missing" | "granted" | "stale";

export interface PageRecord {
  id: string;
  pageKey: string;
  normalizedUrl: string;
  latestUrl: string;
  title: string;
  tagIds: string[];
  note: string;
  createdAt: number;
  updatedAt: number;
  versionCount: number;
}

export interface VersionRecord {
  id: string;
  pageId: string;
  pageKey: string;
  sourceUrl: string;
  normalizedUrl: string;
  title: string;
  capturedAt: number;
  trigger: CaptureTrigger;
  mhtmlPath: string;
  htmlPath: string;
  pngPath: string;
  fullPngPath: string;
  metaPath: string;
  extractedText: string;
  note: string;
  fileStatus: "ready" | "missing";
  searchText: string;
}

export interface TagRecord {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface QueuedSnapshotPayload {
  pageId: string;
  versionId: string;
  sourceUrl: string;
  normalizedUrl: string;
  pageKey: string;
  title: string;
  capturedAt: number;
  trigger: CaptureTrigger;
  extractedText: string;
  pageNote: string;
  tagNames: string[];
  pngDataUrl: string;
  fullPagePngDataUrl: string;
  archiveHtmlDataUrl: string;
}

export interface QueueRecord {
  id: string;
  pageId?: string;
  pageKey: string;
  sourceUrl: string;
  requestedAt: number;
  reason: string;
  status: QueueStatus;
  title: string;
  tabId?: number;
  windowId?: number;
  snapshotPayload?: QueuedSnapshotPayload;
}

export interface SettingRecord<T = unknown> {
  key: string;
  value: T;
}

export interface PageContentPayload {
  title: string;
  text: string;
  url: string;
}

export interface FullPageMetrics {
  totalHeight: number;
  viewportHeight: number;
  viewportWidth: number;
  devicePixelRatio: number;
  originalX: number;
  originalY: number;
}

export interface LongScreenshotShot {
  dataUrl: string;
  offsetY: number;
}

export interface LongScreenshotComposeRequest {
  totalHeight: number;
  viewportHeight: number;
  viewportWidth: number;
  devicePixelRatio: number;
  shots: LongScreenshotShot[];
}

export interface SnapshotFileMeta {
  pageId: string;
  versionId: string;
  pageKey: string;
  title: string;
  sourceUrl: string;
  normalizedUrl: string;
  capturedAt: number;
  capturedAtIso: string;
  capturedAtDisplay: string;
  trigger: CaptureTrigger;
  tags: string[];
  pageNote: string;
  versionNote: string;
  extractedText: string;
  viewportImagePath: string;
  fullPageImagePath: string;
  htmlPath: string;
}

export interface SnapshotWriteRequest {
  pageId: string;
  versionId: string;
  pageKey: string;
  sourceUrl: string;
  normalizedUrl: string;
  title: string;
  capturedAt: number;
  trigger: CaptureTrigger;
  pngDataUrl: string;
  fullPagePngDataUrl: string;
  archiveHtmlDataUrl: string;
  tags: string[];
  pageNote: string;
  versionNote: string;
  extractedText: string;
}

export interface SnapshotWriteResult {
  pngPath: string;
  fullPngPath: string;
  htmlPath: string;
  metaPath: string;
}

export interface ActivePageSummary {
  isSupported: boolean;
  url?: string;
  title?: string;
  page?: PageRecord | null;
  latestVersion?: VersionRecord | null;
  directoryStatus: DirectoryStatus;
  pendingQueueCount: number;
}

export interface SearchMatchVersion {
  version: VersionRecord;
  snippet: string;
}

export interface SearchPageResult {
  page: PageRecord;
  tagNames: string[];
  latestVersion?: VersionRecord;
  matchedVersions: SearchMatchVersion[];
}

export interface LibrarySnapshot {
  pages: PageRecord[];
  versions: VersionRecord[];
  tags: TagRecord[];
  queue: QueueRecord[];
}
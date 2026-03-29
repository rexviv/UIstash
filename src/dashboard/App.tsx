import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ExternalLink,
  FolderOpen,
  ImageIcon,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  FileText,
  GalleryVerticalEnd,
  MoreHorizontal
} from "lucide-react";
import { db } from "../shared/db";
import {
  chooseDirectoryHandle,
  deleteSnapshotDirectory,
  ensureDirectoryPermission,
  exportLibraryZip,
  getPageDirectoryPath,
  getVersionDirectoryPath,
  readSnapshotFile,
  saveZipBlob,
  scanLibrarySnapshot,
  updatePageMetadataOnDisk,
  updateVersionMetadataOnDisk
} from "../shared/filesystem";
import { searchPages } from "../shared/search";
import type { DirectoryStatus, LibrarySnapshot, PageRecord, SearchPageResult, VersionRecord } from "../shared/types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";

const EMPTY_LIBRARY: LibrarySnapshot = { pages: [], versions: [], tags: [], queue: [] };
const MAX_THUMBNAILS = 24;

export function App() {
  const [library, setLibrary] = useState<LibrarySnapshot>(EMPTY_LIBRARY);
  const [directoryStatus, setDirectoryStatus] = useState<DirectoryStatus>("missing");
  const [query, setQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [pageNoteDraft, setPageNoteDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("正在加载目录内容...");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    void reloadLibrary();
  }, []);

  const results = useMemo(
    () => searchPages({ pages: library.pages, versions: library.versions, tags: library.tags, query: deferredQuery, tagId: selectedTagId }),
    [library.pages, library.versions, library.tags, deferredQuery, selectedTagId]
  );
  const selectedResult = pickSelectedResult(results, selectedPageId);
  const selectedPage = selectedResult?.page ?? null;
  const selectedVersions = useMemo(
    () =>
      selectedPage
        ? library.versions.filter((version) => version.pageId === selectedPage.id).sort((a, b) => b.capturedAt - a.capturedAt)
        : [],
    [library.versions, selectedPage]
  );

  useEffect(() => {
    setPageNoteDraft(selectedPage?.note ?? "");
  }, [selectedPage?.id, selectedPage?.note]);

  useEffect(() => {
    let revoked = false;
    const createdUrls: string[] = [];

    async function loadThumbnails() {
      const nextEntries = await Promise.all(
        results.slice(0, MAX_THUMBNAILS).map(async (result) => {
          const latestVersion = result.latestVersion;
          if (!latestVersion) {
            return null;
          }
          try {
            const file = await readSnapshotFile(latestVersion.pngPath);
            const objectUrl = URL.createObjectURL(file);
            createdUrls.push(objectUrl);
            return [result.page.id, objectUrl] as const;
          } catch {
            return null;
          }
        })
      );

      if (revoked) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setThumbnailUrls(Object.fromEntries(nextEntries.filter(Boolean) as Array<readonly [string, string]>));
    }

    if (directoryStatus === "granted") {
      void loadThumbnails();
    } else {
      setThumbnailUrls({});
    }

    return () => {
      revoked = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [results, directoryStatus]);

  async function reloadLibrary(nextSelectedPageId?: string | null) {
    const [snapshot, permission] = await Promise.all([scanLibrarySnapshot(), ensureDirectoryPermission(false)]);
    startTransition(() => {
      setLibrary(snapshot);
      setDirectoryStatus(permission);
      const nextResults = searchPages({ pages: snapshot.pages, versions: snapshot.versions, tags: snapshot.tags, query: deferredQuery, tagId: selectedTagId });
      const nextSelected = nextSelectedPageId ?? (nextResults.some((item) => item.page.id === selectedPageId) ? selectedPageId : nextResults[0]?.page.id ?? null);
      setSelectedPageId(nextSelected);
    });
    setStatusMessage("");
  }

  async function handleChooseDirectory() {
    try {
      setBusy(true);
      await chooseDirectoryHandle();
      await chrome.runtime.sendMessage({ type: "processQueuedCaptures" });
      setStatusMessage("目录已更新");
      await reloadLibrary();
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryQueue() {
    setBusy(true);
    const response = (await chrome.runtime.sendMessage({ type: "processQueuedCaptures" })) as { ok?: boolean; result?: { processed: number }; error?: string };
    if (!response.ok) {
      setStatusMessage(response.error || "补录失败");
      setBusy(false);
      return;
    }
    setStatusMessage("已处理 " + (response.result?.processed ?? 0) + " 条任务");
    await reloadLibrary();
    setBusy(false);
  }

  async function handleDeleteQueueItem(queueId: string) {
    await db.queue.delete(queueId);
    setStatusMessage("队列任务已删除");
    await reloadLibrary(selectedPageId);
  }

  async function handleCreateTag() {
    if (!selectedPage || !newTagName.trim()) {
      return;
    }
    const existingNames = library.tags.filter((tag) => selectedPage.tagIds.includes(tag.id)).map((tag) => tag.name);
    await updatePageMetadataOnDisk(selectedPage.pageKey, { tagNames: Array.from(new Set([...existingNames, newTagName.trim()])) });
    setNewTagName("");
    setStatusMessage("标签已更新");
    await reloadLibrary(selectedPage.id);
  }

  async function toggleTagForSelectedPage(tagId: string) {
    if (!selectedPage) {
      return;
    }
    const tag = library.tags.find((item) => item.id === tagId);
    if (!tag) {
      return;
    }
    const currentNames = library.tags.filter((item) => selectedPage.tagIds.includes(item.id)).map((item) => item.name);
    const nextNames = selectedPage.tagIds.includes(tagId) ? currentNames.filter((item) => item !== tag.name) : [...currentNames, tag.name];
    await updatePageMetadataOnDisk(selectedPage.pageKey, { tagNames: nextNames });
    setStatusMessage("标签已更新");
    await reloadLibrary(selectedPage.id);
  }

  async function handleSavePageNote(page: PageRecord, note: string) {
    await updatePageMetadataOnDisk(page.pageKey, { note });
    setStatusMessage("备注已保存");
    await reloadLibrary(page.id);
  }

  async function handleSaveVersionNote(version: VersionRecord, note: string) {
    await updateVersionMetadataOnDisk(version.id, { note });
    setStatusMessage("备注已保存");
    await reloadLibrary(version.pageId);
  }

  async function handleOpenFile(version: VersionRecord, kind: "mhtml" | "png" | "full") {
    const permission = await ensureDirectoryPermission(false);
    if (permission !== "granted") {
      setDirectoryStatus(permission);
      setStatusMessage("目录需要重新授权");
      return;
    }

    const targetPath = kind === "mhtml" ? version.mhtmlPath : kind === "full" ? version.fullPngPath : version.pngPath;
    try {
      const file = await readSnapshotFile(targetPath);
      const url = URL.createObjectURL(file);
      await chrome.tabs.create({ url });
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setStatusMessage("本地文件不存在或无法读取");
    }
  }

  async function handleDeleteVersion(version: VersionRecord) {
    if (!window.confirm("删除这个版本后，会同时删除对应目录和本地文件。确定继续吗？")) {
      return;
    }
    setBusy(true);
    try {
      await deleteSnapshotDirectory(getVersionDirectoryPath(version));
      setStatusMessage("版本已删除");
      await reloadLibrary(version.pageId);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePage(page: PageRecord) {
    if (!window.confirm("网页会连同全部历史版本与对应目录一起清理。确定继续吗？")) {
      return;
    }
    setBusy(true);
    try {
      const latestVersion = library.versions.filter((version) => version.pageId === page.id).sort((a, b) => b.capturedAt - a.capturedAt)[0];
      if (latestVersion) {
        await deleteSnapshotDirectory(getPageDirectoryPath(latestVersion));
      }
      setStatusMessage("网页已删除");
      await reloadLibrary();
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(selectedOnly: boolean) {
    const permission = await ensureDirectoryPermission(false);
    if (permission !== "granted") {
      setDirectoryStatus(permission);
      setStatusMessage("导出前请先重新授权目录");
      return;
    }
    setBusy(true);
    try {
      const blob = await exportLibraryZip({
        pages: library.pages,
        versions: library.versions,
        tags: library.tags,
        queue: library.queue,
        selectedTagId: selectedOnly ? selectedTagId : null
      });
      const tag = library.tags.find((item) => item.id === selectedTagId);
      const fileName = selectedOnly && tag ? `UIstash-${slugify(tag.name)}.zip` : "UIstash-library.zip";
      await saveZipBlob(blob, fileName);
      setStatusMessage("导出任务已提交到浏览器下载");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-screen overflow-hidden grid-cols-[288px_minmax(520px,1fr)_420px] max-[1180px]:h-auto max-[1180px]:overflow-visible max-[1180px]:grid-cols-1" style={{ background: "var(--canvas)" }}>
      {/* Column 1: Sidebar */}
      <aside className="glass-subtle grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-5 overflow-hidden border-r border-white/20 p-5 max-[1180px]:h-auto max-[1180px]:overflow-visible max-[1180px]:border-r-0 max-[1180px]:border-b max-[1180px]:p-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--ink-primary)" }}>UIstash</h1>
        </div>

        <Card className="glass min-h-0">
          <CardContent className="min-h-0 pt-5">
            <ScrollArea className="h-full pr-3 max-[1180px]:h-auto">
              <div className="mb-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--ink-muted)" }}>PAGES</p>
                <Button variant={selectedTagId ? "secondary" : "outline"} className="w-full justify-between" onClick={() => setSelectedTagId(null)}>
                  <span className="font-mono text-xs">All Pages</span>
                  <Badge variant="secondary">{library.pages.length}</Badge>
                </Button>
              </div>
              <div className="grid gap-2 pb-2">
                <p className="mb-3 mt-4 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--ink-muted)" }}>TAGS</p>
                {library.tags.map((tag) => (
                  <Button
                    key={tag.id}
                    variant={selectedTagId === tag.id ? "outline" : "secondary"}
                    className="w-full justify-between"
                    onClick={() => setSelectedTagId(tag.id)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="font-mono text-xs">{tag.name}</span>
                    </span>
                    <Badge variant="secondary">{countPagesForTag(library.pages, tag.id)}</Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="w-full justify-center gap-2">
              <Settings2 className="size-4" />
              <span className="font-mono text-xs uppercase tracking-wider">Settings</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            <Separator />
            <div className="grid gap-6 px-6 pb-6">
              <Card className="bg-white/50 backdrop-blur-md">
                <CardContent className="grid gap-1 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--ink-muted)" }}>LOCAL STORAGE</p>
                  <p className="font-mono text-sm" style={{ color: "var(--ink-primary)" }}>{statusText(directoryStatus)}</p>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={handleChooseDirectory} disabled={busy} className="justify-start">
                  <FolderOpen className="size-4" />
                  <span className="font-mono text-xs uppercase tracking-wider">Choose Directory</span>
                </Button>
                <Button variant="secondary" onClick={handleRetryQueue} disabled={busy} className="justify-start">
                  <RefreshCw className="size-4" />
                  <span className="font-mono text-xs uppercase tracking-wider">Retry Queue</span>
                </Button>
                <Button variant="secondary" onClick={() => void handleExport(false)} disabled={busy} className="justify-start">
                  <Archive className="size-4" />
                  <span className="font-mono text-xs uppercase tracking-wider">Export All ZIP</span>
                </Button>
                <Button variant="secondary" onClick={() => void handleExport(true)} disabled={busy || !selectedTagId} className="justify-start">
                  <GalleryVerticalEnd className="size-4" />
                  <span className="font-mono text-xs uppercase tracking-wider">Export by Tag</span>
                </Button>
              </div>

              {statusMessage ? <p className="font-mono text-xs" style={{ color: "var(--ink-secondary)" }}>{statusMessage}</p> : null}

              {library.queue.length > 0 ? (
                <>
                  <Separator />
                  <ScrollArea className="max-h-[320px] pr-3">
                    <div className="grid gap-3">
                      {library.queue.map((item) => (
                        <Card key={item.id} className="bg-white/50 backdrop-blur-md">
                          <CardContent className="grid gap-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold tracking-[-0.02em]" style={{ color: "var(--ink-primary)" }}>{item.title}</p>
                                <p className="mt-1 font-mono text-xs" style={{ color: "var(--ink-secondary)" }}>{item.reason}</p>
                              </div>
                              <Button variant="destructive" size="sm" onClick={() => void handleDeleteQueueItem(item.id)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                            <Badge variant="secondary" className="w-fit font-mono text-[10px]">{formatTime(item.requestedAt)}</Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </aside>

      {/* Column 2: Main Content */}
      <main className="grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-6 max-[1180px]:h-auto max-[1180px]:overflow-visible max-[1180px]:p-4" style={{ background: "var(--canvas)" }}>
        <Card className="glass">
          <CardContent className="flex items-end justify-between gap-4 p-5 max-[860px]:flex-col max-[860px]:items-stretch">
            <CardTitle className="text-[18px]">{selectedTagId ? library.tags.find((tag) => tag.id === selectedTagId)?.name || "All Pages" : "All Pages"}</CardTitle>
            <div className="w-full max-w-[380px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2" style={{ color: "var(--ink-muted)" }} />
                <Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={"> search..."} />
              </div>
            </div>
          </CardContent>
        </Card>

        <ScrollArea className="h-full pr-3">
          <div className="grid gap-4 pb-4">
            {results.length === 0 ? (
              <Card className="h-full border-dashed bg-white/30 backdrop-blur-md">
                <CardContent className="grid min-h-[220px] place-items-center p-6 text-center">
                  <p className="font-mono text-sm" style={{ color: "var(--ink-muted)" }}>{"NO RESULTS"}</p>
                </CardContent>
              </Card>
            ) : null}
            {results.map((result) => {
              const latestVersion = result.latestVersion;
              const thumbnailUrl = thumbnailUrls[result.page.id];
              return (
                <button key={result.page.id} type="button" className="text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99]" onClick={() => setSelectedPageId(result.page.id)}>
                  <Card className={selectedPage?.id === result.page.id ? "border-[var(--accent)]/40 bg-white/80 backdrop-blur-xl" : "glass-subtle"}>
                    <CardContent className="grid grid-cols-[168px_1fr] gap-4 p-4 max-[760px]:grid-cols-1">
                      <div className="relative overflow-hidden rounded-[var(--radius-sm)] bg-white/50 backdrop-blur-md">
                        {thumbnailUrl ? (
                          <img src={thumbnailUrl} alt={result.page.title} className="h-[116px] w-full object-cover" />
                        ) : (
                          <div className="grid h-[116px] place-items-center">
                            <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>NO THUMBNAIL</p>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-[15px] font-semibold tracking-tight" style={{ color: "var(--ink-primary)" }}>{result.page.title}</h3>
                            <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--ink-muted)" }}>{safeHost(result.page.latestUrl)}</p>
                          </div>
                          <Badge variant="secondary" className="font-mono text-[10px]">{result.page.versionCount} v</Badge>
                        </div>
                        <p className="line-clamp-2 text-sm" style={{ color: "var(--ink-secondary)" }}>{result.matchedVersions[0]?.snippet || result.page.note || "No excerpt"}</p>
                        <div className="flex items-end justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start">
                          <p className="font-mono text-[10px]" style={{ color: "var(--ink-muted)" }}>{latestVersion ? formatTime(latestVersion.capturedAt) : "NO VERSION"}</p>
                          <div className="flex flex-wrap gap-2">
                            {result.tagNames.map((tagName) => (
                              <Badge key={tagName} variant="secondary" className="font-mono text-[10px]">{tagName}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </main>

      {/* Column 3: Detail Panel */}
      <section className="glass-subtle h-screen overflow-hidden border-l border-white/20 p-5 max-[1180px]:h-auto max-[1180px]:overflow-visible max-[1180px]:border-l-0 max-[1180px]:border-t max-[1180px]:p-4">
        {selectedPage ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-4">
            <Card className="glass">
              <CardHeader className="gap-3 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-[16px] leading-tight" style={{ color: "var(--ink-primary)" }}>{selectedPage.title}</CardTitle>
                  <Button variant="destructive" size="sm" onClick={() => void handleDeletePage(selectedPage)} disabled={busy}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <a href={selectedPage.latestUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-mono text-[11px] transition-colors hover:text-[var(--accent)]" style={{ color: "var(--ink-secondary)" }}>
                  <span className="line-clamp-2">{selectedPage.latestUrl}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </CardHeader>
            </Card>

            <Card className="glass">
              <CardContent className="p-5">
                <Textarea
                  value={pageNoteDraft}
                  placeholder={"Page note..."}
                  onChange={(event) => setPageNoteDraft(event.target.value)}
                  onBlur={() => {
                    if (pageNoteDraft !== selectedPage.note) {
                      void handleSavePageNote(selectedPage, pageNoteDraft);
                    }
                  }}
                />
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="grid gap-4 p-5">
                <div className="flex flex-wrap gap-2">
                  {library.tags.map((tag) => (
                    <Button
                      key={tag.id}
                      type="button"
                      variant={selectedPage.tagIds.includes(tag.id) ? "outline" : "secondary"}
                      size="sm"
                      className="max-w-full"
                      onClick={() => void toggleTagForSelectedPage(tag.id)}
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="font-mono text-[10px]">{tag.name}</span>
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 max-[760px]:grid-cols-1">
                  <Input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder={"> new-tag"} />
                  <Button variant="secondary" onClick={() => void handleCreateTag()} disabled={busy || !selectedPage}>
                    ADD
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-5">
                <ScrollArea className="h-full pr-3 max-[1180px]:h-auto">
                  <div className="grid gap-4">
                    {selectedVersions.map((version) => {
                      const matched = selectedResult?.matchedVersions.find((item) => item.version.id === version.id);
                      return (
                        <Card key={version.id} className="glass-subtle">
                          <CardContent className="grid gap-4 p-4">
                            <div className="flex items-start justify-between gap-3 max-[760px]:flex-col">
                              <p className="font-mono text-sm" style={{ color: "var(--ink-primary)" }}>{formatTime(version.capturedAt)}</p>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="secondary" size="icon" aria-label={"版本操作"}>
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => void handleOpenFile(version, "png")}>
                                    <ImageIcon className="size-4" />
                                    <span className="font-mono text-xs">Screenshot</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => void handleOpenFile(version, "full")}>
                                    <GalleryVerticalEnd className="size-4" />
                                    <span className="font-mono text-xs">Full Page</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => void handleOpenFile(version, "mhtml")}>
                                    <FileText className="size-4" />
                                    <span className="font-mono text-xs">MHTML</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onSelect={() => void handleDeleteVersion(version)} disabled={busy}>
                                    <Trash2 className="size-4" />
                                    <span className="font-mono text-xs">Delete</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>{matched?.snippet || version.extractedText.slice(0, 140) || "No text excerpt"}</p>
                            <Textarea defaultValue={version.note} placeholder={"Version note..."} onBlur={(event) => void handleSaveVersionNote(version, event.target.value)} />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="h-full border-dashed bg-white/30 backdrop-blur-md">
            <CardContent className="grid min-h-[320px] place-items-center p-6 text-center">
              <p className="font-mono text-sm" style={{ color: "var(--ink-muted)" }}>{"SELECT A PAGE"}</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function pickSelectedResult(results: SearchPageResult[], selectedPageId: string | null): SearchPageResult | undefined {
  if (!results.length) {
    return undefined;
  }
  return results.find((item) => item.page.id === selectedPageId) ?? results[0];
}

function countPagesForTag(pages: PageRecord[], tagId: string): number {
  return pages.filter((page) => page.tagIds.includes(tagId)).length;
}

function statusText(directoryStatus: DirectoryStatus): string {
  if (directoryStatus === "granted") {
    return "CONNECTED";
  }
  if (directoryStatus === "stale") {
    return "REAUTH REQUIRED";
  }
  return "SELECT ARCHIVE DIR";
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp);
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

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
  MoreHorizontal,
  Library,
  NotebookPen,
  Tags,
  CheckCircle
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";
import "../styles/globals.css";

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
  const [statusMessage, setStatusMessage] = useState("");
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
    });
    const nextResults = searchPages({ pages: snapshot.pages, versions: snapshot.versions, tags: snapshot.tags, query: deferredQuery, tagId: selectedTagId });
    const nextSelected = nextSelectedPageId ?? (nextResults.some((item) => item.page.id === selectedPageId) ? selectedPageId : nextResults[0]?.page.id ?? null);
    setSelectedPageId(nextSelected);
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
      setStatusMessage(response.error || "补写失败");
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
    if (!window.confirm("删除网页会连同全部历史版本与对应目录一起清理。确定继续吗？")) {
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
    <div className="grid h-screen overflow-hidden grid-cols-[260px_minmax(580px,1fr)_400px] gap-4 p-4 bg-[var(--bg-base)] max-[1240px]:h-auto max-[1240px]:grid-cols-1 max-[1240px]:overflow-visible">

      {/* Sidebar */}
      <aside className="flex flex-col gap-4 overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-sm)] max-[1240px]:h-auto">

        <div>
          <h1 className="text-[20px] font-bold tracking-[-0.04em] text-[var(--ink-primary)]">UIstash</h1>
          <p className="text-[12px] text-[var(--ink-tertiary)] mt-0.5">Personal Archive</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: directoryStatus === "granted" ? "var(--success)" : directoryStatus === "stale" ? "var(--accent)" : "var(--ink-ghost)" }} />
            <span className="text-[11px] text-[var(--ink-tertiary)]">{statusText(directoryStatus)}</span>
            <span className="text-[var(--ink-ghost)]">·</span>
            <span className="text-[11px] text-[var(--ink-tertiary)]">{library.pages.length} 页面</span>
          </div>
        </div>

        <Separator />

        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">Tags</p>
          <ScrollArea className="flex-1 max-[1240px]:h-auto pr-3">
            <div className="flex flex-col gap-1">
              <Button
                variant={!selectedTagId ? "outline" : "ghost"}
                size="sm"
                className="justify-between"
                onClick={() => setSelectedTagId(null)}
              >
                <span className="text-[13px]">全部网页</span>
                <span className="text-[var(--ink-ghost)] text-[12px]">{library.pages.length}</span>
              </Button>
              {library.tags.map((tag) => (
                <Button
                  key={tag.id}
                  variant={selectedTagId === tag.id ? "outline" : "ghost"}
                  size="sm"
                  className="justify-between"
                  onClick={() => setSelectedTagId(tag.id)}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="text-[13px] truncate">{tag.name}</span>
                  </span>
                  <span className="text-[var(--ink-ghost)] text-[12px] ml-1">{countPagesForTag(library.pages, tag.id)}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Button variant="ghost" size="sm" className="text-[var(--ink-tertiary)] mt-auto justify-start" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="size-3.5 mr-1.5" />
          设置
        </Button>
      </aside>

      {/* Main Content */}
      <main className="flex flex-col gap-4 overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] max-[1240px]:h-auto max-[1240px]:overflow-visible">

        {/* Top bar */}
        <div className="flex items-end justify-between px-5 py-4 gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">Browse</p>
            <h2 className="font-semibold text-[18px] tracking-[-0.03em] text-[var(--ink-primary)]">
              {selectedTagId ? library.tags.find((tag) => tag.id === selectedTagId)?.name || "全部网页" : "全部网页"}
            </h2>
          </div>
          <div className="relative w-full max-w-[320px]">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ink-ghost)] pointer-events-none" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索..." className="pl-9 h-9" />
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 px-5 pb-5 max-[1240px]:h-auto">
          <div className="flex flex-col gap-2.5 pb-4">
            {results.length === 0 ? (
              <div className="flex items-center justify-center h-[180px] text-[13px] text-[var(--ink-tertiary)] border border-dashed border-[var(--border-default)] rounded-[12px]">没有结果</div>
            ) : null}
            {results.map((result) => {
              const latestVersion = result.latestVersion;
              const thumbnailUrl = thumbnailUrls[result.page.id];
              const isSelected = selectedPage?.id === result.page.id;
              return (
                <button key={result.page.id} type="button" className="w-full text-left" onClick={() => setSelectedPageId(result.page.id)}>
                  <div
                    className={`w-full flex gap-4 p-4 rounded-[12px] border transition-all duration-150 ${
                      isSelected
                        ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-[var(--shadow-md)]"
                        : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="w-[140px] h-[100px] rounded-[8px] overflow-hidden bg-[var(--bg-sunken)] shrink-0">
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt={result.page.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[11px] text-[var(--ink-ghost)]">暂无截图</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink-primary)] line-clamp-2 leading-[1.25]">{result.page.title}</h3>
                        <p className="text-[11px] text-[var(--ink-tertiary)] mt-1">{safeHost(result.page.latestUrl)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-[var(--ink-ghost)]">{latestVersion ? formatTime(latestVersion.capturedAt) : "尚无版本"}</p>
                        <div className="flex gap-1">
                          {result.tagNames.slice(0, 2).map((name) => (
                            <span key={name} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-sunken)] text-[var(--ink-tertiary)]">{name}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </main>

      {/* Detail Panel */}
      <aside className="flex flex-col overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] max-[1240px]:h-auto max-[1240px]:overflow-visible">
        {selectedPage ? (
          <div className="flex flex-col h-full overflow-auto">
            {/* Page header */}
            <div className="px-5 pt-5 pb-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-tertiary)] mb-2">Inspector</p>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink-primary)] line-clamp-2 leading-[1.2]">{selectedPage.title}</h2>
              <a
                href={selectedPage.latestUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-[11px] text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors"
              >
                <span className="truncate max-w-[200px]">{selectedPage.latestUrl}</span>
                <ExternalLink className="size-2.5 shrink-0" />
              </a>
            </div>

            <Separator className="my-4 mx-5" />

            {/* Note */}
            <div className="px-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-tertiary)] mb-2">Note</p>
              <Textarea
                value={pageNoteDraft}
                placeholder="添加备注..."
                onChange={(event) => setPageNoteDraft(event.target.value)}
                onBlur={() => {
                  if (pageNoteDraft !== selectedPage.note) {
                    void handleSavePageNote(selectedPage, pageNoteDraft);
                  }
                }}
                className="min-h-[80px] text-[13px]"
              />
            </div>

            <Separator className="my-4 mx-5" />

            {/* Tags */}
            <div className="px-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-tertiary)] mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {library.tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => void toggleTagForSelectedPage(tag.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all duration-100 border ${
                      selectedPage.tagIds.includes(tag.id)
                        ? "bg-[var(--accent-soft)] border-[rgba(196,168,130,0.2)] text-[var(--ink-primary)]"
                        : "bg-[var(--bg-sunken)] border-transparent text-[var(--ink-tertiary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="新增标签" className="h-8 text-[12px]" />
                <Button variant="secondary" size="sm" onClick={() => void handleCreateTag()} disabled={busy || !selectedPage} className="shrink-0">添加</Button>
              </div>
            </div>

            <Separator className="my-4 mx-5" />

            {/* Versions */}
            <div className="flex-1 px-5 pb-4 overflow-hidden flex flex-col">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-tertiary)] mb-3">Versions</p>
              <ScrollArea className="flex-1 max-[1240px]:h-auto pr-3">
                <div className="flex flex-col gap-2.5 pb-2">
                  {selectedVersions.map((version) => {
                    const matched = selectedResult?.matchedVersions.find((item) => item.version.id === version.id);
                    return (
                      <div key={version.id} className="border border-[var(--border-default)] rounded-[12px] p-3.5 bg-[var(--bg-base)]">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="text-[13px] font-medium text-[var(--ink-primary)]">{formatTime(version.capturedAt)}</p>
                            <p className="text-[10px] text-[var(--ink-tertiary)] mt-0.5">{triggerLabel(version.trigger)}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="secondary" size="icon" className="size-[28px]" aria-label="版本操作">
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => void handleOpenFile(version, "png")}>
                                <ImageIcon className="size-3.5" /> 短截图
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void handleOpenFile(version, "full")}>
                                <GalleryVerticalEnd className="size-3.5" /> 长截图
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void handleOpenFile(version, "mhtml")}>
                                <FileText className="size-3.5" /> MHTML
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => void handleDeleteVersion(version)} disabled={busy}>
                                <Trash2 className="size-3.5" /> 删除版本
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-[12px] leading-6 text-[var(--ink-tertiary)] line-clamp-2 mb-2">{matched?.snippet || version.extractedText.slice(0, 120) || "暂无正文摘要"}</p>
                        <Textarea
                          defaultValue={version.note}
                          placeholder="版本备注..."
                          onBlur={(event) => void handleSaveVersionNote(version, event.target.value)}
                          className="min-h-[72px] text-[12px]"
                        />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Delete */}
            <div className="px-5 pb-5 mt-auto">
              <Button
                variant="ghost"
                size="sm"
                className="text-[var(--danger)] w-full justify-center hover:bg-[var(--danger-soft)]"
                onClick={() => void handleDeletePage(selectedPage)}
                disabled={busy}
              >
                <Trash2 className="size-3.5 mr-1.5" />
                删除网页
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[13px] text-[var(--ink-tertiary)] px-8 text-center">选择一个网页开始查看详情</div>
        )}
      </aside>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>设置与归档维护</DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="grid gap-5 px-6 py-5">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={handleChooseDirectory} disabled={busy} className="justify-start">
                <FolderOpen className="size-4 mr-2" />
                选择或重授权目录
              </Button>
              <Button variant="secondary" onClick={handleRetryQueue} disabled={busy} className="justify-start">
                <RefreshCw className="size-4 mr-2" />
                重试待处理队列
              </Button>
              <Button variant="secondary" onClick={() => void handleExport(false)} disabled={busy} className="justify-start">
                <Archive className="size-4 mr-2" />
                导出整库 ZIP
              </Button>
              <Button variant="secondary" onClick={() => void handleExport(true)} disabled={busy || !selectedTagId} className="justify-start">
                <GalleryVerticalEnd className="size-4 mr-2" />
                按标签导出 ZIP
              </Button>
            </div>

            <Card className="bg-[var(--bg-base)] shadow-none border-[var(--border-default)]">
              <CardContent className="grid gap-1 p-4">
                <p className="text-[12px] text-[var(--ink-tertiary)]">本地目录状态</p>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="size-3.5 text-[var(--success)]" />
                  <p className="text-[14px] font-medium text-[var(--ink-primary)]">{statusText(directoryStatus)}</p>
                </div>
                {statusMessage ? <p className="text-[12px] leading-6 text-[var(--ink-tertiary)]">{statusMessage}</p> : null}
              </CardContent>
            </Card>

            {library.queue.length > 0 ? (
              <>
                <Separator />
                <ScrollArea className="max-h-[280px] pr-3">
                  <div className="flex flex-col gap-2.5">
                    {library.queue.map((item) => (
                      <Card key={item.id} className="bg-[var(--bg-base)] shadow-none border-[var(--border-default)]">
                        <CardContent className="grid gap-2 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[13px] font-medium text-[var(--ink-primary)]">{item.title}</p>
                              <p className="text-[12px] text-[var(--ink-tertiary)] mt-0.5">{item.reason}</p>
                            </div>
                            <Button variant="destructive" size="sm" onClick={() => void handleDeleteQueueItem(item.id)} className="shrink-0">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          <Badge variant="secondary">{formatTime(item.requestedAt)}</Badge>
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
    </div>
  );
}

function pickSelectedResult(results: SearchPageResult[], selectedPageId: string | null): SearchPageResult | undefined {
  if (!results.length) return undefined;
  return results.find((item) => item.page.id === selectedPageId) ?? results[0];
}

function countPagesForTag(pages: PageRecord[], tagId: string): number {
  return pages.filter((page) => page.tagIds.includes(tagId)).length;
}

function statusText(directoryStatus: DirectoryStatus): string {
  if (directoryStatus === "granted") return "目录已连接";
  if (directoryStatus === "stale") return "目录待刷新";
  return "请先选择归档目录";
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
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

function triggerLabel(trigger: VersionRecord["trigger"]): string {
  if (trigger === "manual") return "手动归档";
  if (trigger === "auto") return "自动归档";
  return "补写队列";
}

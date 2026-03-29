import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Archive, ExternalLink, Eye, FolderOpen, Globe, ImageIcon, RefreshCw,
  Search, Settings2, Trash2, GalleryVerticalEnd, MoreHorizontal, Plus, X
} from "lucide-react";
import { db } from "../shared/db";
import {
  chooseDirectoryHandle, deleteSnapshotDirectory, ensureDirectoryPermission,
  exportLibraryZip, getPageDirectoryPath, getVersionDirectoryPath,
  readSnapshotFile, saveZipBlob, scanLibrarySnapshot,
  updatePageMetadataOnDisk, updateVersionMetadataOnDisk
} from "../shared/filesystem";
import { searchPages } from "../shared/search";
import type { DirectoryStatus, LibrarySnapshot, PageRecord, SearchPageResult, VersionRecord } from "../shared/types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";

const EMPTY_LIBRARY: LibrarySnapshot = { pages: [], versions: [], tags: [], queue: [] };
const MAX_THUMBNAILS = 48;

export function App() {
  const [library, setLibrary] = useState<LibrarySnapshot>(EMPTY_LIBRARY);
  const [directoryStatus, setDirectoryStatus] = useState<DirectoryStatus>("missing");
  const [query, setQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [pageNoteDraft, setPageNoteDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("正在加载...");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<VersionRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => { void reloadLibrary(); }, []);

  const results = useMemo(
    () => searchPages({ pages: library.pages, versions: library.versions, tags: library.tags, query: deferredQuery, tagId: selectedTagId }),
    [library.pages, library.versions, library.tags, deferredQuery, selectedTagId]
  );
  const selectedResult = pickSelectedResult(results, selectedPageId);
  const selectedPage = selectedResult?.page ?? null;
  const selectedVersions = useMemo(
    () => selectedPage
      ? library.versions.filter((v) => v.pageId === selectedPage.id).sort((a, b) => b.capturedAt - a.capturedAt)
      : [],
    [library.versions, selectedPage]
  );

  useEffect(() => { setPageNoteDraft(selectedPage?.note ?? ""); }, [selectedPage?.id, selectedPage?.note]);

  useEffect(() => {
    if (!previewVersion) { setPreviewUrl(null); return; }
    let revoked = false;
    let currentUrl: string | null = null;
    async function load() {
      try {
        const file = await readSnapshotFile(previewVersion.htmlPath);
        currentUrl = URL.createObjectURL(new Blob([file], { type: "text/html" }));
        if (!revoked) { setPreviewUrl(currentUrl); }
        else { URL.revokeObjectURL(currentUrl); }
      } catch {
        // htmlPath不存在时（旧存档），fallback到mhtmlPath
        try {
          const file = await readSnapshotFile(previewVersion.mhtmlPath);
          currentUrl = URL.createObjectURL(new Blob([file], { type: "multipart/related" }));
          if (!revoked) { setPreviewUrl(currentUrl); }
          else { URL.revokeObjectURL(currentUrl); }
        } catch { if (!revoked) { setPreviewUrl(null); } }
      }
    }
    void load();
    return () => { revoked = true; if (currentUrl) { URL.revokeObjectURL(currentUrl); } };
  }, [previewVersion]);

  useEffect(() => {
    let revoked = false;
    const createdUrls: string[] = [];
    async function loadThumbnails() {
      const nextEntries = await Promise.all(
        results.slice(0, MAX_THUMBNAILS).map(async (result) => {
          const latestVersion = result.latestVersion;
          if (!latestVersion) return null;
          try {
            const file = await readSnapshotFile(latestVersion.pngPath);
            const objectUrl = URL.createObjectURL(file);
            createdUrls.push(objectUrl);
            return [result.page.id, objectUrl] as const;
          } catch { return null; }
        })
      );
      if (revoked) { createdUrls.forEach((url) => URL.revokeObjectURL(url)); return; }
      setThumbnailUrls(Object.fromEntries(nextEntries.filter(Boolean) as Array<readonly [string, string]>));
    }
    if (directoryStatus === "granted") { void loadThumbnails(); } else { setThumbnailUrls({}); }
    return () => { revoked = true; createdUrls.forEach((url) => URL.revokeObjectURL(url)); };
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

  async function handleOpenPageInNewTab(page: PageRecord) {
    const latestVersion = library.versions.filter((v) => v.pageId === page.id).sort((a, b) => b.capturedAt - a.capturedAt)[0];
    if (!latestVersion) return;
    const permission = await ensureDirectoryPermission(false);
    if (permission !== "granted") { setDirectoryStatus(permission); setStatusMessage("需要重新授权目录"); return; }
    try {
      let file;
      let contentType = "text/html";
      try {
        file = await readSnapshotFile(latestVersion.htmlPath);
      } catch {
        // htmlPath不存在时（旧存档），fallback到mhtmlPath
        file = await readSnapshotFile(latestVersion.mhtmlPath);
        contentType = "multipart/related";
      }
      const url = URL.createObjectURL(new Blob([file], { type: contentType }));
      await chrome.tabs.create({ url });
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setStatusMessage("无法打开存档文件"); }
  }

  async function handleChooseDirectory() {
    try { setBusy(true); await chooseDirectoryHandle(); await chrome.runtime.sendMessage({ type: "processQueuedCaptures" }); setStatusMessage("目录已更新"); await reloadLibrary(); } finally { setBusy(false); }
  }
  async function handleRetryQueue() {
    setBusy(true);
    const response = (await chrome.runtime.sendMessage({ type: "processQueuedCaptures" })) as { ok?: boolean; result?: { processed: number }; error?: string };
    if (!response.ok) { setStatusMessage(response.error || "补录失败"); setBusy(false); return; }
    setStatusMessage("已处理 " + (response.result?.processed ?? 0) + " 条任务");
    await reloadLibrary(); setBusy(false);
  }
  async function handleDeleteQueueItem(queueId: string) {
    await db.queue.delete(queueId); setStatusMessage("队列任务已删除"); await reloadLibrary(selectedPageId);
  }
  async function handleCreateTag() {
    if (!selectedPage || !newTagName.trim()) return;
    const existingNames = library.tags.filter((tag) => selectedPage.tagIds.includes(tag.id)).map((tag) => tag.name);
    await updatePageMetadataOnDisk(selectedPage.pageKey, { tagNames: Array.from(new Set([...existingNames, newTagName.trim()])) });
    setNewTagName(""); setStatusMessage("标签已添加"); await reloadLibrary(selectedPage.id);
  }
  async function toggleTagForSelectedPage(tagId: string) {
    if (!selectedPage) return;
    const tag = library.tags.find((item) => item.id === tagId);
    if (!tag) return;
    const currentNames = library.tags.filter((item) => selectedPage.tagIds.includes(item.id)).map((item) => item.name);
    const nextNames = selectedPage.tagIds.includes(tagId) ? currentNames.filter((item) => item !== tag.name) : [...currentNames, tag.name];
    await updatePageMetadataOnDisk(selectedPage.pageKey, { tagNames: nextNames });
    setStatusMessage("标签已更新"); await reloadLibrary(selectedPage.id);
  }
  async function handleSavePageNote(page: PageRecord, note: string) {
    await updatePageMetadataOnDisk(page.pageKey, { note }); setStatusMessage("备注已保存"); await reloadLibrary(page.id);
  }
  async function handleSaveVersionNote(version: VersionRecord, note: string) {
    await updateVersionMetadataOnDisk(version.id, { note }); setStatusMessage("备注已保存"); await reloadLibrary(version.pageId);
  }
  async function handleOpenFile(version: VersionRecord, kind: "png" | "full") {
    const permission = await ensureDirectoryPermission(false);
    if (permission !== "granted") { setDirectoryStatus(permission); setStatusMessage("目录需要重新授权"); return; }
    const targetPath = kind === "full" ? version.fullPngPath : version.pngPath;
    try { const file = await readSnapshotFile(targetPath); const url = URL.createObjectURL(file); await chrome.tabs.create({ url }); setTimeout(() => URL.revokeObjectURL(url), 60_000); } catch { setStatusMessage("本地文件不存在或无法读取"); }
  }
  async function handleDeleteVersion(version: VersionRecord) {
    if (!window.confirm("删除这个版本后，会同时删除对应目录和本地文件。确定继续吗？")) return;
    setBusy(true);
    try { await deleteSnapshotDirectory(getVersionDirectoryPath(version)); setStatusMessage("版本已删除"); await reloadLibrary(version.pageId); } finally { setBusy(false); }
  }
  async function handleDeletePage(page: PageRecord) {
    if (!window.confirm("网页会连同全部历史版本与对应目录一起清理。确定继续吗？")) return;
    setBusy(true);
    try {
      const latestVersion = library.versions.filter((v) => v.pageId === page.id).sort((a, b) => b.capturedAt - a.capturedAt)[0];
      if (latestVersion) { await deleteSnapshotDirectory(getPageDirectoryPath(latestVersion)); }
      setStatusMessage("网页已删除"); await reloadLibrary();
    } finally { setBusy(false); }
  }
  async function handleExport(selectedOnly: boolean) {
    const permission = await ensureDirectoryPermission(false);
    if (permission !== "granted") { setDirectoryStatus(permission); setStatusMessage("导出前请先重新授权目录"); return; }
    setBusy(true);
    try {
      const blob = await exportLibraryZip({ pages: library.pages, versions: library.versions, tags: library.tags, queue: library.queue, selectedTagId: selectedOnly ? selectedTagId : null });
      const tag = library.tags.find((item) => item.id === selectedTagId);
      const fileName = selectedOnly && tag ? `UIstash-${slugify(tag.name)}.zip` : "UIstash-library.zip";
      await saveZipBlob(blob, fileName);
      setStatusMessage("导出任务已提交到浏览器下载");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--bg-canvas)" }}>

      {/* 顶部工具条 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--charcoal)]/10 px-6" style={{ background: "var(--bg-toolbar)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-3">
          <Globe className="size-5" style={{ color: "var(--accent)" }} />
          <h1 className="font-serif text-[18px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>UIstash</h1>
        </div>

        {/* 标签过滤器 */}
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedTagId(null)} className={"inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all duration-200 " + (selectedTagId === null ? "bg-[var(--charcoal)] text-white" : "bg-white text-[var(--text-secondary)] border border-[var(--charcoal)]/15 hover:border-[var(--charcoal)]/30")}>
            全部<span className="opacity-60">{library.pages.length}</span>
          </button>
          {library.tags.map((tag) => (
            <button key={tag.id} onClick={() => setSelectedTagId(tag.id)} className={"inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all duration-200 " + (selectedTagId === tag.id ? "text-white" : "bg-white text-[var(--text-secondary)] border border-[var(--charcoal)]/15 hover:border-[var(--charcoal)]/30")} style={selectedTagId === tag.id ? { backgroundColor: tag.color } : {}}>
              <span className="size-2 rounded-full" style={{ backgroundColor: selectedTagId === tag.id ? "rgba(255,255,255,0.7)" : tag.color }} />
              {tag.name}
            </button>
          ))}
        </div>

        {/* 搜索 */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <Input className="w-[200px] pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={"搜索页面..."} />
          </div>

          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon"><Settings2 className="size-4" /></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader><DialogTitle>设置</DialogTitle></DialogHeader>
              <Separator />
              <div className="grid gap-5 px-6 pb-6">
                <Card>
                  <CardContent className="grid gap-1 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>存储状态</p>
                    <p className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{statusText(directoryStatus)} · {library.pages.length} 个页面</p>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={handleChooseDirectory} disabled={busy} className="justify-start gap-2"><FolderOpen className="size-4" />选择目录</Button>
                  <Button variant="secondary" onClick={handleRetryQueue} disabled={busy} className="justify-start gap-2"><RefreshCw className="size-4" />重试队列</Button>
                  <Button variant="secondary" onClick={() => void handleExport(false)} disabled={busy} className="justify-start gap-2"><Archive className="size-4" />导出全部</Button>
                  <Button variant="secondary" onClick={() => void handleExport(true)} disabled={busy || !selectedTagId} className="justify-start gap-2"><GalleryVerticalEnd className="size-4" />按标签导出</Button>
                </div>
                {statusMessage ? <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{statusMessage}</p> : null}
                {library.queue.length > 0 ? (
                  <>
                    <Separator />
                    <ScrollArea className="max-h-[240px]">
                      <div className="grid gap-2">
                        <p className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>待处理队列 ({library.queue.length})</p>
                        {library.queue.map((item) => (
                          <Card key={item.id}>
                            <CardContent className="flex items-start justify-between gap-2 p-3">
                              <div>
                                <p className="text-sm font-medium line-clamp-1" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{item.reason}</p>
                              </div>
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => void handleDeleteQueueItem(item.id)}><Trash2 className="size-3" /></Button>
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

          {/* 存档预览弹窗 */}
          <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) { setPreviewOpen(false); setPreviewVersion(null); setPreviewUrl(null); } }}>
            <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col" showCloseButton={false}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--charcoal)]/10 shrink-0">
                <p className="font-serif text-[14px] font-semibold text-[var(--text-primary)] truncate pr-4">
                  {previewVersion ? selectedPage?.title : ""}
                </p>
                <button
                  onClick={() => { setPreviewOpen(false); setPreviewVersion(null); setPreviewUrl(null); }}
                  className="inline-flex size-8 items-center justify-center rounded-full bg-black/5 text-[var(--text-secondary)] hover:bg-black/10 hover:text-[var(--text-primary)] transition-colors shrink-0"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-white">
                {previewUrl ? (
                  <iframe src={previewUrl} className="w-full h-full min-h-[70vh] border-0" title="存档预览" />
                ) : previewVersion ? (
                  <div className="flex items-center justify-center h-64">
                    <RefreshCw className="size-8 animate-spin text-[var(--text-muted)]" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <ImageIcon className="size-12 text-[var(--text-muted)]" />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* 主体区域 */}
      <div className="flex flex-1 overflow-hidden">

        {/* 网格画廊 */}
        <main className="flex-1 overflow-y-auto p-6" style={{ background: "var(--bg-canvas)" }}>
          {results.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Globe className="size-16 opacity-15" style={{ color: "var(--text-muted)" }} />
              <p className="text-base" style={{ color: "var(--text-muted)" }}>暂无存档页面</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>使用扩展图标保存第一个页面</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
              {results.map((result) => {
                const latestVersion = result.latestVersion;
                const thumbnailUrl = thumbnailUrls[result.page.id];
                const isSelected = selectedPage?.id === result.page.id;
                return (
                  <button
                    key={result.page.id}
                    type="button"
                    className={"card-base relative w-full text-left overflow-hidden cursor-pointer " + (isSelected ? "ring-2 ring-[var(--accent)]" : "")}
                    onClick={() => setSelectedPageId(result.page.id)}
                  >
                    {/* 缩略图 */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-canvas)]">
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <ImageIcon className="size-10 opacity-20" style={{ color: "var(--text-muted)" }} />
                        </div>
                      )}
                      {/* Holographic overlay on hover */}
                      <div className="title-slide absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3">
                        <p className="text-[12px] font-medium leading-tight text-white line-clamp-2">{result.page.title}</p>
                        <p className="mt-1 text-[10px] text-white/70">{safeHost(result.page.latestUrl)}</p>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (latestVersion) { setPreviewVersion(latestVersion); setPreviewOpen(true); } }}
                          className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                        >
                          <Eye className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* 标签圆点 */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                      {result.tagNames.slice(0, 4).map((name) => {
                        const tag = library.tags.find((t) => t.name === name);
                        return <span key={name} className="size-2 rounded-full shadow-sm" style={{ backgroundColor: tag?.color ?? "#888" }} />;
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>

        {/* 侧边抽屉 */}
        {selectedPage && (
          <aside className="drawer-enter w-[420px] shrink-0 overflow-y-auto border-l border-[var(--charcoal)]/10" style={{ background: "var(--bg-canvas)" }}>
            {/* 页面信息 */}
            <div className="px-5 pt-4">
              <h2 className="font-serif text-[20px] font-bold leading-snug" style={{ color: "var(--text-primary)" }}>{selectedPage.title}</h2>
              <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{safeHost(selectedPage.latestUrl)} · {formatTime(selectedPage.capturedAt)}</p>
            </div>

            {/* 在新标签页查看存档 */}
            <div className="px-5 pt-3">
              <Button onClick={() => void handleOpenPageInNewTab(selectedPage)} className="w-full gap-2" variant="secondary">
                <ExternalLink className="size-4" />在新标签页查看存档网页
              </Button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* 标签 */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>标签</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {library.tags.map((tag) => {
                    const isActive = selectedPage.tagIds.includes(tag.id);
                    return (
                      <button key={tag.id} onClick={() => void toggleTagForSelectedPage(tag.id)}
                        className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200 " + (isActive ? "text-white" : "bg-white text-[var(--text-secondary)] border border-[var(--charcoal)]/15")}
                        style={isActive ? { backgroundColor: tag.color } : {}}
                      >
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: isActive ? "rgba(255,255,255,0.6)" : tag.color }} />
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input className="h-8 text-[12px]" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder={"新建标签"} />
                  <Button variant="secondary" size="sm" className="h-8 gap-1" onClick={() => void handleCreateTag()} disabled={busy || !newTagName.trim()}><Plus className="size-3" /></Button>
                </div>
              </div>

              <Separator />

              {/* 备注 */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>备注</p>
                <Textarea value={pageNoteDraft} placeholder={"为这个页面添加备注..."} onChange={(e) => setPageNoteDraft(e.target.value)} onBlur={() => { if (pageNoteDraft !== selectedPage.note) { void handleSavePageNote(selectedPage, pageNoteDraft); } }} className="min-h-[72px] text-[13px]" />
              </div>

              <Separator />

              {/* 版本历史 */}
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>版本历史 ({selectedVersions.length})</p>
                <div className="space-y-3">
                  {selectedVersions.map((version) => {
                    const matched = selectedResult?.matchedVersions.find((item) => item.version.id === version.id);
                    return (
                      <Card key={version.id}>
                        <CardContent className="space-y-2 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{formatTime(version.capturedAt)}</p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-6"><MoreHorizontal className="size-3" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => void handleOpenFile(version, "png")}><ImageIcon className="size-3.5" />截图</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleOpenFile(version, "full")}><GalleryVerticalEnd className="size-3.5" />全页截图</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => void handleDeleteVersion(version)}><Trash2 className="size-3.5" />删除</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <p className="text-[12px] line-clamp-2" style={{ color: "var(--text-secondary)" }}>{matched?.snippet || version.extractedText.slice(0, 100) || "无文本摘录"}</p>
                          <Textarea defaultValue={version.note} placeholder={"版本备注..."} onBlur={(e) => void handleSaveVersionNote(version, e.target.value)} className="min-h-[56px] text-[12px]" />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* 删除按钮 */}
              <div className="pt-4">
                <Button variant="destructive" className="w-full gap-2" onClick={() => void handleDeletePage(selectedPage)} disabled={busy}>
                  <Trash2 className="size-4" />删除此页面
                </Button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function pickSelectedResult(results: SearchPageResult[], selectedPageId: string | null): SearchPageResult | undefined {
  if (!results.length) return undefined;
  return results.find((item) => item.page.id === selectedPageId) ?? results[0];
}

function statusText(directoryStatus: DirectoryStatus): string {
  if (directoryStatus === "granted") return "已连接";
  if (directoryStatus === "stale") return "需重新授权";
  return "未选择目录";
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-\u4e00-\u9fa5]/g, "");
}

function safeHost(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

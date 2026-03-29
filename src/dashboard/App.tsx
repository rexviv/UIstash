import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ExternalLink,
  FolderOpen,
  Globe,
  ImageIcon,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  FileText,
  GalleryVerticalEnd,
  MoreHorizontal,
  Plus
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
  const [statusMessage, setStatusMessage] = useState("正在加载...");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
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
      const file = await readSnapshotFile(latestVersion.fullPngPath);
      const url = URL.createObjectURL(file);
      await chrome.tabs.create({ url });
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setStatusMessage("无法打开存档文件"); }
  }

  async function handleChooseDirectory() {
    try {
      setBusy(true);
      await chooseDirectoryHandle();
      await chrome.runtime.sendMessage({ type: "processQueuedCaptures" });
      setStatusMessage("目录已更新");
      await reloadLibrary();
    } finally { setBusy(false); }
  }

  async function handleRetryQueue() {
    setBusy(true);
    const response = (await chrome.runtime.sendMessage({ type: "processQueuedCaptures" })) as { ok?: boolean; result?: { processed: number }; error?: string };
    if (!response.ok) { setStatusMessage(response.error || "补录失败"); setBusy(false); return; }
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
    if (!selectedPage || !newTagName.trim()) return;
    const existingNames = library.tags.filter((tag) => selectedPage.tagIds.includes(tag.id)).map((tag) => tag.name);
    await updatePageMetadataOnDisk(selectedPage.pageKey, { tagNames: Array.from(new Set([...existingNames, newTagName.trim()])) });
    setNewTagName("");
    setStatusMessage("标签已添加");
    await reloadLibrary(selectedPage.id);
  }

  async function toggleTagForSelectedPage(tagId: string) {
    if (!selectedPage) return;
    const tag = library.tags.find((item) => item.id === tagId);
    if (!tag) return;
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
    if (permission !== "granted") { setDirectoryStatus(permission); setStatusMessage("目录需要重新授权"); return; }
    const targetPath = kind === "mhtml" ? version.mhtmlPath : kind === "full" ? version.fullPngPath : version.pngPath;
    try {
      const file = await readSnapshotFile(targetPath);
      const url = URL.createObjectURL(file);
      await chrome.tabs.create({ url });
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setStatusMessage("本地文件不存在或无法读取"); }
  }

  async function handleDeleteVersion(version: VersionRecord) {
    if (!window.confirm("删除这个版本后，会同时删除对应目录和本地文件。确定继续吗？")) return;
    setBusy(true);
    try {
      await deleteSnapshotDirectory(getVersionDirectoryPath(version));
      setStatusMessage("版本已删除");
      await reloadLibrary(version.pageId);
    } finally { setBusy(false); }
  }

  async function handleDeletePage(page: PageRecord) {
    if (!window.confirm("网页会连同全部历史版本与对应目录一起清理。确定继续吗？")) return;
    setBusy(true);
    try {
      const latestVersion = library.versions.filter((v) => v.pageId === page.id).sort((a, b) => b.capturedAt - a.capturedAt)[0];
      if (latestVersion) { await deleteSnapshotDirectory(getPageDirectoryPath(latestVersion)); }
      setStatusMessage("网页已删除");
      await reloadLibrary();
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
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--canvas)" }}>

      {/* 顶部导航 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/20 px-6" style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent)]/10">
            <Globe className="size-5" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-[16px] font-bold" style={{ color: "var(--ink-primary)" }}>UIstash</h1>
            <p className="text-[10px]" style={{ color: "var(--ink-muted)" }}>网页存档管理器</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={"size-2 rounded-full " + (directoryStatus === "granted" ? "bg-[var(--success)]" : directoryStatus === "stale" ? "bg-yellow-400" : "bg-[var(--ink-ghost)]")} />
            <span className="text-[11px]" style={{ color: "var(--ink-secondary)" }}>{statusText(directoryStatus)}</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: "var(--ink-muted)" }} />
            <Input className="w-[240px] pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={"搜索页面..."} />
          </div>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon"><Settings2 className="size-4" /></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px]">
              <DialogHeader className="px-6 pt-6"><DialogTitle>设置</DialogTitle></DialogHeader>
              <Separator />
              <div className="grid gap-6 px-6 pb-6">
                <Card className="bg-white/50 backdrop-blur-md">
                  <CardContent className="grid gap-1 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--ink-muted)" }}>存储状态</p>
                    <p className="text-sm" style={{ color: "var(--ink-primary)" }}>{statusText(directoryStatus)} · {library.pages.length} 个页面</p>
                  </CardContent>
                </Card>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={handleChooseDirectory} disabled={busy} className="justify-start gap-2"><FolderOpen className="size-4" />选择目录</Button>
                  <Button variant="secondary" onClick={handleRetryQueue} disabled={busy} className="justify-start gap-2"><RefreshCw className="size-4" />重试队列</Button>
                  <Button variant="secondary" onClick={() => void handleExport(false)} disabled={busy} className="justify-start gap-2"><Archive className="size-4" />导出全部</Button>
                  <Button variant="secondary" onClick={() => void handleExport(true)} disabled={busy || !selectedTagId} className="justify-start gap-2"><GalleryVerticalEnd className="size-4" />按标签导出</Button>
                </div>
                {statusMessage ? <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>{statusMessage}</p> : null}
                {library.queue.length > 0 ? (
                  <>
                    <Separator />
                    <ScrollArea className="max-h-[280px] pr-3">
                      <div className="grid gap-3">
                        <p className="text-[11px] font-semibold" style={{ color: "var(--ink-muted)" }}>待处理队列 ({library.queue.length})</p>
                        {library.queue.map((item) => (
                          <Card key={item.id} className="bg-white/50 backdrop-blur-md">
                            <CardContent className="grid gap-2 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium line-clamp-1" style={{ color: "var(--ink-primary)" }}>{item.title}</p>
                                <Button variant="ghost" size="icon" className="size-7" onClick={() => void handleDeleteQueueItem(item.id)}><Trash2 className="size-3" /></Button>
                              </div>
                              <p className="text-[11px]" style={{ color: "var(--ink-secondary)" }}>{item.reason}</p>
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
      </header>

      {/* 主体区域 */}
      <div className="flex flex-1 overflow-hidden">

        {/* 左侧边栏：标签过滤 */}
        <aside className="w-48 shrink-0 overflow-y-auto border-r border-white/20 p-4" style={{ background: "rgba(255,255,255,0.5)", backdropFilter: "blur(12px)" }}>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>筛选</p>
          <div className="space-y-2">
            <button onClick={() => setSelectedTagId(null)} className={"flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-200 " + (selectedTagId === null ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30" : "bg-white/60 text-[var(--ink-secondary)] border border-white/40")}>
              <span>全部页面</span>
              <span className="text-[11px] opacity-60">{library.pages.length}</span>
            </button>
            {library.tags.map((tag) => (
              <button key={tag.id} onClick={() => setSelectedTagId(tag.id)} className={"flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-200 " + (selectedTagId === tag.id ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30" : "bg-white/60 text-[var(--ink-secondary)] border border-white/40")}>
                <span className="flex items-center gap-2 truncate">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="truncate">{tag.name}</span>
                </span>
                <span className="text-[11px] opacity-60 ml-2 shrink-0">{countPagesForTag(library.pages, tag.id)}</span>
              </button>
            ))}
            {library.tags.length === 0 && <p className="text-[11px]" style={{ color: "var(--ink-muted)" }}>暂无标签</p>}
          </div>
        </aside>

        {/* 中间：页面列表 */}
        <main className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--canvas)" }}>
          <div className="flex-1 overflow-y-auto p-4">
            {results.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <Globe className="size-12 opacity-20" style={{ color: "var(--ink-muted)" }} />
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>暂无存档页面</p>
                <p className="text-[11px]" style={{ color: "var(--ink-ghost)" }}>使用扩展图标保存第一个页面</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {results.map((result) => {
                  const latestVersion = result.latestVersion;
                  const thumbnailUrl = thumbnailUrls[result.page.id];
                  const isSelected = selectedPage?.id === result.page.id;
                  return (
                    <button key={result.page.id} type="button" className={"w-full text-left rounded-2xl p-3 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] " + (isSelected ? "bg-white/90 backdrop-blur-xl border-2 border-[var(--accent)]/40 shadow-[var(--shadow-elevated)]" : "bg-white/70 backdrop-blur-md border border-white/40 hover:bg-white/85")} onClick={() => setSelectedPageId(result.page.id)}>
                      <div className="flex gap-3">
                        <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[var(--canvas-subtle)]">
                          {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="size-full object-cover" /> : (
                            <div className="flex size-full items-center justify-center"><ImageIcon className="size-6 opacity-30" style={{ color: "var(--ink-ghost)" }} /></div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-[14px] font-semibold line-clamp-1" style={{ color: "var(--ink-primary)" }}>{result.page.title}</h3>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">{result.page.versionCount} 版本</Badge>
                          </div>
                          <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>{safeHost(result.page.latestUrl)}</p>
                          <p className="mt-1 line-clamp-1 text-[12px]" style={{ color: "var(--ink-secondary)" }}>{result.matchedVersions[0]?.snippet || result.page.note || "无备注"}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {result.tagNames.slice(0, 3).map((name) => {
                              const tag = library.tags.find((t) => t.name === name);
                              return (
                                <span key={name} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: (tag?.color ?? "#888") + "20", color: tag?.color ?? "#888" }}>
                                  <span className="size-1.5 rounded-full" style={{ backgroundColor: tag?.color ?? "#888" }} />
                                  {name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* 右侧：详情预览 */}
        <section className="w-[380px] shrink-0 overflow-y-auto border-l border-white/20" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)" }}>
          {selectedPage ? (
            <div className="flex flex-col">
              {/* 页面头部 */}
              <div className="border-b border-white/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[15px] font-bold leading-snug" style={{ color: "var(--ink-primary)" }}>{selectedPage.title}</h2>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => void handleDeletePage(selectedPage)} disabled={busy}><Trash2 className="size-4" /></Button>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>{safeHost(selectedPage.latestUrl)}</p>
                <Button onClick={() => void handleOpenPageInNewTab(selectedPage)} className="mt-3 w-full gap-2" size="sm">
                  <ExternalLink className="size-3.5" />
                  在新标签页查看存档
                </Button>
              </div>
              {/* 标签 */}
              <div className="border-b border-white/20 p-4">
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>标签</p>
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {library.tags.map((tag) => {
                    const isActive = selectedPage.tagIds.includes(tag.id);
                    return (
                      <button key={tag.id} onClick={() => void toggleTagForSelectedPage(tag.id)} className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200 " + (isActive ? "text-white" : "bg-white/60 text-[var(--ink-secondary)]")} style={isActive ? { backgroundColor: tag.color } : {}}>
                        <span className="size-1.5 rounded-full bg-white/50" />
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input className="h-8 text-[12px]" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder={"新建标签"} />
                  <Button variant="secondary" size="sm" className="h-8 gap-1" onClick={() => void handleCreateTag()} disabled={busy || !selectedPage || !newTagName.trim()}>
                    <Plus className="size-3" />添加
                  </Button>
                </div>
              </div>
              {/* 备注 */}
              <div className="border-b border-white/20 p-4">
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>备注</p>
                <Textarea value={pageNoteDraft} placeholder={"为这个页面添加备注..."} onChange={(e) => setPageNoteDraft(e.target.value)} onBlur={() => { if (pageNoteDraft !== selectedPage.note) { void handleSavePageNote(selectedPage, pageNoteDraft); } }} className="min-h-[80px] text-[13px]" />
              </div>
              {/* 版本历史 */}
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>版本历史 ({selectedVersions.length})</p>
                <div className="space-y-3">
                  {selectedVersions.map((version) => {
                    const matched = selectedResult?.matchedVersions.find((item) => item.version.id === version.id);
                    return (
                      <Card key={version.id} className="bg-white/60 backdrop-blur-md">
                        <CardContent className="space-y-3 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] font-medium" style={{ color: "var(--ink-primary)" }}>{formatTime(version.capturedAt)}</p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-3.5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => void handleOpenFile(version, "png")}><ImageIcon className="size-3.5" />截图</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleOpenFile(version, "full")}><GalleryVerticalEnd className="size-3.5" />全页截图</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleOpenFile(version, "mhtml")}><FileText className="size-3.5" />MHTML</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => void handleDeleteVersion(version)}><Trash2 className="size-3.5" />删除</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <p className="text-[12px] line-clamp-2" style={{ color: "var(--ink-secondary)" }}>{matched?.snippet || version.extractedText.slice(0, 120) || "无文本摘录"}</p>
                          <Textarea defaultValue={version.note} placeholder={"版本备注..."} onBlur={(e) => void handleSaveVersionNote(version, e.target.value)} className="min-h-[60px] text-[12px]" />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
              <Globe className="size-10 opacity-20" style={{ color: "var(--ink-muted)" }} />
              <p className="text-sm" style={{ color: "var(--ink-muted)" }}>选择一个页面</p>
              <p className="text-[11px] text-center" style={{ color: "var(--ink-ghost)" }}>点击左侧列表中的页面查看详情</p>
            </div>
          )}
        </section>

      </div>
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

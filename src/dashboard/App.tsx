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
  const [statusMessage, setStatusMessage] = useState("\u6b63\u5728\u52a0\u8f7d\u76ee\u5f55\u5185\u5bb9...");
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
      setStatusMessage("\u76ee\u5f55\u5df2\u66f4\u65b0");
      await reloadLibrary();
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryQueue() {
    setBusy(true);
    const response = (await chrome.runtime.sendMessage({ type: "processQueuedCaptures" })) as { ok?: boolean; result?: { processed: number }; error?: string };
    if (!response.ok) {
      setStatusMessage(response.error || "\u8865\u5199\u5931\u8d25");
      setBusy(false);
      return;
    }
    setStatusMessage("\u5df2\u5904\u7406 " + (response.result?.processed ?? 0) + " \u6761\u4efb\u52a1");
    await reloadLibrary();
    setBusy(false);
  }

  async function handleDeleteQueueItem(queueId: string) {
    await db.queue.delete(queueId);
    setStatusMessage("\u961f\u5217\u4efb\u52a1\u5df2\u5220\u9664");
    await reloadLibrary(selectedPageId);
  }

  async function handleCreateTag() {
    if (!selectedPage || !newTagName.trim()) {
      return;
    }
    const existingNames = library.tags.filter((tag) => selectedPage.tagIds.includes(tag.id)).map((tag) => tag.name);
    await updatePageMetadataOnDisk(selectedPage.pageKey, { tagNames: Array.from(new Set([...existingNames, newTagName.trim()])) });
    setNewTagName("");
    setStatusMessage("\u6807\u7b7e\u5df2\u66f4\u65b0");
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
    setStatusMessage("\u6807\u7b7e\u5df2\u66f4\u65b0");
    await reloadLibrary(selectedPage.id);
  }

  async function handleSavePageNote(page: PageRecord, note: string) {
    await updatePageMetadataOnDisk(page.pageKey, { note });
    setStatusMessage("\u5907\u6ce8\u5df2\u4fdd\u5b58");
    await reloadLibrary(page.id);
  }

  async function handleSaveVersionNote(version: VersionRecord, note: string) {
    await updateVersionMetadataOnDisk(version.id, { note });
    setStatusMessage("\u5907\u6ce8\u5df2\u4fdd\u5b58");
    await reloadLibrary(version.pageId);
  }

  async function handleOpenFile(version: VersionRecord, kind: "mhtml" | "png" | "full") {
    const permission = await ensureDirectoryPermission(false);
    if (permission !== "granted") {
      setDirectoryStatus(permission);
      setStatusMessage("\u76ee\u5f55\u9700\u8981\u91cd\u65b0\u6388\u6743");
      return;
    }

    const targetPath = kind === "mhtml" ? version.mhtmlPath : kind === "full" ? version.fullPngPath : version.pngPath;
    try {
      const file = await readSnapshotFile(targetPath);
      const url = URL.createObjectURL(file);
      await chrome.tabs.create({ url });
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setStatusMessage("\u672c\u5730\u6587\u4ef6\u4e0d\u5b58\u5728\u6216\u65e0\u6cd5\u8bfb\u53d6");
    }
  }

  async function handleDeleteVersion(version: VersionRecord) {
    if (!window.confirm("\u5220\u9664\u8fd9\u4e2a\u7248\u672c\u540e\uff0c\u4f1a\u540c\u65f6\u5220\u9664\u5bf9\u5e94\u76ee\u5f55\u548c\u672c\u5730\u6587\u4ef6\u3002\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f")) {
      return;
    }
    setBusy(true);
    try {
      await deleteSnapshotDirectory(getVersionDirectoryPath(version));
      setStatusMessage("\u7248\u672c\u5df2\u5220\u9664");
      await reloadLibrary(version.pageId);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePage(page: PageRecord) {
    if (!window.confirm("\u5220\u9664\u7f51\u9875\u4f1a\u8fde\u540c\u5168\u90e8\u5386\u53f2\u7248\u672c\u4e0e\u5bf9\u5e94\u76ee\u5f55\u4e00\u8d77\u6e05\u7406\u3002\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f")) {
      return;
    }
    setBusy(true);
    try {
      const latestVersion = library.versions.filter((version) => version.pageId === page.id).sort((a, b) => b.capturedAt - a.capturedAt)[0];
      if (latestVersion) {
        await deleteSnapshotDirectory(getPageDirectoryPath(latestVersion));
      }
      setStatusMessage("\u7f51\u9875\u5df2\u5220\u9664");
      await reloadLibrary();
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(selectedOnly: boolean) {
    const permission = await ensureDirectoryPermission(false);
    if (permission !== "granted") {
      setDirectoryStatus(permission);
      setStatusMessage("\u5bfc\u51fa\u524d\u8bf7\u5148\u91cd\u65b0\u6388\u6743\u76ee\u5f55");
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
      setStatusMessage("\u5bfc\u51fa\u4efb\u52a1\u5df2\u63d0\u4ea4\u5230\u6d4f\u89c8\u5668\u4e0b\u8f7d");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-screen overflow-hidden grid-cols-[288px_minmax(520px,1fr)_420px] bg-transparent max-[1180px]:h-auto max-[1180px]:overflow-visible max-[1180px]:grid-cols-1">
      <aside className="grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-5 overflow-hidden border-r border-[#e5ded4] bg-[#f7f2eb]/70 p-5 backdrop-blur max-[1180px]:h-auto max-[1180px]:overflow-visible max-[1180px]:border-r-0 max-[1180px]:border-b max-[1180px]:p-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#635e56]">UIstash</h1>
        </div>

        <Card className="min-h-0 border-[#e3ddd4] bg-white/72 shadow-none">
          <CardContent className="min-h-0 pt-5">
            <ScrollArea className="h-full pr-3 max-[1180px]:h-auto">
              <div className="grid gap-2 pb-2">
                <Button variant={selectedTagId ? "secondary" : "outline"} className="justify-between" onClick={() => setSelectedTagId(null)}>
                  <span>{"\u5168\u90e8\u7f51\u9875"}</span>
                  <Badge variant="secondary">{library.pages.length}</Badge>
                </Button>
                {library.tags.map((tag) => (
                  <Button
                    key={tag.id}
                    variant={selectedTagId === tag.id ? "outline" : "secondary"}
                    className="justify-between"
                    onClick={() => setSelectedTagId(tag.id)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
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
            <Button variant="secondary" className="justify-center gap-2">
              <Settings2 className="size-4" />
              {"\u8bbe\u7f6e"}
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#ddd6cc] bg-white/92 p-0 sm:max-w-[720px]">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>{"\u8bbe\u7f6e"}</DialogTitle>

            </DialogHeader>
            <Separator />
            <div className="grid gap-6 px-6 pb-6">
              <Card className="border-[#e3ddd4] bg-[#fcfaf6] shadow-none">
                <CardContent className="grid gap-1 p-4">
                  <p className="text-sm text-[#8b8479]">{"\u672c\u5730\u5b58\u50a8\u72b6\u6001"}</p>
                  <p className="text-base font-semibold text-[#635e56]">{statusText(directoryStatus)}</p>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={handleChooseDirectory} disabled={busy} className="justify-start">
                  <FolderOpen className="size-4" />
                  {"\u9009\u62e9\u6216\u91cd\u6388\u6743\u76ee\u5f55"}
                </Button>
                <Button variant="secondary" onClick={handleRetryQueue} disabled={busy} className="justify-start">
                  <RefreshCw className="size-4" />
                  {"\u91cd\u8bd5\u5f85\u5904\u7406\u961f\u5217"}
                </Button>
                <Button variant="secondary" onClick={() => void handleExport(false)} disabled={busy} className="justify-start">
                  <Archive className="size-4" />
                  {"\u5bfc\u51fa\u6574\u5e93 ZIP"}
                </Button>
                <Button variant="secondary" onClick={() => void handleExport(true)} disabled={busy || !selectedTagId} className="justify-start">
                  <GalleryVerticalEnd className="size-4" />
                  {"\u6309\u6807\u7b7e\u5bfc\u51fa ZIP"}
                </Button>
              </div>

              {statusMessage ? <p className="text-sm leading-6 text-[#6d675e]">{statusMessage}</p> : null}

              {library.queue.length > 0 ? (
                <>
                  <Separator />
                  <ScrollArea className="max-h-[320px] pr-3">
                    <div className="grid gap-3">
                      {library.queue.map((item) => (
                        <Card key={item.id} className="border-[#e3ddd4] bg-[#fcfaf6] shadow-none">
                          <CardContent className="grid gap-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-base font-semibold tracking-[-0.02em] text-[#635e56]">{item.title}</p>
                                <p className="mt-1 text-sm leading-6 text-[#6d675e]">{item.reason}</p>
                              </div>
                              <Button variant="destructive" size="sm" onClick={() => void handleDeleteQueueItem(item.id)}>
                                <Trash2 className="size-4" />
                                {"\u5220\u9664"}
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
      </aside>

      <main className="grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-6 max-[1180px]:h-auto max-[1180px]:overflow-visible max-[1180px]:p-4">
        <Card className="border-[#e3ddd4] bg-white/76">
          <CardContent className="flex items-end justify-between gap-4 p-5 max-[860px]:flex-col max-[860px]:items-stretch">
            <CardTitle className="text-[26px]">{selectedTagId ? library.tags.find((tag) => tag.id === selectedTagId)?.name || "\u5168\u90e8\u7f51\u9875" : "\u5168\u90e8\u7f51\u9875"}</CardTitle>
            <div className="w-full max-w-[380px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#948d82]" />
                <Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={"\u641c\u7d22"} />
              </div>
            </div>
          </CardContent>
        </Card>

        <ScrollArea className="h-full pr-3">
          <div className="grid gap-4 pb-4">
            {results.length === 0 ? (
              <Card className="h-full border-dashed border-[#ddd6cc] bg-white/70 shadow-none">
                <CardContent className="grid min-h-[220px] place-items-center p-6 text-center text-[#6d675e]">{"\u6ca1\u6709\u7ed3\u679c"}</CardContent>
              </Card>
            ) : null}
            {results.map((result) => {
              const latestVersion = result.latestVersion;
              const thumbnailUrl = thumbnailUrls[result.page.id];
              return (
                <button key={result.page.id} type="button" className="text-left" onClick={() => setSelectedPageId(result.page.id)}>
                  <Card className={selectedPage?.id === result.page.id ? "border-[#cfc3b3] bg-[#faf6ef]" : "border-[#e3ddd4] bg-white/78"}>
                    <CardContent className="grid grid-cols-[168px_1fr] gap-4 p-4 max-[760px]:grid-cols-1">
                      <div className="relative overflow-hidden rounded-xl border border-[#e3ddd4] bg-[#f5efe6]">
                        {thumbnailUrl ? (
                          <img src={thumbnailUrl} alt={result.page.title} className="h-[116px] w-full object-cover" />
                        ) : (
                          <div className="grid h-[116px] place-items-center text-sm font-semibold text-[#7c7569]">{"\u6682\u65e0\u77ed\u622a\u56fe"}</div>
                        )}
                      </div>

                      <div className="grid gap-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-xl font-semibold tracking-[-0.02em] text-[#635e56]">{result.page.title}</h3>
                            <p className="mt-1 text-sm text-[#8b8479]">{safeHost(result.page.latestUrl)}</p>
                          </div>
                          <Badge variant="secondary">{result.page.versionCount}</Badge>
                        </div>
                        <p className="line-clamp-2 text-sm leading-6 text-[#6d675e]">{result.matchedVersions[0]?.snippet || result.page.note || "\u6682\u65e0\u6458\u8981"}</p>
                        <div className="flex items-end justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start">
                          <p className="text-xs text-[#8b8479]">{latestVersion ? formatTime(latestVersion.capturedAt) : "\u5c1a\u65e0\u7248\u672c"}</p>
                          <div className="flex flex-wrap gap-2">
                            {result.tagNames.map((tagName) => (
                              <Badge key={tagName} variant="secondary">{tagName}</Badge>
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

      <section className="h-screen overflow-hidden border-l border-[#e5ded4] bg-white/74 p-5 backdrop-blur max-[1180px]:h-auto max-[1180px]:overflow-visible max-[1180px]:border-l-0 max-[1180px]:border-t max-[1180px]:p-4">
        {selectedPage ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-4">
            <Card className="border-[#e3ddd4] bg-white/78 shadow-none">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-[26px] leading-[1.15]">{selectedPage.title}</CardTitle>
                  <Button variant="destructive" size="sm" onClick={() => void handleDeletePage(selectedPage)} disabled={busy}>
                    <Trash2 className="size-4" />
                    {"\u5220\u9664\u7f51\u9875"}
                  </Button>
                </div>
                <a href={selectedPage.latestUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-[#7e776b] hover:text-[#635e56]">
                  <span className="line-clamp-2">{selectedPage.latestUrl}</span>
                  <ExternalLink className="size-4 shrink-0" />
                </a>
              </CardHeader>
            </Card>

            <Card className="border-[#e3ddd4] bg-white/78 shadow-none">
              <CardContent className="p-5">
                <Textarea
                  value={pageNoteDraft}
                  placeholder={"\u5907\u6ce8"}
                  onChange={(event) => setPageNoteDraft(event.target.value)}
                  onBlur={() => {
                    if (pageNoteDraft !== selectedPage.note) {
                      void handleSavePageNote(selectedPage, pageNoteDraft);
                    }
                  }}
                />
              </CardContent>
            </Card>

            <Card className="border-[#e3ddd4] bg-white/78 shadow-none">
              <CardContent className="grid gap-4 p-5">
                <div className="flex flex-wrap gap-2">
                  {library.tags.map((tag) => (
                    <Button
                      key={tag.id}
                      type="button"
                      variant={selectedPage.tagIds.includes(tag.id) ? "outline" : "secondary"}
                      size="sm"
                      className="rounded-full px-3"
                      onClick={() => void toggleTagForSelectedPage(tag.id)}
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 max-[760px]:grid-cols-1">
                  <Input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder={"\u65b0\u6807\u7b7e"} />
                  <Button variant="secondary" onClick={() => void handleCreateTag()} disabled={busy || !selectedPage}>
                    {"\u6dfb\u52a0"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#e3ddd4] bg-white/78 shadow-none">
              <CardContent className="p-5">
                <ScrollArea className="h-full pr-3 max-[1180px]:h-auto">
                  <div className="grid gap-4">
                    {selectedVersions.map((version) => {
                      const matched = selectedResult?.matchedVersions.find((item) => item.version.id === version.id);
                      return (
                        <Card key={version.id} className="border-[#e7e0d7] bg-[#fcfaf6] shadow-none">
                          <CardContent className="grid gap-4 p-4">
                            <div className="flex items-start justify-between gap-3 max-[760px]:flex-col">
                              <p className="text-lg font-semibold tracking-[-0.02em] text-[#635e56]">{formatTime(version.capturedAt)}</p>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="secondary" size="icon" aria-label={"\u7248\u672c\u64cd\u4f5c"}>
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => void handleOpenFile(version, "png")}>
                                    <ImageIcon className="size-4" />
                                    {"\u77ed\u622a\u56fe"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => void handleOpenFile(version, "full")}>
                                    <GalleryVerticalEnd className="size-4" />
                                    {"\u957f\u622a\u56fe"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => void handleOpenFile(version, "mhtml")}>
                                    <FileText className="size-4" />
                                    MHTML
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onSelect={() => void handleDeleteVersion(version)} disabled={busy}>
                                    <Trash2 className="size-4" />
                                    {"\u5220\u9664\u7248\u672c"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <p className="text-sm leading-6 text-[#6d675e]">{matched?.snippet || version.extractedText.slice(0, 140) || "\u6682\u65e0\u6b63\u6587\u6458\u8981"}</p>
                            <Textarea defaultValue={version.note} placeholder={"\u5907\u6ce8"} onBlur={(event) => void handleSaveVersionNote(version, event.target.value)} />
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
          <Card className="h-full border-dashed border-[#ddd6cc] bg-white/70 shadow-none">
            <CardContent className="grid min-h-[320px] place-items-center p-6 text-center text-[#6d675e]">{"\u9009\u62e9\u4e00\u4e2a\u7f51\u9875"}</CardContent>
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
    return "\u5df2\u8fde\u63a5\u6388\u6743\u76ee\u5f55";
  }
  if (directoryStatus === "stale") {
    return "\u76ee\u5f55\u6388\u6743\u9700\u8981\u5237\u65b0";
  }
  return "\u8bf7\u5148\u9009\u62e9\u5f52\u6863\u76ee\u5f55";
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






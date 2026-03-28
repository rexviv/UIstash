import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LibraryBig, Settings2, ArrowRight } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { scanLibrarySnapshot } from "../shared/filesystem";
import type { ActivePageSummary, DirectoryStatus, TagRecord } from "../shared/types";
import { directoryStatusLabel, formatCaptured, normalizeTags, popupArchiveState, popupMetaText, popupPageTitle, popupUrlText } from "./normalizeTags";
import "../styles/globals.css";

function PopupApp() {
  const [summary, setSummary] = useState<ActivePageSummary | null>(null);
  const [availableTags, setAvailableTags] = useState<TagRecord[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTags, setNewTags] = useState("");
  const [pageNote, setPageNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");

    html.style.width = "392px";
    html.style.height = "600px";
    body.style.width = "392px";
    body.style.height = "600px";
    body.style.overflow = "hidden";
    if (root) {
      root.style.width = "392px";
      root.style.height = "600px";
    }

    void refresh();
  }, []);

  const mergedTagNames = useMemo(() => normalizeTags(selectedTags, newTags), [selectedTags, newTags]);
  const saveDisabled = busy || !summary?.isSupported;
  const archiveState = popupArchiveState(summary);
  const metaText = popupMetaText(summary);
  const pageTitle = popupPageTitle(summary);
  const pageUrl = popupUrlText(summary);
  const directoryText = directoryStatusLabel(summary?.directoryStatus ?? "missing");
  const host = safeHost(summary?.url);

  async function refresh() {
    const [summaryResponse, snapshot] = await Promise.all([
      chrome.runtime.sendMessage({ type: "getActivePageSummary" }) as Promise<{ ok?: boolean; result?: ActivePageSummary; error?: string }>,
      scanLibrarySnapshot()
    ]);

    setAvailableTags(snapshot.tags);

    if (!summaryResponse.ok || !summaryResponse.result) {
      return;
    }

    const nextSummary = summaryResponse.result;
    setSummary(nextSummary);
    const activeTagNames = snapshot.tags.filter((tag) => nextSummary.page?.tagIds.includes(tag.id)).map((tag) => tag.name);
    setSelectedTags(activeTagNames);
    setPageNote(nextSummary.page?.note ?? "");
  }

  async function handleSave() {
    if (!summary?.isSupported) {
      return;
    }

    setBusy(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "captureCurrentPage",
        tagNames: mergedTagNames,
        pageNote
      })) as { ok?: boolean; result?: { status: string }; error?: string };

      if (!response.ok) {
        return;
      }

      setNewTags("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function toggleTag(name: string) {
    setSelectedTags((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  return (
    <main className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-base)] p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.04em] text-[var(--ink-primary)]">UIstash</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant={archiveState === "已归档" ? "success" : "secondary"}>{archiveState}</Badge>
            {summary?.pendingQueueCount && summary.pendingQueueCount > 0 ? (
              <Badge variant="secondary">{summary.pendingQueueCount} 待补写</Badge>
            ) : null}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => chrome.runtime.openOptionsPage()} disabled={busy} aria-label="打开管理页">
          <Settings2 className="size-4" />
        </Button>
      </div>

      {/* Page Card */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-tertiary)] mb-2">{metaText}</p>
          <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--ink-primary)] leading-[1.2] mb-1 line-clamp-2">{pageTitle}</h2>
          <p className="text-[12px] text-[var(--ink-tertiary)] mb-3 line-clamp-1">{pageUrl}</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium text-[var(--ink-primary)]">{host}</p>
              <p className="text-[11px] text-[var(--ink-tertiary)]">{summary?.latestVersion ? formatCaptured(summary.latestVersion.capturedAt) : directoryText}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => chrome.runtime.openOptionsPage()}>
              管理页 <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <div className="mb-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-tertiary)] mb-2">标签</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {availableTags.length > 0 ? (
            availableTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.name)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all duration-100 border ${
                  selectedTags.includes(tag.name)
                    ? "bg-[var(--accent-soft)] border-[rgba(196,168,130,0.2)] text-[var(--ink-primary)]"
                    : "bg-[var(--bg-sunken)] border-transparent text-[var(--ink-tertiary)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))
          ) : (
            <p className="text-[12px] text-[var(--ink-ghost)]">还没有标签</p>
          )}
        </div>
        <Input value={newTags} onChange={(event) => setNewTags(event.target.value)} placeholder="添加标签，多个可用逗号分隔" />
      </div>

      {/* Note */}
      <Textarea
        value={pageNote}
        onChange={(event) => setPageNote(event.target.value)}
        placeholder="写一句简短备注，帮助以后回看。"
        className="flex-1 mb-4 min-h-[100px]"
      />

      {/* Footer Actions */}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => chrome.runtime.openOptionsPage()} disabled={busy} className="px-4">
          设置
        </Button>
        <Button onClick={handleSave} disabled={saveDisabled} className="flex-1 justify-center font-semibold">
          <LibraryBig className="size-4" />
          保存
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </main>
  );
}

function safeHost(url?: string) {
  if (!url) {
    return "未识别站点";
  }
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>
);

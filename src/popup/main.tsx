import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Archive, ExternalLink, Plus, Settings2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { scanLibrarySnapshot } from "../shared/filesystem";
import type { ActivePageSummary, TagRecord } from "../shared/types";
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
    if (root) { root.style.width = "392px"; root.style.height = "600px"; }
    void refresh();
  }, []);

  const mergedTagNames = useMemo(() => normalizeTags(selectedTags, newTags), [selectedTags, newTags]);
  const saveDisabled = busy || !summary?.isSupported;

  async function refresh() {
    const [summaryResponse, snapshot] = await Promise.all([
      chrome.runtime.sendMessage({ type: "getActivePageSummary" }) as Promise<{ ok?: boolean; result?: ActivePageSummary; error?: string }>,
      scanLibrarySnapshot()
    ]);
    setAvailableTags(snapshot.tags);
    if (!summaryResponse.ok || !summaryResponse.result) return;
    const nextSummary = summaryResponse.result;
    setSummary(nextSummary);
    const activeTagNames = snapshot.tags.filter((tag) => nextSummary.page?.tagIds.includes(tag.id)).map((tag) => tag.name);
    setSelectedTags(activeTagNames);
    setPageNote(nextSummary.page?.note ?? "");
  }

  async function handleSave() {
    if (!summary?.isSupported) return;
    setBusy(true);
    try {
      const response = (await chrome.runtime.sendMessage({ type: "captureCurrentPage", tagNames: mergedTagNames, pageNote })) as { ok?: boolean; result?: { status: string }; error?: string };
      if (!response.ok) return;
      setNewTags("");
      await refresh();
    } finally { setBusy(false); }
  }

  function toggleTag(name: string) {
    setSelectedTags((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  return (
    <main className="flex h-full w-full flex-col overflow-hidden" style={{ background: "var(--bg-canvas)" }}>
      {/* 顶部栏 */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--charcoal)]/10 px-4">
        <div className="flex items-center gap-2">
          <Globe className="size-4" style={{ color: "var(--accent)" }} />
          <span className="font-serif text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>UIstash</span>
          {summary?.pendingQueueCount !== undefined && summary.pendingQueueCount > 0 && (
            <Badge variant="default" className="ml-1">{summary.pendingQueueCount} 待处理</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => chrome.runtime.openOptionsPage()} disabled={busy}>
          <Settings2 className="size-3.5" />
        </Button>
      </div>

      {/* 主内容 */}
      <div className="flex flex-1 flex-col overflow-hidden p-4 gap-4">
        {/* 截图预览区 */}
        <Card className="relative overflow-hidden shrink-0" style={{ aspectRatio: "16/9" }}>
          {summary?.page ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-canvas)]">
                <Globe className="size-10 opacity-20" style={{ color: "var(--text-muted)" }} />
              </div>
              <Badge variant="success" className="absolute top-3 left-3">已存档</Badge>
            </>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-[var(--bg-canvas)]">
              <Globe className="size-10 opacity-15" style={{ color: "var(--text-muted)" }} />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>当前页面</p>
            </div>
          )}
        </Card>

        {/* 页面信息 */}
        <div className="shrink-0">
          <h2 className="font-serif text-[15px] font-semibold leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
            {summary?.title || "当前网页"}
          </h2>
          <p className="mt-0.5 font-mono text-[10px] line-clamp-1" style={{ color: "var(--text-muted)" }}>
            {summary?.url || "此页面不支持存档"}
          </p>
        </div>

        {/* 标签 */}
        <div className="shrink-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>标签</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag.name);
              return (
                <button key={tag.id} onClick={() => toggleTag(tag.name)}
                  className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200 " + (isSelected ? "text-white" : "bg-white text-[var(--text-secondary)] border border-[var(--charcoal)]/15")}
                  style={isSelected ? { backgroundColor: tag.color } : {}}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : tag.color }} />
                  {tag.name}
                </button>
              );
            })}
          </div>
          <Input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder={"添加标签（逗号分隔）"} />
        </div>

        {/* 备注 */}
        <div className="flex-1 overflow-hidden">
          <Textarea value={pageNote} onChange={(e) => setPageNote(e.target.value)} placeholder={"添加备注..."} className="h-full min-h-[72px] text-[13px]" />
        </div>

        {/* 保存按钮 */}
        <Button onClick={handleSave} disabled={saveDisabled} className="shrink-0 h-12 text-[13px] gap-2">
          <Archive className="size-4" />
          {summary?.isSupported ? "存档" : "此页面不支持存档"}
        </Button>
      </div>
    </main>
  );
}

function normalizeTags(selected: string[], extra: string): string[] {
  return Array.from(new Set([...selected, ...extra.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean)]));
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode><PopupApp /></StrictMode>
);

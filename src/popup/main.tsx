import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LibraryBig, Settings2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
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
    if (root) {
      root.style.width = "392px";
      root.style.height = "600px";
    }

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
    <main className="flex h-full w-full flex-col gap-3 overflow-hidden p-4" style={{ background: "var(--canvas)" }}>
      <Card className="glass flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-white/20 pb-4">
          <CardTitle className="text-[18px] font-semibold tracking-tight" style={{ color: "var(--ink-primary)" }}>UIstash</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => chrome.runtime.openOptionsPage()} disabled={busy} aria-label={"打开管理页"}>
            <Settings2 className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4">
          <div className="flex items-center justify-end">
            <Badge variant={summary?.pendingQueueCount ? "success" : "secondary"}>QUEUE: {summary?.pendingQueueCount ?? 0}</Badge>
          </div>

          <Card className="bg-white/50 backdrop-blur-md">
            <CardContent className="p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold leading-snug line-clamp-2" style={{ color: "var(--ink-primary)" }}>{summary?.title || "当前网页"}</h2>
                {summary?.page ? <Badge variant="success">ARCHIVED</Badge> : null}
              </div>
              <p className="font-mono text-[11px] line-clamp-2" style={{ color: "var(--ink-muted)" }}>{summary?.url || "当前标签页暂不支持保存"}</p>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 overflow-hidden">
            {availableTags.map((tag) => (
              <Button
                key={tag.id}
                type="button"
                variant={selectedTags.includes(tag.name) ? "outline" : "secondary"}
                size="sm"
                className="max-w-full"
                onClick={() => toggleTag(tag.name)}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="truncate">{tag.name}</span>
              </Button>
            ))}
          </div>

          <Input value={newTags} onChange={(event) => setNewTags(event.target.value)} placeholder={"> new-tag"} />

          <Separator />

          <Textarea value={pageNote} onChange={(event) => setPageNote(event.target.value)} placeholder={"Note..."} className="min-h-[88px] max-h-[132px] text-[13px]" />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveDisabled} className="h-12 shrink-0 text-xs uppercase tracking-[0.1em]">
        <LibraryBig className="size-4" />
        {"SAVE CURRENT PAGE"}
      </Button>
    </main>
  );
}

function normalizeTags(selected: string[], extra: string): string[] {
  return Array.from(new Set([...selected, ...extra.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean)]));
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>
);

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
    <main className="flex h-full w-full flex-col gap-3 overflow-hidden p-4">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-[#ded6ca] bg-white/78 shadow-[0_20px_44px_rgba(82,62,38,0.1)]">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-[#e9e3d9] bg-[#fbf8f2]/80 pb-4">
          <CardTitle className="text-[22px]">UIstash</CardTitle>
          <Button variant="secondary" size="icon" onClick={() => chrome.runtime.openOptionsPage()} disabled={busy} aria-label={"\u6253\u5f00\u7ba1\u7406\u9875"}>
            <Settings2 className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4">
          <Card className="border-[#e6dfd6] bg-[#faf6ef]/90 shadow-none">
            <CardContent className="flex items-center justify-end p-4">
              <Badge variant="secondary">{summary?.pendingQueueCount ?? 0}</Badge>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-[#e6dfd6] bg-white/90 shadow-none">
            <CardHeader className="gap-1 p-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="line-clamp-2 text-base leading-6">{summary?.title || "\u5f53\u524d\u7f51\u9875"}</CardTitle>
                {summary?.page ? <Badge>{"\u5df2\u5f52\u6863"}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="line-clamp-2 overflow-hidden p-4 pt-0 text-sm text-[#6d675e]">{summary?.url || "\u5f53\u524d\u6807\u7b7e\u9875\u6682\u4e0d\u652f\u6301\u4fdd\u5b58"}</CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 overflow-hidden">
            {availableTags.map((tag) => (
              <Button
                key={tag.id}
                type="button"
                variant={selectedTags.includes(tag.name) ? "outline" : "secondary"}
                size="sm"
                className="max-w-full rounded-full px-3"
                onClick={() => toggleTag(tag.name)}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="truncate">{tag.name}</span>
              </Button>
            ))}
          </div>

          <Input value={newTags} onChange={(event) => setNewTags(event.target.value)} placeholder={"\u65b0\u6807\u7b7e"} />

          <Separator />

          <Textarea value={pageNote} onChange={(event) => setPageNote(event.target.value)} placeholder={"\u5907\u6ce8"} className="min-h-[88px] max-h-[132px]" />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveDisabled} className="h-12 shrink-0 text-sm">
        <LibraryBig className="size-4" />
        {"\u4fdd\u5b58\u5f53\u524d\u7f51\u9875"}
      </Button>
    </main>
  );
}

function normalizeTags(selected: string[], extra: string): string[] {
  return Array.from(new Set([...selected, ...extra.split(/[\uFF0C,\n]/).map((item) => item.trim()).filter(Boolean)]));
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>
);

import type { PageRecord, SearchPageResult, TagRecord, VersionRecord } from "./types";

export function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function buildVersionSearchText(input: {
  page: PageRecord;
  version: Pick<VersionRecord, "sourceUrl" | "normalizedUrl" | "title" | "extractedText" | "note">;
  tagNames: string[];
}): string {
  return [
    input.page.title,
    input.page.latestUrl,
    input.page.normalizedUrl,
    input.page.note,
    input.version.title,
    input.version.sourceUrl,
    input.version.normalizedUrl,
    input.version.note,
    input.version.extractedText,
    input.tagNames.join(" ")
  ]
    .join("\n")
    .toLowerCase();
}

export function searchPages(input: {
  pages: PageRecord[];
  versions: VersionRecord[];
  tags: TagRecord[];
  query: string;
  tagId?: string | null;
}): SearchPageResult[] {
  const tagMap = new Map(input.tags.map((tag) => [tag.id, tag]));
  const tokens = tokenizeQuery(input.query);
  const versionsByPage = new Map<string, VersionRecord[]>();

  for (const version of input.versions) {
    const existing = versionsByPage.get(version.pageId);
    if (existing) {
      existing.push(version);
    } else {
      versionsByPage.set(version.pageId, [version]);
    }
  }

  return input.pages
    .filter((page) => !input.tagId || page.tagIds.includes(input.tagId))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((page) => {
      const pageVersions = (versionsByPage.get(page.id) ?? []).sort((a, b) => b.capturedAt - a.capturedAt);
      const matchedVersions =
        tokens.length === 0
          ? []
          : pageVersions
              .filter((version) => tokens.every((token) => version.searchText.includes(token)))
              .map((version) => ({
                version,
                snippet: createSnippet(version.extractedText || version.note || page.note || page.title, tokens)
              }));

      return {
        page,
        tagNames: page.tagIds.map((tagId) => tagMap.get(tagId)?.name).filter(Boolean) as string[],
        latestVersion: pageVersions[0],
        matchedVersions
      };
    })
    .filter((entry) => tokens.length === 0 || entry.matchedVersions.length > 0);
}

export function createSnippet(text: string, tokens: string[]): string {
  const content = text.replace(/\s+/g, " ").trim();
  if (!content) {
    return "暂无摘要";
  }

  const lowered = content.toLowerCase();
  const token = tokens.find((item) => lowered.includes(item)) ?? tokens[0];
  const index = token ? lowered.indexOf(token) : 0;

  if (index === -1) {
    return content.slice(0, 160);
  }

  const start = Math.max(0, index - 48);
  const end = Math.min(content.length, index + 120);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return `${prefix}${content.slice(start, end)}${suffix}`;
}

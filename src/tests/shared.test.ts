import { planQueueUpsert } from "../shared/queue";
import { buildPageKey, buildSnapshotRelativeBase, normalizeUrl } from "../shared/url";
import { searchPages } from "../shared/search";
import type { PageRecord, QueueRecord, TagRecord, VersionRecord } from "../shared/types";

describe("url normalization", () => {
  it("normalizes tracking params while keeping stable page identity", () => {
    expect(normalizeUrl("https://example.com/work/?utm_source=x&ref=hero#top")).toBe("https://example.com/work?ref=hero");
    expect(buildPageKey("https://example.com/work/?utm_source=x#top")).toBe("https://example.com/work");
    expect(buildPageKey("https://example.com/work#next")).toBe("https://example.com/work");
  });

  it("builds collision-free snapshot directories for distinct paths", () => {
    const capturedAt = 1_710_000_000_000;

    expect(buildSnapshotRelativeBase("https://example.com/foo/bar", capturedAt)).not.toBe(
      buildSnapshotRelativeBase("https://example.com/foo-bar", capturedAt)
    );
    expect(buildSnapshotRelativeBase("https://example.com/", capturedAt)).not.toBe(
      buildSnapshotRelativeBase("https://example.com/__root__", capturedAt)
    );
  });
});

describe("queue upsert planning", () => {
  it("reuses an existing queue id and removes stale duplicates for the same page and status", () => {
    const existing: QueueRecord[] = [
      {
        id: "existing-1",
        pageId: "page-1",
        pageKey: "https://example.com/work",
        sourceUrl: "https://example.com/work",
        requestedAt: 1,
        reason: "old",
        status: "awaiting-permission",
        title: "Work"
      },
      {
        id: "existing-2",
        pageId: "page-1",
        pageKey: "https://example.com/work",
        sourceUrl: "https://example.com/work",
        requestedAt: 2,
        reason: "duplicate",
        status: "awaiting-permission",
        title: "Work"
      },
      {
        id: "other-status",
        pageId: "page-1",
        pageKey: "https://example.com/work",
        sourceUrl: "https://example.com/work",
        requestedAt: 3,
        reason: "visible",
        status: "awaiting-visibility",
        title: "Work"
      }
    ];

    const plan = planQueueUpsert(existing, {
      id: "fresh-id",
      pageId: "page-1",
      pageKey: "https://example.com/work",
      sourceUrl: "https://example.com/work",
      requestedAt: 4,
      reason: "latest",
      status: "awaiting-permission",
      title: "Work"
    });

    expect(plan.record.id).toBe("existing-1");
    expect(plan.record.reason).toBe("latest");
    expect(plan.duplicateIds).toEqual(["existing-2"]);
  });
});

describe("search grouping", () => {
  it("groups matched versions by page and respects tag filtering", () => {
    const page: PageRecord = {
      id: "page-1",
      pageKey: "https://example.com/work",
      normalizedUrl: "https://example.com/work",
      latestUrl: "https://example.com/work",
      title: "Example Work",
      tagIds: ["tag-1"],
      note: "Gallery note",
      createdAt: 1,
      updatedAt: 2,
      versionCount: 2
    };

    const versions: VersionRecord[] = [
      {
        id: "version-1",
        pageId: "page-1",
        pageKey: page.pageKey,
        sourceUrl: page.latestUrl,
        normalizedUrl: page.normalizedUrl,
        title: page.title,
        capturedAt: 10,
        trigger: "manual",
        mhtmlPath: "a/page.mhtml",
        pngPath: "a/preview.png",
        fullPngPath: "a/full-page.png",
        metaPath: "a/meta.json",
        extractedText: "bold motion system and clean editorial spacing",
        note: "latest note",
        fileStatus: "ready",
        searchText: "bold motion system and clean editorial spacing gallery note editorial"
      },
      {
        id: "version-2",
        pageId: "page-1",
        pageKey: page.pageKey,
        sourceUrl: page.latestUrl,
        normalizedUrl: page.normalizedUrl,
        title: page.title,
        capturedAt: 8,
        trigger: "auto",
        mhtmlPath: "b/page.mhtml",
        pngPath: "b/preview.png",
        fullPngPath: "b/full-page.png",
        metaPath: "b/meta.json",
        extractedText: "older version",
        note: "archive",
        fileStatus: "ready",
        searchText: "older version archive editorial"
      }
    ];

    const tags: TagRecord[] = [{ id: "tag-1", name: "editorial", color: "#fff", createdAt: 1 }];
    const results = searchPages({ pages: [page], versions, tags, query: "motion editorial", tagId: "tag-1" });

    expect(results).toHaveLength(1);
    expect(results[0].matchedVersions).toHaveLength(1);
    expect(results[0].matchedVersions[0].version.id).toBe("version-1");
  });
});

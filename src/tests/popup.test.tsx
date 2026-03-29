// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { directoryStatusLabel, normalizeTags, popupArchiveState, popupMetaText, popupPageTitle, popupUrlText } from "../popup/normalizeTags";
import type { ActivePageSummary } from "../shared/types";

describe("popup tag normalization", () => {
  it("merges selected tags with comma and newline separated input", () => {
    expect(normalizeTags(["归档", "灵感"], "作品集, 交互\n灵感\n")).toEqual(["归档", "灵感", "作品集", "交互"]);
  });

  it("ignores whitespace and duplicate values", () => {
    expect(normalizeTags([], "  \n,  视觉系统, 视觉系统 \n  ")).toEqual(["视觉系统"]);
  });
});

describe("popup view model", () => {
  it("builds concise labels for an archived page", () => {
    const summary: ActivePageSummary = {
      isSupported: true,
      url: "https://example.com/work",
      title: "Example Work",
      page: {
        id: "page-1",
        pageKey: "https://example.com/work",
        normalizedUrl: "https://example.com/work",
        latestUrl: "https://example.com/work",
        title: "Example Work",
        tagIds: [],
        note: "",
        createdAt: 1,
        updatedAt: 1,
        versionCount: 1
      },
      latestVersion: {
        id: "version-1",
        pageId: "page-1",
        pageKey: "https://example.com/work",
        sourceUrl: "https://example.com/work",
        normalizedUrl: "https://example.com/work",
        title: "Example Work",
        capturedAt: new Date("2026-03-27T10:20:00+08:00").getTime(),
        trigger: "manual",
        mhtmlPath: "page.mhtml",
        pngPath: "preview.png",
        fullPngPath: "full-page.png",
        metaPath: "meta.json",
        extractedText: "",
        note: "",
        fileStatus: "ready",
        searchText: ""
      },
      directoryStatus: "granted",
      pendingQueueCount: 0
    };

    expect(popupArchiveState(summary)).toBe("已归档");
    expect(popupPageTitle(summary)).toBe("Example Work");
    expect(popupUrlText(summary)).toBe("https://example.com/work");
    expect(popupMetaText(summary)).toContain("最近记录");
  });

  it("falls back to connection guidance for new pages", () => {
    const summary: ActivePageSummary = {
      isSupported: true,
      url: "https://example.com/new",
      title: "",
      page: null,
      latestVersion: null,
      directoryStatus: "missing",
      pendingQueueCount: 2
    };

    expect(popupArchiveState(summary)).toBe("准备收录");
    expect(popupPageTitle(summary)).toBe("当前网页");
    expect(popupMetaText(summary)).toBe("请先连接归档目录");
  });

  it("keeps unsupported pages out of the archive path", () => {
    const summary: ActivePageSummary = {
      isSupported: false,
      directoryStatus: "stale",
      pendingQueueCount: 0
    };

    expect(popupArchiveState(summary)).toBe("当前页不可归档");
    expect(popupMetaText(summary)).toBe("请切回普通网页后再试");
    expect(popupUrlText(summary)).toContain("暂不支持保存");
    expect(directoryStatusLabel("stale")).toBe("目录待刷新");
  });
});

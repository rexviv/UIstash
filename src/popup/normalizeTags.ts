import type { ActivePageSummary, DirectoryStatus } from "../shared/types";

export function normalizeTags(selected: string[], extra: string): string[] {
  return Array.from(new Set([...selected, ...extra.split(/[\uFF0C,\n]/).map((item) => item.trim()).filter(Boolean)]));
}

export function popupArchiveState(summary: ActivePageSummary | null): string {
  if (!summary?.isSupported) {
    return "当前页不可归档";
  }
  return summary?.page ? "已归档" : "准备收录";
}

export function popupMetaText(summary: ActivePageSummary | null): string {
  if (!summary?.isSupported) {
    return "请切回普通网页后再试";
  }
  if (summary?.latestVersion) {
    return `最近记录 ${formatCaptured(summary.latestVersion.capturedAt)}`;
  }
  if (summary?.directoryStatus === "granted") {
    return "将保存到当前归档目录";
  }
  if (summary?.directoryStatus === "stale") {
    return "归档目录待刷新";
  }
  return "请先连接归档目录";
}

export function popupPageTitle(summary: ActivePageSummary | null): string {
  return summary?.title?.trim() || "当前网页";
}

export function popupUrlText(summary: ActivePageSummary | null): string {
  return summary?.url || "当前标签页暂不支持保存，请切回普通网页内容后再试。";
}

export function directoryStatusLabel(status: DirectoryStatus): string {
  if (status === "granted") {
    return "目录已连接";
  }
  if (status === "stale") {
    return "目录待刷新";
  }
  return "目录未连接";
}

export function formatCaptured(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp);
}

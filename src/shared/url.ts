const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid"
]);

const SNAPSHOT_ROOT_SEGMENT = "root";
const SNAPSHOT_PATH_PREFIX = "seg-";

export function isSupportedUrl(input: string | undefined | null): input is string {
  if (!input) {
    return false;
  }

  return input.startsWith("http://") || input.startsWith("https://");
}

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  const normalizedPath = normalizePathname(url.pathname);

  const keptParams = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));

  const search = new URLSearchParams(keptParams);
  const searchString = search.toString();

  return `${url.origin.toLowerCase()}${normalizedPath}${searchString ? `?${searchString}` : ""}`;
}

export function buildPageKey(input: string): string {
  const url = new URL(input);
  return `${url.origin.toLowerCase()}${normalizePathname(url.pathname)}`;
}

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

export function sanitizePathSegment(value: string): string {
  const safe = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return safe || "home";
}

export function buildSnapshotRelativeBase(normalizedUrl: string, capturedAt: number): string {
  const url = new URL(normalizedUrl);

  return ["UIstash", encodeSnapshotHost(url.host), "__path__", ...encodeSnapshotPath(url.pathname), formatTimestampId(capturedAt)].join("/");
}

export function formatTimestampId(timestamp: number): string {
  const date = new Date(timestamp);
  const parts = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ];
  const timeParts = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds()), padMillis(date.getMilliseconds())];
  return `${parts.join("")}-${timeParts.join("")}`;
}

function encodeSnapshotHost(host: string): string {
  return encodeURIComponent(host.toLowerCase());
}

function encodeSnapshotPath(pathname: string): string[] {
  const segments = normalizePathname(pathname).split("/").filter(Boolean);

  if (segments.length === 0) {
    return [SNAPSHOT_ROOT_SEGMENT];
  }

  return segments.map((segment) => `${SNAPSHOT_PATH_PREFIX}${encodeURIComponent(segment)}`);
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function padMillis(value: number): string {
  return value.toString().padStart(3, "0");
}

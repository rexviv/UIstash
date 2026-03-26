import Dexie, { type Table } from "dexie";
import type { DirectoryStatus, QueueRecord, SettingRecord } from "./types";

const DIRECTORY_HANDLE_KEY = "directory-handle";
const DIRECTORY_STATUS_KEY = "directory-status";

class UIstashDatabase extends Dexie {
  queue!: Table<QueueRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super("uistash-db");

    this.version(1).stores({
      queue: "&id, status, pageKey, requestedAt",
      settings: "&key"
    });

    this.version(2).stores({
      queue: "&id, status, pageKey, requestedAt",
      settings: "&key",
      pages: null,
      versions: null,
      tags: null
    });
  }
}

export const db = new UIstashDatabase();

export async function getDirectoryStatus(): Promise<DirectoryStatus> {
  const record = await db.settings.get(DIRECTORY_STATUS_KEY);
  return (record?.value as DirectoryStatus | undefined) ?? "missing";
}

export async function setDirectoryStatus(status: DirectoryStatus): Promise<void> {
  await db.settings.put({ key: DIRECTORY_STATUS_KEY, value: status });
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const record = await db.settings.get(DIRECTORY_HANDLE_KEY);
  return (record?.value as FileSystemDirectoryHandle | undefined) ?? null;
}

export async function setDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await db.settings.put({ key: DIRECTORY_HANDLE_KEY, value: handle });
  await setDirectoryStatus("granted");
}

export async function clearDirectoryHandle(): Promise<void> {
  await Promise.all([db.settings.delete(DIRECTORY_HANDLE_KEY), setDirectoryStatus("missing")]);
}
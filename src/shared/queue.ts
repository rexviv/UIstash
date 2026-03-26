import type { QueueRecord } from "./types";

export interface QueueUpsertPlan {
  record: QueueRecord;
  duplicateIds: string[];
}

export function planQueueUpsert(existing: QueueRecord[], next: QueueRecord, preferredId?: string): QueueUpsertPlan {
  const matches = existing.filter((item) => item.pageKey === next.pageKey && item.status === next.status);
  const recordId = preferredId ?? matches[0]?.id ?? next.id;

  return {
    record: {
      ...next,
      id: recordId
    },
    duplicateIds: matches.map((item) => item.id).filter((id) => id !== recordId)
  };
}

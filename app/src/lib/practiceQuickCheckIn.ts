export const PRACTICE_QUICK_CHECK_IN_EVENT = "gijilai:practiceQuickCheckIn";

export interface PracticeQuickCheckInPayload {
  practiceId: string;
  done: boolean;
  memo?: string | null;
  source?: "notification_action";
  actionId?: string;
  receivedAt?: string;
}

declare global {
  interface Window {
    __pendingPracticeQuickCheckIn?: PracticeQuickCheckInPayload | null;
  }
}

const MAX_QUICK_CHECK_IN_MEMO_LENGTH = 500;

export function normalizePracticeQuickCheckInPayload(
  value: unknown,
): PracticeQuickCheckInPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  const practiceId =
    typeof candidate.practiceId === "string" ? candidate.practiceId.trim() : "";
  const done = candidate.done;
  if (!practiceId || typeof done !== "boolean") return null;

  const memo =
    typeof candidate.memo === "string"
      ? candidate.memo.trim().slice(0, MAX_QUICK_CHECK_IN_MEMO_LENGTH)
      : null;
  const source =
    candidate.source === "notification_action" ? candidate.source : undefined;
  const actionId =
    typeof candidate.actionId === "string"
      ? candidate.actionId.trim() || undefined
      : undefined;
  const receivedAt =
    typeof candidate.receivedAt === "string"
      ? candidate.receivedAt.trim() || undefined
      : undefined;

  return {
    practiceId,
    done,
    memo: memo || null,
    source,
    actionId,
    receivedAt,
  };
}

export function getPracticeQuickCheckInKey(
  payload: PracticeQuickCheckInPayload,
) {
  return [
    payload.receivedAt ?? "no-time",
    payload.actionId ?? "no-action",
    payload.practiceId,
    payload.done ? "done" : "skipped",
    payload.memo ?? "",
  ].join(":");
}

import { getLocalDateString } from "./date";

export const PRACTICE_INACTIVITY_THRESHOLD_DAYS = 3;
export const PRACTICE_REVIEW_EXTENSION_DAYS = 3;
export const PRACTICE_MAX_DURATION_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PracticeLike = {
  id: string;
  created_at: string;
  duration: number;
};

type PracticeLogLike = {
  practice_id: string;
  date: string;
  done: boolean;
};

export type PracticeLifecycleStatus =
  | "ACTIVE"
  | "NEEDS_RECONNECT"
  | "DUE_FOR_REVIEW"
  | "STALE";

export type PracticeLifecycle = {
  status: PracticeLifecycleStatus;
  elapsedDays: number;
  inactiveDays: number;
  daysPastDuration: number;
  lastActionDate: string;
  dueDate: string;
  doneDays: number;
  skippedDays: number;
  progress: number;
  canExtend: boolean;
  extensionDuration: number;
};

function toLocalDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function toLocalDateString(value: string): string {
  return getLocalDateString(toLocalDate(value));
}

function addDays(value: string, days: number): string {
  const date = toLocalDate(value);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function daysBetween(start: string, end: string): number {
  const diff = toLocalDate(end).getTime() - toLocalDate(start).getTime();
  return Math.max(0, Math.round(diff / MS_PER_DAY));
}

export function getPracticeLifecycle(
  practice: PracticeLike,
  logs: PracticeLogLike[] = [],
  today = getLocalDateString(),
): PracticeLifecycle {
  const duration = Math.max(1, practice.duration || 1);
  const practiceLogs = logs.filter((log) => log.practice_id === practice.id);
  const startDate = toLocalDateString(practice.created_at);
  const lastLogDate = practiceLogs
    .map((log) => log.date)
    .sort((a, b) => b.localeCompare(a))[0];
  const lastActionDate = lastLogDate ?? startDate;
  const elapsedDays = daysBetween(startDate, today) + 1;
  const inactiveDays = daysBetween(lastActionDate, today);
  const daysPastDuration = Math.max(0, elapsedDays - duration);
  const doneDays = practiceLogs.filter((log) => log.done).length;
  const skippedDays = practiceLogs.filter((log) => !log.done).length;

  let status: PracticeLifecycleStatus = "ACTIVE";
  if (daysPastDuration > 0) {
    status =
      inactiveDays >= PRACTICE_INACTIVITY_THRESHOLD_DAYS
        ? "STALE"
        : "DUE_FOR_REVIEW";
  } else if (inactiveDays >= PRACTICE_INACTIVITY_THRESHOLD_DAYS) {
    status = "NEEDS_RECONNECT";
  }

  const extensionDuration = Math.min(
    PRACTICE_MAX_DURATION_DAYS,
    Math.max(
      duration + PRACTICE_REVIEW_EXTENSION_DAYS,
      elapsedDays + PRACTICE_REVIEW_EXTENSION_DAYS,
    ),
  );

  return {
    status,
    elapsedDays,
    inactiveDays,
    daysPastDuration,
    lastActionDate,
    dueDate: addDays(startDate, duration),
    doneDays,
    skippedDays,
    progress: Math.min(doneDays / duration, 1),
    canExtend: status === "DUE_FOR_REVIEW" && extensionDuration > duration,
    extensionDuration,
  };
}

export const PRACTICE_REMINDER_STORAGE_KEY = "gijilai_notification_settings";

export interface PracticeReminderPreferences {
  pushEnabled: boolean;
  practiceReminderEnabled: boolean;
  practiceReminderTime: string;
}

export interface PracticeReminderSyncPayload {
  enabled: boolean;
  time: string;
  mode?: "daily_practice_checkin";
  title?: string;
  body?: string;
  timezone?: string;
  focusPracticeId?: string;
  activePracticeIds?: string[];
  activePracticeCount?: number;
  pendingPracticeCount?: number;
  userInitiated?: boolean;
  payload?: string;
}

export interface PracticeReminderPlanInput {
  preferences: PracticeReminderPreferences;
  activePracticeCount: number;
  pendingPracticeCount?: number;
  title?: string;
  body?: string;
  focusPracticeId?: string;
  activePracticeIds?: string[];
  userInitiated?: boolean;
}

declare global {
  interface Window {
    ReminderBridge?: {
      postMessage: (message: string) => void;
    };
  }
}

export function isAppWebView() {
  return (
    typeof window !== "undefined" &&
    window.navigator.userAgent.includes("gijilai_app")
  );
}

export function readPracticeReminderPreferences(
  fallback: PracticeReminderPreferences,
): PracticeReminderPreferences {
  if (typeof window === "undefined") return fallback;

  try {
    const saved = window.localStorage.getItem(PRACTICE_REMINDER_STORAGE_KEY);
    if (!saved) return fallback;
    return { ...fallback, ...JSON.parse(saved) };
  } catch {
    return fallback;
  }
}

export function formatPracticeReminderTime(time: string, locale: "ko" | "en") {
  const [rawHours, rawMinutes] = normalizePracticeReminderTime(time).split(":");
  const hours = Number.parseInt(rawHours ?? "20", 10);
  const minutes = Number.parseInt(rawMinutes ?? "0", 10);
  const normalizedHours = Number.isNaN(hours) ? 20 : hours;
  const normalizedMinutes = Number.isNaN(minutes) ? 0 : minutes;
  const displayHours = normalizedHours % 12 || 12;
  const displayMinutes = String(normalizedMinutes).padStart(2, "0");

  if (locale === "ko") {
    return `${normalizedHours < 12 ? "오전" : "오후"} ${displayHours}:${displayMinutes}`;
  }

  return `${displayHours}:${displayMinutes} ${normalizedHours < 12 ? "AM" : "PM"}`;
}

export function normalizePracticeReminderTime(time: string) {
  const [rawHours, rawMinutes] = time.split(":");
  const hours = Number.parseInt(rawHours ?? "20", 10);
  const minutes = Number.parseInt(rawMinutes ?? "0", 10);
  const normalizedHours =
    Number.isNaN(hours) || hours < 0 || hours > 23 ? 20 : hours;
  const normalizedMinutes =
    Number.isNaN(minutes) || minutes < 0 || minutes > 59 ? 0 : minutes;

  return `${String(normalizedHours).padStart(2, "0")}:${String(normalizedMinutes).padStart(2, "0")}`;
}

export function getPracticeReminderTimezone() {
  if (typeof Intl === "undefined") return undefined;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function buildPracticeReminderPayload(focusPracticeId?: string) {
  const params = new URLSearchParams({ source: "practice_reminder" });
  if (focusPracticeId) {
    params.set("focusPracticeId", focusPracticeId);
  }
  return `/practices?${params.toString()}`;
}

export function buildPracticeReminderPlan({
  preferences,
  activePracticeCount,
  pendingPracticeCount,
  title,
  body,
  focusPracticeId,
  activePracticeIds,
  userInitiated,
}: PracticeReminderPlanInput): PracticeReminderSyncPayload {
  const time = normalizePracticeReminderTime(preferences.practiceReminderTime);
  const enabled = preferences.pushEnabled && preferences.practiceReminderEnabled;

  return {
    mode: "daily_practice_checkin",
    enabled,
    time,
    title,
    body,
    timezone: getPracticeReminderTimezone(),
    focusPracticeId,
    activePracticeIds,
    activePracticeCount,
    pendingPracticeCount,
    userInitiated,
    payload: buildPracticeReminderPayload(focusPracticeId),
  };
}

export function postPracticeReminderSync(payload: PracticeReminderSyncPayload) {
  if (typeof window === "undefined") return;

  window.ReminderBridge?.postMessage(
    JSON.stringify({
      type: "PRACTICE_REMINDER_SETTINGS",
      ...payload,
    }),
  );
}

export function postPracticeReminderTest(payload: PracticeReminderSyncPayload) {
  if (typeof window === "undefined") return;

  window.ReminderBridge?.postMessage(
    JSON.stringify({
      type: "PRACTICE_REMINDER_TEST",
      ...payload,
    }),
  );
}

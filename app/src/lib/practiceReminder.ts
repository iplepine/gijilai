export const PRACTICE_REMINDER_STORAGE_KEY = "gijilai_notification_settings";

export interface PracticeReminderPreferences {
  pushEnabled: boolean;
  practiceReminderEnabled: boolean;
  practiceReminderTime: string;
}

export interface PracticeReminderSyncPayload {
  enabled: boolean;
  time: string;
  title?: string;
  body?: string;
  activePracticeCount?: number;
  pendingPracticeCount?: number;
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
  const [rawHours, rawMinutes] = time.split(":");
  const hours = Number.parseInt(rawHours ?? "20", 10);
  const minutes = Number.parseInt(rawMinutes ?? "0", 10);
  const normalizedHours =
    Number.isNaN(hours) || hours < 0 || hours > 23 ? 20 : hours;
  const normalizedMinutes =
    Number.isNaN(minutes) || minutes < 0 || minutes > 59 ? 0 : minutes;
  const displayHours = normalizedHours % 12 || 12;
  const displayMinutes = String(normalizedMinutes).padStart(2, "0");

  if (locale === "ko") {
    return `${normalizedHours < 12 ? "오전" : "오후"} ${displayHours}:${displayMinutes}`;
  }

  return `${displayHours}:${displayMinutes} ${normalizedHours < 12 ? "AM" : "PM"}`;
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

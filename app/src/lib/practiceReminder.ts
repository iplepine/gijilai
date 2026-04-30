export const PRACTICE_REMINDER_STORAGE_KEY = 'gijilai_notification_settings';

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
}

declare global {
    interface Window {
        ReminderBridge?: {
            postMessage: (message: string) => void;
        };
    }
}

export function isAppWebView() {
    return typeof window !== 'undefined' && window.navigator.userAgent.includes('gijilai_app');
}

export function readPracticeReminderPreferences(
    fallback: PracticeReminderPreferences,
): PracticeReminderPreferences {
    if (typeof window === 'undefined') return fallback;

    try {
        const saved = window.localStorage.getItem(PRACTICE_REMINDER_STORAGE_KEY);
        if (!saved) return fallback;
        return { ...fallback, ...JSON.parse(saved) };
    } catch {
        return fallback;
    }
}

export function formatPracticeReminderTime(time: string, locale: 'ko' | 'en') {
    const [rawHours, rawMinutes] = time.split(':');
    const hours = Number.parseInt(rawHours ?? '20', 10);
    const minutes = Number.parseInt(rawMinutes ?? '0', 10);
    const date = new Date(2026, 0, 1, Number.isNaN(hours) ? 20 : hours, Number.isNaN(minutes) ? 0 : minutes);

    return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

export function postPracticeReminderSync(payload: PracticeReminderSyncPayload) {
    if (typeof window === 'undefined') return;

    window.ReminderBridge?.postMessage(JSON.stringify({
        type: 'PRACTICE_REMINDER_SETTINGS',
        ...payload,
    }));
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/i18n/LocaleProvider";
import { db } from "@/lib/db";
import {
  PRACTICE_REMINDER_STORAGE_KEY,
  formatPracticeReminderTime,
  isAppWebView,
  postPracticeReminderSync,
  readPracticeReminderPreferences,
} from "@/lib/practiceReminder";

interface NotificationSettings {
  pushEnabled: boolean;
  practiceReminderEnabled: boolean;
  practiceReminderTime: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  practiceReminderEnabled: true,
  practiceReminderTime: "20:00",
};

export default function NotificationsPage() {
  const { locale, t } = useLocale();
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] =
    useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [marketingLoaded, setMarketingLoaded] = useState(false);
  const [isSavingMarketing, setIsSavingMarketing] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [draftReminderTime, setDraftReminderTime] = useState(
    DEFAULT_SETTINGS.practiceReminderTime,
  );

  const [draftHour, draftMinute] = draftReminderTime.split(":");
  const selectedHour = Number.parseInt(draftHour ?? "20", 10);
  const selectedMinute = Number.parseInt(draftMinute ?? "0", 10);

  const hourOptions = Array.from({ length: 24 }, (_, index) => index);
  const minuteOptions = Array.from({ length: 12 }, (_, index) => index * 5);

  useEffect(() => {
    setSettings(readPracticeReminderPreferences(DEFAULT_SETTINGS));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setMarketingEnabled(false);
      setMarketingLoaded(true);
      return;
    }

    let isCancelled = false;

    const loadMarketingPreference = async () => {
      try {
        const profile = await db.getUserProfile(user.id);
        if (isCancelled) return;
        setMarketingEnabled(profile.marketing_opt_in ?? false);
      } catch (error) {
        console.error("Failed to load marketing preference:", error);
        if (isCancelled) return;
        setMarketingEnabled(false);
      } finally {
        if (!isCancelled) {
          setMarketingLoaded(true);
        }
      }
    };

    setMarketingLoaded(false);
    void loadMarketingPreference();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(
      PRACTICE_REMINDER_STORAGE_KEY,
      JSON.stringify(settings),
    );
    postPracticeReminderSync({
      enabled: settings.pushEnabled && settings.practiceReminderEnabled,
      time: settings.practiceReminderTime,
    });
  }, [loaded, settings]);

  const updateSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!isTimePickerOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTimePickerOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isTimePickerOpen]);

  const openTimePicker = () => {
    setDraftReminderTime(settings.practiceReminderTime);
    setIsTimePickerOpen(true);
  };

  const updateDraftHour = (hour: number) => {
    setDraftReminderTime(
      `${String(hour).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`,
    );
  };

  const updateDraftMinute = (minute: number) => {
    setDraftReminderTime(
      `${String(selectedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
  };

  const saveReminderTime = () => {
    updateSetting("practiceReminderTime", draftReminderTime);
    setIsTimePickerOpen(false);
  };

  const reminderEnabled =
    settings.pushEnabled && settings.practiceReminderEnabled;
  const reminderTimeLabel = formatPracticeReminderTime(
    settings.practiceReminderTime,
    locale,
  );
  const reminderPreview = !settings.pushEnabled
    ? t("settings.practiceReminderPreviewPushOff")
    : !settings.practiceReminderEnabled
      ? t("settings.practiceReminderPreviewReminderOff")
      : isAppWebView()
        ? t("settings.practiceReminderPreviewActive", {
            time: reminderTimeLabel,
          })
        : t("settings.practiceReminderPreviewWeb", { time: reminderTimeLabel });

  const toggleMarketingPreference = async () => {
    if (!user?.id || isSavingMarketing) return;

    const previousValue = marketingEnabled;
    const nextValue = !previousValue;

    setMarketingEnabled(nextValue);
    setIsSavingMarketing(true);

    try {
      await db.updateUserProfile(user.id, { marketing_opt_in: nextValue });
    } catch (error) {
      console.error("Failed to update marketing preference:", error);
      setMarketingEnabled(previousValue);
      alert(t("settings.marketingUpdateError"));
    } finally {
      setIsSavingMarketing(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen">
      <div className="max-w-md mx-auto relative min-h-screen flex flex-col">
        <Navbar title={t("settings.notificationSettings")} />

        <main className="app-page-scroll flex-1 px-4 py-8">
          <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-soft border border-gray-100 dark:border-gray-800 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-6 flex flex-col gap-1">
                <h2 className="text-[15px] font-bold text-navy dark:text-white">
                  {t("settings.pushNotifications")}
                </h2>
                <p className="text-[13px] text-gray-500 break-keep">
                  {t("settings.pushDescription")}
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting("pushEnabled", !settings.pushEnabled)
                }
                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${settings.pushEnabled ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${settings.pushEnabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>

            <hr className="border-gray-100 dark:border-gray-800" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-6 flex flex-col gap-1">
                  <h2 className="text-[15px] font-bold text-navy dark:text-white">
                    {t("settings.practiceReminders")}
                  </h2>
                  <p className="text-[13px] text-gray-500 break-keep">
                    {t("settings.practiceReminderDescription")}
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateSetting(
                      "practiceReminderEnabled",
                      !settings.practiceReminderEnabled,
                    )
                  }
                  className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${settings.practiceReminderEnabled ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${settings.practiceReminderEnabled ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl bg-beige-main/20 dark:bg-white/5 px-4 py-3">
                <span className="text-[13px] font-bold text-text-main dark:text-white">
                  {t("settings.reminderTime")}
                </span>
                <button
                  type="button"
                  disabled={!reminderEnabled}
                  onClick={openTimePicker}
                  className="min-w-28 rounded-xl border border-primary/10 bg-white dark:bg-surface-dark px-3 py-2 text-[14px] font-bold text-text-main dark:text-white disabled:opacity-40"
                >
                  {reminderTimeLabel}
                </button>
              </div>

              <p className="text-[12px] font-medium text-primary break-keep">
                {reminderPreview}
              </p>
              <p className="text-[12px] text-gray-500 leading-relaxed break-keep">
                {t("settings.practiceReminderLocalNote")}
              </p>
            </div>

            <hr className="border-gray-100 dark:border-gray-800" />

            <div className="flex items-center justify-between">
              <div className="flex-1 pr-6 flex flex-col gap-1">
                <h2 className="text-[15px] font-bold text-navy dark:text-white">
                  {t("settings.marketingNotifications")}
                </h2>
                <p className="text-[13px] text-gray-500 break-keep">
                  {t("settings.marketingDescription")}
                </p>
              </div>
              <button
                onClick={() => void toggleMarketingPreference()}
                disabled={!marketingLoaded || !user || isSavingMarketing}
                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 disabled:opacity-50 ${marketingEnabled ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${marketingEnabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          </div>
        </main>
      </div>

      {isTimePickerOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsTimePickerOpen(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-surface-dark animate-slide-up"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-beige-main/10 bg-beige-main/5 px-6 py-5 dark:border-white/5 dark:bg-white/5">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-text-sub">
                  {t("settings.practiceReminders")}
                </p>
                <h4 className="mt-1 text-lg font-bold text-text-main dark:text-white">
                  {t("settings.reminderTime")}
                </h4>
              </div>
              <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                {formatPracticeReminderTime(draftReminderTime, locale)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 px-6 py-6">
              <div>
                <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-text-sub">
                  {t("settings.reminderHour")}
                </p>
                <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {hourOptions.map((hour) => {
                    const isSelected = selectedHour == hour;
                    return (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => updateDraftHour(hour)}
                        className={`h-11 rounded-xl text-sm font-bold transition-all ${
                          isSelected
                            ? "bg-primary text-white shadow-md shadow-primary/20"
                            : "bg-beige-main/10 text-text-main hover:bg-primary/10 dark:bg-white/5 dark:text-white"
                        }`}
                      >
                        {String(hour).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-text-sub">
                  {t("settings.reminderMinute")}
                </p>
                <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {minuteOptions.map((minute) => {
                    const isSelected = selectedMinute == minute;
                    return (
                      <button
                        key={minute}
                        type="button"
                        onClick={() => updateDraftMinute(minute)}
                        className={`h-11 rounded-xl text-sm font-bold transition-all ${
                          isSelected
                            ? "bg-primary text-white shadow-md shadow-primary/20"
                            : "bg-beige-main/10 text-text-main hover:bg-primary/10 dark:bg-white/5 dark:text-white"
                        }`}
                      >
                        {String(minute).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-beige-main/10 px-6 py-5 dark:border-white/5">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setIsTimePickerOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={saveReminderTime}
              >
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

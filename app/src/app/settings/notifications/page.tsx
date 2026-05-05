"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useLocale } from "@/i18n/LocaleProvider";
import { db, type PracticeItemData, type PracticeLogData } from "@/lib/db";
import { getLocalDateString } from "@/lib/date";
import { getPracticeLifecycle } from "@/lib/practiceLifecycle";
import {
  PRACTICE_REMINDER_STORAGE_KEY,
  buildPracticeReminderPlan,
  formatPracticeReminderTime,
  isAppWebView,
  postPracticeReminderTest,
  postPracticeReminderSync,
  readPracticeReminderPreferences,
} from "@/lib/practiceReminder";
import { supabase } from "@/lib/supabase";
import {
  getCenteredWheelScrollTop,
  getCenteredWheelSideSpacerHeight,
  getCenteredWheelValue,
} from "@/lib/timeWheel";

interface NotificationSettings {
  pushEnabled: boolean;
  practiceReminderEnabled: boolean;
  practiceReminderTime: string;
}

interface ReminderPracticeSnapshot {
  activePracticeCount: number;
  pendingPracticeCount: number;
  activePracticeIds: string[];
  focusPracticeId?: string;
  focusPracticeTitle?: string;
  isLoading: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  practiceReminderEnabled: true,
  practiceReminderTime: "20:00",
};

const EMPTY_REMINDER_SNAPSHOT: ReminderPracticeSnapshot = {
  activePracticeCount: 0,
  pendingPracticeCount: 0,
  activePracticeIds: [],
  isLoading: false,
};

const WHEEL_ROW_HEIGHT = 44;
const WHEEL_SIDE_SPACER_HEIGHT =
  getCenteredWheelSideSpacerHeight(WHEEL_ROW_HEIGHT);
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => index);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);

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
  const [reminderSnapshot, setReminderSnapshot] =
    useState<ReminderPracticeSnapshot>({
      ...EMPTY_REMINDER_SNAPSHOT,
      isLoading: true,
    });
  const [draftReminderTime, setDraftReminderTime] = useState(
    DEFAULT_SETTINGS.practiceReminderTime,
  );
  const hourWheelRef = useRef<HTMLDivElement | null>(null);
  const minuteWheelRef = useRef<HTMLDivElement | null>(null);
  const reminderSyncUserInitiatedRef = useRef(false);

  const [draftHour, draftMinute] = draftReminderTime.split(":");
  const selectedHour = Number.parseInt(draftHour ?? "20", 10);
  const selectedMinute = Number.parseInt(draftMinute ?? "0", 10);

  const scrollWheelToValue = (
    wheel: HTMLDivElement | null,
    value: number,
    options: number[],
  ) => {
    if (!wheel) return;
    const scrollTop = getCenteredWheelScrollTop(
      value,
      options,
      WHEEL_ROW_HEIGHT,
    );
    if (scrollTop === null) return;

    wheel.scrollTo({
      top: scrollTop,
      behavior: "auto",
    });
  };

  const updateWheelValue = (value: number, options: number[]) => {
    return getCenteredWheelValue(value, options, WHEEL_ROW_HEIGHT);
  };

  useEffect(() => {
    setSettings(readPracticeReminderPreferences(DEFAULT_SETTINGS));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setReminderSnapshot(EMPTY_REMINDER_SNAPSHOT);
      return;
    }

    let isCancelled = false;

    const loadReminderSnapshot = async () => {
      setReminderSnapshot((current) => ({ ...current, isLoading: true }));
      try {
        const activePractices = (await db.getActivePracticeItems(
          user.id,
        )) as PracticeItemData[];
        const practiceIds = activePractices.map((practice) => practice.id);
        let logs: Array<Pick<PracticeLogData, "practice_id" | "date" | "done">> =
          [];

        if (practiceIds.length > 0) {
          const { data, error } = await supabase
            .from("practice_logs")
            .select("practice_id, date, done")
            .in("practice_id", practiceIds);
          if (error) throw error;
          logs = (data || []) as Array<
            Pick<PracticeLogData, "practice_id" | "date" | "done">
          >;
        }

        if (isCancelled) return;

        const today = getLocalDateString();
        const checkedTodayIds = new Set(
          logs
            .filter((log) => log.date === today)
            .map((log) => log.practice_id),
        );
        const reminderPractices = activePractices.filter((practice) => {
          return getPracticeLifecycle(practice, logs, today).status === "ACTIVE";
        });
        const pendingPractices = reminderPractices.filter(
          (practice) => !checkedTodayIds.has(practice.id),
        );
        const focusPractice = pendingPractices[0] ?? reminderPractices[0];

        setReminderSnapshot({
          activePracticeCount: reminderPractices.length,
          pendingPracticeCount: pendingPractices.length,
          activePracticeIds: reminderPractices.map((practice) => practice.id),
          focusPracticeId: focusPractice?.id,
          focusPracticeTitle: focusPractice?.title,
          isLoading: false,
        });
      } catch (error) {
        console.error("Failed to load reminder practice snapshot:", error);
        if (!isCancelled) {
          setReminderSnapshot(EMPTY_REMINDER_SNAPSHOT);
        }
      }
    };

    void loadReminderSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, user?.id]);

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
        const marketingOptIn =
          "marketing_opt_in" in profile
            ? (profile as { marketing_opt_in?: boolean | null })
                .marketing_opt_in
            : false;
        setMarketingEnabled(marketingOptIn ?? false);
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
    if (!loaded || reminderSnapshot.isLoading) return;
    window.localStorage.setItem(
      PRACTICE_REMINDER_STORAGE_KEY,
      JSON.stringify(settings),
    );
    const reminderTime = formatPracticeReminderTime(
      settings.practiceReminderTime,
      locale,
    );
    const title = reminderSnapshot.focusPracticeTitle
      ? t("practices.reminderTitleWithItem", {
          title: reminderSnapshot.focusPracticeTitle,
        })
      : reminderSnapshot.activePracticeCount > 0
        ? t("practices.reminderTitleAllDone")
        : t("practices.reminderTitleNoActive");
    const body = reminderSnapshot.focusPracticeTitle
      ? t("practices.reminderBodyWithItem", { time: reminderTime })
      : reminderSnapshot.activePracticeCount > 0
        ? t("practices.reminderBodyAllDone", { time: reminderTime })
        : t("practices.reminderBodyNoActive");

    postPracticeReminderSync(
      buildPracticeReminderPlan({
        preferences: settings,
        title,
        body,
        focusPracticeId: reminderSnapshot.focusPracticeId,
        activePracticeIds: reminderSnapshot.activePracticeIds,
        activePracticeCount: reminderSnapshot.activePracticeCount,
        pendingPracticeCount: reminderSnapshot.pendingPracticeCount,
        userInitiated: reminderSyncUserInitiatedRef.current,
      }),
    );
    reminderSyncUserInitiatedRef.current = false;
  }, [loaded, locale, reminderSnapshot, settings, t]);

  const updateSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) => {
    reminderSyncUserInitiatedRef.current = true;
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

  useEffect(() => {
    if (!isTimePickerOpen) return;

    const frame = window.requestAnimationFrame(() => {
      scrollWheelToValue(hourWheelRef.current, selectedHour, HOUR_OPTIONS);
      scrollWheelToValue(
        minuteWheelRef.current,
        selectedMinute,
        MINUTE_OPTIONS,
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isTimePickerOpen, selectedHour, selectedMinute]);

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
    reminderSyncUserInitiatedRef.current = true;
    updateSetting("practiceReminderTime", draftReminderTime);
    setIsTimePickerOpen(false);
  };

  const handleHourWheelScroll = () => {
    const nextHour = updateWheelValue(
      hourWheelRef.current?.scrollTop ?? 0,
      HOUR_OPTIONS,
    );
    if (nextHour !== selectedHour) {
      updateDraftHour(nextHour);
    }
  };

  const handleMinuteWheelScroll = () => {
    const nextMinute = updateWheelValue(
      minuteWheelRef.current?.scrollTop ?? 0,
      MINUTE_OPTIONS,
    );
    if (nextMinute !== selectedMinute) {
      updateDraftMinute(nextMinute);
    }
  };

  const reminderEnabled =
    settings.pushEnabled && settings.practiceReminderEnabled;
  const reminderTimeLabel = formatPracticeReminderTime(
    settings.practiceReminderTime,
    locale,
  );
  const reminderNotificationTitle = reminderSnapshot.focusPracticeTitle
    ? t("practices.reminderTitleWithItem", {
        title: reminderSnapshot.focusPracticeTitle,
      })
    : reminderSnapshot.activePracticeCount > 0
      ? t("practices.reminderTitleAllDone")
      : t("practices.reminderTitleNoActive");
  const reminderNotificationBody = reminderSnapshot.focusPracticeTitle
    ? t("practices.reminderBodyWithItem", { time: reminderTimeLabel })
    : reminderSnapshot.activePracticeCount > 0
      ? t("practices.reminderBodyAllDone", { time: reminderTimeLabel })
      : t("practices.reminderBodyNoActive");
  const reminderStatusText = !settings.pushEnabled
    ? t("settings.practiceReminderStatusPushOff")
    : !settings.practiceReminderEnabled
      ? t("settings.practiceReminderStatusReminderOff")
      : reminderSnapshot.isLoading
        ? t("settings.practiceReminderStatusLoading")
        : reminderSnapshot.activePracticeCount === 0
          ? t("settings.practiceReminderStatusNoActive")
          : reminderSnapshot.pendingPracticeCount === 0
            ? t("settings.practiceReminderStatusAllDone", {
                time: reminderTimeLabel,
              })
          : t("settings.practiceReminderStatusScheduled", {
              time: reminderTimeLabel,
              count: String(reminderSnapshot.pendingPracticeCount),
            });
  const reminderPreview = !settings.pushEnabled
    ? t("settings.practiceReminderPreviewPushOff")
    : !settings.practiceReminderEnabled
      ? t("settings.practiceReminderPreviewReminderOff")
      : isAppWebView()
        ? t("settings.practiceReminderPreviewActive", {
            time: reminderTimeLabel,
          })
        : t("settings.practiceReminderPreviewWeb", { time: reminderTimeLabel });
  const canSendTestReminder =
    isAppWebView() && settings.pushEnabled && settings.practiceReminderEnabled;

  const sendTestReminder = () => {
    postPracticeReminderTest(
      buildPracticeReminderPlan({
        preferences: settings,
        title: reminderNotificationTitle,
        body: reminderNotificationBody,
        focusPracticeId: reminderSnapshot.focusPracticeId,
        activePracticeIds: reminderSnapshot.activePracticeIds,
        activePracticeCount: reminderSnapshot.activePracticeCount,
        pendingPracticeCount: reminderSnapshot.pendingPracticeCount,
        userInitiated: true,
      }),
    );
  };

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
              <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-white/10">
                    <Icon name="notifications_active" size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-text-main dark:text-white">
                      {t("settings.practiceReminderStatusTitle")}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-text-sub break-keep">
                      {reminderStatusText}
                    </p>
                    {reminderEnabled && reminderSnapshot.activePracticeCount > 0 && (
                      <p className="mt-2 text-[11px] leading-relaxed text-text-sub/80 break-keep">
                        {t("settings.practiceReminderInexactNote")}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={sendTestReminder}
                  disabled={!canSendTestReminder}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/15 bg-white px-4 py-2.5 text-[13px] font-bold text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-40 dark:bg-surface-dark"
                >
                  <Icon name="notifications" size="sm" />
                  {t("settings.practiceReminderTest")}
                </button>
              </div>
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
          className="app-modal-overlay fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsTimePickerOpen(false)}
        >
          <div
            className="app-modal-panel flex max-h-[min(78vh,42rem)] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-surface-dark animate-slide-up"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-beige-main/10 bg-beige-main/5 px-6 py-5 dark:border-white/5 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-text-sub">
                  {t("settings.practiceReminders")}
                </p>
                <h4 className="mt-1 text-lg font-bold text-text-main dark:text-white">
                  {t("settings.reminderTime")}
                </h4>
              </div>
              <div className="self-start rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary sm:self-auto">
                {formatPracticeReminderTime(draftReminderTime, locale)}
              </div>
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden px-6 py-6">
              <section className="flex min-w-0 flex-1 flex-col rounded-2xl bg-beige-main/10 p-3 dark:bg-white/5">
                <p className="mb-3 px-1 text-[12px] font-bold uppercase tracking-[0.2em] text-text-sub">
                  {t("settings.reminderHour")}
                </p>
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-white/70 dark:bg-white/5">
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-white via-white/80 to-transparent dark:from-surface-dark dark:via-surface-dark/80" />
                  <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 h-11 -translate-y-1/2 rounded-xl border border-primary/15 bg-primary/8 shadow-inner dark:border-white/10 dark:bg-white/5" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-surface-dark dark:via-surface-dark/80" />
                  <div
                    ref={hourWheelRef}
                    onScroll={handleHourWheelScroll}
                    className="h-full snap-y snap-mandatory overflow-y-auto no-scrollbar"
                  >
                    <div style={{ height: WHEEL_SIDE_SPACER_HEIGHT }} />
                    {HOUR_OPTIONS.map((hour) => {
                      const isSelected = selectedHour == hour;
                      return (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => updateDraftHour(hour)}
                          className={`flex h-11 w-full snap-center items-center justify-center rounded-xl text-base font-bold transition-all ${
                            isSelected
                              ? "scale-105 text-primary dark:text-white"
                              : "text-text-sub hover:text-text-main dark:text-gray-400 dark:hover:text-white"
                          }`}
                        >
                          {String(hour).padStart(2, "0")}
                        </button>
                      );
                    })}
                    <div style={{ height: WHEEL_SIDE_SPACER_HEIGHT }} />
                  </div>
                </div>
              </section>

              <section className="flex min-w-0 flex-1 flex-col rounded-2xl bg-beige-main/10 p-3 dark:bg-white/5">
                <p className="mb-3 px-1 text-[12px] font-bold uppercase tracking-[0.2em] text-text-sub">
                  {t("settings.reminderMinute")}
                </p>
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-white/70 dark:bg-white/5">
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-white via-white/80 to-transparent dark:from-surface-dark dark:via-surface-dark/80" />
                  <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 h-11 -translate-y-1/2 rounded-xl border border-primary/15 bg-primary/8 shadow-inner dark:border-white/10 dark:bg-white/5" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-surface-dark dark:via-surface-dark/80" />
                  <div
                    ref={minuteWheelRef}
                    onScroll={handleMinuteWheelScroll}
                    className="h-full snap-y snap-mandatory overflow-y-auto no-scrollbar"
                  >
                    <div style={{ height: WHEEL_SIDE_SPACER_HEIGHT }} />
                    {MINUTE_OPTIONS.map((minute) => {
                      const isSelected = selectedMinute == minute;
                      return (
                        <button
                          key={minute}
                          type="button"
                          onClick={() => updateDraftMinute(minute)}
                          className={`flex h-11 w-full snap-center items-center justify-center rounded-xl text-base font-bold transition-all ${
                            isSelected
                              ? "scale-105 text-primary dark:text-white"
                              : "text-text-sub hover:text-text-main dark:text-gray-400 dark:hover:text-white"
                          }`}
                        >
                          {String(minute).padStart(2, "0")}
                        </button>
                      );
                    })}
                    <div style={{ height: WHEEL_SIDE_SPACER_HEIGHT }} />
                  </div>
                </div>
              </section>
            </div>

            <div className="flex gap-3 border-t border-beige-main/10 px-6 py-5 dark:border-white/5">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setIsTimePickerOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="button" fullWidth onClick={saveReminderTime}>
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

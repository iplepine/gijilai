"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import BottomNav from "@/components/layout/BottomNav";
import {
  db,
  ChildProfile,
  PracticeItemData,
  PracticeLogData,
  SessionData,
} from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/layout/Navbar";
import {
  PracticeCheckModal,
  type ParentImpressionType,
  type PracticeAiFeedback,
  type PracticeAttemptType,
  type PracticeCheckSaveResult,
  type PracticeCheckSavePayload,
} from "@/components/practices/PracticeCheckModal";
import { PracticeReviewModal } from "@/components/practices/PracticeReviewModal";
import { useLocale } from "@/i18n/LocaleProvider";
import { getFeatureAccess } from "@/lib/access";
import { getLocalDateString } from "@/lib/date";
import {
  getPracticeLifecycle,
  type PracticeLifecycle,
  type PracticeLifecycleStatus,
} from "@/lib/practiceLifecycle";
import {
  buildPracticeReminderPlan,
  formatPracticeReminderTime,
  isAppWebView,
  postPracticeReminderSync,
  readPracticeReminderPreferences,
  type PracticeReminderPreferences,
} from "@/lib/practiceReminder";
import {
  getPracticeQuickCheckInKey,
  normalizePracticeQuickCheckInPayload,
  PRACTICE_QUICK_CHECK_IN_EVENT,
  type PracticeQuickCheckInPayload,
} from "@/lib/practiceQuickCheckIn";
import { trackEvent } from "@/lib/analytics";

interface PracticeWithSession extends PracticeItemData {
  consultation_sessions: SessionData;
}

interface GroupedPractices {
  session: SessionData;
  practices: PracticeItemData[];
}

interface PracticeInsight {
  totalLogs: number;
  doneLogs: number;
  skippedLogs: number;
  completionRate: number;
  uncheckedToday: number;
  recentMemo: string | null;
}

const DEFAULT_REMINDER_PREFERENCES: PracticeReminderPreferences = {
  pushEnabled: true,
  practiceReminderEnabled: true,
  practiceReminderTime: "20:00",
};

interface ParsedPracticeDescription {
  trigger: string | null;
  action: string | null;
  body: string;
}

function parsePracticeDescription(description: string): ParsedPracticeDescription {
  const match = description.match(
    /^\[IF\]\s*([^\n]+)\r?\n\[THEN\]\s*([^\n]+)(?:\r?\n){2,}([\s\S]*)$/,
  );

  if (!match) {
    return {
      trigger: null,
      action: null,
      body: description,
    };
  }

  return {
    trigger: match[1].trim(),
    action: match[2].trim(),
    body: match[3].trim(),
  };
}

function PracticeDescription({
  description,
  whenLabel,
  actionLabel,
}: {
  description: string;
  whenLabel: string;
  actionLabel: string;
}) {
  const parsed = parsePracticeDescription(description);

  if (!parsed.trigger || !parsed.action) {
    return (
      <p className="text-[13px] leading-relaxed text-text-main dark:text-white">
        {description}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="border-l-2 border-secondary/50 pl-3">
          <p className="text-[10px] font-black text-secondary">{whenLabel}</p>
          <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-text-main dark:text-white">
            {parsed.trigger}
          </p>
        </div>
        <div className="border-l-2 border-primary/50 pl-3">
          <p className="text-[10px] font-black text-primary">{actionLabel}</p>
          <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-text-main dark:text-white">
            {parsed.action}
          </p>
        </div>
      </div>
      {parsed.body && (
        <p className="text-[13px] leading-relaxed text-text-main dark:text-white">
          {parsed.body}
        </p>
      )}
    </div>
  );
}

function buildPracticeChangeUrl(sessionId: string, practiceId: string) {
  const params = new URLSearchParams({
    sessionId,
    source: "practice_feedback",
    replacePracticeId: practiceId,
  });
  return `/consult?${params.toString()}`;
}

export default function PracticesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { locale, t } = useLocale();
  const [practices, setPractices] = useState<PracticeWithSession[]>([]);
  const [allLogs, setAllLogs] = useState<PracticeLogData[]>([]);
  const [todayLogs, setTodayLogs] = useState<PracticeLogData[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | "ALL">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [reminderPreferences, setReminderPreferences] =
    useState<PracticeReminderPreferences>(DEFAULT_REMINDER_PREFERENCES);
  const [pendingQuickCheckIn, setPendingQuickCheckIn] =
    useState<PracticeQuickCheckInPayload | null>(null);
  const [quickCheckInNotice, setQuickCheckInNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const handledFocusPracticeIdRef = useRef<string | null>(null);
  const handledQuickCheckInKeysRef = useRef<Set<string>>(new Set());

  // 모달 상태
  const [checkModal, setCheckModal] = useState<{
    practice: PracticeItemData;
    existingLog?: PracticeLogData;
    recentFailCount?: number;
    sessionId?: string;
    enableChildReactionFeedback?: boolean;
  } | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    practice: PracticeItemData;
    doneDays: number;
    sessionId?: string;
    reviewMode?: "complete" | "due" | "stale";
  } | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [childrenData, practicesData, todayLogsData, subscription] =
        await Promise.all([
          db.getChildren(user.id),
          db.getActivePracticeItems(user.id),
          db.getTodayPracticeLogs(user.id),
          db.getActiveSubscription(user.id).catch(() => null),
        ]);
      const access = getFeatureAccess({
        userCreatedAt: user.created_at,
        hasSubscription: !!subscription,
      });
      setHasFullAccess(access.hasFullAccess);
      setChildren(childrenData);
      const sortedPractices = [
        ...(practicesData as PracticeWithSession[]),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const visiblePractices = access.visiblePracticeCount
        ? sortedPractices.slice(0, access.visiblePracticeCount)
        : sortedPractices;
      setPractices(visiblePractices);
      setTodayLogs(todayLogsData);

      if (subscription && sortedPractices.length > visiblePractices.length) {
        void fetch("/api/subscription/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventName: "PRACTICE_HISTORY_VIEW" }),
        }).catch((error) => {
          console.error("Failed to record practice history usage:", error);
        });
      }

      // 각 practice의 전체 로그 가져오기
      const practiceIds = practicesData.map((p) => p.id);
      if (practiceIds.length > 0) {
        const { data: logsData, error: logsError } = await supabase
          .from("practice_logs")
          .select("*")
          .in("practice_id", practiceIds)
          .order("date", { ascending: false });
        if (logsError) {
          console.error("Failed to fetch practice logs:", logsError);
          setAllLogs([]);
          return;
        }
        setAllLogs((logsData || []) as PracticeLogData[]);
      } else {
        setAllLogs([]);
      }
    } catch (e) {
      console.error("Failed to fetch practices:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        void fetchData();
      } else {
        setIsLoading(false);
      }
    }
  }, [authLoading, fetchData, user]);

  useEffect(() => {
    const loadReminderPreferences = () => {
      setReminderPreferences(
        readPracticeReminderPreferences(DEFAULT_REMINDER_PREFERENCES),
      );
    };

    loadReminderPreferences();
    window.addEventListener("focus", loadReminderPreferences);
    window.addEventListener("storage", loadReminderPreferences);
    return () => {
      window.removeEventListener("focus", loadReminderPreferences);
      window.removeEventListener("storage", loadReminderPreferences);
    };
  }, []);

  useEffect(() => {
    const receiveQuickCheckIn = (value: unknown) => {
      const payload = normalizePracticeQuickCheckInPayload(value);
      if (payload) {
        setPendingQuickCheckIn(payload);
      }
    };
    const handleQuickCheckIn = (event: Event) => {
      receiveQuickCheckIn((event as CustomEvent<unknown>).detail);
    };

    window.addEventListener(PRACTICE_QUICK_CHECK_IN_EVENT, handleQuickCheckIn);
    receiveQuickCheckIn(window.__pendingPracticeQuickCheckIn);

    return () => {
      window.removeEventListener(
        PRACTICE_QUICK_CHECK_IN_EVENT,
        handleQuickCheckIn,
      );
    };
  }, []);

  useEffect(() => {
    if (!quickCheckInNotice) return;
    const timeoutId = window.setTimeout(() => {
      setQuickCheckInNotice(null);
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [quickCheckInNotice]);

  const today = getLocalDateString();

  const filteredPractices = useMemo(
    () =>
      selectedChildId === "ALL"
        ? practices
        : practices.filter(
            (practice) =>
              practice.consultation_sessions?.child_id === selectedChildId,
          ),
    [practices, selectedChildId],
  );

  const checkedTodayIds = useMemo(
    () => new Set(todayLogs.map((log) => log.practice_id)),
    [todayLogs],
  );

  const lifecycleByPracticeId = useMemo(
    () =>
      new Map(
        filteredPractices.map((practice) => [
          practice.id,
          getPracticeLifecycle(practice, allLogs, today),
        ]),
      ),
    [allLogs, filteredPractices, today],
  );

  const getLifecycle = useCallback(
    (practice: PracticeItemData): PracticeLifecycle =>
      lifecycleByPracticeId.get(practice.id) ??
      getPracticeLifecycle(practice, allLogs, today),
    [allLogs, lifecycleByPracticeId, today],
  );

  const getLifecyclePriority = useCallback(
    (practice: PracticeItemData) => {
      const lifecycle = getLifecycle(practice);
      if (lifecycle.status === "DUE_FOR_REVIEW") return 0;
      if (lifecycle.status === "STALE") return 1;
      if (lifecycle.status === "NEEDS_RECONNECT") return 2;
      if (!checkedTodayIds.has(practice.id)) return 3;
      return 4;
    },
    [checkedTodayIds, getLifecycle],
  );

  const grouped = useMemo(() => {
    const groupedMap = new Map<string, GroupedPractices>();

    for (const practice of filteredPractices) {
      const session = practice.consultation_sessions;
      if (!session) continue;

      const existing = groupedMap.get(session.id);
      if (existing) {
        existing.practices.push(practice);
        continue;
      }

      groupedMap.set(session.id, {
        session,
        practices: [practice],
      });
    }

    return [...groupedMap.values()].sort((a, b) => {
      const aPriority = Math.min(...a.practices.map(getLifecyclePriority));
      const bPriority = Math.min(...b.practices.map(getLifecyclePriority));
      return aPriority - bPriority;
    });
  }, [filteredPractices, getLifecyclePriority]);

  const recommendedPractice = useMemo(() => {
    const attentionPractice = [...filteredPractices]
      .sort((a, b) => getLifecyclePriority(a) - getLifecyclePriority(b))
      .find((practice) => getLifecycle(practice).status !== "ACTIVE");
    if (attentionPractice) return attentionPractice;

    const uncheckedPractice = filteredPractices.find(
      (practice) => !checkedTodayIds.has(practice.id),
    );
    return uncheckedPractice ?? filteredPractices[0] ?? null;
  }, [checkedTodayIds, filteredPractices, getLifecycle, getLifecyclePriority]);

  const practiceInsight = useMemo<PracticeInsight | null>(() => {
    if (filteredPractices.length === 0) return null;

    const visiblePracticeIds = new Set(
      filteredPractices.map((practice) => practice.id),
    );
    const visibleLogs = allLogs.filter((log) =>
      visiblePracticeIds.has(log.practice_id),
    );
    const doneLogs = visibleLogs.filter((log) => log.done).length;
    const skippedLogs = visibleLogs.filter((log) => !log.done).length;
    const recentMemo =
      visibleLogs
        .filter((log) => log.memo && log.memo.trim().length > 0)
        .sort((a, b) => b.date.localeCompare(a.date))[0]
        ?.memo?.trim() || null;
    return {
      totalLogs: visibleLogs.length,
      doneLogs,
      skippedLogs,
      completionRate:
        visibleLogs.length > 0
          ? Math.round((doneLogs / visibleLogs.length) * 100)
          : 0,
      uncheckedToday: filteredPractices.filter(
        (practice) =>
          getLifecycle(practice).status === "ACTIVE" &&
          !checkedTodayIds.has(practice.id),
      ).length,
      recentMemo,
    };
  }, [allLogs, checkedTodayIds, filteredPractices, getLifecycle]);

  const getTodayLog = (practiceId: string) =>
    todayLogs.find((l) => l.practice_id === practiceId);

  const getRecentFailCount = (practiceId: string) => {
    const logs = allLogs
      .filter((l) => l.practice_id === practiceId)
      .sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    for (const log of logs) {
      if (!log.done) count++;
      else break;
    }
    return count;
  };

  const focusPracticeId = searchParams.get("focusPracticeId");

  useEffect(() => {
    if (
      isLoading ||
      !focusPracticeId ||
      handledFocusPracticeIdRef.current === focusPracticeId
    ) {
      return;
    }

    const practice = filteredPractices.find(
      (item) => item.id === focusPracticeId,
    );
    if (!practice) return;

    handledFocusPracticeIdRef.current = focusPracticeId;
    const lifecycle = getLifecycle(practice);
    if (lifecycle.status === "DUE_FOR_REVIEW" || lifecycle.status === "STALE") {
      setReviewModal({
        practice,
        doneDays: lifecycle.doneDays,
        sessionId: practice.session_id,
        reviewMode: lifecycle.status === "STALE" ? "stale" : "due",
      });
      return;
    }

    const todayLog = todayLogs.find((log) => log.practice_id === practice.id);
    const practiceLogs = allLogs
      .filter((log) => log.practice_id === practice.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    let recentFailCount = 0;
    for (const log of practiceLogs) {
      if (!log.done) recentFailCount++;
      else break;
    }
    const hasPreviousLogs = allLogs.some(
      (log) =>
        log.practice_id === practice.id && (!todayLog || log.id !== todayLog.id),
    );

    setCheckModal({
      practice,
      existingLog: todayLog,
      recentFailCount,
      sessionId: practice.session_id,
      enableChildReactionFeedback:
        recommendedPractice?.id === practice.id && hasPreviousLogs,
    });
  }, [
    allLogs,
    filteredPractices,
    focusPracticeId,
    getLifecycle,
    isLoading,
    recommendedPractice?.id,
    todayLogs,
  ]);

  const parseAiFeedback = (value: PracticeLogData["ai_feedback"]): PracticeAiFeedback | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.reactionInsight === "string" &&
      typeof candidate.tomorrowAdjustment === "string" &&
      typeof candidate.parentEncouragement === "string"
    ) {
      return {
        reactionInsight: candidate.reactionInsight,
        tomorrowAdjustment: candidate.tomorrowAdjustment,
        parentEncouragement: candidate.parentEncouragement,
      };
    }
    return null;
  };

  const handleCheckSave = useCallback(
    async (payload: PracticeCheckSavePayload): Promise<PracticeCheckSaveResult | null> => {
      if (!user || !checkModal) return null;
      const {
        done,
        memo,
        practiceAttemptType,
        practiceAttemptNote,
        childReactionType,
        childReactionNote,
        parentImpressionType,
      } = payload;
      const existingLog = checkModal.existingLog;
      const previousLogCount = allLogs.filter(
        (log) =>
          log.practice_id === checkModal.practice.id &&
          (!existingLog || log.id !== existingLog.id),
      ).length;
      const feedbackInputsChanged = !!existingLog
        && checkModal.enableChildReactionFeedback
        && (
          existingLog.done !== done
          || existingLog.practice_attempt_type !== (practiceAttemptType ?? null)
          || (existingLog.practice_attempt_note ?? null) !== (practiceAttemptNote ?? null)
          || existingLog.child_reaction_type !== (childReactionType ?? null)
          || (existingLog.child_reaction_note ?? null) !== (childReactionNote ?? null)
          || existingLog.parent_impression_type !== (parentImpressionType ?? null)
        );
      const logPayload: Parameters<typeof db.createPracticeLog>[0] = {
        practice_id: checkModal.practice.id,
        user_id: user.id,
        date: today,
        done,
        memo: checkModal.enableChildReactionFeedback ? null : memo,
      };

      if (checkModal.enableChildReactionFeedback) {
        Object.assign(logPayload, {
          practice_attempt_type: practiceAttemptType ?? null,
          practice_attempt_note: practiceAttemptNote ?? null,
          child_reaction_type: childReactionType ?? null,
          child_reaction_note: childReactionNote ?? null,
          parent_impression_type: parentImpressionType ?? null,
        });
      }

      if (feedbackInputsChanged) {
        Object.assign(logPayload, {
          ai_feedback: null,
          ai_feedback_created_at: null,
          ai_feedback_model: null,
          ai_feedback_depth: null,
        });
      }

      const log = await db.createPracticeLog(logPayload);
      await fetchData();

      const createFeedbackSignal = () => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 15000);
        return { controller, timeoutId };
      };

      const clearFeedbackTimeout = (timeoutId: number) => {
        window.clearTimeout(timeoutId);
      };

      trackEvent("practice_log_saved", {
        done,
        first_log: previousLogCount === 0,
        has_full_access: hasFullAccess,
        with_reaction_feedback: !!checkModal.enableChildReactionFeedback,
        parent_impression_type: parentImpressionType ?? undefined,
        child_reaction_type: childReactionType ?? undefined,
      });

      let aiFeedback: PracticeAiFeedback | null = null;
      if (checkModal.enableChildReactionFeedback && childReactionType) {
        const { controller, timeoutId } = createFeedbackSignal();
        try {
          const response = await fetch("/api/consult/practice-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              logId: log.id,
              practiceId: checkModal.practice.id,
            }),
          });
          if (response.ok) {
            const payload = (await response.json()) as {
              feedback?: PracticeAiFeedback;
            };
            aiFeedback = payload.feedback ?? null;
          }
        } catch (error) {
          console.error("Failed to generate practice feedback:", error);
        } finally {
          clearFeedbackTimeout(timeoutId);
        }
      }
      if (aiFeedback) {
        trackEvent("practice_feedback_viewed", {
          first_log: previousLogCount === 0,
          has_full_access: hasFullAccess,
          child_reaction_type: childReactionType,
          parent_impression_type: parentImpressionType ?? undefined,
        });
        await fetchData();
      }

      return { aiFeedback };
    },
    [allLogs, checkModal, fetchData, hasFullAccess, today, user],
  );

  const savePracticeQuickCheckIn = useCallback(
    async (payload: PracticeQuickCheckInPayload) => {
      if (!user) return;

      const practice = practices.find(
        (item) => item.id === payload.practiceId,
      );
      if (!practice) {
        setQuickCheckInNotice({
          tone: "error",
          message: t("practices.quickCheckInMissingPractice"),
        });
        return;
      }

      const lifecycle = getPracticeLifecycle(practice, allLogs, today);
      if (lifecycle.status === "DUE_FOR_REVIEW" || lifecycle.status === "STALE") {
        setReviewModal({
          practice,
          doneDays: lifecycle.doneDays,
          sessionId: practice.session_id,
          reviewMode: lifecycle.status === "STALE" ? "stale" : "due",
        });
        setQuickCheckInNotice({
          tone: "error",
          message: t("practices.quickCheckInReviewNeeded"),
        });
        return;
      }

      const childId = practice.consultation_sessions?.child_id;
      if (childId) {
        setSelectedChildId(childId);
      }

      const existingLog = todayLogs.find(
        (log) => log.practice_id === practice.id,
      );
      const previousLogCount = allLogs.filter(
        (log) =>
          log.practice_id === practice.id &&
          (!existingLog || log.id !== existingLog.id),
      ).length;
      const memo = payload.memo?.trim() || null;

      try {
        await db.createPracticeLog({
          practice_id: practice.id,
          user_id: user.id,
          date: today,
          done: payload.done,
          memo,
          practice_attempt_type: payload.done ? "as_prescribed" : "barely_tried",
          practice_attempt_note: memo,
          child_reaction_type: payload.done ? null : "not_tried",
          child_reaction_note: null,
          parent_impression_type: null,
          ai_feedback: null,
          ai_feedback_created_at: null,
          ai_feedback_model: null,
          ai_feedback_depth: null,
        });
        trackEvent("practice_log_saved", {
          done: payload.done,
          first_log: previousLogCount === 0,
          has_full_access: hasFullAccess,
          with_reaction_feedback: false,
          quick_checkin: true,
          source: payload.source ?? "notification_action",
        });
        await fetchData();
        setQuickCheckInNotice({
          tone: "success",
          message: payload.done
            ? t("practices.quickCheckInDoneSaved")
            : t("practices.quickCheckInSkippedSaved"),
        });
      } catch (error) {
        console.error("Failed to save quick practice check-in:", error);
        setQuickCheckInNotice({
          tone: "error",
          message: t("practices.quickCheckInFailed"),
        });
      }
    },
    [allLogs, fetchData, hasFullAccess, practices, t, today, todayLogs, user],
  );

  useEffect(() => {
    if (!pendingQuickCheckIn || isLoading || !user) return;

    const key = getPracticeQuickCheckInKey(pendingQuickCheckIn);
    if (handledQuickCheckInKeysRef.current.has(key)) return;

    handledQuickCheckInKeysRef.current.add(key);
    window.__pendingPracticeQuickCheckIn = null;
    setPendingQuickCheckIn(null);
    void savePracticeQuickCheckIn(pendingQuickCheckIn);
  }, [isLoading, pendingQuickCheckIn, savePracticeQuickCheckIn, user]);

  const handleReviewSave = useCallback(
    async (content: string) => {
      if (!user || !reviewModal) return;
      await db.createPracticeReview({
        practice_id: reviewModal.practice.id,
        user_id: user.id,
        content,
      });
      await db.updatePracticeItem(reviewModal.practice.id, {
        status: "COMPLETED",
      });
      trackEvent("practice_review_saved", {
        done_days: reviewModal.doneDays,
        review_mode: reviewModal.reviewMode ?? "complete",
        has_full_access: hasFullAccess,
      });
      await fetchData();
    },
    [fetchData, hasFullAccess, reviewModal, user],
  );

  const handleReviewResolveSession = useCallback(async () => {
    if (!user || !reviewModal?.sessionId) return;

    await db.updateSession(reviewModal.sessionId, {
      status: "RESOLVED",
    });

    const { data: activePractices, error } = await supabase
      .from("practice_items")
      .select("id")
      .eq("session_id", reviewModal.sessionId)
      .eq("status", "ACTIVE");

    if (error) throw error;

    const activePracticeIds = (activePractices || []).map(
      (practice) => practice.id,
    );
    if (activePracticeIds.length > 0) {
      const { error: updateError } = await supabase
        .from("practice_items")
        .update({ status: "DROPPED" })
        .in("id", activePracticeIds);
      if (updateError) throw updateError;
    }

    await fetchData();
  }, [fetchData, reviewModal?.sessionId, user]);

  const handleExtendPractice = useCallback(
    async (practice: PracticeItemData, lifecycle: PracticeLifecycle) => {
      if (!user || !lifecycle.canExtend) return;
      await db.updatePracticeItem(practice.id, {
        duration: lifecycle.extensionDuration,
      });
      await fetchData();
    },
    [fetchData, user],
  );

  useEffect(() => {
    if (isLoading || !isAppWebView()) return;

    const reminderPractices = practices.filter(
      (practice) => getLifecycle(practice).status === "ACTIVE",
    );
    const uncheckedPractice = reminderPractices.find(
      (practice) => !checkedTodayIds.has(practice.id),
    );
    const fallbackPractice = uncheckedPractice ?? reminderPractices[0];
    const reminderTime = formatPracticeReminderTime(
      reminderPreferences.practiceReminderTime,
      locale,
    );
    const title = fallbackPractice
      ? uncheckedPractice
        ? t("practices.reminderTitleWithItem", {
            title: fallbackPractice.title,
          })
        : t("practices.reminderTitleAllDone")
      : t("practices.reminderTitleNoActive");
    const body = fallbackPractice
      ? uncheckedPractice
        ? t("practices.reminderBodyWithItem", { time: reminderTime })
        : t("practices.reminderBodyAllDone", { time: reminderTime })
      : t("practices.reminderBodyNoActive");

    postPracticeReminderSync(
      buildPracticeReminderPlan({
        preferences: reminderPreferences,
        title,
        body,
        focusPracticeId: fallbackPractice?.id,
        activePracticeIds: reminderPractices.map((practice) => practice.id),
        activePracticeCount: reminderPractices.length,
        pendingPracticeCount: practiceInsight?.uncheckedToday ?? 0,
        userInitiated: false,
      }),
    );
  }, [
    checkedTodayIds,
    getLifecycle,
    isLoading,
    locale,
    practiceInsight?.uncheckedToday,
    practices,
    reminderPreferences,
    t,
  ]);

  const reminderEnabled =
    reminderPreferences.pushEnabled &&
    reminderPreferences.practiceReminderEnabled;
  const reminderTimeLabel = formatPracticeReminderTime(
    reminderPreferences.practiceReminderTime,
    locale,
  );
  const reminderStatusText = !reminderPreferences.pushEnabled
    ? t("practices.reminderPushOff")
    : !reminderPreferences.practiceReminderEnabled
      ? t("practices.reminderOff")
      : t("practices.reminderDailyAt", { time: reminderTimeLabel });
  const recommendedLifecycle = recommendedPractice
    ? getLifecycle(recommendedPractice)
    : null;

  const getStatusBadge = (status: PracticeLifecycleStatus) => {
    if (status === "DUE_FOR_REVIEW" || status === "STALE") {
      return t("practices.reviewStatusBadge");
    }
    if (status === "NEEDS_RECONNECT") {
      return t("practices.reconnectStatusBadge");
    }
    return t("practices.activeStatusBadge");
  };

  const getReviewMode = (
    status: PracticeLifecycleStatus,
  ): "complete" | "due" | "stale" => {
    if (status === "STALE") return "stale";
    if (status === "DUE_FOR_REVIEW") return "due";
    return "complete";
  };

  const getAttentionMessage = (
    lifecycle: PracticeLifecycle,
    duration: number,
  ) => {
    if (lifecycle.status === "DUE_FOR_REVIEW") {
      return t("practices.dueForReviewDesc", {
        duration,
      });
    }
    if (lifecycle.status === "STALE") {
      return t("practices.staleDesc", {
        days: lifecycle.inactiveDays,
      });
    }
    if (lifecycle.status === "NEEDS_RECONNECT") {
      return t("practices.needsReconnectDesc", {
        days: lifecycle.inactiveDays,
      });
    }
    return null;
  };

  const renderPracticeActions = (
    practice: PracticeItemData,
    lifecycle: PracticeLifecycle,
    options?: { featured?: boolean },
  ) => {
    const todayLog = getTodayLog(practice.id);
    const featured = options?.featured;
    const hasPreviousLogs = allLogs.some(
      (log) => log.practice_id === practice.id && (!todayLog || log.id !== todayLog.id),
    );
    const enableReactionFeedback = !!featured && hasPreviousLogs;
    const actionClassName = featured
      ? "w-full py-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
      : "w-full py-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]";

    if (lifecycle.status === "DUE_FOR_REVIEW" || lifecycle.status === "STALE") {
      return (
        <div className="space-y-2">
          <button
            onClick={() =>
              setReviewModal({
                practice,
                doneDays: lifecycle.doneDays,
                sessionId: practice.session_id,
                reviewMode: getReviewMode(lifecycle.status),
              })
            }
            className={`${actionClassName} bg-secondary/10 text-secondary`}
          >
            <span className="material-symbols-outlined text-[18px]">
              rate_review
            </span>
            {t(lifecycle.status === "STALE" ? "practices.reviewStaleCta" : "practices.reviewDueCta")}
          </button>
          <div className="grid grid-cols-2 gap-2">
            {lifecycle.canExtend && (
              <button
                onClick={() => handleExtendPractice(practice, lifecycle)}
                className="py-3 rounded-xl bg-primary/10 text-primary font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[17px]">
                  more_time
                </span>
                {t("practices.extendPracticeCta")}
              </button>
            )}
            {practice.session_id && (
              <button
                onClick={() =>
                  router.push(buildPracticeChangeUrl(practice.session_id, practice.id))
                }
                className={`py-3 rounded-xl bg-orange-50 text-orange-600 font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                  lifecycle.canExtend ? "" : "col-span-2"
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">
                  alt_route
                </span>
                {t("practices.changePracticeShort")}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (lifecycle.status === "NEEDS_RECONNECT") {
      return (
        <div className="space-y-2">
          <button
            onClick={() =>
              setCheckModal({
                practice,
                existingLog: todayLog,
                recentFailCount: getRecentFailCount(practice.id),
                sessionId: practice.session_id,
                enableChildReactionFeedback: enableReactionFeedback,
              })
            }
            className={`${actionClassName} bg-primary text-white shadow-sm shadow-primary/20`}
          >
            <span className="material-symbols-outlined text-[18px]">
              edit_note
            </span>
            {t("practices.resumePractice")}
          </button>
          {practice.session_id && (
            <button
              onClick={() =>
                router.push(buildPracticeChangeUrl(practice.session_id, practice.id))
              }
              className="w-full py-3 rounded-xl bg-orange-50 text-orange-600 font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[17px]">
                alt_route
              </span>
              {t("practices.changePracticeShort")}
            </button>
          )}
        </div>
      );
    }

    return (
      <button
        onClick={() =>
          setCheckModal({
            practice,
            existingLog: todayLog,
            recentFailCount: getRecentFailCount(practice.id),
            sessionId: practice.session_id,
            enableChildReactionFeedback: enableReactionFeedback,
          })
        }
        className={`${actionClassName} ${
          todayLog
            ? todayLog.done
              ? "bg-primary/10 text-primary"
              : "bg-orange-50 text-orange-600"
            : "bg-primary text-white shadow-sm shadow-primary/20"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">
          {todayLog ? (todayLog.done ? "check_circle" : "schedule") : "edit_note"}
        </span>
        {todayLog
          ? todayLog.done
            ? t("practices.doneToday")
            : t("practices.failedToday")
          : t("practices.recordToday")}
      </button>
    );
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
        <Navbar title={t("nav.practices")} />

        <main className="app-bottom-nav-scroll flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {quickCheckInNotice && (
            <div
              className={`rounded-2xl border px-4 py-3 text-[13px] font-bold ${
                quickCheckInNotice.tone === "success"
                  ? "border-primary/15 bg-primary/5 text-primary"
                  : "border-orange-200 bg-orange-50 text-orange-700"
              }`}
              role="status"
            >
              {quickCheckInNotice.message}
            </div>
          )}

          {/* 아이별 필터 */}
          {children.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSelectedChildId("ALL")}
                className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all ${
                  selectedChildId === "ALL"
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white dark:bg-surface-dark text-text-sub border border-primary/10"
                }`}
              >
                {t("common.all")}
              </button>
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all ${
                    selectedChildId === child.id
                      ? "bg-primary text-white shadow-sm"
                      : "bg-white dark:bg-surface-dark text-text-sub border border-primary/10"
                  }`}
                >
                  {child.name}
                </button>
              ))}
            </div>
          )}

          {!isLoading && !hasFullAccess && practices.length > 0 && (
            <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold text-text-main dark:text-white">
                  {t("practices.lockedTitle")}
                </p>
                <p className="text-[11px] text-text-sub dark:text-gray-400">
                  {t("practices.lockedDesc")}
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/pricing?source=practices&entry_cta=practice_history_lock")}
                className="shrink-0 rounded-xl px-4"
              >
                {t("consult.subscribeCta")}
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
              <span className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
              <p className="text-sm font-medium text-text-sub">
                {t("practices.loadingRecords")}
              </p>
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-24 flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-5xl text-primary/40">
                  self_improvement
                </span>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-text-main dark:text-white text-lg">
                  {t("practices.noPractices")}
                </p>
                <p className="text-text-sub text-sm leading-relaxed break-keep px-6">
                  {t("practices.noPracticesDesc")}
                </p>
              </div>
              <button
                onClick={() => router.push("/consult")}
                className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-[15px] shadow-xl shadow-primary/20 flex items-center gap-2 active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">
                  chat_bubble
                </span>
                {t("practices.startConsult")}
              </button>
            </div>
          ) : (
            <>
              {recommendedPractice && recommendedLifecycle && (
                <section className="rounded-3xl border border-primary/15 bg-white dark:bg-surface-dark p-5 space-y-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold text-primary uppercase tracking-wider">
                        {recommendedLifecycle.status === "NEEDS_RECONNECT"
                          ? t("practices.recommendedReconnectEyebrow")
                          : recommendedLifecycle.status !== "ACTIVE"
                            ? t("practices.recommendedAttentionEyebrow")
                            : t("practices.recommendedEyebrow")}
                      </p>
                      <h2 className="mt-1 text-[17px] font-bold text-text-main dark:text-white">
                        {recommendedPractice.title}
                      </h2>
                      <p className="mt-1 text-[12px] leading-relaxed text-text-sub">
                        {recommendedLifecycle.status !== "ACTIVE"
                          ? t("practices.recommendedAttentionDescription")
                          : t("practices.recommendedDescription")}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                      {getStatusBadge(recommendedLifecycle.status)}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-primary/5 p-4">
                    {getAttentionMessage(
                      recommendedLifecycle,
                      recommendedPractice.duration,
                    ) && (
                      <p className="mb-3 rounded-xl bg-white/70 px-3 py-2 text-[12px] font-medium leading-relaxed text-text-main dark:bg-white/5 dark:text-white">
                        {getAttentionMessage(
                          recommendedLifecycle,
                          recommendedPractice.duration,
                        )}
                      </p>
                    )}
                    <PracticeDescription
                      description={recommendedPractice.description}
                      whenLabel={t("practices.practiceWhenLabel")}
                      actionLabel={t("practices.practiceActionLabel")}
                    />
                    {recommendedPractice.encouragement && (
                      <p className="mt-2 text-[12px] font-medium text-secondary">
                        {recommendedPractice.encouragement}
                      </p>
                    )}
                  </div>

                  {renderPracticeActions(recommendedPractice, recommendedLifecycle, {
                    featured: true,
                  })}
                </section>
              )}

              {practiceInsight && (
                <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-primary/10 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold text-secondary uppercase tracking-wider">
                        {t("practices.insightEyebrow")}
                      </p>
                      <h2 className="text-[17px] font-bold text-text-main dark:text-white mt-1">
                        {t("practices.insightTitle")}
                      </h2>
                    </div>
                    <button
                      onClick={() => router.push("/settings/notifications")}
                      className="rounded-2xl border border-primary/10 bg-primary/5 px-3 py-2 text-left text-primary transition-all active:scale-[0.98]"
                      aria-label={t("practices.reminderSettings")}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">
                          notifications
                        </span>
                        <div>
                          <p className="text-[11px] font-bold">
                            {t("practices.reminderSettings")}
                          </p>
                          <p className="text-[11px] text-primary/70">
                            {reminderStatusText}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-primary/5 p-3">
                      <p className="text-[11px] text-text-sub">
                        {t("practices.completionRate")}
                      </p>
                      <p className="text-[18px] font-bold text-primary mt-1">
                        {practiceInsight.completionRate}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-secondary/5 p-3">
                      <p className="text-[11px] text-text-sub">
                        {t("practices.doneCount")}
                      </p>
                      <p className="text-[18px] font-bold text-secondary mt-1">
                        {practiceInsight.doneLogs}
                      </p>
                    </div>
                    <div className="rounded-xl bg-orange-50 dark:bg-orange-900/10 p-3">
                      <p className="text-[11px] text-text-sub">
                        {t("practices.uncheckedToday")}
                      </p>
                      <p className="text-[18px] font-bold text-orange-600 mt-1">
                        {practiceInsight.uncheckedToday}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-beige-main/20 dark:bg-white/5 p-3 space-y-2">
                    <p className="text-[12px] text-text-sub leading-relaxed">
                      {practiceInsight.totalLogs > 0
                        ? t("practices.insightSummary", {
                            done: practiceInsight.doneLogs,
                            skipped: practiceInsight.skippedLogs,
                          })
                        : t("practices.insightEmpty")}
                    </p>
                    {practiceInsight.recentMemo && (
                      <p className="text-[12px] font-medium text-text-main dark:text-white leading-relaxed line-clamp-2">
                        &quot;{practiceInsight.recentMemo}&quot;
                      </p>
                    )}
                    {practiceInsight.uncheckedToday > 0 && reminderEnabled && (
                      <p className="text-[12px] text-primary font-medium">
                        {t("practices.reminderSummary", {
                          count: practiceInsight.uncheckedToday,
                          time: reminderTimeLabel,
                        })}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {grouped.map(({ session, practices: sessionPractices }, gi) => (
                <div key={`${session.id}-${gi}`} className="space-y-3">
                  {/* 세션 헤더 */}
                  {(() => {
                    const visibleSessionPractices = sessionPractices.filter(
                      (practice) => practice.id !== recommendedPractice?.id,
                    );

                    if (visibleSessionPractices.length === 0) {
                      return null;
                    }

                    return (
                      <>
                        <button
                          onClick={() => router.push(`/consultations/${session.id}`)}
                          className="flex items-center gap-2 group"
                        >
                          <div className="w-1 h-4 bg-secondary rounded-full" />
                          <h3 className="text-[14px] font-bold text-text-main dark:text-white group-hover:text-secondary transition-colors">
                            {session.title}
                          </h3>
                          <span className="material-symbols-outlined text-[14px] text-text-sub/50">
                            chevron_right
                          </span>
                        </button>

                        {/* 실천 카드들 */}
                        {[...visibleSessionPractices]
                          .sort(
                            (a, b) =>
                              getLifecyclePriority(a) - getLifecyclePriority(b),
                          )
                          .map((practice) => {
                            const lifecycle = getLifecycle(practice);
                            const attentionMessage = getAttentionMessage(
                              lifecycle,
                              practice.duration,
                            );

                            return (
                              <div
                                key={practice.id}
                                className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-primary/10 space-y-3"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-[14px] font-bold text-text-main dark:text-white">
                                      {practice.title}
                                    </p>
                                    {lifecycle.status !== "ACTIVE" && (
                                      <span className="mt-2 inline-flex rounded-full bg-secondary/10 px-2.5 py-1 text-[10px] font-bold text-secondary">
                                        {getStatusBadge(lifecycle.status)}
                                      </span>
                                    )}
                                    <div className="mt-2">
                                      <PracticeDescription
                                        description={practice.description}
                                        whenLabel={t("practices.practiceWhenLabel")}
                                        actionLabel={t("practices.practiceActionLabel")}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* 진행률 */}
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-primary/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary rounded-full transition-all"
                                      style={{
                                        width: `${Math.round(lifecycle.progress * 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-primary">
                                    {lifecycle.doneDays}/{practice.duration}
                                    {t("common.days")}
                                  </span>
                                </div>

                                {attentionMessage && (
                                  <p className="rounded-xl bg-secondary/5 px-3 py-2 text-[12px] font-medium leading-relaxed text-text-main dark:bg-white/5 dark:text-white">
                                    {attentionMessage}
                                  </p>
                                )}

                                {/* 응원 메시지 */}
                                {practice.encouragement && (
                                  <p className="text-[11px] text-secondary font-medium">
                                    {practice.encouragement}
                                  </p>
                                )}

                                {/* 오늘 체크 / 회고 버튼 */}
                                {renderPracticeActions(practice, lifecycle)}
                              </div>
                            );
                          })}
                      </>
                    );
                  })()}
                </div>
              ))}
            </>
          )}
        </main>

        <BottomNav />
      </div>

      {/* 체크 모달 */}
      {checkModal && (
        <PracticeCheckModal
          practiceTitle={checkModal.practice.title}
          existingDone={checkModal.existingLog?.done}
          existingMemo={checkModal.existingLog?.memo}
          existingPracticeAttemptType={
            (checkModal.existingLog?.practice_attempt_type ?? null) as PracticeAttemptType | null
          }
          existingPracticeAttemptNote={
            checkModal.existingLog?.practice_attempt_note ?? null
          }
          existingChildReactionType={
            checkModal.existingLog?.child_reaction_type ?? null
          }
          existingChildReactionNote={checkModal.existingLog?.child_reaction_note}
          existingParentImpressionType={
            (checkModal.existingLog?.parent_impression_type ?? null) as ParentImpressionType | null
          }
          existingAiFeedback={parseAiFeedback(
            checkModal.existingLog?.ai_feedback ?? null,
          )}
          enableChildReactionFeedback={checkModal.enableChildReactionFeedback}
          recentFailCount={checkModal.recentFailCount}
          onChangePractice={
            checkModal.sessionId
              ? () => {
                  setCheckModal(null);
                  router.push(
                    buildPracticeChangeUrl(
                      checkModal.sessionId ?? "",
                      checkModal.practice.id,
                    ),
                  );
                }
              : undefined
          }
          onSave={handleCheckSave}
          onClose={() => setCheckModal(null)}
        />
      )}

      {/* 회고 모달 */}
      {reviewModal && (
        <PracticeReviewModal
          practiceTitle={reviewModal.practice.title}
          doneDays={reviewModal.doneDays}
          totalDays={reviewModal.practice.duration}
          sessionId={reviewModal.sessionId}
          reviewMode={reviewModal.reviewMode}
          onSave={handleReviewSave}
          onResolveSession={
            reviewModal.sessionId ? handleReviewResolveSession : undefined
          }
          onClose={() => setReviewModal(null)}
        />
      )}
    </div>
  );
}

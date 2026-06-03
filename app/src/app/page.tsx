"use client";

import {
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import BottomNav from "@/components/layout/BottomNav";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeLoadingScreen } from "@/components/home/HomeLoadingScreen";
import { HomeWelcomeState } from "@/components/home/HomeWelcomeState";
import LandingPage from "@/components/landing/LandingPage";
import { db, ChildProfile, PracticeItemData } from "@/lib/db";
import { TemperamentScorer } from "@/lib/TemperamentScorer";
import { TemperamentClassifier } from "@/lib/TemperamentClassifier";
import { CHILD_QUESTIONS, PARENT_QUESTIONS } from "@/data/questions";
import { TCI_TERMINOLOGY } from "@/constants/terminology";
import { useLocale } from "@/i18n/LocaleProvider";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import {
  extractReportScores,
  isTemperamentScores,
  parseAnswerMap,
  type TemperamentScores,
} from "@/lib/home";
import { getLocalDateString } from "@/lib/date";
import {
  buildPracticeReminderPlan,
  formatPracticeReminderTime,
  isAppWebView,
  postPracticeReminderSync,
  readPracticeReminderPreferences,
  type PracticeReminderPreferences,
} from "@/lib/practiceReminder";
import { trackEvent } from "@/lib/analytics";
import { getFeatureAccess } from "@/lib/access";
import type { HomeSosSituationKey } from "@/lib/consultSituationPrefill";

const DEFAULT_REMINDER_PREFERENCES: PracticeReminderPreferences = {
  pushEnabled: true,
  practiceReminderEnabled: true,
  practiceReminderTime: "20:00",
};
const PRIMARY_PRACTICE_PREVIEW_LIMIT = 2;
const PARENT_ATQ_DISMISS_STORAGE_KEY = "gijilai.parentAtqDismissedUntil";
const PARENT_ATQ_DISMISS_DAYS = 7;

function readParentAtqDismissedUntil(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(PARENT_ATQ_DISMISS_STORAGE_KEY);
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

type QuickPracticeMessage = {
  tone: "success" | "error" | "info";
  text: string;
  detail?: string;
  actionHref?: string;
  actionText?: string;
};

const HOME_SOS_SITUATIONS: Array<{
  key: HomeSosSituationKey;
  icon: string;
  labelKey: string;
}> = [
  {
    key: "morning_transition",
    icon: "directions_walk",
    labelKey: "home.sosMorning",
  },
  {
    key: "meltdown",
    icon: "sentiment_stressed",
    labelKey: "home.sosMeltdown",
  },
  {
    key: "sleep",
    icon: "bedtime",
    labelKey: "home.sosSleep",
  },
  {
    key: "parent_regret",
    icon: "favorite",
    labelKey: "home.sosParentRegret",
  },
];

function HomeModuleReveal({
  children,
}: {
  children: ReactNode;
  order?: number;
}) {
  return <>{children}</>;
}

export default function HomePage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const { user, loading: authLoading } = useAuth();
  const {
    intake,
    cbqResponses,
    atqResponses,
    resetSurveyOnly,
    selectedChildId,
    setSelectedChildId,
  } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const [showSurveyIntro, setShowSurveyIntro] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [magicWordIndex, setMagicWordIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showChildDropdown, setShowChildDropdown] = useState(false);
  const [sosInput, setSosInput] = useState("");
  const [quickPracticeSavingId, setQuickPracticeSavingId] = useState<
    string | null
  >(null);
  const [quickPracticeCompletedIds, setQuickPracticeCompletedIds] = useState<
    Set<string>
  >(() => new Set());
  const [quickPracticeSnoozedIds, setQuickPracticeSnoozedIds] = useState<
    Set<string>
  >(() => new Set());
  const [quickPracticeMessage, setQuickPracticeMessage] =
    useState<QuickPracticeMessage | null>(null);
  const [parentAtqDismissedUntil, setParentAtqDismissedUntil] = useState<number>(0);
  const parentAtqShownRef = useRef(false);
  useEffect(() => {
    setParentAtqDismissedUntil(readParentAtqDismissedUntil());
  }, []);
  const {
    profile,
    children,
    reports,
    surveys,
    practices,
    showConsultCTA,
    allMagicWords,
    subscription,
    loading,
  } = useHomeDashboard({
    userId: user?.id,
    authLoading,
  });

  // Derived Child Profile (DB first, then local intake store)
  const mainChild = useMemo(() => {
    if (children.length > 0) {
      if (selectedChildId) {
        const found = children.find((c) => c.id === selectedChildId);
        if (found) return found;
      }
      return children[0];
    }
    if (intake.childName) {
      return {
        id: "temporary-intake-id",
        name: intake.childName,
        birth_date: intake.birthDate,
        gender: (intake.gender || "MALE").toUpperCase(),
        image_url: null,
      } as ChildProfile;
    }
    return null;
  }, [children, selectedChildId, intake]);

  // 홈에서 실제로 보여주는 아이를 selectedChildId에 반영해, 상담 등 다른 화면이 같은 아이를 대상으로 하게 한다.
  // (selectedChildId가 비어 있으면 화면마다 fallback 대상(children[0])이 달라져 엉뚱한 아이로 진입하던 문제 방지)
  useEffect(() => {
    if (!mainChild || mainChild.id === "temporary-intake-id") return;
    if (mainChild.id !== selectedChildId) setSelectedChildId(mainChild.id);
  }, [mainChild, selectedChildId, setSelectedChildId]);

  // Derived per-child surveys
  const latestSurvey = useMemo(() => {
    if (!mainChild) return null;
    return (
      surveys.find((s) => (
        s.type === "CHILD" &&
        s.child_id === mainChild.id &&
        s.status === "COMPLETED"
      )) ||
      null
    );
  }, [surveys, mainChild]);

  const parentSurvey = useMemo(() => {
    return surveys.find((s) => s.type === "PARENT" && s.status === "COMPLETED") || null;
  }, [surveys]);

  // Handle Child Selection
  const handleChildSelect = (index: number) => {
    const child = children[index];
    if (child) setSelectedChildId(child.id);
  };

  // 선택된 아이의 마법의 한마디
  const magicWords = useMemo(() => {
    if (!mainChild) return allMagicWords;
    return allMagicWords.filter((w) => w.childId === mainChild.id);
  }, [allMagicWords, mainChild]);

  // 홈 진입 시 최근 한마디 목록에서 하나를 순환 노출
  useEffect(() => {
    if (magicWords.length === 0) {
      setMagicWordIndex(0);
      return;
    }

    const storageKey = `home-magic-word-index:${mainChild?.id || "all"}`;
    let nextIndex = 0;

    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(storageKey);
      const previousIndex = raw ? Number(raw) : -1;
      nextIndex = Number.isFinite(previousIndex)
        ? (previousIndex + 1) % magicWords.length
        : 0;
      window.localStorage.setItem(storageKey, String(nextIndex));
    }

    setMagicWordIndex(nextIndex);
  }, [magicWords.length, mainChild?.id]);

  // 아이 전환 직후 한 프레임 동안은 magicWords가 새 길이로 바뀌었지만
  // magicWordIndex는 다음 effect까지 stale이라, 직접 인덱싱하면 undefined 접근으로 크래시.
  const currentMagicWord =
    magicWords.length > 0
      ? magicWords[magicWordIndex] ?? magicWords[0]
      : null;

  const childName = mainChild?.name || t("home.defaultChildName");
  const access = getFeatureAccess({
    userCreatedAt: user?.created_at,
    hasSubscription: !!subscription,
  });
  const trialStatus = access.trial;
  const hasFullAccess = access.hasFullAccess;
  const shouldShowTrialEndingCard =
    !subscription && !!trialStatus?.isActive && trialStatus.daysRemaining <= 2;
  const hasCompleteLocalChildResponses = Object.keys(cbqResponses).length >= CHILD_QUESTIONS.length;
  const hasCompleteLocalParentResponses = Object.keys(atqResponses).length >= PARENT_QUESTIONS.length;
  const shouldUseNativeLogin = !authLoading && !user && isAppWebView();

  // Derived Temperament (Parent = Soil, Child = Seed + Plant)
  // 양육자 기질은 아이와 무관하게 하나
  const parentTemperament = useMemo(() => {
    let parentScores: TemperamentScores = { NS: 50, HA: 50, RD: 50, P: 50 };
    const parentReport = reports.find((r) => r.type === "PARENT");
    const parentReportScores = extractReportScores(parentReport?.analysis_json);

    if (parentSurvey?.answers) {
      const parentSurveyAnswers = parseAnswerMap(parentSurvey.answers);
      if (parentSurveyAnswers) {
        parentScores = TemperamentScorer.calculate(
          PARENT_QUESTIONS,
          parentSurveyAnswers,
        );
      }
    } else if (hasCompleteLocalParentResponses) {
      parentScores = TemperamentScorer.calculate(
        PARENT_QUESTIONS,
        atqResponses,
      );
    } else if (parentReportScores) {
      parentScores = parentReportScores;
    }

    const parentType = TemperamentClassifier.analyzeParent(parentScores);
    const hasRealParentData =
      hasCompleteLocalParentResponses ||
      !!parentSurvey?.answers ||
      !!parentReportScores;

    return { ...parentType, hasData: hasRealParentData };
  }, [atqResponses, hasCompleteLocalParentResponses, parentSurvey, reports]);

  const temperamentInfo = useMemo(() => {
    // 해당 아이의 리포트나 설문 데이터 찾기
    const childReport = reports.find(
      (r) => r.child_id === mainChild?.id && r.type === "CHILD",
    );

    // Check DB report/survey first, then fall back to local store for temporary intake
    const childAnswers =
      extractReportScores(childReport?.analysis_json) ||
      parseAnswerMap(latestSurvey?.answers) ||
      (mainChild?.id === "temporary-intake-id" &&
      hasCompleteLocalChildResponses
        ? cbqResponses
        : null);

    if (!childAnswers) return null;

    const scores = isTemperamentScores(childAnswers)
      ? childAnswers
      : TemperamentScorer.calculate(CHILD_QUESTIONS, childAnswers);

    const childResult = TemperamentClassifier.analyzeChild(scores);

    return { child: childResult };
  }, [mainChild, cbqResponses, hasCompleteLocalChildResponses, latestSurvey, reports]);

  const childTestPending = !temperamentInfo;
  const parentAtqDismissed = parentAtqDismissedUntil > Date.now();
  const parentTestPending =
    !parentSurvey &&
    !hasCompleteLocalParentResponses &&
    !!temperamentInfo?.child &&
    !parentAtqDismissed;
  const handleParentAtqDismiss = useCallback(() => {
    const until = Date.now() + PARENT_ATQ_DISMISS_DAYS * 24 * 60 * 60 * 1000;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PARENT_ATQ_DISMISS_STORAGE_KEY, String(until));
    }
    setParentAtqDismissedUntil(until);
    trackEvent("parent_atq_card_dismissed", {
      location: "home_primary",
      dismiss_days: PARENT_ATQ_DISMISS_DAYS,
    });
  }, []);
  const handleParentAtqStart = useCallback(() => {
    trackEvent("parent_atq_card_clicked", {
      location: "home_primary",
      has_existing_responses: Object.keys(atqResponses).length > 0,
    });
  }, [atqResponses]);
  const handleHarmonyBadgeClick = useCallback(() => {
    if (!parentTemperament?.hasData) return;
    if (!temperamentInfo) {
      alert(t("home.childTestAlert", { name: childName }));
      router.push("/survey/intro");
      return;
    }
    trackEvent("harmony_report_viewed", {
      from: "home_parent_badge",
      has_subscription: !!subscription,
    });
    router.push("/report?tab=parent");
  }, [parentTemperament, temperamentInfo, t, router, subscription, childName]);
  const uncheckedPracticeItems = useMemo(
    () =>
      practices.uncheckedItems.filter(
        (item) =>
          !quickPracticeCompletedIds.has(item.id) &&
          !quickPracticeSnoozedIds.has(item.id),
      ),
    [
      practices.uncheckedItems,
      quickPracticeCompletedIds,
      quickPracticeSnoozedIds,
    ],
  );
  const hasPracticePriority =
    practices.attentionCount > 0 || uncheckedPracticeItems.length > 0;
  const practicePriorityItems =
    practices.attentionCount > 0
      ? practices.attentionItems
      : uncheckedPracticeItems;
  const practicePriorityCount =
    practices.attentionCount > 0
      ? practices.attentionCount
      : uncheckedPracticeItems.length;
  const primaryPracticePreviewItems = practicePriorityItems.slice(
    0,
    PRIMARY_PRACTICE_PREVIEW_LIMIT,
  );
  const primaryPracticeHiddenCount = Math.max(
    0,
    practicePriorityCount - primaryPracticePreviewItems.length,
  );
  const primaryQuickPractice =
    practices.attentionCount === 0 ? practicePriorityItems[0] : null;
  const hasConsultPriority = showConsultCTA && !!temperamentInfo?.child;
  const hasTrialPriority = shouldShowTrialEndingCard;

  const primaryAction = childTestPending
    ? "child_test"
    : parentTestPending
      ? "parent_test"
      : hasPracticePriority
        ? "practice"
        : hasConsultPriority
          ? "consult"
          : hasTrialPriority
            ? "trial"
            : null;

  useEffect(() => {
    if (primaryAction !== "parent_test") {
      parentAtqShownRef.current = false;
      return;
    }
    if (parentAtqShownRef.current) return;
    parentAtqShownRef.current = true;
    trackEvent("parent_atq_card_shown", {
      location: "home_primary",
      has_existing_responses: Object.keys(atqResponses).length > 0,
    });
  }, [primaryAction, atqResponses]);

  const openTrialConversion = (placement: string) => {
    trackEvent("trial_conversion_cta_clicked", {
      source: "home",
      entry_cta: "trial_ending",
      placement,
      trial_state: "active",
      trial_days_remaining: trialStatus?.daysRemaining ?? 0,
      has_subscription: false,
      has_practice_priority: hasPracticePriority,
      has_consult_priority: hasConsultPriority,
    });
    router.push("/pricing?source=home&entry_cta=trial_ending");
  };

  const openHomeSosConsult = useCallback(
    (situationKey: HomeSosSituationKey) => {
      trackEvent("home_sos_clicked", {
        source: "home",
        entry_cta: "today_sos",
        situation_key: situationKey,
        has_practice_priority: hasPracticePriority,
        has_consult_priority: hasConsultPriority,
      });
      const params = new URLSearchParams({
        source: "home_sos",
        entry_cta: "today_sos",
        situation: situationKey,
      });
      router.push(`/consult?${params.toString()}`);
    },
    [hasConsultPriority, hasPracticePriority, router],
  );

  const openHomeSosFreeText = useCallback(() => {
    const trimmed = sosInput.trim();
    if (!trimmed) return;
    trackEvent("home_sos_clicked", {
      source: "home",
      entry_cta: "today_sos_text",
      prefill_mode: "free_text",
      prefill_length: trimmed.length,
      has_practice_priority: hasPracticePriority,
      has_consult_priority: hasConsultPriority,
    });
    const params = new URLSearchParams({
      source: "home_sos",
      entry_cta: "today_sos_text",
      prefill: trimmed.slice(0, 500),
    });
    router.push(`/consult?${params.toString()}`);
  }, [hasConsultPriority, hasPracticePriority, router, sosInput]);

  const handleQuickPracticeSave = useCallback(
    async (practice: PracticeItemData, done: boolean) => {
      if (!user || !practice || quickPracticeSavingId) return;

      setQuickPracticeSavingId(practice.id);
      setQuickPracticeMessage(null);
      trackEvent("home_next_action_clicked", {
        source: "home",
        entry_cta: "practice_inline",
        next_action_type: "practice",
        action_type: done ? "done" : "not_done",
      });

      try {
        const today = getLocalDateString();
        const existingLogs = await db.getPracticeLogs(practice.id).catch(() => null);
        const feedbackHref = `/practices?focusPracticeId=${practice.id}`;

        const log = await db.createPracticeLog({
          practice_id: practice.id,
          user_id: user.id,
          date: today,
          done,
          memo: null,
          practice_attempt_type: done ? "as_prescribed" : "barely_tried",
          child_reaction_type: done ? "no_clear_reaction" : "not_tried",
          parent_impression_type: "not_sure",
          ai_feedback: null,
          ai_feedback_created_at: null,
          ai_feedback_model: null,
          ai_feedback_depth: null,
        });

        setQuickPracticeCompletedIds((previous) => {
          const next = new Set(previous);
          next.add(practice.id);
          return next;
        });
        setQuickPracticeMessage({
          tone: "success",
          text: done
            ? t("home.quickPracticeDoneSaved")
            : t("home.quickPracticeSkippedSaved"),
          detail: t("home.quickPracticeFeedbackPending"),
          actionHref: feedbackHref,
          actionText: t("home.quickPracticeFeedbackDetailCta"),
        });

        trackEvent("practice_log_saved", {
          source: "home",
          entry_cta: "practice_inline",
          done,
          first_log: existingLogs ? existingLogs.length === 0 : undefined,
          with_reaction_feedback: false,
        });

        if (hasFullAccess) {
          void (async () => {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 15000);
            try {
              const response = await fetch("/api/consult/practice-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                  logId: log.id,
                  practiceId: practice.id,
                }),
              });
              if (!response.ok) return;
              const payload = (await response.json()) as {
                feedback?: { tomorrowAdjustment?: string };
              };
              const adjustment = payload.feedback?.tomorrowAdjustment?.trim();
              if (!adjustment) return;
              setQuickPracticeMessage((previous) => {
                if (previous?.actionHref !== feedbackHref) return previous;
                return {
                  ...previous,
                  text: t("home.quickPracticeFeedbackReady"),
                  detail: adjustment,
                };
              });
              trackEvent("practice_feedback_viewed", {
                source: "home",
                entry_cta: "practice_inline",
                first_log: existingLogs ? existingLogs.length === 0 : undefined,
                has_full_access: hasFullAccess,
                child_reaction_type: done ? "no_clear_reaction" : "not_tried",
                parent_impression_type: "not_sure",
              });
            } catch (error) {
              console.error("Failed to generate home practice feedback:", error);
            } finally {
              window.clearTimeout(timeoutId);
            }
          })();
        }
      } catch (error) {
        console.error("Failed to save home practice log:", error);
        setQuickPracticeMessage({
          tone: "error",
          text: t("home.quickPracticeSaveFailed"),
        });
      } finally {
        setQuickPracticeSavingId(null);
      }
    },
    [hasFullAccess, quickPracticeSavingId, t, user],
  );

  const handleQuickPracticeSnooze = useCallback(
    (practiceId: string) => {
      setQuickPracticeSnoozedIds((previous) => {
        const next = new Set(previous);
        next.add(practiceId);
        return next;
      });
      setQuickPracticeMessage({
        tone: "info",
        text: t("home.quickPracticeSnoozed"),
      });
      trackEvent("home_next_action_clicked", {
        source: "home",
        entry_cta: "practice_inline",
        next_action_type: "practice",
        action_type: "later",
      });
    },
    [t],
  );

  useEffect(() => {
    // Only show onboarding if no child is registered in DB AND no intake info in local store
    if (!loading && user && children.length === 0 && !intake.childName) {
      setShowOnboarding(true);
    }
  }, [loading, user, children, intake.childName]);

  useEffect(() => {
    if (loading || !user || !isAppWebView()) return;

    const preferences = readPracticeReminderPreferences(
      DEFAULT_REMINDER_PREFERENCES,
    );
    const reminderItem = uncheckedPracticeItems[0];
    const reminderTime = formatPracticeReminderTime(
      preferences.practiceReminderTime,
      locale,
    );
    const title = reminderItem
      ? t("home.practiceReminderTitleWithItem", { title: reminderItem.title })
      : t("home.practiceReminderTitleDefault");
    const body = reminderItem
      ? t("home.practiceReminderBodyWithItem", { time: reminderTime })
      : t("home.practiceReminderBodyDefault", { time: reminderTime });

    postPracticeReminderSync(
      buildPracticeReminderPlan({
        preferences,
        title,
        body,
        focusPracticeId: reminderItem?.id,
        activePracticeIds: uncheckedPracticeItems.map((item) => item.id),
        activePracticeCount: practices.reminderActiveCount,
        pendingPracticeCount: uncheckedPracticeItems.length,
        userInitiated: false,
      }),
    );
  }, [
    loading,
    locale,
    practices.reminderActiveCount,
    t,
    uncheckedPracticeItems,
    user,
  ]);

  useEffect(() => {
    if (!shouldUseNativeLogin) return;
    router.replace("/login");
  }, [router, shouldUseNativeLogin]);

  const handleProfileClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mainChild) return;

    try {
      setUploading(true);
      const imageUrl = await db.uploadChildAvatar(file, user!.id);
      await db.updateChildProfile(mainChild.id, { image_url: imageUrl });
    } catch (error) {
      console.error("Failed to update profile image:", error);
      alert(t("home.imageUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  // Not logged in state (only after auth check completes)
  if (shouldUseNativeLogin) {
    return <HomeLoadingScreen />;
  }

  if (!authLoading && !user) {
    return <LandingPage />;
  }

  // 데이터 로딩 중 스켈레톤 표시 (뒤로가기 시 번쩍임 방지)
  if (loading || authLoading) {
    return <HomeLoadingScreen />;
  }

  // Calculate age string
  const ageString = mainChild?.birth_date
    ? (() => {
        const birth = new Date(mainChild.birth_date);
        const today = new Date();
        const totalMonths =
          (today.getFullYear() - birth.getFullYear()) * 12 +
          (today.getMonth() - birth.getMonth());
        if (totalMonths <= 36)
          return t("home.ageMonths", { months: totalMonths });
        const years = Math.floor(totalMonths / 12);
        const remainingMonths = totalMonths % 12;
        if (remainingMonths === 0) return t("home.ageYears", { years });
        return t("home.ageYearsMonths", { years, months: remainingMonths });
      })()
    : t("home.noBirthInfo");

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 h-[100dvh] min-h-[100dvh] overflow-hidden flex flex-col items-center justify-center font-body pb-0">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-0 flex flex-col sm:shadow-2xl overflow-hidden relative">
        <HomeHeader
          userCreatedAt={user?.created_at}
          subscription={subscription}
          onSubscriptionClick={() => router.push("/settings/subscription")}
          onPricingClick={() => router.push("/pricing?source=home&entry_cta=header_badge")}
        />

        <main className="app-bottom-nav-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
          {mainChild ? (
            /* [기존 사용자] 아이가 등록된 상태 */
            <div>
              {/* 상단 프로필 섹션 */}
              <HomeModuleReveal>
                <div className="relative w-full flex flex-col items-center p-2 pt-8">
                <div className="flex flex-col items-center justify-center w-full mb-4">
                  <div
                    className="relative w-32 h-32 cursor-pointer group"
                    onClick={handleProfileClick}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                    <div className="w-full h-full rounded-full overflow-hidden bg-gray-50 relative z-10 border-[3px] border-white dark:border-surface-dark shadow-md ring-1 ring-black/5 group-hover:scale-105 transition-transform">
                      {mainChild?.image_url ? (
                        <div
                          role="img"
                          aria-label={childName}
                          className="w-full h-full bg-cover bg-center"
                          style={{
                            backgroundImage: `url("${mainChild.image_url}")`,
                          }}
                        />
                      ) : temperamentInfo?.child?.image ? (
                        <div
                          role="img"
                          aria-label={childName}
                          className="w-full h-full bg-cover bg-center"
                          style={{
                            backgroundImage: `url("${temperamentInfo.child.image}")`,
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                          <span className="material-icons-round text-5xl">
                            face
                          </span>
                          <span className="text-[10px] font-bold mt-1">
                            {t("home.registerPhoto")}
                          </span>
                        </div>
                      )}
                    </div>

                    {uploading && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 rounded-full">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  <div className="relative -mt-5 z-20 whitespace-nowrap">
                    <div
                      onClick={() =>
                        router.push(
                          temperamentInfo
                            ? "/report?tab=child"
                            : "/survey/intro",
                        )
                      }
                      className="bg-white dark:bg-surface-dark text-primary dark:text-white px-3 py-1 rounded-full text-[12px] font-bold shadow-sm inline-flex items-center gap-1 border border-primary/10 cursor-pointer active:scale-95 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[14px] text-child">
                        child_care
                      </span>
                      {temperamentInfo
                        ? temperamentInfo.child.label
                        : t("home.assessTemperament")}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center mt-6">
                    <div className="relative">
                      <h1
                        className={`text-2xl font-bold text-text-main dark:text-white tracking-tight inline-flex items-center gap-1 ${children.length > 1 ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}`}
                        onClick={() => {
                          if (children.length > 1)
                            setShowChildDropdown(!showChildDropdown);
                        }}
                      >
                        {childName} ({ageString})
                        {children.length > 1 && (
                          <span
                            className={`material-symbols-outlined text-[20px] text-gray-400 transition-transform ${showChildDropdown ? "rotate-180" : ""}`}
                          >
                            expand_more
                          </span>
                        )}
                      </h1>
                      {showChildDropdown && children.length > 1 && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowChildDropdown(false)}
                          />
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-1 min-w-[160px] z-50 animate-in fade-in zoom-in-95 duration-200">
                            {children.map((child, idx) => (
                              <button
                                key={child.id}
                                onClick={() => {
                                  handleChildSelect(idx);
                                  setShowChildDropdown(false);
                                }}
                                className={`w-full px-5 py-3 text-sm font-bold text-left transition-colors ${
                                  mainChild?.id === child.id
                                    ? "text-primary bg-primary/5"
                                    : "text-text-main dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                                }`}
                              >
                                {child.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div
                      onClick={handleHarmonyBadgeClick}
                      className={`mt-2 bg-white/90 dark:bg-surface-dark/90 text-text-main dark:text-gray-200 px-3.5 py-1.5 rounded-full text-[12px] font-medium shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] inline-flex items-center gap-1.5 ring-1 ring-black/5 dark:ring-white/10 ${parentTemperament?.hasData ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
                    >
                      <span className="material-symbols-outlined text-[16px] text-caregiver">
                        volunteer_activism
                      </span>
                      {TCI_TERMINOLOGY.REPORT.PARENT_NAME}{" "}
                      <span className="mx-0.5 text-gray-300 dark:text-gray-600">
                        |
                      </span>{" "}
                      <span className="font-bold text-caregiver">
                        {parentTemperament?.hasData
                          ? parentTemperament.label
                          : t("home.assessNeeded")}
                      </span>
                    </div>
                  </div>
              </div>
                  <p className="text-text-sub dark:text-gray-400 text-sm font-light mt-2 break-keep text-center px-8">
                    {t("home.dailyMessage")}
                  </p>
                </div>
              </HomeModuleReveal>

              {/* 기능 카드 리스트 */}
              <div className="px-6 flex flex-col gap-5 mt-8">
                {quickPracticeMessage && (
                  <HomeModuleReveal>
                    <div
                      className={`rounded-2xl px-4 py-3 text-[13px] font-bold shadow-soft ${
                        quickPracticeMessage.tone === "error"
                          ? "border border-red-100 bg-red-50 text-red-700"
                          : quickPracticeMessage.tone === "info"
                            ? "border border-primary/10 bg-primary/5 text-primary"
                            : "border border-emerald-100 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <p>{quickPracticeMessage.text}</p>
                      {quickPracticeMessage.detail && (
                        <p className="mt-1 text-[12px] font-medium leading-relaxed opacity-80">
                          {quickPracticeMessage.detail}
                        </p>
                      )}
                      {quickPracticeMessage.actionHref && quickPracticeMessage.actionText && (
                        <Link
                          href={quickPracticeMessage.actionHref}
                          className="mt-2 inline-flex items-center gap-1 text-[12px] font-black underline underline-offset-2"
                        >
                          <span>{quickPracticeMessage.actionText}</span>
                          <span className="material-symbols-outlined text-[15px]">
                            arrow_forward
                          </span>
                        </Link>
                      )}
                    </div>
                  </HomeModuleReveal>
                )}
                {temperamentInfo?.child && (
                  <HomeModuleReveal order={0}>
                    <section className="rounded-2xl border border-secondary/15 bg-white p-4 shadow-soft dark:bg-surface-dark">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                          <span className="material-symbols-outlined text-[21px]">
                            chat_bubble
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-secondary">
                            {t("home.sosEyebrow")}
                          </p>
                          <h2 className="mt-0.5 text-[15px] font-black leading-snug text-text-main dark:text-white break-keep">
                            {t("home.sosTitle")}
                          </h2>
                          <p className="mt-1 text-[12px] leading-relaxed text-text-sub break-keep">
                            {t("home.sosDescription", { name: childName })}
                          </p>
                        </div>
                      </div>
                      <form
                        className="mt-4 flex items-center gap-2 rounded-2xl border border-secondary/15 bg-secondary/5 pl-3 pr-1 py-1 focus-within:border-secondary/40 dark:bg-white/5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          openHomeSosFreeText();
                        }}
                      >
                        <input
                          type="text"
                          value={sosInput}
                          onChange={(e) => setSosInput(e.target.value)}
                          placeholder={t("home.sosPlaceholder")}
                          maxLength={500}
                          enterKeyHint="send"
                          aria-label={t("home.sosTitle")}
                          className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-text-main placeholder:text-text-sub/70 outline-none dark:text-white"
                        />
                        <button
                          type="submit"
                          disabled={!sosInput.trim()}
                          aria-label={t("home.sosSendCta")}
                          className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-white shadow-sm transition-opacity active:scale-95 disabled:opacity-30"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            arrow_upward
                          </span>
                        </button>
                      </form>
                      <p className="mt-3 text-[10px] font-bold tracking-wide text-text-sub/80 uppercase">
                        {t("home.sosExampleEyebrow")}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {HOME_SOS_SITUATIONS.map((situation) => (
                          <button
                            key={situation.key}
                            type="button"
                            onClick={() => openHomeSosConsult(situation.key)}
                            className="inline-flex items-center gap-1 rounded-full border border-secondary/15 bg-white px-3 py-1.5 text-[11px] font-bold text-text-sub transition-all active:scale-[0.97] hover:border-secondary/30 hover:text-text-main dark:bg-white/5 dark:text-gray-300"
                          >
                            <span className="material-symbols-outlined text-[14px] text-secondary">
                              {situation.icon}
                            </span>
                            <span className="break-keep">
                              {t(situation.labelKey)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </HomeModuleReveal>
                )}
                {primaryAction && (
                  <HomeModuleReveal order={1}>
                    <div className="bg-[#243A2F] dark:bg-[#1B2B23] rounded-[28px] p-6 shadow-card text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/[0.08] rounded-full -mr-12 -mt-12 pointer-events-none" />
                    <div className="relative z-10">
                      <span className="text-white/70 text-[11px] font-bold bg-white/10 px-2.5 py-1 rounded-full inline-flex items-center">
                        {t("home.nextRecommendedAction")}
                      </span>

                      {primaryAction === "child_test" && (
                        <div className="mt-4">
                          <h3 className="text-[22px] font-black leading-snug tracking-tight">
                            {childName}
                            {t("home.temperamentTest")}
                          </h3>
                          <p className="mt-2 text-sm text-white/85 leading-relaxed break-keep">
                            {t("home.testDescription")}
                          </p>
                          <Link href="/survey/intro" className="block mt-5">
                            <button className="w-full py-4 rounded-xl bg-white text-primary font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                              <span>{t("home.startTest")}</span>
                              <span className="material-symbols-outlined text-[18px]">
                                play_arrow
                              </span>
                            </button>
                          </Link>
                        </div>
                      )}

                      {primaryAction === "parent_test" && (
                        <div className="mt-4">
                          <h3 className="text-[22px] font-black leading-snug tracking-tight">
                            {t("home.parentStyleTest")}
                          </h3>
                          <p className="mt-2 text-sm text-white/85 leading-relaxed break-keep">
                            {t("home.parentTestDescription")}
                          </p>
                          <Link
                            href="/survey?type=PARENT"
                            className="block mt-5"
                            onClick={handleParentAtqStart}
                          >
                            <button className="w-full py-4 rounded-xl bg-white text-secondary font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                              <span>
                                {Object.keys(atqResponses).length > 0
                                  ? t("home.continueTest")
                                  : t("home.startTestButton")}
                              </span>
                              <span className="material-symbols-outlined text-[18px]">
                                play_arrow
                              </span>
                            </button>
                          </Link>
                          <button
                            type="button"
                            onClick={handleParentAtqDismiss}
                            className="mt-3 w-full text-center text-[12px] font-medium text-white/65 hover:text-white/85 transition-colors"
                          >
                            {t("home.parentTestDismissLater")}
                          </button>
                        </div>
                      )}

                      {primaryAction === "practice" && (
                        <div className="mt-4">
                          <h3 className="text-[22px] font-black leading-snug tracking-tight">
                            {practices.attentionCount > 0
                              ? t("home.practiceAttentionTitle")
                              : t("home.todaysPractice")}
                          </h3>
                          <p className="mt-2 text-sm text-white/85 leading-relaxed break-keep">
                            {practices.attentionCount > 0
                              ? t("home.practiceAttentionDescription", {
                                  count: practicePriorityCount,
                                })
                              : t("home.quickPracticePrompt", {
                                  count: practicePriorityCount,
                                })}
                          </p>

                          {primaryQuickPractice ? (
                            <div className="mt-4 rounded-[22px] bg-white/10 p-4">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                                  <span className="material-symbols-outlined text-[16px]">
                                    checklist
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[15px] font-bold leading-snug text-white break-keep">
                                    {primaryQuickPractice.title}
                                  </p>
                                  {practicePriorityCount > 1 && (
                                    <p className="mt-1 text-[11px] font-medium text-white/60">
                                      {t("home.quickPracticeRemaining", {
                                        count: practicePriorityCount - 1,
                                      })}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={quickPracticeSavingId === primaryQuickPractice.id}
                                  onClick={() =>
                                    handleQuickPracticeSave(primaryQuickPractice, true)
                                  }
                                  className="min-h-12 rounded-2xl bg-white px-3 py-3 text-[13px] font-black text-[#243A2F] shadow-lg transition-all active:scale-[0.98] disabled:opacity-60"
                                >
                                  {quickPracticeSavingId === primaryQuickPractice.id
                                    ? t("home.quickPracticeSaving")
                                    : t("home.quickPracticeDone")}
                                </button>
                                <button
                                  type="button"
                                  disabled={quickPracticeSavingId === primaryQuickPractice.id}
                                  onClick={() =>
                                    handleQuickPracticeSave(primaryQuickPractice, false)
                                  }
                                  className="min-h-12 rounded-2xl bg-white/15 px-3 py-3 text-[13px] font-bold text-white ring-1 ring-white/20 transition-all active:scale-[0.98] disabled:opacity-60"
                                >
                                  {t("home.quickPracticeNotDone")}
                                </button>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  disabled={quickPracticeSavingId === primaryQuickPractice.id}
                                  onClick={() =>
                                    handleQuickPracticeSnooze(primaryQuickPractice.id)
                                  }
                                  className="rounded-full px-2 py-1 text-[12px] font-bold text-white/70 transition-colors hover:text-white disabled:opacity-60"
                                >
                                  {t("home.quickPracticeLater")}
                                </button>
                                <Link
                                  href={`/practices?focusPracticeId=${primaryQuickPractice.id}`}
                                  className="rounded-full px-2 py-1 text-[12px] font-bold text-white/80 underline-offset-4 hover:underline"
                                >
                                  {t("home.quickPracticeDetail")}
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <Link href="/practices" className="block">
                              <div className="mt-4 space-y-2">
                                {primaryPracticePreviewItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-3"
                                  >
                                    <div className="w-4 h-4 rounded border-2 border-white/50 flex-shrink-0" />
                                    <span className="text-[13px] text-white truncate flex-1">
                                      {item.title}
                                    </span>
                                  </div>
                                ))}
                                {primaryPracticeHiddenCount > 0 && (
                                  <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.08] px-3 py-2.5">
                                    <div className="w-4 h-4 flex-shrink-0" />
                                    <span className="text-[12px] font-bold text-white/70">
                                      {t("home.moreItems", {
                                        count: primaryPracticeHiddenCount,
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </Link>
                          )}
                        </div>
                      )}

                      {primaryAction === "consult" && (
                        <Link href="/consult" className="block mt-4">
                          <div>
                            <h3 className="text-[22px] font-black leading-snug tracking-tight">
                              {t("home.consultCTA")}
                            </h3>
                            <p className="mt-2 text-sm text-white/85 leading-relaxed break-keep">
                              {t("home.consultCTADescription", {
                                name: childName,
                              })}
                            </p>
                            <div className="mt-5 w-full rounded-[22px] bg-white px-5 py-4 text-[#243A2F] shadow-lg active:scale-[0.98] transition-all">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="min-w-0 flex-1 text-left text-sm font-bold leading-snug">
                                  {t("consult.startConsult")}
                                </span>
                                <span className="material-symbols-outlined shrink-0 text-[20px]">
                                  arrow_forward
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      )}

                      {primaryAction === "trial" && trialStatus && (
                        <div className="mt-4">
                          <h3 className="text-[22px] font-black leading-snug tracking-tight">
                            {t("home.trialEndingTitle", {
                              days: trialStatus.daysRemaining,
                            })}
                          </h3>
                          <p className="mt-2 text-sm text-white/85 leading-relaxed break-keep">
                            {t("home.trialEndingDesc")}
                          </p>
                          <button
                            onClick={() => openTrialConversion("primary_action")}
                            className="mt-5 w-full py-4 rounded-xl bg-white text-primary font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                          >
                            <span>{t("home.trialEndingCta")}</span>
                            <span className="material-symbols-outlined text-[18px]">
                              arrow_forward
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                    </div>
                  </HomeModuleReveal>
                )}

                {shouldShowTrialEndingCard && primaryAction !== "trial" && (
                  <HomeModuleReveal order={2}>
                    <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-soft border border-primary/15">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-primary">
                          workspace_premium
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-primary mb-1">
                          {t("home.trialEndingTitle", {
                            days: trialStatus.daysRemaining,
                          })}
                        </p>
                        <p className="text-[12px] text-text-sub leading-relaxed break-keep">
                          {t("home.trialEndingDesc")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openTrialConversion("secondary_card")}
                      className="mt-4 w-full py-3.5 rounded-xl bg-primary text-white text-[13px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>{t("home.trialEndingCta")}</span>
                      <span className="material-symbols-outlined text-[17px]">
                        arrow_forward
                      </span>
                    </button>
                    </div>
                  </HomeModuleReveal>
                )}

                {/* 아이 기질 검사 유도 카드 */}
                {!temperamentInfo && primaryAction !== "child_test" && (
                  <HomeModuleReveal order={2}>
                    <div className="bg-primary dark:bg-surface-dark rounded-2xl p-6 shadow-card relative overflow-hidden mb-2">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/[0.08] rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="relative z-10">
                      <div className="flex flex-col gap-1 mb-4">
                        <span className="text-white/80 text-xs font-medium bg-black/10 px-2 py-1 rounded inline-block w-fit">
                          {t("home.firstStep")}
                        </span>
                        <h3 className="text-xl font-bold text-white leading-snug tracking-tight">
                          {childName}
                          {t("home.temperamentTest")}
                        </h3>
                      </div>
                      <p className="text-sm text-white/90 mb-6">
                        {t("home.testDescription")}
                      </p>
                      <Link href="/survey/intro">
                        <button className="w-full py-4 rounded-xl bg-white text-primary font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                          <span>{t("home.startTest")}</span>
                          <span className="material-symbols-outlined text-[18px]">
                            play_arrow
                          </span>
                        </button>
                      </Link>
                    </div>
                    </div>
                  </HomeModuleReveal>
                )}

                {/* 양육자 검사 유도 카드 */}
                {!parentSurvey &&
                  Object.keys(atqResponses).length < PARENT_QUESTIONS.length &&
                  temperamentInfo?.child &&
                  primaryAction !== "parent_test" &&
                  !parentAtqDismissed && (
                    <HomeModuleReveal order={3}>
                      <div className="bg-secondary dark:bg-surface-dark rounded-2xl p-6 shadow-card relative overflow-hidden mb-2">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/[0.08] rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-white/80 text-xs font-medium bg-black/10 px-2 py-1 rounded inline-block w-fit">
                              {t("home.requiredStep")}
                            </span>
                            <h3 className="text-xl font-bold text-white leading-snug tracking-tight">
                              {t("home.parentStyleTest")}
                            </h3>
                          </div>
                        </div>
                        <p className="text-sm text-white/90 mb-6">
                          {t("home.parentTestDescription")}
                        </p>
                        <Link
                          href="/survey?type=PARENT"
                          onClick={() => {
                            trackEvent("parent_atq_card_clicked", {
                              location: "home_secondary",
                              has_existing_responses: Object.keys(atqResponses).length > 0,
                            });
                          }}
                        >
                          <button className="w-full py-4 rounded-xl bg-white text-secondary font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                            <span>
                              {Object.keys(atqResponses).length > 0
                                ? t("home.continueTest")
                                : t("home.startTestButton")}
                            </span>
                            <span className="material-symbols-outlined text-[18px]">
                              play_arrow
                            </span>
                          </button>
                        </Link>
                      </div>
                      </div>
                    </HomeModuleReveal>
                  )}

                {/* 마법의 한마디 캐러셀 */}
                {currentMagicWord && (
                  <HomeModuleReveal order={4}>
                    <div className="bg-[#519E8A] rounded-2xl p-5 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.08] rounded-full -mr-10 -mt-10" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="material-symbols-outlined text-[18px]">
                          auto_awesome
                        </span>
                        <span className="text-[13px] font-black">
                          {t("home.todaysMagicWord")}
                        </span>
                      </div>
                      <div className="min-h-[84px] mb-3">
                        <p className="text-[16px] font-medium leading-relaxed line-clamp-3 break-keep">
                          &ldquo;{currentMagicWord.word}&rdquo;
                        </p>
                      </div>
                      <p className="text-[11px] text-white/60">
                        {new Date(currentMagicWord.date).toLocaleDateString(
                          "ko-KR",
                        )}
                        {currentMagicWord.childName &&
                          ` · ${currentMagicWord.childName}`}
                      </p>
                    </div>
                    </div>
                  </HomeModuleReveal>
                )}

                {/* 오늘의 실천 카드 */}
                {hasPracticePriority && primaryAction !== "practice" && (
                  <HomeModuleReveal order={5}>
                    <Link href="/practices" className="block">
                      <div className="bg-white dark:bg-surface-dark/50 rounded-2xl p-5 shadow-soft border border-primary/20 active:scale-[0.99] transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px] text-primary">
                            checklist
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-[14px] font-bold text-text-main dark:text-white">
                            {practices.attentionCount > 0
                              ? t("home.practiceAttentionTitle")
                              : t("home.todaysPractice")}
                          </h3>
                          <p className="text-[11px] text-text-sub dark:text-gray-400">
                            {practices.attentionCount > 0
                              ? t("home.practiceAttentionDescription", {
                                  count: practicePriorityCount,
                                })
                              : t("home.practiceItemsRemaining", {
                                  count: practicePriorityCount,
                                })}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-primary/50">
                          arrow_forward
                        </span>
                      </div>
                      {practicePriorityItems.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
                          {practicePriorityItems.slice(0, 3).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2.5"
                            >
                              <div className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                              <span className="text-[13px] text-text-main dark:text-gray-300 truncate flex-1">
                                {item.title}
                              </span>
                            </div>
                          ))}
                          {practicePriorityItems.length > 3 && (
                            <p className="text-[11px] text-text-sub dark:text-gray-500 pl-6.5">
                              {t("home.moreItems", {
                                count: practicePriorityItems.length - 3,
                              })}
                            </p>
                          )}
                        </div>
                      )}
                      </div>
                    </Link>
                  </HomeModuleReveal>
                )}

                {/* 상담 유도 카드 — 상담 이력이 없거나 진행 중 실천이 없을 때 */}
                {showConsultCTA && temperamentInfo?.child && primaryAction !== "consult" && (
                  <HomeModuleReveal order={6}>
                    <Link href="/consult" className="block">
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-surface-dark dark:to-surface-dark rounded-2xl p-5 shadow-soft border border-amber-200/60 dark:border-amber-500/30 active:scale-[0.99] transition-all relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-28 h-28 bg-amber-200/20 rounded-full -mr-10 -mt-10 pointer-events-none" />
                      <div className="relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400">
                              chat_bubble
                            </span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-[14px] font-bold text-text-main dark:text-white">
                              {t("home.consultCTA")}
                            </h3>
                            <p className="text-[11px] text-text-sub dark:text-gray-400">
                              {t("home.consultCTADescription", {
                                name: childName,
                              })}
                            </p>
                          </div>
                          <span className="material-symbols-outlined text-[18px] text-amber-400">
                            arrow_forward
                          </span>
                        </div>
                      </div>
                      </div>
                    </Link>
                  </HomeModuleReveal>
                )}

                {/* 기질 분석 리포트 */}
                {temperamentInfo?.child && (
                  <HomeModuleReveal order={7}>
                    <Link href="/report" className="block">
                      <div className="bg-white dark:bg-surface-dark/50 rounded-2xl p-5 shadow-soft border border-primary/10 dark:border-primary/50 flex justify-between items-center gap-4 active:scale-[0.99] transition-all">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <span className="material-symbols-outlined text-[20px]">
                            description
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-bold text-text-main dark:text-white">
                            {t("home.temperamentAnalysisReport")}
                          </h3>
                          <p className="text-[11px] text-text-sub dark:text-gray-400 break-keep">
                            {t("home.reportSubtitle")}
                          </p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-primary/50 shrink-0">
                        arrow_forward
                      </span>
                      </div>
                    </Link>
                  </HomeModuleReveal>
                )}
              </div>
            </div>
          ) : (
            <HomeWelcomeState profile={profile} />
          )}
        </main>

        <BottomNav />

        {/* Modal Sections */}
        {showOnboarding && (
          <div className="app-modal-overlay fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>
            <div className="app-modal-panel-scroll relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl animate-in fade-in zoom-in duration-500">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>

              <div className="relative z-10 px-6 py-6 flex flex-col items-center">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-[1.75rem] flex items-center justify-center mb-5 rotate-3 shadow-xl">
                  <Image
                    src="/gijilai_icon.png"
                    alt={t("common.appName")}
                    width={56}
                    height={56}
                    className="w-14 h-14 object-contain"
                  />
                </div>

                <div className="text-center space-y-2 mb-6">
                  <h3 className="text-[22px] leading-tight font-black text-slate-800 dark:text-white font-display break-keep whitespace-pre-line">
                    {t("home.onboardingTitle")}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed break-keep px-2 whitespace-pre-line">
                    {t("home.onboardingDescription")}
                  </p>
                </div>

                <div className="w-full space-y-3 mb-6">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center shrink-0">
                      <span className="text-lg">🧬</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {t("home.scientificAnalysis")}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t("home.scientificAnalysisDesc")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center shrink-0">
                      <span className="text-lg">💬</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {t("home.customPrescription")}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t("home.customPrescriptionDesc")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full">
                  <button
                    onClick={() => {
                      setShowOnboarding(false);
                      router.push("/settings/child/new");
                    }}
                    className="w-full bg-primary text-white font-black py-4 rounded-[1.5rem] shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                  >
                    <span className="text-lg">
                      {t("home.registerChildInfo")}
                    </span>
                    <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </button>
                  <button
                    onClick={() => setShowOnboarding(false)}
                    className="w-full py-3 text-slate-400 text-xs font-bold hover:text-slate-600 transition-colors mt-1"
                  >
                    {t("home.laterButton")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSurveyIntro && (
          <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSurveyIntro(false)}
            ></div>
            <div className="app-modal-panel relative bg-background-light dark:bg-surface-dark w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-5 shadow-lg animate-bounce-subtle">
                  <Image
                    src="/gijilai_icon.png"
                    alt={t("common.appName")}
                    width={48}
                    height={48}
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3 font-display">
                  {t("home.surveyIntroTitle")}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-8 break-keep whitespace-pre-line">
                  {t("home.surveyIntroDescription")}
                </p>

                <div className="w-full space-y-3">
                  <button
                    onClick={() => {
                      resetSurveyOnly();
                      router.push("/survey");
                    }}
                    className="w-full bg-[#2E7D32] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#2E7D32]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <span>{t("home.startTestSurvey")}</span>
                    <span className="material-symbols-outlined text-sm">
                      arrow_forward
                    </span>
                  </button>
                  <button
                    onClick={() => setShowSurveyIntro(false)}
                    className="w-full py-3 text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
                  >
                    {t("home.laterSurvey")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

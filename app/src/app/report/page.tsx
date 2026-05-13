'use client';

import React, { useMemo, useState, useEffect, useRef, Suspense, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useSurveyStore } from '@/store/surveyStore';
import { CHILD_QUESTIONS, PARENT_QUESTIONS, PARENTING_STYLE_QUESTIONS } from '@/data/questions';
import BottomNav from '@/components/layout/BottomNav';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { TabLoadingIndicator } from '@/components/ui/TabLoadingIndicator';
import { TemperamentLoadingState } from '@/components/ui/TemperamentLoadingState';
import { trackEvent } from '@/lib/analytics';
import { db, type ChildProfile, type ReportData, type SurveyData } from '@/lib/db';
import { createPerfTracker } from '@/lib/perf';
import { TemperamentScorer } from '@/lib/TemperamentScorer';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { TCI_TERMINOLOGY } from '@/constants/terminology';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/i18n/LocaleProvider';
import { childNamePossessive, normalizeChildNameParticlesInValue } from '@/lib/koreanUtils';
import { extractReportScores, isTemperamentScores, parseAnswerMap } from '@/lib/home';
import { checkCooldown, type CooldownStatus } from '@/lib/dateUtils';
import { CHILD_PROFILE_LIMIT_REACHED_CODE } from '@/lib/access';
import {
  asChildAiReport,
  asHarmonyAiReport,
  asParentAiReport,
  buildParentReportStreamModules,
  getParentSectionContent,
  normalizeTemperamentDimensions,
  sanitizeQuotedText,
  type ChildAiReport,
  type HarmonyAiReport,
  type ParentingStyleScores,
  type ParentAiReport,
  type ParentReportStreamModule,
  type ReportApiPayload,
  type ReportApiResult,
  type ReportDates,
  type ReportScoreKey,
  type ReportTab,
  type TemperamentScores,
} from '@/lib/report';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

function getReportTabFromParam(tabParam: string | null): ReportTab {
  if (tabParam === 'parent') return 'parent';
  if (tabParam === 'parenting') return 'parenting';
  return 'child';
}

type ChildReportStreamModule =
  | { module: 'intro'; data: Pick<ChildAiReport, 'title' | 'intro'> }
  | { module: 'dimensions'; data: { dimensions?: NonNullable<NonNullable<ChildAiReport['analysis']>['dimensions']> } }
  | { module: 'insight'; data: { insight?: NonNullable<ChildAiReport['analysis']>['insight'] } }
  | { module: 'strengths'; data: { strengths?: string } }
  | { module: 'parentingTips'; data: Pick<ChildAiReport, 'parentingTips'> }
  | { module: 'scripts'; data: Pick<ChildAiReport, 'scripts' | 'shareText'> };
type ChildReportLoadingKey =
  | 'intro'
  | 'scores'
  | 'dimensions'
  | 'insight'
  | 'strengths'
  | 'parentingTips'
  | 'scripts';

function isChildProfileLimitError(error: unknown) {
  return error instanceof Error && error.message === CHILD_PROFILE_LIMIT_REACHED_CODE;
}
type ParentReportLoadingKey =
  | 'intro'
  | 'scores'
  | 'dimensions'
  | 'shining'
  | 'parentingStyle'
  | 'vulnerability'
  | 'solutions'
  | 'letter';
type ReportLoadingSection<Key extends string = string> = {
  key: Key;
  icon: string;
  label: string;
  message: string;
  isReady: boolean;
};
type ReanalysisTarget = 'child' | 'parent' | 'harmony';
type SurveyReanalysisTarget = Exclude<ReanalysisTarget, 'harmony'>;
type HarmonyRefreshSource = 'child' | 'parent' | null;
type ExistingReportLoadingType = 'CHILD' | 'PARENT' | 'HARMONY' | null;
const PARENT_REPORT_MODULE_REVEAL_DELAY_MS = 280;

function getHarmonyRefreshSource(refreshParam: string | null): HarmonyRefreshSource {
  if (refreshParam === 'child' || refreshParam === 'parent') return refreshParam;
  return null;
}

function wait(ms: number) {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}

async function revealParentReportModules(
  report: ParentAiReport | null | undefined,
  onModule: (item: ParentReportStreamModule) => void,
) {
  const modules = buildParentReportStreamModules(report);

  for (const [index, module] of modules.entries()) {
    onModule(module);
    if (index < modules.length - 1) {
      await wait(PARENT_REPORT_MODULE_REVEAL_DELAY_MS);
    }
  }

  return modules.length;
}

function applyChildReportStreamModule(report: ChildAiReport, item: ChildReportStreamModule): ChildAiReport {
  if (item.module === 'intro') {
    return { ...report, title: item.data.title, intro: item.data.intro };
  }

  if (item.module === 'dimensions') {
    return {
      ...report,
      analysis: {
        ...report.analysis,
        dimensions: normalizeTemperamentDimensions(item.data.dimensions),
      },
    };
  }

  if (item.module === 'insight') {
    return {
      ...report,
      analysis: { ...report.analysis, insight: item.data.insight },
    };
  }

  if (item.module === 'strengths') {
    return {
      ...report,
      analysis: { ...report.analysis, strengths: item.data.strengths },
    };
  }

  if (item.module === 'parentingTips') {
    return { ...report, parentingTips: item.data.parentingTips };
  }

  return { ...report, scripts: item.data.scripts, shareText: item.data.shareText };
}

function applyParentReportStreamModule(report: ParentAiReport, item: ParentReportStreamModule): ParentAiReport {
  if (item.module === 'intro') {
    return { ...report, intro: item.data.intro };
  }

  if (item.module === 'dimensions') {
    return {
      ...report,
      dimensions: normalizeTemperamentDimensions(item.data.dimensions),
    };
  }

  if (item.module === 'shining') {
    return { ...report, shining: item.data.shining };
  }

  if (item.module === 'parentingStyle') {
    return { ...report, parentingStyle: item.data.parentingStyle };
  }

  if (item.module === 'vulnerability') {
    return { ...report, vulnerability: item.data.vulnerability };
  }

  if (item.module === 'solutions') {
    return { ...report, solutions: item.data.solutions };
  }

  return { ...report, letter: item.data.letter };
}

function parseSseBlock(block: string) {
  let event = 'message';
  let data = '';

  block.split(/\r?\n/).forEach((line) => {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
      return;
    }
    if (line.startsWith('data:')) {
      data += line.slice('data:'.length).trim();
    }
  });

  return { event, data };
}

function ReportSectionReveal({
  children,
  order,
}: {
  children: React.ReactNode;
  order: number;
}) {
  return (
    <ScrollReveal
      delayMs={Math.min(order * 80, 360)}
      durationMs={680}
      y={20}
    >
      {children}
    </ScrollReveal>
  );
}

function ReportSectionGroup({ children }: { children: React.ReactNode }) {
  const items = React.Children
    .toArray(children)
    .filter((child) => child !== null && child !== undefined);

  return (
    <>
      {items.map((child, index) => (
        <ReportSectionReveal key={index} order={index}>
          {child}
        </ReportSectionReveal>
      ))}
    </>
  );
}

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const isChildOnly = searchParams.get('child_only') === 'true';
  const entrySource = searchParams.get('source') ?? (searchParams.get('id') ? 'saved_report' : 'direct');
  const reportKind = isChildOnly ? 'child_only' : 'full';
  const reportRefreshParam = searchParams.get('refresh');

  const { user, loading: authLoading } = useAuth();
  const { t, locale } = useLocale();
  const [activeTab, setActiveTab] = useState<ReportTab>(() => getReportTabFromParam(tabParam));
  const {
    intake,
    setIntake,
    cbqResponses,
    atqResponses,
    parentingResponses,
    selectedChildId,
    resetSurveyModule,
  } = useAppStore();

  const [childAiReport, setChildAiReport] = useState<ChildAiReport | null>(null);
  const [parentAiReport, setParentAiReport] = useState<ParentAiReport | null>(null);
  const [harmonyAiReport, setHarmonyAiReport] = useState<HarmonyAiReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [existingReportLoadingType, setExistingReportLoadingType] = useState<ExistingReportLoadingType>(null);
  const [isRestartDialogOpen, setIsRestartDialogOpen] = useState(false);
  const [restartTarget, setRestartTarget] = useState<ReanalysisTarget>('child');
  const [isStartingFreshSurvey, setIsStartingFreshSurvey] = useState(false);
  const [reportLoadingStep, setReportLoadingStep] = useState(0);
  const generatingRef = useRef<Set<string>>(new Set());
  const inflightControllersRef = useRef<Map<'CHILD' | 'PARENT' | 'HARMONY', AbortController>>(new Map());
  const refreshedReportTypesRef = useRef<Set<string>>(new Set());
  const [reportDates, setReportDates] = useState<ReportDates>({});
  const [childReportId, setChildReportId] = useState<string | null>(null);
  const [parentReportId, setParentReportId] = useState<string | null>(null);
  const [harmonyReportId, setHarmonyReportId] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isSubscriptionLoaded, setIsSubscriptionLoaded] = useState(false);
  const [harmonyRefreshSource, setHarmonyRefreshSource] = useState<HarmonyRefreshSource>(() => getHarmonyRefreshSource(reportRefreshParam));

  // DB에서 로드된 {t('common.points')}수 데이터 (상세 보기용)
  const [savedChildScores, setSavedChildScores] = useState<TemperamentScores | null>(null);
  const [savedParentScores, setSavedParentScores] = useState<TemperamentScores | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [surveys, setSurveys] = useState<SurveyData[]>([]);
  const [isDashboardContextLoaded, setIsDashboardContextLoaded] = useState(false);
  const [isSavedReportLoaded, setIsSavedReportLoaded] = useState(false);
  const reportId = searchParams.get('id');
  const isSavedReportContextLoading = !!user && !!reportId && !isSavedReportLoaded;
  const isReportContextLoading =
    authLoading
    || (!!user && !reportId && !isDashboardContextLoaded)
    || isSavedReportContextLoading;
  const canUseReportContext = !isReportContextLoading;

  useEffect(() => {
    setActiveTab(getReportTabFromParam(tabParam));
  }, [tabParam]);

  useEffect(() => {
    let isActive = true;

    if (authLoading) {
      setHasSubscription(false);
      setIsSubscriptionLoaded(false);
      return;
    }

    if (!user) {
      setHasSubscription(false);
      setIsSubscriptionLoaded(true);
      return;
    }

    setIsSubscriptionLoaded(false);
    db.getActiveSubscription(user.id)
      .catch(() => null)
      .then((subscription) => {
        if (!isActive) return;
        setHasSubscription(!!subscription);
      })
      .finally(() => {
        if (isActive) setIsSubscriptionLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) {
      setIsDashboardContextLoaded(false);
      return;
    }

    if (!user || reportId) {
      setIsDashboardContextLoaded(true);
      return;
    }

    let isActive = true;
    setIsDashboardContextLoaded(false);

    db.getDashboardData(user.id)
      .then((data) => {
        if (!isActive) return;
        setChildren(data.children);
        setReports(data.reports);
        setSurveys(data.surveys);
      })
      .catch((error) => {
        console.error('Failed to load report dashboard context:', error);
      })
      .finally(() => {
        if (isActive) setIsDashboardContextLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authLoading, reportId, user]);

  const showPremiumCta = !!user && isSubscriptionLoaded && !hasSubscription;
  const currentChild = useMemo(() => {
    if (children.length === 0) return null;
    if (selectedChildId) {
      const matchedChild = children.find((child) => child.id === selectedChildId);
      if (matchedChild) return matchedChild;
    }
    return children[0] ?? null;
  }, [children, selectedChildId]);

  useEffect(() => {
    if (reportId || !currentChild) return;

    setIntake({
      childName: currentChild.name,
      gender: currentChild.gender,
      birthDate: currentChild.birth_date,
    });
  }, [currentChild, reportId, setIntake]);

  const currentChildReport = useMemo(() => {
    if (!currentChild) return null;
    return reports.find((report) => report.type === 'CHILD' && report.child_id === currentChild.id) ?? null;
  }, [currentChild, reports]);

  const currentChildSurvey = useMemo(() => {
    if (!currentChild) return null;
    return surveys.find((survey) => (
      survey.type === 'CHILD'
      && survey.child_id === currentChild.id
      && survey.status === 'COMPLETED'
    )) ?? null;
  }, [currentChild, surveys]);

  const currentParentReport = useMemo(() => {
    return reports.find((report) => report.type === 'PARENT') ?? null;
  }, [reports]);

  const currentHarmonyReport = useMemo(() => {
    if (!currentChild) return reports.find((report) => report.type === 'HARMONY') ?? null;
    return reports.find((report) => report.type === 'HARMONY' && report.child_id === currentChild.id)
      ?? reports.find((report) => report.type === 'HARMONY')
      ?? null;
  }, [currentChild, reports]);

  const currentParentSurvey = useMemo(() => {
    return surveys.find((survey) => survey.type === 'PARENT' && survey.status === 'COMPLETED') ?? null;
  }, [surveys]);

  const currentChildReportScores = useMemo(
    () => extractReportScores(currentChildReport?.analysis_json),
    [currentChildReport?.analysis_json],
  );
  const currentChildSurveyScores = useMemo(
    () => (isTemperamentScores(currentChildSurvey?.scores) ? currentChildSurvey.scores : null),
    [currentChildSurvey?.scores],
  );
  const currentChildSurveyAnswers = useMemo(
    () => parseAnswerMap(currentChildSurvey?.answers),
    [currentChildSurvey?.answers],
  );

  const currentParentReportScores = useMemo(
    () => extractReportScores(currentParentReport?.analysis_json),
    [currentParentReport?.analysis_json],
  );
  const currentParentSurveyScores = useMemo(
    () => (isTemperamentScores(currentParentSurvey?.scores) ? currentParentSurvey.scores : null),
    [currentParentSurvey?.scores],
  );
  const currentParentSurveyAnswers = useMemo(
    () => parseAnswerMap(currentParentSurvey?.answers),
    [currentParentSurvey?.answers],
  );

  const childName = currentChild?.name || intake.childName || t('report.child');
  const childPossessiveName = locale === 'ko' ? childNamePossessive(childName) : childName;

  const normalizeReportTextForName = useCallback(<T,>(report: T, name?: string | null): T => {
    if (locale !== 'ko' || !name) return report;
    return normalizeChildNameParticlesInValue(report, name);
  }, [locale]);

  useEffect(() => {
    const shouldAnimate = (isGenerating || isReportContextLoading) && !existingReportLoadingType;
    if (!shouldAnimate) {
      setReportLoadingStep(0);
      return;
    }

    const interval = window.setInterval(() => {
      setReportLoadingStep((step) => step + 1);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [existingReportLoadingType, isGenerating, isReportContextLoading]);

  const childLoadingSteps = useMemo(() => [
    t('report.childLoadingStep1'),
    t('report.childLoadingStep2'),
    t('report.childLoadingStep3'),
    t('report.childLoadingStep4'),
    t('report.childLoadingStep5'),
  ], [t]);

  const parentLoadingSteps = useMemo(() => [
    t('report.parentLoadingStep1'),
    t('report.parentLoadingStep2'),
    t('report.parentLoadingStep3'),
    t('report.parentLoadingStep4'),
    t('report.parentLoadingStep5'),
  ], [t]);

  const harmonyLoadingSteps = useMemo(() => [
    t('report.harmonyLoadingStep1'),
    t('report.harmonyLoadingStep2'),
    t('report.harmonyLoadingStep3'),
    t('report.harmonyLoadingStep4'),
    t('report.harmonyLoadingStep5'),
  ], [t]);

  const ReportGeneratingState = ({
    title,
    steps,
    imageSrc,
    imageAlt,
    typeLabel,
    showImage = true,
  }: {
    title: string;
    steps: string[];
    imageSrc?: string;
    imageAlt?: string;
    typeLabel?: string;
    showImage?: boolean;
  }) => {
    const currentStep = (reportLoadingStep % steps.length) + 1;

    return (
      <div className="py-14 px-6">
        <TemperamentLoadingState
          title={title}
          message={steps[currentStep - 1]}
          note={t('report.loadingStillWorking')}
          imageSrc={imageSrc}
          imageAlt={imageAlt}
          typeLabel={showImage ? typeLabel : undefined}
          imagePriority={showImage}
          showImage={showImage}
          progressCurrent={currentStep}
          progressTotal={steps.length}
          progressLabel={t('report.reportLoadingProgress', {
            current: currentStep,
            total: steps.length,
          })}
        />
      </div>
    );
  };

  const ExistingReportLoadingProgress = ({ className = '' }: { className?: string }) => (
    <TabLoadingIndicator
      ariaLabel={t('common.loading')}
      className={`w-full px-6 ${className}`}
    />
  );

  const SectionLoadingCard = ({
    icon,
    label,
    message,
    progressCurrent,
    progressTotal,
  }: {
    icon: string;
    label: string;
    message: string;
    progressCurrent: number;
    progressTotal: number;
  }) => {
    const progressPercent = Math.min(100, Math.round((progressCurrent / progressTotal) * 100));
    const progressLabel = t('report.childReportProgressPercent', {
      percent: progressPercent,
    });
    const progressRadius = 18;
    const progressCircumference = 2 * Math.PI * progressRadius;
    const progressDashOffset = progressCircumference * (1 - progressPercent / 100);

    return (
      <section
        role="status"
        aria-live="polite"
        className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 px-6 py-5 shadow-card shadow-primary/5 backdrop-blur-md dark:border-white/10 dark:bg-surface-dark/75 dark:shadow-black/20"
      >
        <div className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-primary/10 blur-2xl dark:bg-primary/20" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-16 w-32 rounded-full bg-secondary/10 blur-2xl dark:bg-secondary/15" />
        <div className="relative flex items-center gap-3">
          <div className="mt-0.5 size-8 rounded-full bg-primary/10 text-primary dark:bg-white/10 dark:text-primary-light flex items-center justify-center shrink-0">
            <Icon name={icon} size="sm" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[12px] font-black text-text-main dark:text-white break-keep">
              {label}
            </p>
            <p className="text-[14px] font-semibold text-text-sub dark:text-slate-400 leading-[1.75] break-keep">
              {message}
            </p>
          </div>
          <div
            role="progressbar"
            aria-label={`${label} ${progressLabel}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            className="relative size-12 shrink-0 rounded-full bg-white/80 text-primary shadow-[0_6px_18px_rgba(47,79,62,0.10)] dark:bg-white/10 dark:text-primary-light"
          >
            <svg className="absolute inset-0 size-full animate-spin" viewBox="0 0 44 44" aria-hidden="true">
              <circle
                cx="22"
                cy="22"
                r={progressRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-primary/10 dark:text-white/10"
              />
              <circle
                cx="22"
                cy="22"
                r={progressRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={progressCircumference}
                strokeDashoffset={progressDashOffset}
                transform="rotate(-90 22 22)"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black leading-none text-primary dark:text-primary-light">
              {progressLabel}
            </span>
          </div>
        </div>
      </section>
    );
  };

  const PremiumContinuationCard = ({ compact = false }: { compact?: boolean }) => (
    <section className="bg-primary rounded-2xl px-6 py-5 text-white shadow-card relative overflow-hidden text-left">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
      <div className="relative z-10 space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-black text-white/70 uppercase tracking-wider">{t('report.premiumCtaEyebrow')}</p>
          <h3 className={`${compact ? 'text-[18px]' : 'text-xl'} font-black leading-tight break-keep`}>{t('report.premiumCtaTitle')}</h3>
          <p className="text-[13px] leading-relaxed text-white/85 break-keep">{t('report.premiumCtaDesc')}</p>
        </div>
        <button
          onClick={() => {
            trackReportCtaClick('start_trial', compact ? 'footer' : 'hero', '/pricing');
            router.push(buildTrackedPath('/pricing?entry_cta=start_trial'));
          }}
          className="w-full h-12 rounded-xl bg-white text-primary text-[14px] font-black active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
        >
          <span>{t('report.premiumCtaButton')}</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </section>
  );

  const loadSavedReport = useCallback(async (id: string) => {
    setIsSavedReportLoaded(false);
    setExistingReportLoadingType(null);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*, surveys(*), children(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        const surveyData = data.surveys;
        const childData = data.children;

        if (childData) {
          useAppStore.getState().setIntake({
            childName: childData.name,
            gender: childData.gender,
            birthDate: childData.birth_date,
          });
        }

        if (data.type === 'CHILD') {
          setChildAiReport(normalizeReportTextForName(asChildAiReport(data.analysis_json), childData?.name));
          setChildReportId(data.id);
          setReportDates(prev => ({ ...prev, child: data.created_at }));
          setSavedChildScores(
            extractReportScores(data.analysis_json)
            || (isTemperamentScores(surveyData?.scores) ? surveyData.scores : null)
            || (() => {
              const surveyAnswers = parseAnswerMap(surveyData?.answers);
              return surveyAnswers ? TemperamentScorer.calculate(CHILD_QUESTIONS, surveyAnswers) : null;
            })()
          );
          setActiveTab('child');
        } else if (data.type === 'PARENT') {
          setParentAiReport(asParentAiReport(data.analysis_json));
          setParentReportId(data.id);
          setReportDates(prev => ({ ...prev, parent: data.created_at }));
          setSavedParentScores(
            extractReportScores(data.analysis_json)
            || (isTemperamentScores(surveyData?.scores) ? surveyData.scores : null)
            || (() => {
              const surveyAnswers = parseAnswerMap(surveyData?.answers);
              return surveyAnswers ? TemperamentScorer.calculate(PARENT_QUESTIONS, surveyAnswers) : null;
            })()
          );
          setActiveTab('parent');
        } else if (data.type === 'HARMONY') {
          setHarmonyAiReport(normalizeReportTextForName(asHarmonyAiReport(data.analysis_json), childData?.name));
          setHarmonyReportId(data.id);
          setReportDates(prev => ({ ...prev, parenting: data.created_at }));
          setActiveTab('parenting');
        }
      }
    } catch (e) {
      console.error('Failed to load report:', e);
      alert(t('report.loadingError'));
    } finally {
      setIsSavedReportLoaded(true);
      setExistingReportLoadingType(null);
    }
  }, [normalizeReportTextForName, t]);

  // URL ID가 있을 경우 DB에서 리포트 로드
  useEffect(() => {
    if (!reportId) {
      setIsSavedReportLoaded(false);
      return;
    }

    if (authLoading) {
      setIsSavedReportLoaded(false);
      return;
    }

    if (!user) {
      setIsSavedReportLoaded(true);
      return;
    }

    void loadSavedReport(reportId);
  }, [authLoading, loadSavedReport, reportId, user]);

  // 선택된 아이가 바뀌면 리포트 초기화 (다자녀 전환 시)
  const prevChildIdRef = useRef(selectedChildId);
  useEffect(() => {
    if (prevChildIdRef.current !== selectedChildId) {
      prevChildIdRef.current = selectedChildId;
      inflightControllersRef.current.forEach((controller) => controller.abort());
      inflightControllersRef.current.clear();
      generatingRef.current.clear();
      setIsGenerating(false);
      setExistingReportLoadingType(null);
      setChildAiReport(null);
      setParentAiReport(null);
      setHarmonyAiReport(null);
      setChildReportId(null);
      setParentReportId(null);
      setHarmonyReportId(null);
    }
  }, [selectedChildId]);

  useEffect(() => {
    const controllers = inflightControllersRef.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  const handleTabChange = (tab: 'child' | 'parent' | 'parenting') => {
    setActiveTab(tab);
  };

  const buildTrackedPath = useCallback((path: string) => {
    const [basePath, queryString] = path.split('?');
    const params = new URLSearchParams(queryString ?? '');
    params.set('source', 'report');
    params.set('report_tab', activeTab);
    params.set('report_kind', reportKind);
    const nextQuery = params.toString();
    return nextQuery ? `${basePath}?${nextQuery}` : basePath;
  }, [activeTab, reportKind]);

  const trackReportCtaClick = useCallback((
    ctaType: string,
    placement: 'hero' | 'footer' | 'sticky' | 'inline_final',
    destinationPath: string,
  ) => {
    trackEvent('report_primary_cta_clicked', {
      cta_type: ctaType,
      placement,
      report_tab: activeTab,
      report_kind: reportKind,
      child_only: isChildOnly,
      source: entrySource,
      has_saved_report: !!reportId,
      destination_path: destinationPath,
    });
  }, [activeTab, entrySource, isChildOnly, reportId, reportKind]);

  useEffect(() => {
    refreshedReportTypesRef.current.clear();
  }, [reportRefreshParam]);

  useEffect(() => {
    const refreshSource = getHarmonyRefreshSource(reportRefreshParam);
    if (refreshSource) setHarmonyRefreshSource(refreshSource);
  }, [reportRefreshParam]);

  const shouldRefreshReportType = useCallback((type: 'CHILD' | 'PARENT' | 'HARMONY') => {
    const matches =
      reportRefreshParam === 'all'
      || (reportRefreshParam === 'child' && type === 'CHILD')
      || (reportRefreshParam === 'parent' && type === 'PARENT')
      || (reportRefreshParam === 'parenting' && type === 'HARMONY');

    if (!matches) return false;

    const refreshKey = `${reportRefreshParam}:${type}`;
    if (refreshedReportTypesRef.current.has(refreshKey)) return false;

    refreshedReportTypesRef.current.add(refreshKey);
    return true;
  }, [reportRefreshParam]);

  const getSurveyRetakeCooldown = useCallback((
    target: SurveyReanalysisTarget,
    subscriptionOverride = hasSubscription,
  ) => {
    const lastReportDate = target === 'child' ? reportDates.child : reportDates.parent;
    return checkCooldown(lastReportDate ?? null, {
      hasSubscription: subscriptionOverride,
    });
  }, [hasSubscription, reportDates.child, reportDates.parent]);

  const formatCooldownRemaining = useCallback((status: CooldownStatus) => {
    if (status.remainingHours >= 24) {
      return t('report.retakeCooldownDays', { days: status.remainingDays });
    }

    return t('report.retakeCooldownHours', {
      hours: Math.max(1, status.remainingHours),
    });
  }, [t]);

  const getRetakeCooldownMessage = useCallback((
    status: CooldownStatus,
    subscriptionOverride = hasSubscription,
  ) => {
    const time = formatCooldownRemaining(status);
    return subscriptionOverride
      ? t('report.retakeCooldownSubscriber', { time })
      : t('report.retakeCooldownFree', { time });
  }, [formatCooldownRemaining, hasSubscription, t]);

  const resolveCurrentSubscription = useCallback(async () => {
    if (!user) return false;

    try {
      const subscription = await db.getActiveSubscription(user.id);
      const nextHasSubscription = !!subscription;
      setHasSubscription(nextHasSubscription);
      setIsSubscriptionLoaded(true);
      return nextHasSubscription;
    } catch {
      return hasSubscription;
    }
  }, [hasSubscription, user]);

  const openRestartDialog = useCallback(async (target: ReanalysisTarget) => {
    if (target !== 'harmony') {
      const currentHasSubscription = await resolveCurrentSubscription();
      const status = getSurveyRetakeCooldown(target, currentHasSubscription);
      if (!status.isAvailable) {
        alert(getRetakeCooldownMessage(status, currentHasSubscription));
        return;
      }
    }

    setRestartTarget(target);
    setIsRestartDialogOpen(true);
  }, [getRetakeCooldownMessage, getSurveyRetakeCooldown, resolveCurrentSubscription]);

  const handleFreshSurveyRestart = useCallback(async () => {
    const surveyTarget: SurveyReanalysisTarget = restartTarget === 'child' ? 'child' : 'parent';
    const currentHasSubscription = await resolveCurrentSubscription();
    const cooldownStatus = getSurveyRetakeCooldown(surveyTarget, currentHasSubscription);
    if (!cooldownStatus.isAvailable) {
      alert(getRetakeCooldownMessage(cooldownStatus, currentHasSubscription));
      setIsRestartDialogOpen(false);
      return;
    }

    setIsStartingFreshSurvey(true);
    try {
      const surveyType = surveyTarget === 'child' ? 'CHILD' : 'PARENT';
      resetSurveyModule(surveyTarget);
      useSurveyStore.getState().resetSurvey();

      if (user) {
        await db.startFreshSurveyResponses(user.id, currentChild?.id ?? selectedChildId, [surveyType]);
      }

      const destination = surveyTarget === 'child'
        ? '/survey?type=CHILD&flow=quick&restart=report&restart_scope=child&refresh=child'
        : '/survey?type=PARENT&flow=quick&restart=report&restart_scope=parent&refresh=parent';

      trackReportCtaClick(`restart_${surveyTarget}_survey_for_reanalysis`, 'footer', destination);
      router.replace(buildTrackedPath(destination));
    } catch (error) {
      console.error('Failed to start fresh survey:', error);
      alert(t('report.restartAnalysisError'));
      setIsStartingFreshSurvey(false);
    }
  }, [
    buildTrackedPath,
    currentChild?.id,
    getRetakeCooldownMessage,
    getSurveyRetakeCooldown,
    resetSurveyModule,
    resolveCurrentSubscription,
    restartTarget,
    router,
    selectedChildId,
    t,
    trackReportCtaClick,
    user,
  ]);

  useEffect(() => {
    if (!canUseReportContext) return;

    trackEvent('report_viewed', {
      tab: activeTab,
      report_kind: reportKind,
      child_only: isChildOnly,
      has_saved_report: !!reportId,
      source: entrySource,
      has_subscription: hasSubscription,
    });
  }, [activeTab, canUseReportContext, entrySource, hasSubscription, isChildOnly, reportId, reportKind]);


  // 리포트 포맷 검증: 필수 필드가 있는지 확인
  const isValidReport = useCallback((report: unknown, type: string): boolean => {
    if (!report || typeof report !== 'object') return false;
    const value = report as Record<string, unknown>;
    if (type === 'CHILD') return !!(value.intro && value.analysis);
    if (type === 'PARENT') return !!(value.intro && (value.dimensions || value.sections));
    if (type === 'HARMONY') return !!(value.harmonyTitle || value.compatibilityScore);
    return false;
  }, []);

  // 공통 API 호출 함수 (포맷 불일치 시 자동 재생성)
  // API에서 반환된 리포트 ID 저장 (공유 등에 활용)
  const getShareReportId = useCallback((tab: ReportTab) => {
    if (reportId && activeTab === tab) return reportId;
    if (tab === 'child') return childReportId || currentChildReport?.id || null;
    if (tab === 'parent') return parentReportId || currentParentReport?.id || null;
    return harmonyReportId || currentHarmonyReport?.id || null;
  }, [
    activeTab,
    childReportId,
    currentChildReport?.id,
    currentHarmonyReport?.id,
    currentParentReport?.id,
    harmonyReportId,
    parentReportId,
    reportId,
  ]);

  const buildSharePathForTab = useCallback((tab: ReportTab) => {
    const shareReportId = getShareReportId(tab);
    return buildTrackedPath(`/share${shareReportId ? `?id=${shareReportId}` : ''}`);
  }, [buildTrackedPath, getShareReportId]);

  const fetchReport = useCallback(async (payload: ReportApiPayload, signal?: AbortSignal): Promise<ReportApiResult | null> => {
    const resolvedChildId = currentChild?.id ?? selectedChildId;
    const perf = createPerfTracker('fetchReport', {
      type: payload.type,
      childId: resolvedChildId ?? null,
      refresh: !!payload.refresh,
    });

    const res = await fetch('/api/llm/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, intake, childId: resolvedChildId }),
      signal,
    });
    perf.mark('network_complete', {
      ok: res.ok,
      status: res.status,
      serverTiming: res.headers.get('server-timing') ?? null,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error(`[fetchReport] ${payload.type} failed:`, res.status, errBody);
      if (errBody?.code === CHILD_PROFILE_LIMIT_REACHED_CODE || errBody?.error === CHILD_PROFILE_LIMIT_REACHED_CODE) {
        throw new Error(CHILD_PROFILE_LIMIT_REACHED_CODE);
      }
      throw new Error('Report generation failed');
    }
    const data = await res.json();
    perf.mark('response_parsed', {
      cached: data.cached,
      createdAt: data.createdAt,
    });
    console.log(
      `[fetchReport] ${payload.type}: cached=${data.cached}, createdAt=${data.createdAt}, timings=${JSON.stringify(data.timings ?? null)}`
    );
    if (!data.report) throw new Error('Empty report response');

    // 캐시된 리포트의 포맷이 현재 UI와 맞지 않으면 재생성
    if (data.cached && !isValidReport(data.report, payload.type)) {
      console.warn(`Cached ${payload.type} report format mismatch, regenerating...`);
      return fetchReport({ ...payload, refresh: true }, signal);
    }

    return { report: data.report, reportId: data.reportId, createdAt: data.createdAt };
  }, [currentChild?.id, intake, isValidReport, selectedChildId]);

  const fetchChildReportStream = useCallback(async (
    payload: ReportApiPayload & { type: 'CHILD' },
    onModule: (item: ChildReportStreamModule) => void,
    signal?: AbortSignal,
  ): Promise<ReportApiResult | null> => {
    const resolvedChildId = currentChild?.id ?? selectedChildId;
    const perf = createPerfTracker('fetchReportStream', {
      type: payload.type,
      childId: resolvedChildId ?? null,
      refresh: !!payload.refresh,
    });

    const res = await fetch('/api/llm/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, intake, childId: resolvedChildId, stream: true }),
      signal,
    });
    perf.mark('network_headers', {
      ok: res.ok,
      status: res.status,
    });

    if (!res.ok || !res.body) {
      const errBody = await res.json().catch(() => ({}));
      console.error('[fetchReportStream] CHILD failed:', res.status, errBody);
      throw new Error('Report stream failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: ReportApiResult | null = null;

    const handleBlock = (block: string) => {
      if (signal?.aborted) return;
      const { event, data } = parseSseBlock(block);
      if (!data) return;

      const parsed = JSON.parse(data);
      if (event === 'module') {
        onModule(parsed as ChildReportStreamModule);
        return;
      }

      if (event === 'cached' || event === 'completed') {
        if (parsed.report) {
          result = {
            report: parsed.report,
            reportId: parsed.reportId,
            createdAt: parsed.createdAt,
            persisted: parsed.persisted,
          };
        }
        if (event === 'completed') {
          perf.mark('stream_completed', { cached: !!parsed.cached, persisted: parsed.persisted !== false });
          console.log(
            `[fetchReportStream] CHILD: cached=${parsed.cached}, persisted=${parsed.persisted !== false}, createdAt=${parsed.createdAt}, timings=${JSON.stringify(parsed.timings ?? null)}`
          );
        }
        return;
      }

      if (event === 'error') {
        throw new Error(typeof parsed.code === 'string' ? parsed.code : (typeof parsed.error === 'string' ? parsed.error : 'Report stream failed'));
      }
    };

    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let delimiterIndex = buffer.indexOf('\n\n');
      while (delimiterIndex >= 0) {
        const block = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);
        handleBlock(block);
        delimiterIndex = buffer.indexOf('\n\n');
      }
    }

    if (signal?.aborted) return null;
    buffer += decoder.decode();
    if (buffer.trim()) handleBlock(buffer);
    perf.mark('response_parsed');

    return result;
  }, [currentChild?.id, intake, selectedChildId]);

  const fetchParentReportStream = useCallback(async (
    payload: ReportApiPayload & { type: 'PARENT' },
    onModule: (item: ParentReportStreamModule) => void,
    signal?: AbortSignal,
  ): Promise<ReportApiResult | null> => {
    const resolvedChildId = currentChild?.id ?? selectedChildId;
    const perf = createPerfTracker('fetchReportStream', {
      type: payload.type,
      childId: resolvedChildId ?? null,
      refresh: !!payload.refresh,
    });

    const res = await fetch('/api/llm/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, intake, childId: resolvedChildId, stream: true }),
      signal,
    });
    perf.mark('network_headers', {
      ok: res.ok,
      status: res.status,
    });

    if (!res.ok || !res.body) {
      const errBody = await res.json().catch(() => ({}));
      console.error('[fetchReportStream] PARENT failed:', res.status, errBody);
      throw new Error('Parent report stream failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: ReportApiResult | null = null;
    let streamedModuleCount = 0;
    let revealedReportFallback = false;

    const revealReportFallback = async (report: Parameters<typeof asParentAiReport>[0]) => {
      if (streamedModuleCount > 0 || revealedReportFallback) return;

      const parentReport = asParentAiReport(report);
      const revealedCount = await revealParentReportModules(parentReport, onModule);
      if (revealedCount > 0) {
        streamedModuleCount += revealedCount;
        revealedReportFallback = true;
      }
    };

    const handleBlock = async (block: string) => {
      if (signal?.aborted) return;
      const { event, data } = parseSseBlock(block);
      if (!data) return;

      const parsed = JSON.parse(data);
      if (event === 'module') {
        streamedModuleCount += 1;
        onModule(parsed as ParentReportStreamModule);
        await wait(PARENT_REPORT_MODULE_REVEAL_DELAY_MS);
        return;
      }

      if (event === 'cached' || event === 'completed') {
        if (parsed.report) {
          result = {
            report: parsed.report,
            reportId: parsed.reportId,
            createdAt: parsed.createdAt,
            persisted: parsed.persisted,
          };
        }
        if (parsed.report && (event === 'cached' || streamedModuleCount === 0)) {
          await revealReportFallback(parsed.report);
        }
        if (event === 'completed') {
          perf.mark('stream_completed', { cached: !!parsed.cached, persisted: parsed.persisted !== false });
          console.log(
            `[fetchReportStream] PARENT: cached=${parsed.cached}, persisted=${parsed.persisted !== false}, createdAt=${parsed.createdAt}, timings=${JSON.stringify(parsed.timings ?? null)}`
          );
        }
        return;
      }

      if (event === 'error') {
        throw new Error(typeof parsed.code === 'string' ? parsed.code : (typeof parsed.error === 'string' ? parsed.error : 'Parent report stream failed'));
      }
    };

    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let delimiterIndex = buffer.indexOf('\n\n');
      while (delimiterIndex >= 0) {
        const block = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);
        await handleBlock(block);
        delimiterIndex = buffer.indexOf('\n\n');
      }
    }

    if (signal?.aborted) return null;
    buffer += decoder.decode();
    if (buffer.trim()) await handleBlock(buffer);
    perf.mark('response_parsed');

    return result;
  }, [currentChild?.id, intake, selectedChildId]);

  const hasCompleteLocalChildResponses = Object.keys(cbqResponses).length >= CHILD_QUESTIONS.length;
  const hasCompleteLocalParentResponses = Object.keys(atqResponses).length >= PARENT_QUESTIONS.length;
  const prefersFreshChildResponses =
    (reportRefreshParam === 'all' || reportRefreshParam === 'child')
    && hasCompleteLocalChildResponses;
  const prefersFreshParentResponses =
    (reportRefreshParam === 'all' || reportRefreshParam === 'parent')
    && hasCompleteLocalParentResponses;

  const childScores = useMemo(() => {
    if (prefersFreshChildResponses) return TemperamentScorer.calculate(CHILD_QUESTIONS, cbqResponses);
    if (savedChildScores) return savedChildScores;
    if (currentChildReportScores) return currentChildReportScores;
    if (currentChildSurveyScores) return currentChildSurveyScores;
    if (currentChildSurveyAnswers) return TemperamentScorer.calculate(CHILD_QUESTIONS, currentChildSurveyAnswers);
    return TemperamentScorer.calculate(CHILD_QUESTIONS, cbqResponses);
  }, [cbqResponses, currentChildReportScores, currentChildSurveyAnswers, currentChildSurveyScores, prefersFreshChildResponses, savedChildScores]);

  const parentScores = useMemo(() => {
    if (prefersFreshParentResponses) return TemperamentScorer.calculate(PARENT_QUESTIONS, atqResponses);
    if (savedParentScores) return savedParentScores;
    if (currentParentReportScores) return currentParentReportScores;
    if (currentParentSurveyScores) return currentParentSurveyScores;
    if (currentParentSurveyAnswers) return TemperamentScorer.calculate(PARENT_QUESTIONS, currentParentSurveyAnswers);
    return TemperamentScorer.calculate(PARENT_QUESTIONS, atqResponses);
  }, [atqResponses, currentParentReportScores, currentParentSurveyAnswers, currentParentSurveyScores, prefersFreshParentResponses, savedParentScores]);

  const styleScores = useMemo<ParentingStyleScores>(() => {
    const scores = { Efficacy: 0, Autonomy: 0, Responsiveness: 0 };
    const counts = { Efficacy: 0, Autonomy: 0, Responsiveness: 0 };

    PARENTING_STYLE_QUESTIONS.forEach(q => {
      const answer = parentingResponses[q.id.toString()];
      if (answer) {
        const cat = q.category as keyof typeof scores;
        if (cat in scores) {
          scores[cat] += answer;
          counts[cat]++;
        }
      }
    });
    return {
      Efficacy: counts.Efficacy > 0 ? Math.round((scores.Efficacy / (counts.Efficacy * 5)) * 100) : 0,
      Autonomy: counts.Autonomy > 0 ? Math.round((scores.Autonomy / (counts.Autonomy * 5)) * 100) : 0,
      Responsiveness: counts.Responsiveness > 0 ? Math.round((scores.Responsiveness / (counts.Responsiveness * 5)) * 100) : 0,
    };
  }, [parentingResponses]);

  const childType = useMemo(() => TemperamentClassifier.analyzeChild(childScores), [childScores]);
  const childAnswerMap = prefersFreshChildResponses ? cbqResponses : currentChildSurveyAnswers ?? cbqResponses;
  const parentAnswerMap = prefersFreshParentResponses ? atqResponses : currentParentSurveyAnswers ?? atqResponses;

  const isStyleSurveyComplete = useMemo(() => {
    return PARENTING_STYLE_QUESTIONS.every(q => !!parentingResponses[q.id.toString()]);
  }, [parentingResponses]);

  const parentType = useMemo(() => TemperamentClassifier.analyzeParent(parentScores), [parentScores]);

  const isChildSurveyComplete = useMemo(() => {
    if (prefersFreshChildResponses) return hasCompleteLocalChildResponses;
    return !!savedChildScores
      || !!currentChildReportScores
      || !!currentChildSurveyScores
      || !!currentChildSurveyAnswers
      || hasCompleteLocalChildResponses;
  }, [currentChildReportScores, currentChildSurveyAnswers, currentChildSurveyScores, hasCompleteLocalChildResponses, prefersFreshChildResponses, savedChildScores]);

  const hasParentScores = useMemo(() => {
    if (prefersFreshParentResponses) return hasCompleteLocalParentResponses;
    return !!savedParentScores
      || !!currentParentReportScores
      || !!currentParentSurveyScores
      || !!currentParentSurveyAnswers
      || hasCompleteLocalParentResponses;
  }, [currentParentReportScores, currentParentSurveyAnswers, currentParentSurveyScores, hasCompleteLocalParentResponses, prefersFreshParentResponses, savedParentScores]);
  const isParentSurveyComplete = hasParentScores;

  useEffect(() => {
    if (!canUseReportContext) return;
    if (!isChildOnly || !isParentSurveyComplete || reportId) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('child_only');
    params.delete('report_tab');
    params.delete('report_kind');
    params.set('tab', 'child');

    const nextQuery = params.toString();
    router.replace(nextQuery ? `/report?${nextQuery}` : '/report?tab=child');
  }, [canUseReportContext, isChildOnly, isParentSurveyComplete, reportId, router, searchParams]);

  const generateChildAIReport = useCallback(async (refresh = false) => {
    if (generatingRef.current.has('CHILD')) return;
    const previousChildReport = childAiReport;
    const previousChildReportDate = reportDates.child;
    const previousChildReportId = childReportId;
    const isLoadingExistingReport = !refresh && !!currentChildReport?.id;
    const controller = new AbortController();
    inflightControllersRef.current.set('CHILD', controller);
    generatingRef.current.add('CHILD');
    setIsGenerating(true);
    if (isLoadingExistingReport) setExistingReportLoadingType('CHILD');
    try {
      const answers = Object.entries(childAnswerMap).map(([id, score]) => ({ questionId: id, score: score as number }));
      setReportDates(prev => {
        const next = { ...prev };
        delete next.child;
        return next;
      });
      setChildAiReport({ analysis: {} });
      const result = await fetchChildReportStream({
        userName: childName || '아이',
        scores: childScores, type: 'CHILD', answers,
        refresh,
        childType: { label: childType.label, keywords: childType.keywords, desc: childType.desc }
      }, (item) => {
        if (controller.signal.aborted) return;
        setChildAiReport((current) => normalizeReportTextForName(
          applyChildReportStreamModule(current ?? { analysis: {} }, item),
          childName,
        ));
      }, controller.signal);
      if (controller.signal.aborted) return;
      if (result) {
        setChildAiReport(normalizeReportTextForName(asChildAiReport(result.report), childName));
        if (result.reportId) setChildReportId(result.reportId);
        setReportDates(prev => ({ ...prev, child: result.createdAt }));
        if (refresh) setHarmonyRefreshSource('child');
      }
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return;
      }
      console.error(error);
      if (previousChildReport) {
        setChildAiReport(previousChildReport);
      } else {
        setChildAiReport(null);
      }
      setReportDates(prev => {
        const next = { ...prev };
        if (previousChildReportDate) {
          next.child = previousChildReportDate;
        } else {
          delete next.child;
        }
        return next;
      });
      setChildReportId(previousChildReportId);
      alert(isChildProfileLimitError(error) ? t('settings.childProfileLimitReached') : t('report.generationError'));
    } finally {
      if (inflightControllersRef.current.get('CHILD') === controller) {
        inflightControllersRef.current.delete('CHILD');
        generatingRef.current.delete('CHILD');
        setIsGenerating(generatingRef.current.size > 0);
        if (isLoadingExistingReport) {
          setExistingReportLoadingType(current => current === 'CHILD' ? null : current);
        }
      }
    }
  }, [childAiReport, childAnswerMap, childName, childReportId, childScores, childType.desc, childType.keywords, childType.label, currentChildReport?.id, fetchChildReportStream, normalizeReportTextForName, reportDates.child, t]);

  const generateParentAIReport = useCallback(async (refresh = false) => {
    if (generatingRef.current.has('PARENT')) return;
    const previousParentReport = parentAiReport;
    const previousParentReportDate = reportDates.parent;
    const isLoadingExistingReport = !refresh && !!currentParentReport?.id;
    const controller = new AbortController();
    inflightControllersRef.current.set('PARENT', controller);
    generatingRef.current.add('PARENT');
    setIsGenerating(true);
    if (isLoadingExistingReport) setExistingReportLoadingType('PARENT');
    try {
      const answers = Object.entries(parentAnswerMap).map(([id, score]) => ({ questionId: id, score: score as number }));
      setReportDates(prev => {
        const next = { ...prev };
        delete next.parent;
        return next;
      });
      setParentAiReport({});
      const result = await fetchParentReportStream({
        userName: '양육자',
        scores: parentScores, type: 'PARENT', answers,
        refresh,
        parentType: { label: parentType.label, keywords: parentType.keywords }
      }, (item) => {
        if (controller.signal.aborted) return;
        setParentAiReport((current) => applyParentReportStreamModule(current ?? {}, item));
      }, controller.signal);
      if (controller.signal.aborted) return;
      if (result) {
        setParentAiReport(asParentAiReport(result.report));
        if (result.reportId) setParentReportId(result.reportId);
        setReportDates(prev => ({ ...prev, parent: result.createdAt }));
        if (refresh) setHarmonyRefreshSource('parent');
      }
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return;
      }
      console.error(error);
      if (previousParentReport) {
        setParentAiReport(previousParentReport);
      } else {
        setParentAiReport(null);
      }
      setReportDates(prev => {
        const next = { ...prev };
        if (previousParentReportDate) {
          next.parent = previousParentReportDate;
        } else {
          delete next.parent;
        }
        return next;
      });
      alert(isChildProfileLimitError(error) ? t('settings.childProfileLimitReached') : t('report.generationError'));
    } finally {
      if (inflightControllersRef.current.get('PARENT') === controller) {
        inflightControllersRef.current.delete('PARENT');
        generatingRef.current.delete('PARENT');
        setIsGenerating(generatingRef.current.size > 0);
        if (isLoadingExistingReport) {
          setExistingReportLoadingType(current => current === 'PARENT' ? null : current);
        }
      }
    }
  }, [currentParentReport?.id, fetchParentReportStream, parentAiReport, parentAnswerMap, parentScores, parentType.keywords, parentType.label, reportDates.parent, t]);

  const generateHarmonyAIReport = useCallback(async (refresh = false) => {
    if (generatingRef.current.has('HARMONY')) return;
    const isLoadingExistingReport = !refresh && !!currentHarmonyReport?.id;
    const controller = new AbortController();
    inflightControllersRef.current.set('HARMONY', controller);
    generatingRef.current.add('HARMONY');
    setIsGenerating(true);
    if (isLoadingExistingReport) setExistingReportLoadingType('HARMONY');
    try {
      const answers = [
        ...Object.entries(childAnswerMap),
        ...Object.entries(parentAnswerMap),
        ...Object.entries(parentingResponses)
      ].map(([id, score]) => ({ questionId: id, score: score as number }));
      const result = await fetchReport({
        userName: childName || '아이',
        scores: childScores, parentScores, type: 'HARMONY', answers,
        isPreview: false, refresh, styleScores,
        childType: { label: childType.label, keywords: childType.keywords },
        parentType: { label: parentType.label, keywords: parentType.keywords }
      }, controller.signal);
      if (controller.signal.aborted) return false;
      if (result) {
        setHarmonyAiReport(normalizeReportTextForName(asHarmonyAiReport(result.report), childName));
        if (result.reportId) setHarmonyReportId(result.reportId);
        setReportDates(prev => ({ ...prev, parenting: result.createdAt }));
        return true;
      }
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return false;
      }
      console.error(error);
      alert(isChildProfileLimitError(error) ? t('settings.childProfileLimitReached') : t('report.harmonyError'));
      return false;
    } finally {
      if (inflightControllersRef.current.get('HARMONY') === controller) {
        inflightControllersRef.current.delete('HARMONY');
        generatingRef.current.delete('HARMONY');
        setIsGenerating(generatingRef.current.size > 0);
        if (isLoadingExistingReport) {
          setExistingReportLoadingType(current => current === 'HARMONY' ? null : current);
        }
      }
    }
    return false;
  }, [childAnswerMap, childName, childScores, childType.keywords, childType.label, currentHarmonyReport?.id, fetchReport, normalizeReportTextForName, parentAnswerMap, parentScores, parentType.keywords, parentType.label, parentingResponses, styleScores, t]);

  const handleHarmonyRefresh = useCallback(async () => {
    if (!isStyleSurveyComplete) {
      if (confirm(t('report.styleSurveyNeeded'))) {
        const destination = '/survey?type=STYLE';
        trackReportCtaClick('continue_parenting_style_for_harmony_refresh', 'footer', destination);
        router.push(buildTrackedPath(destination));
      }
      return;
    }

    setIsRestartDialogOpen(false);
    setActiveTab('parenting');
    const previousHarmonyReport = harmonyAiReport;
    const previousHarmonyDate = reportDates.parenting;
    setHarmonyAiReport(null);
    trackReportCtaClick('refresh_harmony_after_reanalysis', 'footer', '/report?tab=parenting&refresh=parenting');
    const refreshed = await generateHarmonyAIReport(true);
    if (refreshed) {
      setHarmonyRefreshSource(null);
    } else {
      setHarmonyAiReport(previousHarmonyReport);
      setReportDates(prev => {
        const next = { ...prev };
        if (previousHarmonyDate) {
          next.parenting = previousHarmonyDate;
        } else {
          delete next.parenting;
        }
        return next;
      });
    }
  }, [buildTrackedPath, generateHarmonyAIReport, harmonyAiReport, isStyleSurveyComplete, reportDates.parenting, router, t, trackReportCtaClick]);

  const handleRestartAnalysisConfirm = useCallback(async () => {
    if (restartTarget === 'harmony') {
      await handleHarmonyRefresh();
      return;
    }

    await handleFreshSurveyRestart();
  }, [handleFreshSurveyRestart, handleHarmonyRefresh, restartTarget]);

  // 아이 기질 탭: 리포트 없으면 자동 생성 (서버가 캐시/생성 분기)
  useEffect(() => {
    if (!canUseReportContext) return;

    const hasCbq = hasCompleteLocalChildResponses
      || !!savedChildScores
      || !!currentChildReportScores
      || !!currentChildSurveyScores;
    if (activeTab === 'child' && !isGenerating && !reportId && hasCbq && !childAiReport) {
      const shouldRefresh = prefersFreshChildResponses && shouldRefreshReportType('CHILD');
      void generateChildAIReport(shouldRefresh);
    }
  }, [activeTab, canUseReportContext, childAiReport, currentChildReportScores, currentChildSurveyScores, generateChildAIReport, hasCompleteLocalChildResponses, isGenerating, prefersFreshChildResponses, reportId, savedChildScores, shouldRefreshReportType]);

  // 양육자 탭 진입 시 자동 생성
  useEffect(() => {
    if (!canUseReportContext) return;

    if (activeTab === 'parent' && !isGenerating && !reportId && hasParentScores && !parentAiReport) {
      const shouldRefresh = prefersFreshParentResponses && shouldRefreshReportType('PARENT');
      void generateParentAIReport(shouldRefresh);
    }
  }, [activeTab, canUseReportContext, generateParentAIReport, hasParentScores, isGenerating, parentAiReport, prefersFreshParentResponses, reportId, shouldRefreshReportType]);

  // 기질맞춤양육 탭 진입 시 자동 생성
  useEffect(() => {
    if (!canUseReportContext) return;

    const styleComplete = PARENTING_STYLE_QUESTIONS.every(q => !!parentingResponses[q.id.toString()]);
    if (activeTab === 'parenting' && !isGenerating && !reportId && !harmonyAiReport && styleComplete) {
      void generateHarmonyAIReport(shouldRefreshReportType('HARMONY'));
    }
  }, [activeTab, canUseReportContext, generateHarmonyAIReport, harmonyAiReport, isGenerating, parentingResponses, reportId, shouldRefreshReportType]);

  // Radar chart loading animation
  const [animatedRadar, setAnimatedRadar] = useState<number[][]>([[50,50,50,50],[50,50,50,50]]);
  useEffect(() => {
    if (harmonyAiReport || activeTab !== 'parenting') return;
    const interval = setInterval(() => {
      setAnimatedRadar([
        Array.from({ length: 4 }, () => 20 + Math.random() * 60),
        Array.from({ length: 4 }, () => 20 + Math.random() * 60),
      ]);
    }, 800);
    return () => clearInterval(interval);
  }, [harmonyAiReport, activeTab]);

  const isRadarLoading = activeTab === 'parenting' && !harmonyAiReport;
  const shouldShowHarmonyRefreshNotice = !isChildOnly && activeTab === 'parenting' && !!harmonyRefreshSource;
  const childScoreSectionTitle = locale === 'ko'
    ? `${childPossessiveName} 기질 점수`
    : `${childName}${t('report.temperamentScores')}`;
  const isChildReportStreaming = isGenerating && generatingRef.current.has('CHILD');
  const childReportInsight = childAiReport?.analysis?.insight;
  const childReportStrengths = childAiReport?.analysis?.strengths;
  const childReportParentingTips = childAiReport?.parentingTips;
  const childReportScripts = childAiReport?.scripts;
  const hasChildReportIntro = !!childAiReport?.intro;
  const hasChildReportDimensions = !!childAiReport?.analysis?.dimensions
    && Object.values(childAiReport.analysis.dimensions).some(Boolean);
  const hasChildReportParentingTips = Array.isArray(childReportParentingTips)
    && childReportParentingTips.length > 0;
  const hasChildReportScripts = Array.isArray(childReportScripts)
    && childReportScripts.length > 0;
  const childReportLoadingSections = useMemo(() => [
    {
      key: 'intro',
      icon: 'chat_bubble',
      label: t('report.ainaComment'),
      message: t('report.childSectionLoadingAina'),
      isReady: hasChildReportIntro,
    },
    {
      key: 'scores',
      icon: 'bar_chart',
      label: childScoreSectionTitle,
      message: t('report.childSectionLoadingScores'),
      isReady: hasChildReportIntro || !isChildReportStreaming,
    },
    {
      key: 'dimensions',
      icon: 'psychology',
      label: t('report.dimensionAnalysis'),
      message: t('report.childSectionLoadingDimensions'),
      isReady: hasChildReportDimensions,
    },
    {
      key: 'insight',
      icon: 'favorite',
      label: t('report.hiddenFeelings'),
      message: t('report.childSectionLoadingInsight'),
      isReady: !!childReportInsight,
    },
    {
      key: 'strengths',
      icon: 'emoji_events',
      label: t('report.strengthsGrowth'),
      message: t('report.childSectionLoadingStrengths'),
      isReady: !!childReportStrengths,
    },
    {
      key: 'parentingTips',
      icon: 'lightbulb',
      label: t('report.parentingGuide'),
      message: t('report.childSectionLoadingParentingGuide'),
      isReady: hasChildReportParentingTips,
    },
    {
      key: 'scripts',
      icon: 'record_voice_over',
      label: t('report.magicWord'),
      message: t('report.childSectionLoadingMagicWord'),
      isReady: hasChildReportScripts,
    },
  ] satisfies Array<ReportLoadingSection<ChildReportLoadingKey>>, [
    childReportInsight,
    childReportStrengths,
    childScoreSectionTitle,
    hasChildReportDimensions,
    hasChildReportIntro,
    hasChildReportParentingTips,
    hasChildReportScripts,
    isChildReportStreaming,
    t,
  ]);
  const activeChildLoadingSection = isChildReportStreaming
    ? childReportLoadingSections.find((section) => !section.isReady)
    : undefined;
  const activeChildLoadingKey = activeChildLoadingSection?.key;
  const childReportProgressTotal = childReportLoadingSections.length + 1;
  const activeChildLoadingProgressCurrent = activeChildLoadingSection
    ? childReportLoadingSections.findIndex((section) => section.key === activeChildLoadingSection.key) + 1
    : childReportProgressTotal;
  const isChildReportFinalizing = isChildReportStreaming && hasChildReportScripts && !activeChildLoadingSection;
  const shouldShowChildOnlyCompletionCta =
    isChildOnly &&
    isDashboardContextLoaded &&
    !isParentSurveyComplete &&
    !!childAiReport &&
    !!reportDates.child &&
    !isGenerating;
  const isParentReportStreaming = isGenerating && generatingRef.current.has('PARENT');
  const parentReportShining = parentAiReport?.shining || getParentSectionContent(parentAiReport, 'shining');
  const parentReportVulnerability = parentAiReport?.vulnerability || getParentSectionContent(parentAiReport, 'vulnerability');
  const hasParentReportIntro = !!parentAiReport?.intro;
  const hasParentReportDimensions = !!parentAiReport?.dimensions
    && Object.values(parentAiReport.dimensions).some(Boolean);
  const hasParentReportParentingStyle = Array.isArray(parentAiReport?.parentingStyle)
    && parentAiReport.parentingStyle.length > 0;
  const hasParentReportSolutions = Array.isArray(parentAiReport?.solutions)
    && parentAiReport.solutions.length > 0;
  const hasParentReportLetter = !!parentAiReport?.letter;
  const parentReportLoadingSections = useMemo(() => [
    {
      key: 'intro',
      icon: 'chat_bubble',
      label: t('report.ainaComment'),
      message: t('report.parentSectionLoadingAina'),
      isReady: hasParentReportIntro,
    },
    {
      key: 'scores',
      icon: 'bar_chart',
      label: t('report.parentTemperamentScores'),
      message: t('report.parentSectionLoadingScores'),
      isReady: hasParentReportIntro || !isParentReportStreaming,
    },
    {
      key: 'dimensions',
      icon: 'psychology',
      label: t('report.dimensionAnalysis'),
      message: t('report.parentSectionLoadingDimensions'),
      isReady: hasParentReportDimensions,
    },
    {
      key: 'shining',
      icon: 'auto_awesome',
      label: t('report.shiningMoment'),
      message: t('report.parentSectionLoadingShining'),
      isReady: !!parentReportShining,
    },
    {
      key: 'parentingStyle',
      icon: 'child_care',
      label: t('report.parentingTemperament'),
      message: t('report.parentSectionLoadingParentingTemperament'),
      isReady: hasParentReportParentingStyle,
    },
    {
      key: 'vulnerability',
      icon: 'battery_alert',
      label: t('report.energyWarning'),
      message: t('report.parentSectionLoadingEnergyWarning'),
      isReady: !!parentReportVulnerability,
    },
    {
      key: 'solutions',
      icon: 'lightbulb',
      label: t('report.mindNutrient'),
      message: t('report.parentSectionLoadingMindNutrient'),
      isReady: hasParentReportSolutions,
    },
    {
      key: 'letter',
      icon: 'mail',
      label: t('report.ainaLetter'),
      message: t('report.parentSectionLoadingLetter'),
      isReady: hasParentReportLetter,
    },
  ] satisfies Array<ReportLoadingSection<ParentReportLoadingKey>>, [
    hasParentReportDimensions,
    hasParentReportIntro,
    hasParentReportLetter,
    hasParentReportParentingStyle,
    hasParentReportSolutions,
    isParentReportStreaming,
    parentReportShining,
    parentReportVulnerability,
    t,
  ]);
  const activeParentLoadingSection = isParentReportStreaming
    ? parentReportLoadingSections.find((section) => !section.isReady)
    : undefined;
  const activeParentLoadingKey = activeParentLoadingSection?.key;
  const parentReportProgressTotal = parentReportLoadingSections.length + 1;
  const activeParentLoadingProgressCurrent = activeParentLoadingSection
    ? parentReportLoadingSections.findIndex((section) => section.key === activeParentLoadingSection.key) + 1
    : parentReportProgressTotal;
  const isParentReportFinalizing = isParentReportStreaming && hasParentReportLetter && !activeParentLoadingSection;
  const isHarmonyReportGenerating = isGenerating && generatingRef.current.has('HARMONY');
  const radarData = {
    labels: [
      TCI_TERMINOLOGY.DIMENSIONS.NS.name,
      TCI_TERMINOLOGY.DIMENSIONS.HA.name,
      TCI_TERMINOLOGY.DIMENSIONS.RD.name,
      TCI_TERMINOLOGY.DIMENSIONS.P.name
    ],
    datasets: [
      {
        label: TCI_TERMINOLOGY.REPORT.CHILD_NAME,
        data: isRadarLoading ? animatedRadar[0] : [childScores.NS, childScores.HA, childScores.RD, childScores.P],
        backgroundColor: isRadarLoading ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.15)',
        borderColor: isRadarLoading ? 'rgba(59, 130, 246, 0.3)' : '#3B82F6',
        borderWidth: 2.5,
        pointBackgroundColor: isRadarLoading ? 'rgba(59, 130, 246, 0.3)' : '#3B82F6',
        pointRadius: 4,
      },
      {
        label: TCI_TERMINOLOGY.REPORT.PARENT_NAME,
        data: isRadarLoading ? animatedRadar[1] : [parentScores.NS, parentScores.HA, parentScores.RD, parentScores.P],
        backgroundColor: isRadarLoading ? 'rgba(249, 115, 22, 0.06)' : 'rgba(249, 115, 22, 0.12)',
        borderColor: isRadarLoading ? 'rgba(249, 115, 22, 0.3)' : '#F97316',
        borderWidth: 2,
        pointBackgroundColor: isRadarLoading ? 'rgba(249, 115, 22, 0.3)' : '#F97316',
        pointRadius: 4,
      },
    ],
  };

  const radarOptions = {
    scales: {
      r: {
        angleLines: { display: true, color: 'rgba(0,0,0,0.05)' },
        grid: { color: 'rgba(0,0,0,0.05)' },
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: { display: false, stepSize: 20 },
        pointLabels: {
          font: { size: 11, weight: 'bold' as const },
          color: '#64748b'
        }
      },
    },
    plugins: {
      legend: { display: false }
    },
    animation: {
      duration: 600,
      easing: 'easeInOutQuad' as const,
    }
  };
  const activeReportLoadingType =
    activeTab === 'child' ? 'CHILD' : activeTab === 'parent' ? 'PARENT' : 'HARMONY';
  const isExistingReportLoadingForActiveTab = existingReportLoadingType === activeReportLoadingType;

  if (isReportContextLoading) {
    const tabLoadingConfig: Record<ReportTab, { title: string; steps: string[] }> = {
      child: { title: t('report.analyzingChild'), steps: childLoadingSteps },
      parent: { title: t('report.analyzingParent'), steps: parentLoadingSteps },
      parenting: { title: t('report.analyzingHarmony'), steps: harmonyLoadingSteps },
    };
    const { title, steps } = tabLoadingConfig[activeTab];
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center font-body">
        <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl items-center justify-center gap-4">
          {isSavedReportContextLoading ? (
            <ExistingReportLoadingProgress className="min-h-screen py-0" />
          ) : (
            <ReportGeneratingState
              title={title}
              steps={steps}
              showImage={false}
            />
          )}
        </div>
      </div>
    );
  }

  if (isExistingReportLoadingForActiveTab) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center font-body">
        <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl items-center justify-center">
          <ExistingReportLoadingProgress className="min-h-screen py-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 h-[100dvh] min-h-[100dvh] overflow-hidden flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-0 flex flex-col shadow-2xl overflow-hidden relative">
        <main className="app-bottom-nav-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
          {/* Header Overlay */}
          <div className="relative z-10">
            {/* 히어로 이미지 */}
            <div className="relative">
              {/* Top Navigation Bar */}
              <div className="absolute top-0 left-0 right-0 pt-12 px-4 z-20 flex items-center justify-between">
                <button
                  onClick={() => router.back()}
                  className="size-10 flex items-center justify-center text-text-main dark:text-white"
                  aria-label="뒤로 가기"
                >
                  <span className="material-symbols-outlined">arrow_back_ios</span>
                </button>
              </div>

              <div key={activeTab} className="animate-in fade-in duration-500">
                {activeTab === 'child' ? (
                  isChildSurveyComplete ? (
                    <Image src={childType.image} alt={childType.label} width={800} height={600} className="w-full aspect-[4/3] object-cover" />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E4] dark:from-surface-dark dark:to-background-dark" />
                  )
                ) : activeTab === 'parent' ? (
                  isParentSurveyComplete ? (
                    <Image src={parentType.image} alt={parentType.label} width={800} height={600} className="w-full aspect-[4/3] object-cover" />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-gradient-to-b from-[#E8F5E9] to-[#C8E6C9] dark:from-surface-dark dark:to-background-dark" />
                  )
                ) : (
                  <div className="w-full aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-[#F5EDE4] to-[#E8DDD3] dark:from-surface-dark dark:to-background-dark flex items-center justify-center">
                    <div className="relative w-full h-full flex items-center justify-center">
                      <div className="w-[57%] h-[90%] rounded-2xl overflow-hidden border-4 border-white shadow-xl rotate-[-3deg] z-10 -mt-8">
                        <Image src={childType.image} alt={childType.label} width={500} height={700} className="w-full h-full object-cover" />
                      </div>
                      <div className="w-[50%] h-[82%] rounded-2xl overflow-hidden border-4 border-white shadow-lg rotate-[5deg] -ml-[9%] -mt-4 z-0">
                        <Image src={parentType.image} alt={parentType.label} width={500} height={700} className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tab Switcher - 아이 리포트 선공 모드에서는 숨김 */}
            {!isChildOnly && (
              <div className="bg-background-light dark:bg-background-dark px-6 pt-6 pb-2 -mt-6 rounded-t-3xl relative z-10">
                <div className="p-1 rounded-2xl flex gap-1 border border-beige-main/20 dark:border-gray-700 shadow-sm bg-background-light dark:bg-surface-dark">
                  <button
                    onClick={() => handleTabChange('child')}
                    className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all ${activeTab === 'child' ? 'bg-primary text-white shadow-md' : 'text-text-sub hover:text-text-main dark:hover:text-white hover:bg-beige-light/50 dark:hover:bg-white/5'}`}
                  >
                    {t('report.childTab')}
                  </button>
                  <button
                    onClick={() => {
                      if (isParentSurveyComplete) handleTabChange('parent');
                      else if (confirm(t('report.parentSurveyNeeded'))) {
                        trackReportCtaClick('continue_parent_survey', 'hero', '/survey?type=PARENT');
                        router.push(buildTrackedPath('/survey?type=PARENT'));
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all ${activeTab === 'parent' ? 'bg-primary text-white shadow-md' : 'text-text-sub hover:text-text-main dark:hover:text-white hover:bg-beige-light/50 dark:hover:bg-white/5'}`}
                  >
                    {t('report.parentTab')}
                  </button>
                  <button
                    onClick={() => {
                      if (isStyleSurveyComplete) handleTabChange('parenting');
                      else if (confirm(t('report.styleSurveyNeeded'))) {
                        trackReportCtaClick('continue_parenting_style', 'hero', '/survey?type=STYLE');
                        router.push(buildTrackedPath('/survey?type=STYLE'));
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all ${activeTab === 'parenting' ? 'bg-primary text-white shadow-md' : 'text-text-sub hover:text-text-main dark:hover:text-white hover:bg-beige-light/50 dark:hover:bg-white/5'}`}
                  >
                    {t('report.harmonyTab')}
                  </button>
                </div>
              </div>
            )}

            {/* 유형 정보 */}
            <div key={`info-${activeTab}`} className={`bg-background-light dark:bg-background-dark text-center px-6 ${!isChildOnly ? 'pt-4' : 'pt-8 -mt-6 rounded-t-3xl'} pb-4 space-y-3 relative z-10 animate-in fade-in duration-500`}>
              {activeTab === 'child' ? (
                isChildSurveyComplete ? (
                  <>
                    <p className="text-text-sub text-sm font-medium">
                      {locale === 'ko' ? `${childPossessiveName} 기질 유형` : `${childName}${t('report.childTemperamentType')}`}
                    </p>
                    <h1 className="text-3xl font-black text-text-main dark:text-white tracking-tight">
                      {childType.label}
                    </h1>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {childType.keywords.map((kw: string) => (
                        <span key={kw} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-bold">#{kw}</span>
                      ))}
                    </div>
                    <p className="text-text-sub text-[13px] break-keep">{childType.desc}</p>
                  </>
                ) : (
                  <>
                    <p className="text-text-sub text-sm font-medium">
                      {locale === 'ko' ? `${childPossessiveName} 기질 유형` : `${childName}${t('report.childTemperamentType')}`}
                    </p>
                    <div className="h-9 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mx-auto" />
                    <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mx-auto" />
                  </>
                )
              ) : activeTab === 'parent' ? (
                isParentSurveyComplete ? (
                  <>
                    <p className="text-text-sub text-sm font-medium">{t('report.parentTemperamentType')}</p>
                    <h1 className="text-3xl font-black text-text-main dark:text-white tracking-tight">
                      {parentType.label}
                    </h1>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {parentType.keywords.map((kw: string) => (
                        <span key={kw} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-bold">#{kw}</span>
                      ))}
                    </div>
                    <p className="text-text-sub text-[13px] break-keep">{parentType.desc}</p>
                  </>
                ) : (
                  <>
                    <p className="text-text-sub text-sm font-medium">{t('report.parentTemperamentType')}</p>
                    <div className="h-9 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mx-auto" />
                    <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mx-auto" />
                  </>
                )
              ) : (
                <>
                  <p className="text-text-sub text-sm font-medium">{t('report.harmonyReport')}</p>
                  {harmonyAiReport ? (
                    <>
                      <h1 className="text-3xl font-black text-text-main dark:text-white tracking-tight">
                        {harmonyAiReport.harmonyTitle}
                      </h1>
                      <p className="text-text-sub text-[13px] break-keep">{harmonyAiReport.oneLiner}</p>
                    </>
                  ) : (
                    <>
                      <div className="h-9 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mx-auto" />
                      <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mx-auto" />
                    </>
                  )}
                </>
              )}
            </div>
            {/* child_only 모드: 헤더와 컨텐츠 사이 간격 */}
            {isChildOnly && <div className="h-8" />}
          </div>

          <div className="max-w-2xl mx-auto px-6 space-y-8 relative z-20">
            {shouldShowHarmonyRefreshNotice && (
              <section className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl px-5 py-4 shadow-card border border-amber-200/70 dark:border-amber-800/50 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <Icon name="sync" size="sm" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] font-black text-amber-900 dark:text-amber-200">
                      {t('report.harmonyRefreshNoticeTitle')}
                    </p>
                    <p className="text-[12px] leading-relaxed text-amber-800/80 dark:text-amber-100/75 break-keep">
                      {t(harmonyRefreshSource === 'child' ? 'report.harmonyRefreshNoticeChildDesc' : 'report.harmonyRefreshNoticeParentDesc')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={isGenerating}
                  onClick={handleHarmonyRefresh}
                  className="h-11 rounded-xl border-none bg-white dark:bg-surface-dark text-amber-900 dark:text-amber-100 shadow-sm"
                >
                  {t('report.refreshHarmonyCta')}
                </Button>
              </section>
            )}

            {activeTab === 'child' ? (
              !isChildSurveyComplete ? (
                /* Child Survey Onboarding */
                <div className="bg-white dark:bg-surface-dark rounded-2xl p-10 shadow-card border border-beige-main/20 flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="w-40 h-40 bg-primary/5 rounded-full flex items-center justify-center text-7xl relative">
                    <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20"></div>
                    🎁
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-2xl font-black text-text-main dark:text-white leading-tight">
                      {locale === 'ko' ? `${childPossessiveName} 기질을 알아볼 시간이에요!` : `${childName}${t('report.testTime')}`}
                    </h2>
                    <p className="text-text-sub dark:text-slate-400 text-[15px] leading-relaxed break-keep px-4">
                      {t('report.testTimeDesc')}<br />
                      <span className="text-[12px] opacity-70 mt-2 block">{t('report.testTimeDuration')}</span>
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    fullWidth
                    className="h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
                    onClick={() => router.push('/survey')}
                  >
                    {t('report.startTemperamentTest')}
                  </Button>
                </div>
              ) : (
                <>
                  {childAiReport ? (
                    <div className="space-y-5 animate-fade-in">
                      {/* 1. 아이나의 한마디 */}
                      {hasChildReportIntro ? (
                        <ReportSectionReveal key="child-intro" order={0}>
                          <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10">
                            <p className="text-[12px] font-black text-primary mb-2.5 flex items-center gap-1.5">
                              <Icon name="chat_bubble" size="sm" /> {t('report.ainaComment')}
                            </p>
                            <p className="text-[15px] text-text-main dark:text-slate-300 leading-[1.85] break-keep">
                              {childAiReport.intro}
                            </p>
                          </section>
                        </ReportSectionReveal>
                      ) : activeChildLoadingKey === 'intro' && activeChildLoadingSection && (
                        <SectionLoadingCard
                          icon={activeChildLoadingSection.icon}
                          label={activeChildLoadingSection.label}
                          message={activeChildLoadingSection.message}
                          progressCurrent={activeChildLoadingProgressCurrent}
                          progressTotal={childReportProgressTotal}
                        />
                      )}

                      {/* 2. 기질 {t('common.points')}수 카드 */}
                      {hasChildReportIntro || !isChildReportStreaming ? (
                        <ReportSectionReveal key="child-scores" order={1}>
                          <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-6 shadow-card border border-beige-main/10 space-y-5">
                            <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                              <Icon name="bar_chart" size="sm" /> {childScoreSectionTitle}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {([
                                { key: 'NS', label: t('report.noveltySeekingName'), color: '#E5A150', desc: t('report.noveltySeekingDesc') },
                                { key: 'HA', label: t('report.harmAvoidanceName'), color: '#6B9E8A', desc: t('report.harmAvoidanceDesc') },
                                { key: 'RD', label: t('report.rewardDependenceName'), color: '#7B8EC4', desc: t('report.rewardDependenceDesc') },
                                { key: 'P', label: t('report.persistenceName'), color: '#D4805E', desc: t('report.persistenceDesc') },
                              ] as const).map(dim => {
                                const score = childScores[dim.key as keyof typeof childScores];
                                return (
                                  <div key={dim.key} className="bg-background-light dark:bg-background-dark rounded-xl p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-bold text-text-sub">{dim.label}</span>
                                      <span className="text-[16px] font-black" style={{ color: dim.color }}>{score}</span>
                                    </div>
                                    <div className="w-full h-2 bg-white dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: dim.color }} />
                                    </div>
                                    <p className="text-[10px] text-text-sub leading-tight">{dim.desc}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        </ReportSectionReveal>
                      ) : activeChildLoadingKey === 'scores' && activeChildLoadingSection && (
                        <SectionLoadingCard
                          icon={activeChildLoadingSection.icon}
                          label={activeChildLoadingSection.label}
                          message={activeChildLoadingSection.message}
                          progressCurrent={activeChildLoadingProgressCurrent}
                          progressTotal={childReportProgressTotal}
                        />
                      )}

                      {/* 3. 기질 요소별 해석 */}
                      {hasChildReportDimensions ? (
                        <ReportSectionReveal key="child-dimensions" order={2}>
                          <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-4">
                            <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                              <Icon name="psychology" size="sm" /> {t('report.dimensionAnalysis')}
                            </p>
                            {([
                              { key: 'NS', label: t('report.noveltySeekingName'), color: '#E5A150', icon: '\uD83D\uDD25' },
                              { key: 'HA', label: t('report.harmAvoidanceName'), color: '#6B9E8A', icon: '\uD83D\uDEE1\uFE0F' },
                              { key: 'RD', label: t('report.rewardDependenceName'), color: '#7B8EC4', icon: '\uD83D\uDC99' },
                              { key: 'P', label: t('report.persistenceName'), color: '#D4805E', icon: '\u231B' },
                            ] as const).map(dim => {
                              const text = childAiReport.analysis?.dimensions?.[dim.key as ReportScoreKey];
                              if (!text) return null;
                              return (
                                <div key={dim.key} className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{dim.icon}</span>
                                    <span className="text-[12px] font-bold" style={{ color: dim.color }}>{dim.label}</span>
                                    <span className="text-[12px] font-black" style={{ color: dim.color }}>{childScores[dim.key as keyof typeof childScores]}{t('common.points')}</span>
                                  </div>
                                  <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.8] break-keep pl-6">
                                    {text}
                                  </p>
                                </div>
                              );
                            })}
                          </section>
                        </ReportSectionReveal>
                      ) : activeChildLoadingKey === 'dimensions' && activeChildLoadingSection && (
                        <SectionLoadingCard
                          icon={activeChildLoadingSection.icon}
                          label={activeChildLoadingSection.label}
                          message={activeChildLoadingSection.message}
                          progressCurrent={activeChildLoadingProgressCurrent}
                          progressTotal={childReportProgressTotal}
                        />
                      )}

                      {/* 4. 아이의 숨겨진 속마음 */}
                      {childReportInsight ? (
                        <ReportSectionReveal key="child-insight" order={3}>
                          <section className="space-y-3">
                            <p className="text-[12px] font-black text-primary flex items-center gap-1.5 px-1">
                              <Icon name="favorite" size="sm" /> {t('report.hiddenFeelings')}
                            </p>
                            {Array.isArray(childReportInsight) ? (
                              childReportInsight.map((item, idx: number) => (
                                <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2">
                                  <p className="text-[11px] font-black text-primary/70">{item.scene}</p>
                                  <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep">
                                    {item.content}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10">
                                <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep whitespace-pre-wrap">
                                  {childReportInsight}
                                </p>
                              </div>
                            )}
                          </section>
                        </ReportSectionReveal>
                      ) : activeChildLoadingKey === 'insight' && activeChildLoadingSection && (
                        <SectionLoadingCard
                          icon={activeChildLoadingSection.icon}
                          label={activeChildLoadingSection.label}
                          message={activeChildLoadingSection.message}
                          progressCurrent={activeChildLoadingProgressCurrent}
                          progressTotal={childReportProgressTotal}
                        />
                      )}

                      {/* 6. 강{t('common.points')} + 성장 가능성 */}
                      {childReportStrengths ? (
                        <ReportSectionReveal key="child-strengths" order={4}>
                          <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2.5">
                            <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                              <Icon name="emoji_events" size="sm" /> {t('report.strengthsGrowth')}
                            </p>
                            <p className="text-[14px] text-text-main dark:text-slate-300 leading-[1.85] break-keep whitespace-pre-wrap">
                              {childReportStrengths}
                            </p>
                          </section>
                        </ReportSectionReveal>
                      ) : activeChildLoadingKey === 'strengths' && activeChildLoadingSection && (
                        <SectionLoadingCard
                          icon={activeChildLoadingSection.icon}
                          label={activeChildLoadingSection.label}
                          message={activeChildLoadingSection.message}
                          progressCurrent={activeChildLoadingProgressCurrent}
                          progressTotal={childReportProgressTotal}
                        />
                      )}

                      {/* 7. 양육 가이드 */}
                      {hasChildReportParentingTips ? (
                        <ReportSectionReveal key="child-parenting-tips" order={5}>
                          <section className="space-y-3">
                            <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                              <Icon name="lightbulb" size="sm" /> {t('report.parentingGuide')}
                            </p>
                            {childReportParentingTips?.map((tip, idx: number) => (
                              <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10">
                                <h6 className="font-bold text-text-main dark:text-white mb-3 text-[14px]">
                                  {tip.situation}
                                </h6>
                                <ul className="space-y-2.5">
                                  {tip.tips?.map((t: string, i: number) => (
                                    <li key={i} className="text-[14px] text-text-sub dark:text-slate-400 flex gap-2">
                                      <span className="text-primary mt-0.5 shrink-0">•</span>
                                      <span className="leading-relaxed break-keep">{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </section>
                        </ReportSectionReveal>
                      ) : activeChildLoadingKey === 'parentingTips' && activeChildLoadingSection && (
                        <SectionLoadingCard
                          icon={activeChildLoadingSection.icon}
                          label={activeChildLoadingSection.label}
                          message={activeChildLoadingSection.message}
                          progressCurrent={activeChildLoadingProgressCurrent}
                          progressTotal={childReportProgressTotal}
                        />
                      )}

                      {/* 7. 마법의 한마디 */}
                      {hasChildReportScripts ? (
                        <ReportSectionReveal key="child-scripts" order={6}>
                          <section className="space-y-3">
                            <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                              <Icon name="record_voice_over" size="sm" /> {t('report.magicWord')}
                            </p>
                            {childReportScripts?.map((s, idx: number) => (
                              <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2">
                                <p className="text-[12px] font-bold text-text-sub">{s.situation}</p>
                                <p className="text-[16px] font-black text-primary leading-snug break-keep">&ldquo;{sanitizeQuotedText(s.script)}&rdquo;</p>
                                <p className="text-[13px] text-text-sub leading-relaxed break-keep">{s.guide}</p>
                              </div>
                            ))}
                          </section>
                        </ReportSectionReveal>
                      ) : activeChildLoadingKey === 'scripts' && activeChildLoadingSection && (
                        <SectionLoadingCard
                          icon={activeChildLoadingSection.icon}
                          label={activeChildLoadingSection.label}
                          message={activeChildLoadingSection.message}
                          progressCurrent={activeChildLoadingProgressCurrent}
                          progressTotal={childReportProgressTotal}
                        />
                      )}

                      {isChildReportFinalizing && (
                        <SectionLoadingCard
                          icon="auto_awesome"
                          label={t('report.finalizingReport')}
                          message={t('report.childSectionLoadingFinal')}
                          progressCurrent={childReportProgressTotal}
                          progressTotal={childReportProgressTotal}
                        />
                      )}

                      {/* 분석 날짜 & 다시 분석하기 */}
                      {reportDates.child && (
                        <div className="flex items-center justify-between pt-4">
                          <p className="text-[11px] text-text-sub/50">
                            {new Date(reportDates.child).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} {t('common.analysis')}
                          </p>
                          <button
                            onClick={() => openRestartDialog('child')}
                            disabled={isGenerating || isStartingFreshSurvey || !isSubscriptionLoaded}
                            className="text-[11px] text-text-sub/50 hover:text-primary font-medium transition-colors disabled:opacity-40"
                          >
                            {t('common.reanalyze')}
                          </button>
                        </div>
                      )}

                      {shouldShowChildOnlyCompletionCta && (
                        <ReportSectionReveal key="child-only-parent-survey-cta" order={7}>
                          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card dark:border-white/10 dark:bg-surface-dark">
                            <div className="bg-gradient-to-r from-primary/10 to-slate-50 px-5 py-3 border-b border-slate-100 dark:from-primary/20 dark:to-white/5 dark:border-white/10">
                              <p className="text-center text-[11px] font-bold text-primary">
                                {t('report.parentChildMatch')}
                              </p>
                            </div>
                            <div className="px-5 py-5 space-y-3 text-center">
                              <p className="text-[12px] leading-relaxed text-slate-500 break-keep dark:text-slate-400">
                                {t('report.parentChildMatchDesc')}
                              </p>
                              <button
                                onClick={() => {
                                  trackReportCtaClick('continue_parent_survey', 'inline_final', '/survey?type=PARENT');
                                  router.push(buildTrackedPath('/survey?type=PARENT'));
                                }}
                                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black text-white shadow-lg shadow-primary/15 transition-all active:scale-[0.98]"
                                style={{ backgroundColor: 'var(--primary)' }}
                              >
                                <span>{t('report.continueParentSurvey')}</span>
                                <Icon name="arrow_forward" size="md" />
                              </button>
                              <button
                                onClick={() => {
                                  trackReportCtaClick('share', 'inline_final', '/share');
                                  router.push(buildTrackedPath(`/share${(childReportId || reportId) ? `?id=${childReportId || reportId}` : ''}`));
                                }}
                                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-slate-500 transition-all hover:text-primary active:scale-[0.98] dark:text-slate-400"
                              >
                                <Icon name="share" size="sm" />
                                <span>{t('report.shareResults')}</span>
                              </button>
                            </div>
                          </section>
                        </ReportSectionReveal>
                      )}
                    </div>
                  ) : (
                    <ReportGeneratingState
                      title={t('report.analyzingChild')}
                      steps={childLoadingSteps}
                      imageSrc={childType.image}
                      imageAlt={childType.label}
                      typeLabel={childType.label}
                      showImage={false}
                    />
                  )}

                  {/* Footer Actions */}
                  {!isChildOnly && childAiReport && reportDates.child && (
                    <div className="flex flex-col gap-4 pt-10 pb-10 text-center">
                      <MedicalDisclaimer title={t('report.medicalDisclaimerTitle')} body={t('report.medicalDisclaimerBody')} />
                      {showPremiumCta && <PremiumContinuationCard />}
                      <Button
                        variant="secondary"
                        onClick={() => {
                          trackReportCtaClick('share', 'footer', '/share');
                          router.push(buildSharePathForTab('child'));
                        }}
                        fullWidth
                        className="h-14 rounded-2xl border-none bg-white shadow-lg"
                      >
                        {t('report.shareResult')}
                      </Button>
                      <Link href="/" className="text-slate-400 text-sm font-bold hover:text-primary transition-colors">
                        {t('common.goBack')}
                      </Link>
                    </div>
                  )}
                </>
              )
            ) : activeTab === 'parent' ? (
              <div className="animate-fade-in space-y-5">
                {parentAiReport ? (
                  <ReportSectionGroup>
                    {hasParentReportIntro ? (
                      <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10">
                        <p className="text-[12px] font-black text-primary mb-2.5 flex items-center gap-1.5">
                          <Icon name="chat_bubble" size="sm" /> {t('report.ainaComment')}
                        </p>
                        <p className="text-[15px] text-text-main dark:text-slate-300 leading-[1.85] break-keep">
                          {parentAiReport.intro}
                        </p>
                      </section>
                    ) : activeParentLoadingKey === 'intro' && activeParentLoadingSection && (
                      <SectionLoadingCard
                        icon={activeParentLoadingSection.icon}
                        label={activeParentLoadingSection.label}
                        message={activeParentLoadingSection.message}
                        progressCurrent={activeParentLoadingProgressCurrent}
                        progressTotal={parentReportProgressTotal}
                      />
                    )}

                    {hasParentReportIntro || !isParentReportStreaming ? (
                      <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-6 shadow-card border border-beige-main/10 space-y-5">
                        <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                          <Icon name="bar_chart" size="sm" /> {t('report.parentTemperamentScores')}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {([
                            { key: 'NS', label: t('report.noveltySeekingName'), color: '#E5A150', desc: t('report.noveltySeekingDesc') },
                            { key: 'HA', label: t('report.harmAvoidanceName'), color: '#6B9E8A', desc: t('report.harmAvoidanceDesc') },
                            { key: 'RD', label: t('report.rewardDependenceName'), color: '#7B8EC4', desc: t('report.rewardDependenceDesc') },
                            { key: 'P', label: t('report.persistenceName'), color: '#D4805E', desc: t('report.persistenceDesc') },
                          ] as const).map(dim => {
                            const score = parentScores[dim.key as keyof typeof parentScores];
                            return (
                              <div key={dim.key} className="bg-background-light dark:bg-background-dark rounded-xl p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-text-sub">{dim.label}</span>
                                  <span className="text-[16px] font-black" style={{ color: dim.color }}>{score}</span>
                                </div>
                                <div className="w-full h-2 bg-white dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: dim.color }} />
                                </div>
                                <p className="text-[10px] text-text-sub leading-tight">{dim.desc}</p>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ) : activeParentLoadingKey === 'scores' && activeParentLoadingSection && (
                      <SectionLoadingCard
                        icon={activeParentLoadingSection.icon}
                        label={activeParentLoadingSection.label}
                        message={activeParentLoadingSection.message}
                        progressCurrent={activeParentLoadingProgressCurrent}
                        progressTotal={parentReportProgressTotal}
                      />
                    )}

                    {hasParentReportDimensions ? (
                      <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-4">
                        <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                          <Icon name="psychology" size="sm" /> {t('report.dimensionAnalysis')}
                        </p>
                        {([
                          { key: 'NS', label: t('report.noveltySeekingName'), color: '#E5A150', icon: '\uD83D\uDD25' },
                          { key: 'HA', label: t('report.harmAvoidanceName'), color: '#6B9E8A', icon: '\uD83D\uDEE1\uFE0F' },
                          { key: 'RD', label: t('report.rewardDependenceName'), color: '#7B8EC4', icon: '\uD83D\uDC99' },
                          { key: 'P', label: t('report.persistenceName'), color: '#D4805E', icon: '\u231B' },
                        ] as const).map(dim => {
                          const text = parentAiReport.dimensions?.[dim.key as ReportScoreKey];
                          if (!text) return null;
                          return (
                            <div key={dim.key} className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{dim.icon}</span>
                                <span className="text-[12px] font-bold" style={{ color: dim.color }}>{dim.label}</span>
                                <span className="text-[12px] font-black" style={{ color: dim.color }}>{parentScores[dim.key as keyof typeof parentScores]}{t('common.points')}</span>
                              </div>
                              <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.8] break-keep pl-6">
                                {text}
                              </p>
                            </div>
                          );
                        })}
                      </section>
                    ) : activeParentLoadingKey === 'dimensions' && activeParentLoadingSection && (
                      <SectionLoadingCard
                        icon={activeParentLoadingSection.icon}
                        label={activeParentLoadingSection.label}
                        message={activeParentLoadingSection.message}
                        progressCurrent={activeParentLoadingProgressCurrent}
                        progressTotal={parentReportProgressTotal}
                      />
                    )}

                    {parentReportShining ? (
                      <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2.5">
                        <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                          <Icon name="auto_awesome" size="sm" /> {t('report.shiningMoment')}
                        </p>
                        <p className="text-[14px] text-text-main dark:text-slate-300 leading-[1.85] break-keep whitespace-pre-wrap">
                          {parentReportShining}
                        </p>
                      </section>
                    ) : activeParentLoadingKey === 'shining' && activeParentLoadingSection && (
                      <SectionLoadingCard
                        icon={activeParentLoadingSection.icon}
                        label={activeParentLoadingSection.label}
                        message={activeParentLoadingSection.message}
                        progressCurrent={activeParentLoadingProgressCurrent}
                        progressTotal={parentReportProgressTotal}
                      />
                    )}

                    {hasParentReportParentingStyle ? (
                      <section className="space-y-3">
                        <p className="text-[12px] font-black text-primary flex items-center gap-1.5 px-1">
                          <Icon name="child_care" size="sm" /> {t('report.parentingTemperament')}
                        </p>
                        {parentAiReport.parentingStyle?.map((item, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2">
                            <p className="text-[11px] font-black text-primary/70">{item.scene}</p>
                            <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep">
                              {item.content}
                            </p>
                          </div>
                        ))}
                      </section>
                    ) : activeParentLoadingKey === 'parentingStyle' && activeParentLoadingSection && (
                      <SectionLoadingCard
                        icon={activeParentLoadingSection.icon}
                        label={activeParentLoadingSection.label}
                        message={activeParentLoadingSection.message}
                        progressCurrent={activeParentLoadingProgressCurrent}
                        progressTotal={parentReportProgressTotal}
                      />
                    )}

                    {parentReportVulnerability ? (
                      <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2.5">
                        <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                          <Icon name="battery_alert" size="sm" /> {t('report.energyWarning')}
                        </p>
                        <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep whitespace-pre-wrap">
                          {parentReportVulnerability}
                        </p>
                      </section>
                    ) : activeParentLoadingKey === 'vulnerability' && activeParentLoadingSection && (
                      <SectionLoadingCard
                        icon={activeParentLoadingSection.icon}
                        label={activeParentLoadingSection.label}
                        message={activeParentLoadingSection.message}
                        progressCurrent={activeParentLoadingProgressCurrent}
                        progressTotal={parentReportProgressTotal}
                      />
                    )}

                    {hasParentReportSolutions ? (
                      <section className="space-y-3">
                        <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                          <Icon name="lightbulb" size="sm" /> {t('report.mindNutrient')}
                        </p>
                        {parentAiReport.solutions?.map((sol, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2">
                            <h6 className="font-bold text-text-main dark:text-white text-[14px]">{sol.name}</h6>
                            <p className="text-[14px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">{sol.action}</p>
                            <p className="text-[11px] text-text-sub/60 leading-relaxed break-keep">💡 {sol.reason}</p>
                          </div>
                        ))}
                      </section>
                    ) : activeParentLoadingKey === 'solutions' && activeParentLoadingSection && (
                      <SectionLoadingCard
                        icon={activeParentLoadingSection.icon}
                        label={activeParentLoadingSection.label}
                        message={activeParentLoadingSection.message}
                        progressCurrent={activeParentLoadingProgressCurrent}
                        progressTotal={parentReportProgressTotal}
                      />
                    )}

                    {hasParentReportLetter ? (
                      <section className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl px-6 py-8 shadow-card border border-beige-main/10 text-center relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 shadow-md px-4 py-1 rounded-full text-xs font-bold text-rose-500">
                          From. {t('report.ainaLetter')}
                        </div>
                        <p className="text-rose-700 dark:text-rose-300 italic leading-loose break-keep font-serif text-[15px] pt-2">
                          &ldquo;{parentAiReport.letter}&rdquo;
                        </p>
                      </section>
                    ) : activeParentLoadingKey === 'letter' && activeParentLoadingSection && (
                      <SectionLoadingCard
                        icon={activeParentLoadingSection.icon}
                        label={activeParentLoadingSection.label}
                        message={activeParentLoadingSection.message}
                        progressCurrent={activeParentLoadingProgressCurrent}
                        progressTotal={parentReportProgressTotal}
                      />
                    )}

                    {isParentReportFinalizing && (
                      <SectionLoadingCard
                        icon="auto_awesome"
                        label={t('report.finalizingReport')}
                        message={t('report.parentSectionLoadingFinal')}
                        progressCurrent={parentReportProgressTotal}
                        progressTotal={parentReportProgressTotal}
                      />
                    )}

                    {reportDates.parent && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-[11px] text-text-sub/50">
                          {new Date(reportDates.parent).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 분석
                        </p>
                        <button
                          onClick={() => openRestartDialog('parent')}
                          disabled={isGenerating || isStartingFreshSurvey || !isSubscriptionLoaded}
                          className="text-[11px] text-text-sub/50 hover:text-primary font-medium transition-colors disabled:opacity-40"
                        >
                          {t('common.reanalyze')}
                        </button>
                      </div>
                    )}
                  </ReportSectionGroup>
                ) : (
                  <ReportGeneratingState
                    title={t('report.analyzingParent')}
                    steps={parentLoadingSteps}
                    showImage={false}
                  />
                )}

                {/* Footer Actions */}
                {parentAiReport && reportDates.parent && (
                  <div className="flex flex-col gap-4 pt-10 pb-10 text-center">
                    <MedicalDisclaimer title={t('report.medicalDisclaimerTitle')} body={t('report.medicalDisclaimerBody')} />
                    {showPremiumCta && <PremiumContinuationCard compact />}
                    <Button
                      variant="secondary"
                      onClick={() => {
                        trackReportCtaClick('share', 'footer', '/share');
                        router.push(buildSharePathForTab('parent'));
                      }}
                      fullWidth
                      className="h-14 rounded-2xl border-none bg-white shadow-lg"
                    >
                      {t('report.shareMyResult')}
                    </Button>
                    <Link href="/" className="text-slate-400 text-sm font-bold hover:text-primary transition-colors">
                      홈으로 돌아가기
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-fade-in space-y-5">
                {/* 1. 레이더 차트 */}
                <section className="bg-white dark:bg-surface-dark rounded-2xl px-4 pt-4 pb-2 shadow-card border border-beige-main/10">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                      <Icon name="analytics" size="sm" /> {t('report.temperamentComparison')}
                    </p>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-[2px] bg-[#3B82F6]" />
                        <span className="text-[10px] font-bold text-text-sub w-[52px] text-right">{t('report.childTemperament')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-[2px] bg-[#F97316]" />
                        <span className="text-[10px] font-bold text-text-sub w-[52px] text-right">{t('report.parentTemperamentShort')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="max-w-[280px] mx-auto">
                    <Radar data={radarData} options={radarOptions} />
                  </div>
                  {isRadarLoading && !isHarmonyReportGenerating && (
                    <p
                      role="status"
                      aria-live="polite"
                      className="pb-3 text-center text-[13px] font-black text-primary break-keep"
                    >
                      {t('report.harmonyAnalyzingShort')}
                    </p>
                  )}
                </section>

                {harmonyAiReport ? (
                  <>
                    {/* 레거시 구조 감지: dynamics 필드가 있으면 업그레이드 유도 */}
                    {harmonyAiReport.dynamics ? (
                      <section className="bg-white dark:bg-surface-dark rounded-2xl p-8 shadow-card border border-beige-main/10 text-center space-y-4">
                        <h4 className="text-2xl font-black text-text-main dark:text-white">{harmonyAiReport.harmonyTitle}</h4>
                        <span className="text-4xl font-black text-primary">{harmonyAiReport.compatibilityScore}%</span>
                        <p className="text-text-sub text-[13px] leading-relaxed break-keep">{harmonyAiReport.dynamics?.description}</p>
                        <Button
                          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setHarmonyAiReport(null); }}
                          variant="secondary"
                          fullWidth
                          className="h-12 rounded-2xl mt-4"
                        >
                          {t('report.upgradeGuide')}
                        </Button>
                      </section>
	                    ) : (
	                      <ReportSectionGroup>
                        {/* 2. 관계 카드 */}
                        <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-6 shadow-card border border-beige-main/10 text-center space-y-3">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Our Harmony</p>
                          <h4 className="text-2xl font-black text-text-main dark:text-white leading-tight">{harmonyAiReport.harmonyTitle}</h4>
                          <span className="inline-block text-4xl font-black text-primary">{harmonyAiReport.compatibilityScore}<span className="text-lg">%</span></span>
                          <p className="text-text-sub text-[14px] break-keep">{harmonyAiReport.oneLiner}</p>
                        </section>

                        {/* 3. 핵심 기질 차이 */}
                        {harmonyAiReport.coreGap && (
                          <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-4">
                            <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                              <Icon name="compare_arrows" size="sm" /> {t('report.coreGap')}
                            </p>
                            <div className="flex items-center justify-between bg-background-light dark:bg-background-dark rounded-xl p-4">
                              <div className="text-center flex-1">
                                <p className="text-[10px] font-bold text-teal-500 mb-1">{t('report.child')}</p>
                                <span className="text-2xl font-black text-text-main dark:text-white">{harmonyAiReport.coreGap.childScore}</span>
                              </div>
                              <div className="text-center px-4">
                                <span className="text-[11px] font-black text-text-sub px-3 py-1 rounded-full bg-white dark:bg-slate-700 shadow-sm">{harmonyAiReport.coreGap.label}</span>
                              </div>
                              <div className="text-center flex-1">
                                <p className="text-[10px] font-bold text-orange-400 mb-1">{t('report.parent')}</p>
                                <span className="text-2xl font-black text-text-main dark:text-white">{harmonyAiReport.coreGap.parentScore}</span>
                              </div>
                            </div>
                            <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep">{harmonyAiReport.coreGap.insight}</p>
                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                              <p className="text-primary text-[13px] font-bold break-keep">{harmonyAiReport.coreGap.reframe}</p>
                            </div>
                          </section>
                        )}

                        {/* 3-2. 가장 잘 맞는 기질 */}
                        {harmonyAiReport.coreMatch && (
                          <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-4">
                            <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                              <Icon name="favorite" size="sm" /> {t('report.coreMatch')}
                            </p>
                            <div className="flex items-center justify-between bg-background-light dark:bg-background-dark rounded-xl p-4">
                              <div className="text-center flex-1">
                                <p className="text-[10px] font-bold text-teal-500 mb-1">{t('report.child')}</p>
                                <span className="text-2xl font-black text-text-main dark:text-white">{harmonyAiReport.coreMatch.childScore}</span>
                              </div>
                              <div className="text-center px-4">
                                <span className="text-[11px] font-black text-text-sub px-3 py-1 rounded-full bg-white dark:bg-slate-700 shadow-sm">{harmonyAiReport.coreMatch.label}</span>
                              </div>
                              <div className="text-center flex-1">
                                <p className="text-[10px] font-bold text-orange-400 mb-1">{t('report.parent')}</p>
                                <span className="text-2xl font-black text-text-main dark:text-white">{harmonyAiReport.coreMatch.parentScore}</span>
                              </div>
                            </div>
                            <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep">{harmonyAiReport.coreMatch.insight}</p>
                            <div className="bg-teal-50 dark:bg-teal-900/10 rounded-xl p-4 border border-teal-100 dark:border-teal-800">
                              <p className="text-teal-700 dark:text-teal-300 text-[13px] font-bold break-keep">{harmonyAiReport.coreMatch.strength}</p>
                            </div>
                          </section>
                        )}

                        {/* 4. 양육 원칙 */}
                        {harmonyAiReport.parentingPrinciples && (
                          <section className="space-y-3">
                            <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                              <Icon name="school" size="sm" /> {t('report.parentingPrinciples')}
                            </p>
                            {harmonyAiReport.parentingPrinciples.map((p, idx: number) => (
                              <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-3">
                                <h4 className="font-bold text-text-main dark:text-white text-[14px]">{idx + 1}. {p.title}</h4>
                                <p className="text-[14px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">{p.why}</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 border border-green-100">
                                    <p className="text-[10px] font-black text-green-600 mb-1">DO</p>
                                    <p className="text-[12px] text-green-800 dark:text-green-300 break-keep">{p.do}</p>
                                  </div>
                                  <div className="bg-rose-50 dark:bg-rose-900/10 rounded-lg p-3 border border-rose-100">
                                    <p className="text-[10px] font-black text-rose-600 mb-1">DON&apos;T</p>
                                    <p className="text-[12px] text-rose-800 dark:text-rose-300 break-keep">{p.dont}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </section>
                        )}

                        {/* 5. 이럴 때 이렇게 */}
                        {harmonyAiReport.situationalTips && (
                          <section className="space-y-3">
                            <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                              <Icon name="lightbulb" size="sm" /> {t('report.situationalTips')}
                            </p>
                            {harmonyAiReport.situationalTips.map((tip, idx: number) => (
                              <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-3">
                                <h4 className="font-bold text-text-main dark:text-white text-[14px]">{tip.situation}</h4>
                                <div className="bg-teal-50 dark:bg-teal-900/10 rounded-lg p-3 border border-teal-100">
                                  <p className="text-[10px] font-black text-teal-600 mb-1">{t('report.childFeeling')}</p>
                                  <p className="text-[12px] text-teal-800 dark:text-teal-300 break-keep">{tip.childFeeling}</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3 border border-amber-100">
                                  <p className="text-[10px] font-black text-amber-600 mb-1">{t('report.parentTrap')}</p>
                                  <p className="text-[12px] text-amber-800 dark:text-amber-300 break-keep">{tip.parentTrap}</p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 border border-green-100">
                                  <p className="text-[10px] font-black text-green-600 mb-1">{t('report.betterResponse')}</p>
                                  <p className="text-[12px] text-green-800 dark:text-green-300 break-keep">{tip.betterResponse}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-[13px] text-text-main dark:text-white font-bold italic break-keep">&ldquo;{sanitizeQuotedText(tip.script)}&rdquo;</p>
                                </div>
                              </div>
                            ))}
                          </section>
                        )}

                        {/* 6. 양육 스타일 점검 */}
                        {harmonyAiReport.parentingAudit && (
                          <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-3">
                            <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                              <Icon name="tune" size="sm" /> {t('report.parentingStyleDiag')}
                            </p>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-black">{harmonyAiReport.parentingAudit.currentStyle}</span>
                            </div>
                            <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep">{harmonyAiReport.parentingAudit.evaluation}</p>
                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                              <p className="text-[11px] font-black text-primary mb-1">{t('report.adjustmentPoint')}</p>
                              <p className="text-[13px] text-text-main dark:text-slate-300 leading-relaxed break-keep">{harmonyAiReport.parentingAudit.adjustment}</p>
                            </div>
                          </section>
                        )}

                        {/* 7. 오늘의 한 마디 */}
                        {harmonyAiReport.dailyReminder && (
                          <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-8 shadow-card border border-beige-main/10 text-center space-y-3">
                            <p className="text-[12px] font-black text-primary flex items-center justify-center gap-1.5">
                              <Icon name="bookmark" size="sm" /> {t('report.dailyReminder')}
                            </p>
                            <p className="text-text-main dark:text-white text-[16px] font-black leading-snug break-keep">
                              &ldquo;{harmonyAiReport.dailyReminder}&rdquo;
                            </p>
                            <p className="text-text-sub text-[11px]">{t('report.putOnFridge')}</p>
                          </section>
                        )}
	                      </ReportSectionGroup>
	                    )}

                    {/* 분석 날짜 & 다시 분석하기 */}
                    {reportDates.parenting && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-[11px] text-text-sub/50">
                          {new Date(reportDates.parenting).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 분석
                        </p>
                        <button
                          onClick={() => openRestartDialog('harmony')}
                          disabled={isGenerating || isStartingFreshSurvey}
                          className="text-[11px] text-text-sub/50 hover:text-primary font-medium transition-colors disabled:opacity-40"
                        >
                          {t('common.reanalyze')}
                        </button>
                      </div>
                    )}
                  </>
	                ) : (
	                  <ReportGeneratingState
	                    title={t('report.analyzingHarmony')}
	                    steps={harmonyLoadingSteps}
	                    showImage={false}
	                  />
	                )}

                {/* Footer Actions */}
                {harmonyAiReport && <div className="flex flex-col gap-4 pt-10 pb-16 text-center px-4">
                  <MedicalDisclaimer title={t('report.medicalDisclaimerTitle')} body={t('report.medicalDisclaimerBody')} />
                  {showPremiumCta && <PremiumContinuationCard />}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      trackReportCtaClick('share', 'footer', '/share');
                      router.push(buildSharePathForTab('parenting'));
                    }}
                    fullWidth
                    className="h-14 rounded-2xl border-none bg-white shadow-lg text-slate-800 font-bold"
                  >
                    결과 공유하기
                  </Button>
                  <Link href="/" className="text-slate-400 text-sm font-bold hover:text-primary transition-colors">
                    홈으로 돌아가기
                  </Link>
                </div>}
              </div>
            )}
          </div>
        </main>
        <BottomNav />
      </div>

      {isRestartDialogOpen && (
        <ConfirmDialog
          title={t(
            restartTarget === 'child'
              ? 'report.restartChildAnalysisDialogTitle'
              : restartTarget === 'parent'
                ? 'report.restartParentAnalysisDialogTitle'
                : 'report.restartHarmonyAnalysisDialogTitle'
          )}
          description={t(
            restartTarget === 'child'
              ? 'report.restartChildAnalysisDialogDescription'
              : restartTarget === 'parent'
                ? 'report.restartParentAnalysisDialogDescription'
                : 'report.restartHarmonyAnalysisDialogDescription'
          )}
          cancelLabel={t('common.cancel')}
          confirmLabel={t(restartTarget === 'harmony' ? 'report.restartHarmonyAnalysisConfirm' : 'report.restartAnalysisConfirm')}
          isConfirming={isStartingFreshSurvey || (restartTarget === 'harmony' && isGenerating)}
          onCancel={() => {
            if (!isStartingFreshSurvey && !(restartTarget === 'harmony' && isGenerating)) setIsRestartDialogOpen(false);
          }}
          onConfirm={handleRestartAnalysisConfirm}
        />
      )}

    </div>
  );
}

function ReportPageFallback() {
  const { t } = useLocale();

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center font-body pb-0">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl items-center justify-center">
        <TabLoadingIndicator ariaLabel={t('common.loading')} />
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportPageFallback />}>
      <ReportContent />
    </Suspense>
  );
}

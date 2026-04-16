'use client';

import React, { useMemo, useState, useEffect, useRef, Suspense, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
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
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { trackEvent } from '@/lib/analytics';
import { db } from '@/lib/db';
import { TemperamentScorer } from '@/lib/TemperamentScorer';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { TCI_TERMINOLOGY } from '@/constants/terminology';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/i18n/LocaleProvider';
import { childNamePossessive, normalizeChildNameParticlesInValue } from '@/lib/koreanUtils';
import {
  asChildAiReport,
  asHarmonyAiReport,
  asParentAiReport,
  getParentSectionContent,
  sanitizeQuotedText,
  type ChildAiReport,
  type HarmonyAiReport,
  type ParentingStyleScores,
  type ParentAiReport,
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

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const isChildOnly = searchParams.get('child_only') === 'true';

  const { user } = useAuth();
  const { t, locale } = useLocale();
  const [activeTab, setActiveTab] = useState<ReportTab>('child');
  const { intake, cbqResponses, atqResponses, parentingResponses, selectedChildId } = useAppStore();

  const [childAiReport, setChildAiReport] = useState<ChildAiReport | null>(null);
  const [parentAiReport, setParentAiReport] = useState<ParentAiReport | null>(null);
  const [harmonyAiReport, setHarmonyAiReport] = useState<HarmonyAiReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportLoadingStep, setReportLoadingStep] = useState(0);
  const generatingRef = useRef<Set<string>>(new Set());
  const [reportDates, setReportDates] = useState<ReportDates>({});
  const [hasSubscription, setHasSubscription] = useState(false);

  // DB에서 로드된 {t('common.points')}수 데이터 (상세 보기용)
  const [savedChildScores, setSavedChildScores] = useState<TemperamentScores | null>(null);
  const [savedParentScores, setSavedParentScores] = useState<TemperamentScores | null>(null);

  useEffect(() => {
    if (tabParam === 'parent') {
      setActiveTab('parent');
    } else if (tabParam === 'child') {
      setActiveTab('child');
    } else if (tabParam === 'parenting') {
      setActiveTab('parenting');
    } else if (!tabParam) {
      setActiveTab('child');
    }
  }, [tabParam, parentingResponses]);

  useEffect(() => {
    if (!user) return;
    db.getActiveSubscription(user.id).catch(() => null).then((subscription) => {
      setHasSubscription(!!subscription);
    });
  }, [user]);

  const reportId = searchParams.get('id');
  const showPremiumCta = !!user && !hasSubscription;
  const childName = intake.childName || t('report.child');
  const childPossessiveName = locale === 'ko' ? childNamePossessive(childName) : childName;

  const normalizeReportTextForName = useCallback(<T,>(report: T, name?: string | null): T => {
    if (locale !== 'ko' || !name) return report;
    return normalizeChildNameParticlesInValue(report, name);
  }, [locale]);

  useEffect(() => {
    if (!isGenerating) {
      setReportLoadingStep(0);
      return;
    }

    const interval = window.setInterval(() => {
      setReportLoadingStep((step) => step + 1);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isGenerating]);

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

  const ReportGeneratingState = ({ title, steps }: { title: string; steps: string[] }) => (
    <div className="py-16 px-6 flex flex-col items-center gap-4 animate-fade-in text-center">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <div className="space-y-2">
        <p className="text-text-sub text-sm font-bold break-keep">{title}</p>
        <p className="min-h-[22px] text-text-main dark:text-white text-[14px] font-black leading-snug break-keep">
          {steps[reportLoadingStep % steps.length]}
        </p>
        <p className="text-text-sub/60 text-[12px] leading-relaxed break-keep">
          {t('report.loadingStillWorking')}
        </p>
      </div>
    </div>
  );

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
          onClick={() => router.push('/pricing')}
          className="w-full h-12 rounded-xl bg-white text-primary text-[14px] font-black active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
        >
          <span>{t('report.premiumCtaButton')}</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </section>
  );

  const loadSavedReport = useCallback(async (id: string) => {
    setIsGenerating(true);
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
          setSavedChildScores((surveyData?.scores as TemperamentScores | null) ?? null);
          setActiveTab('child');
        } else if (data.type === 'PARENT') {
          setParentAiReport(asParentAiReport(data.analysis_json));
          setSavedParentScores((surveyData?.scores as TemperamentScores | null) ?? null);
          setActiveTab('parent');
        } else if (data.type === 'HARMONY') {
          setHarmonyAiReport(normalizeReportTextForName(asHarmonyAiReport(data.analysis_json), childData?.name));
          setActiveTab('parenting');
        }
      }
    } catch (e) {
      console.error('Failed to load report:', e);
      alert(t('report.loadingError'));
    } finally {
      setIsGenerating(false);
    }
  }, [normalizeReportTextForName, t]);

  // URL ID가 있을 경우 DB에서 리포트 로드
  useEffect(() => {
    if (reportId && user) {
      void loadSavedReport(reportId);
    }
  }, [loadSavedReport, reportId, user]);

  // 선택된 아이가 바뀌면 리포트 초기화 (다자녀 전환 시)
  const prevChildIdRef = useRef(selectedChildId);
  useEffect(() => {
    if (prevChildIdRef.current !== selectedChildId) {
      prevChildIdRef.current = selectedChildId;
      setChildAiReport(null);
      setParentAiReport(null);
      setHarmonyAiReport(null);
    }
  }, [selectedChildId]);

  const handleTabChange = (tab: 'child' | 'parent' | 'parenting') => {
    setActiveTab(tab);
  };

  useEffect(() => {
    trackEvent('report_viewed', {
      tab: activeTab,
      child_only: isChildOnly,
      has_saved_report: !!reportId,
    });
  }, [activeTab, isChildOnly, reportId]);


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
  const [childReportId, setChildReportId] = useState<string | null>(null);

  const fetchReport = useCallback(async (payload: ReportApiPayload): Promise<ReportApiResult | null> => {
    const res = await fetch('/api/llm/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, intake, childId: selectedChildId })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error(`[fetchReport] ${payload.type} failed:`, res.status, errBody);
      throw new Error('Report generation failed');
    }
    const data = await res.json();
    console.log(`[fetchReport] ${payload.type}: cached=${data.cached}, createdAt=${data.createdAt}`);
    if (!data.report) throw new Error('Empty report response');

    // 캐시된 리포트의 포맷이 현재 UI와 맞지 않으면 재생성
    if (data.cached && !isValidReport(data.report, payload.type)) {
      console.warn(`Cached ${payload.type} report format mismatch, regenerating...`);
      return fetchReport({ ...payload, refresh: true });
    }

    return { report: data.report, reportId: data.reportId, createdAt: data.createdAt };
  }, [intake, isValidReport, selectedChildId]);

  const childScores = useMemo(() => {
    if (savedChildScores) return savedChildScores;
    return TemperamentScorer.calculate(CHILD_QUESTIONS, cbqResponses);
  }, [cbqResponses, savedChildScores]);

  const parentScores = useMemo(() => {
    if (savedParentScores) return savedParentScores;
    return TemperamentScorer.calculate(PARENT_QUESTIONS, atqResponses);
  }, [atqResponses, savedParentScores]);

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

  const isStyleSurveyComplete = useMemo(() => {
    return PARENTING_STYLE_QUESTIONS.every(q => !!parentingResponses[q.id.toString()]);
  }, [parentingResponses]);

  const parentType = useMemo(() => TemperamentClassifier.analyzeParent(parentScores), [parentScores]);
  const isParentSurveyComplete = useMemo(() => Object.keys(atqResponses).length >= PARENT_QUESTIONS.length, [atqResponses]);

  const isChildSurveyComplete = useMemo(() => {
    return Object.keys(cbqResponses).length > 0 || !!savedChildScores;
  }, [cbqResponses, savedChildScores]);

  const generateChildAIReport = useCallback(async (refresh = false) => {
    if (generatingRef.current.has('CHILD')) return;
    generatingRef.current.add('CHILD');
    setIsGenerating(true);
    try {
      const answers = Object.entries(cbqResponses).map(([id, score]) => ({ questionId: id, score: score as number }));
      const result = await fetchReport({
        userName: intake.childName || '아이',
        scores: childScores, type: 'CHILD', answers,
        refresh,
        childType: { label: childType.label, keywords: childType.keywords, desc: childType.desc }
      });
      if (result) {
        setChildAiReport(normalizeReportTextForName(asChildAiReport(result.report), intake.childName));
        if (result.reportId) setChildReportId(result.reportId);
        setReportDates(prev => ({ ...prev, child: result.createdAt }));
      }
    } catch (error) {
      console.error(error);
      alert(t('report.generationError'));
    } finally {
      generatingRef.current.delete('CHILD');
      setIsGenerating(generatingRef.current.size > 0);
    }
  }, [cbqResponses, childScores, childType.desc, childType.keywords, childType.label, fetchReport, intake.childName, normalizeReportTextForName, t]);

  const generateParentAIReport = useCallback(async (refresh = false) => {
    if (generatingRef.current.has('PARENT')) return;
    generatingRef.current.add('PARENT');
    setIsGenerating(true);
    try {
      const answers = Object.entries(atqResponses).map(([id, score]) => ({ questionId: id, score: score as number }));
      const result = await fetchReport({
        userName: '양육자',
        scores: parentScores, type: 'PARENT', answers,
        refresh,
        parentType: { label: parentType.label, keywords: parentType.keywords }
      });
      if (result) {
        setParentAiReport(asParentAiReport(result.report));
        setReportDates(prev => ({ ...prev, parent: result.createdAt }));
      }
    } catch (error) {
      console.error(error);
      alert(t('report.generationError'));
    } finally {
      generatingRef.current.delete('PARENT');
      setIsGenerating(generatingRef.current.size > 0);
    }
  }, [atqResponses, fetchReport, parentScores, parentType.keywords, parentType.label, t]);

  const generateHarmonyAIReport = useCallback(async (refresh = false) => {
    if (generatingRef.current.has('HARMONY')) return;
    generatingRef.current.add('HARMONY');
    setIsGenerating(true);
    try {
      const answers = [
        ...Object.entries(cbqResponses),
        ...Object.entries(atqResponses),
        ...Object.entries(parentingResponses)
      ].map(([id, score]) => ({ questionId: id, score: score as number }));
      const result = await fetchReport({
        userName: intake.childName || '아이',
        scores: childScores, parentScores, type: 'HARMONY', answers,
        isPreview: false, refresh, styleScores,
        childType: { label: childType.label, keywords: childType.keywords },
        parentType: { label: parentType.label, keywords: parentType.keywords }
      });
      if (result) {
        setHarmonyAiReport(normalizeReportTextForName(asHarmonyAiReport(result.report), intake.childName));
        setReportDates(prev => ({ ...prev, parenting: result.createdAt }));
      }
    } catch (error) {
      console.error(error);
      alert(t('report.harmonyError'));
    } finally {
      generatingRef.current.delete('HARMONY');
      setIsGenerating(generatingRef.current.size > 0);
    }
  }, [atqResponses, cbqResponses, childScores, childType.keywords, childType.label, fetchReport, intake.childName, normalizeReportTextForName, parentScores, parentType.keywords, parentType.label, parentingResponses, styleScores, t]);

  // 아이 진단 탭: 리포트 없으면 자동 생성 (서버가 캐시/생성 분기)
  useEffect(() => {
    const hasCbq = Object.keys(cbqResponses).length > 0 || !!savedChildScores;
    if (!isGenerating && !reportId && hasCbq && !childAiReport) {
      void generateChildAIReport();
    }
  }, [cbqResponses, childAiReport, generateChildAIReport, isGenerating, reportId, savedChildScores]);

  // 양육자 탭 진입 시 자동 생성
  useEffect(() => {
    const hasAtq = Object.keys(atqResponses).length > 0 || !!savedParentScores;
    if (activeTab === 'parent' && !isGenerating && !reportId && hasAtq && !parentAiReport) {
      void generateParentAIReport();
    }
  }, [activeTab, atqResponses, generateParentAIReport, isGenerating, parentAiReport, reportId, savedParentScores]);

  // 기질맞춤양육 탭 진입 시 자동 생성
  useEffect(() => {
    const styleComplete = PARENTING_STYLE_QUESTIONS.every(q => !!parentingResponses[q.id.toString()]);
    if (activeTab === 'parenting' && !isGenerating && !reportId && !harmonyAiReport && styleComplete) {
      void generateHarmonyAIReport();
    }
  }, [activeTab, generateHarmonyAIReport, harmonyAiReport, isGenerating, parentingResponses, reportId]);

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

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
        <main className={`flex-1 overflow-y-auto no-scrollbar ${isChildOnly ? 'pb-40' : 'pb-24'}`}>
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
                        router.push('/survey?type=PARENT');
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
                        router.push('/survey?type=STYLE');
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
                      <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10">
                        <p className="text-[12px] font-black text-primary mb-2.5 flex items-center gap-1.5">
                          <Icon name="chat_bubble" size="sm" /> {t('report.ainaComment')}
                        </p>
                        <p className="text-[15px] text-text-main dark:text-slate-300 leading-[1.85] break-keep">
                          {childAiReport.intro}
                        </p>
                      </section>

                      {/* 2. 기질 {t('common.points')}수 카드 */}
                      <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-6 shadow-card border border-beige-main/10 space-y-5">
                        <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                          <Icon name="bar_chart" size="sm" /> {locale === 'ko' ? `${childPossessiveName} 기질 점수` : `${childName}${t('report.temperamentScores')}`}
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

                      {/* 3. 기질 요소별 해석 */}
                      {childAiReport.analysis?.dimensions && Object.values(childAiReport.analysis.dimensions).some(Boolean) && (
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
                      )}

                      {/* 4. 아이의 숨겨진 속마음 */}
                      {childAiReport.analysis?.insight && (
                        <section className="space-y-3">
                          <p className="text-[12px] font-black text-primary flex items-center gap-1.5 px-1">
                            <Icon name="favorite" size="sm" /> {t('report.hiddenFeelings')}
                          </p>
                          {Array.isArray(childAiReport.analysis.insight) ? (
                            childAiReport.analysis.insight.map((item, idx: number) => (
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
                                {childAiReport.analysis.insight}
                              </p>
                            </div>
                          )}
                        </section>
                      )}

                      {/* 6. 강{t('common.points')} + 성장 가능성 */}
                      {childAiReport.analysis?.strengths && (
                        <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2.5">
                          <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                            <Icon name="emoji_events" size="sm" /> {t('report.strengthsGrowth')}
                          </p>
                          <p className="text-[14px] text-text-main dark:text-slate-300 leading-[1.85] break-keep whitespace-pre-wrap">
                            {childAiReport.analysis.strengths}
                          </p>
                        </section>
                      )}

                      {/* 7. 양육 가이드 */}
                      {childAiReport.parentingTips && childAiReport.parentingTips.length > 0 && (
                        <section className="space-y-3">
                          <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                            <Icon name="lightbulb" size="sm" /> {t('report.parentingGuide')}
                          </p>
                          {childAiReport.parentingTips.map((tip, idx: number) => (
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
                      )}

                      {/* 7. 마법의 한마디 */}
                      {childAiReport.scripts && childAiReport.scripts.length > 0 && (
                        <section className="space-y-3">
                          <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                            <Icon name="record_voice_over" size="sm" /> {t('report.magicWord')}
                          </p>
                          {childAiReport.scripts.map((s, idx: number) => (
                            <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2">
                              <p className="text-[12px] font-bold text-text-sub">{s.situation}</p>
                              <p className="text-[16px] font-black text-primary leading-snug break-keep">&ldquo;{sanitizeQuotedText(s.script)}&rdquo;</p>
                              <p className="text-[13px] text-text-sub leading-relaxed break-keep">{s.guide}</p>
                            </div>
                          ))}
                        </section>
                      )}

                      {/* 분석 날짜 & 다시 분석하기 */}
                      {reportDates.child && (
                        <div className="flex items-center justify-between pt-4">
                          <p className="text-[11px] text-text-sub/50">
                            {new Date(reportDates.child).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} {t('common.analysis')}
                          </p>
                          <button
                            onClick={() => { setChildAiReport(null); void generateChildAIReport(true); }}
                            disabled={isGenerating}
                            className="text-[11px] text-text-sub/50 hover:text-primary font-medium transition-colors disabled:opacity-40"
                          >
                            {t('common.reanalyze')}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <ReportGeneratingState title={t('report.analyzingChild')} steps={childLoadingSteps} />
                  )}

                  {/* Footer Actions */}
                  {!isChildOnly && childAiReport && (
                    <div className="flex flex-col gap-4 pt-10 pb-10 text-center">
                      <MedicalDisclaimer title={t('report.medicalDisclaimerTitle')} body={t('report.medicalDisclaimerBody')} />
                      {showPremiumCta && <PremiumContinuationCard />}
                      <Button variant="secondary" onClick={() => router.push(`/share${(reportId || childReportId) ? `?id=${reportId || childReportId}` : ''}`)} fullWidth className="h-14 rounded-2xl border-none bg-white shadow-lg">
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
                  <>
                    {/* 1. 아이나의 한마디 */}
                    <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10">
                      <p className="text-[12px] font-black text-primary mb-2.5 flex items-center gap-1.5">
                        <Icon name="chat_bubble" size="sm" /> {t('report.ainaComment')}
                      </p>
                      <p className="text-[15px] text-text-main dark:text-slate-300 leading-[1.85] break-keep">
                        {parentAiReport.intro}
                      </p>
                    </section>

                    {/* 2. 기질 {t('common.points')}수 카드 */}
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

                    {/* 3. 기질 요소별 해석 */}
                    {parentAiReport.dimensions && (
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
                    )}

                    {/* 4. 내가 가장 빛나는 순간 */}
                    {(parentAiReport.shining || getParentSectionContent(parentAiReport, 'shining')) && (
                      <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2.5">
                        <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                          <Icon name="auto_awesome" size="sm" /> {t('report.shiningMoment')}
                        </p>
                        <p className="text-[14px] text-text-main dark:text-slate-300 leading-[1.85] break-keep whitespace-pre-wrap">
                          {parentAiReport.shining || getParentSectionContent(parentAiReport, 'shining')}
                        </p>
                      </section>
                    )}

                    {/* 5. 나의 양육 기질 */}
                    {parentAiReport.parentingStyle && parentAiReport.parentingStyle.length > 0 && (
                      <section className="space-y-3">
                        <p className="text-[12px] font-black text-primary flex items-center gap-1.5 px-1">
                          <Icon name="child_care" size="sm" /> {t('report.parentingTemperament')}
                        </p>
                        {parentAiReport.parentingStyle.map((item, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2">
                            <p className="text-[11px] font-black text-primary/70">{item.scene}</p>
                            <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep">
                              {item.content}
                            </p>
                          </div>
                        ))}
                      </section>
                    )}

                    {/* 6. 에너지 고갈 신호 */}
                    {(parentAiReport.vulnerability || getParentSectionContent(parentAiReport, 'vulnerability')) && (
                      <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2.5">
                        <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                          <Icon name="battery_alert" size="sm" /> {t('report.energyWarning')}
                        </p>
                        <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep whitespace-pre-wrap">
                          {parentAiReport.vulnerability || getParentSectionContent(parentAiReport, 'vulnerability')}
                        </p>
                      </section>
                    )}

                    {/* 6. 나를 위한 마음 영양제 */}
                    {parentAiReport.solutions && parentAiReport.solutions.length > 0 && (
                      <section className="space-y-3">
                        <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                          <Icon name="lightbulb" size="sm" /> {t('report.mindNutrient')}
                        </p>
                        {parentAiReport.solutions.map((sol, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2">
                            <h6 className="font-bold text-text-main dark:text-white text-[14px]">{sol.name}</h6>
                            <p className="text-[14px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">{sol.action}</p>
                            <p className="text-[11px] text-text-sub/60 leading-relaxed break-keep">💡 {sol.reason}</p>
                          </div>
                        ))}
                      </section>
                    )}

                    {/* 7. 아이나의 편지 */}
                    {parentAiReport.letter && (
                      <section className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl px-6 py-8 shadow-card border border-beige-main/10 text-center relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 shadow-md px-4 py-1 rounded-full text-xs font-bold text-rose-500">
                          From. {t('report.ainaLetter')}
                        </div>
                        <p className="text-rose-700 dark:text-rose-300 italic leading-loose break-keep font-serif text-[15px] pt-2">
                          &ldquo;{parentAiReport.letter}&rdquo;
                        </p>
                      </section>
                    )}

                    {/* 분석 날짜 & 다시 분석하기 */}
                    {reportDates.parent && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-[11px] text-text-sub/50">
                          {new Date(reportDates.parent).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 분석
                        </p>
                        <button
                          onClick={() => { setParentAiReport(null); void generateParentAIReport(true); }}
                          disabled={isGenerating}
                          className="text-[11px] text-text-sub/50 hover:text-primary font-medium transition-colors disabled:opacity-40"
                        >
                          다시 분석하기
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <ReportGeneratingState title={t('report.analyzingParent')} steps={parentLoadingSteps} />
                )}

                {/* Footer Actions */}
                {parentAiReport && (
                  <div className="flex flex-col gap-4 pt-10 pb-10 text-center">
                    <MedicalDisclaimer title={t('report.medicalDisclaimerTitle')} body={t('report.medicalDisclaimerBody')} />
                    {showPremiumCta && <PremiumContinuationCard compact />}
                    <Button variant="secondary" onClick={() => router.push(`/share${(reportId || childReportId) ? `?id=${reportId || childReportId}` : ''}`)} fullWidth className="h-14 rounded-2xl border-none bg-white shadow-lg">
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
                      <>
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

                        {/* 6. 양육 스타일 진단 */}
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
                      </>
                    )}

                    {/* 분석 날짜 & 다시 분석하기 */}
                    {reportDates.parenting && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-[11px] text-text-sub/50">
                          {new Date(reportDates.parenting).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 분석
                        </p>
                        <button
                          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setHarmonyAiReport(null); void generateHarmonyAIReport(true); }}
                          disabled={isGenerating}
                          className="text-[11px] text-text-sub/50 hover:text-primary font-medium transition-colors disabled:opacity-40"
                        >
                          다시 분석하기
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <ReportGeneratingState title={t('report.analyzingHarmony')} steps={harmonyLoadingSteps} />
                )}

                {/* Footer Actions */}
                {harmonyAiReport && <div className="flex flex-col gap-4 pt-10 pb-16 text-center px-4">
                  <MedicalDisclaimer title={t('report.medicalDisclaimerTitle')} body={t('report.medicalDisclaimerBody')} />
                  {showPremiumCta && <PremiumContinuationCard />}
                  <Button variant="secondary" onClick={() => router.push(`/share${(reportId || childReportId) ? `?id=${reportId || childReportId}` : ''}`)} fullWidth className="h-14 rounded-2xl border-none bg-white shadow-lg text-slate-800 font-bold">
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

      {isChildOnly && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-md mx-auto">
            {isParentSurveyComplete ? (
              <div className="m-3 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 flex gap-3">
                  <button
                    onClick={() => router.push(`/share${(reportId || childReportId) ? `?id=${reportId || childReportId}` : ''}`)}
                    className="flex-1 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all border-2 border-primary text-primary"
                  >
                    <span className="material-symbols-outlined text-[20px]">share</span>
                    <span>{t('report.shareResults')}</span>
                  </button>
                  <button
                    onClick={() => router.replace('/report')}
                    className="flex-1 py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    <span>{t('report.viewFullReport')}</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="m-3 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-slate-50 px-5 py-3 border-b border-slate-100">
                  <p className="text-[11px] font-bold text-primary text-center">
                    {t('report.parentChildMatch')}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[12px] text-slate-500 text-center mb-3 leading-relaxed">
                    {t('report.parentChildMatchDesc')}
                  </p>
                  <button
                    onClick={() => router.push('/survey?type=PARENT')}
                    className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    <span>{t('report.continueParentSurvey')}</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center font-body pb-0">
        <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}

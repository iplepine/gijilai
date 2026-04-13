'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import BottomNav from '@/components/layout/BottomNav';
import LandingPage from '@/components/landing/LandingPage';
import { db, UserProfile, ChildProfile, ReportData, SurveyData, PracticeItemData, PracticeLogData, SubscriptionData } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { TemperamentScorer } from '@/lib/TemperamentScorer';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { CHILD_QUESTIONS, PARENT_QUESTIONS } from '@/data/questions';
import { TCI_TERMINOLOGY } from '@/constants/terminology';
import { useLocale } from '@/i18n/LocaleProvider';

export default function HomePage() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, loading: authLoading } = useAuth();
  const { intake, cbqResponses, atqResponses, resetSurveyOnly, selectedChildId, setSelectedChildId } = useAppStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [surveys, setSurveys] = useState<SurveyData[]>([]);

  const [uploading, setUploading] = useState(false);
  const [showSurveyIntro, setShowSurveyIntro] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [practices, setPractices] = useState<{ uncheckedCount: number; uncheckedItems: PracticeItemData[] }>({ uncheckedCount: 0, uncheckedItems: [] });
  const [showConsultCTA, setShowConsultCTA] = useState(false);
  const [allMagicWords, setAllMagicWords] = useState<{ word: string; date: string; childId?: string; childName?: string }[]>([]);
  const [magicWordIndex, setMagicWordIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  const [showChildDropdown, setShowChildDropdown] = useState(false);

  // Derived Child Profile (DB first, then local intake store)
  const mainChild = useMemo(() => {
    if (children.length > 0) {
      if (selectedChildId) {
        const found = children.find(c => c.id === selectedChildId);
        if (found) return found;
      }
      return children[0];
    }
    if (intake.childName) {
      return {
        id: 'temporary-intake-id',
        name: intake.childName,
        birth_date: intake.birthDate,
        gender: (intake.gender || 'MALE').toUpperCase(),
        image_url: null,
      } as ChildProfile;
    }
    return null;
  }, [children, selectedChildId, intake]);

  // Derived per-child surveys
  const latestSurvey = useMemo(() => {
    if (!mainChild) return null;
    return surveys.find(s => s.type === 'CHILD' && s.child_id === mainChild.id) || null;
  }, [surveys, mainChild]);

  const parentSurvey = useMemo(() => {
    return surveys.find(s => s.type === 'PARENT') || null;
  }, [surveys]);

  // Handle Child Selection
  const handleChildSelect = (index: number) => {
    const child = children[index];
    if (child) setSelectedChildId(child.id);
  };

  // 선택된 아이의 마법의 한마디
  const magicWords = useMemo(() => {
    if (!mainChild) return allMagicWords;
    return allMagicWords.filter(w => w.childId === mainChild.id);
  }, [allMagicWords, mainChild]);

  // 홈 진입 시 최근 한마디 목록에서 하나를 순환 노출
  useEffect(() => {
    if (magicWords.length === 0) {
      setMagicWordIndex(0);
      return;
    }

    const storageKey = `home-magic-word-index:${mainChild?.id || 'all'}`;
    let nextIndex = 0;

    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(storageKey);
      const previousIndex = raw ? Number(raw) : -1;
      nextIndex = Number.isFinite(previousIndex) ? (previousIndex + 1) % magicWords.length : 0;
      window.localStorage.setItem(storageKey, String(nextIndex));
    }

    setMagicWordIndex(nextIndex);
  }, [magicWords.length, mainChild?.id]);

  const childName = mainChild?.name || t('home.defaultChildName');

  // Derived Temperament (Parent = Soil, Child = Seed + Plant)
  // 양육자 기질은 아이와 무관하게 하나
  const parentTemperament = useMemo(() => {
    let parentScores = { NS: 50, HA: 50, RD: 50, P: 50 };
    const parentReport = reports.find(r => r.type === 'PARENT');
    const parentReportScores = (parentReport?.analysis_json as any)?.scores;

    if (Object.keys(atqResponses).length > 0) {
      parentScores = TemperamentScorer.calculate(PARENT_QUESTIONS, atqResponses as any);
    } else if (parentSurvey?.answers) {
      parentScores = TemperamentScorer.calculate(PARENT_QUESTIONS, parentSurvey.answers as any);
    } else if (parentReportScores && 'NS' in parentReportScores) {
      parentScores = parentReportScores;
    }

    const parentType = TemperamentClassifier.analyzeParent(parentScores);
    const hasRealParentData = Object.keys(atqResponses).length > 0 || !!parentSurvey?.answers || !!parentReportScores;

    return { ...parentType, hasData: hasRealParentData };
  }, [atqResponses, parentSurvey, reports]);

  const temperamentInfo = useMemo(() => {
    // 해당 아이의 리포트나 설문 데이터 찾기
    const childSurvey = reports.find(r => r.child_id === mainChild?.id && r.type === 'CHILD');

    // Check DB report/survey first, then fall back to local store for temporary intake
    const childAnswers = (childSurvey?.analysis_json as any)?.scores
      || (latestSurvey?.answers as Record<string, number>)
      || (mainChild?.id === 'temporary-intake-id' && Object.keys(cbqResponses).length > 0 ? cbqResponses : null);

    if (!childAnswers) return null;

    const scores = typeof childAnswers === 'object' && 'NS' in childAnswers
      ? childAnswers
      : TemperamentScorer.calculate(CHILD_QUESTIONS, childAnswers as any);

    const childResult = TemperamentClassifier.analyzeChild(scores as any);

    return { child: childResult };
  }, [mainChild, children, selectedChildId, cbqResponses, latestSurvey, reports]);

  useEffect(() => {
    async function fetchData() {
      if (authLoading) return;

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const [data, activePractices, todayLogs, sub] = await Promise.all([
          db.getDashboardData(user.id),
          db.getActivePracticeItems(user.id).catch(() => [] as PracticeItemData[]),
          db.getTodayPracticeLogs(user.id).catch(() => [] as PracticeLogData[]),
          db.getActiveSubscription(user.id).catch(() => null),
        ]);
        setSubscription(sub);
        setProfile(data.profile);
        setChildren(data.children);
        setReports(data.reports);
        setSurveys(data.surveys);

        // 오늘 미체크 실천 항목 필터링
        const checkedPracticeIds = new Set((todayLogs as PracticeLogData[]).map(l => l.practice_id));
        const uncheckedItems = (activePractices as PracticeItemData[]).filter(p => !checkedPracticeIds.has(p.id));
        setPractices({ uncheckedCount: uncheckedItems.length, uncheckedItems });

        // 상담 이력 없거나 진행 중인 실천이 없으면 상담 유도 표시
        const hasActivePractices = (activePractices as PracticeItemData[]).length > 0;
        if (!hasActivePractices) {
          const { count } = await supabase
            .from('consultation_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);
          setShowConsultCTA(!count || count === 0);
        } else {
          setShowConsultCTA(false);
        }

        // 실천 중인 상담의 마법의 한마디만 표시
        const activeConsultationIds = [...new Set((activePractices as any[]).map(p => p.consultation_id).filter(Boolean))];
        if (activeConsultationIds.length > 0) {
          const { data: activeConsults } = await supabase
            .from('consultations')
            .select('ai_prescription, created_at, child_id')
            .in('id', activeConsultationIds)
            .eq('status', 'COMPLETED');
          const words = (activeConsults || [])
            .filter((c: any) => c.ai_prescription?.magicWord)
            .map((c: any) => ({
              word: c.ai_prescription.magicWord,
              date: c.created_at,
              childId: c.child_id,
              childName: data.children.find((ch: ChildProfile) => ch.id === c.child_id)?.name,
            }));
          setAllMagicWords(words);
        } else {
          setAllMagicWords([]);
        }

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, authLoading]);

  useEffect(() => {
    // Only show onboarding if no child is registered in DB AND no intake info in local store
    if (!loading && user && children.length === 0 && !intake.childName) {
      setShowOnboarding(true);
    }
  }, [loading, user, children, intake.childName]);

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

      // Update local state immediately
      setChildren(prev => prev.map(child =>
        child.id === mainChild.id ? { ...child, image_url: imageUrl } : child
      ));
    } catch (error) {
      console.error('Failed to update profile image:', error);
      alert(t('home.imageUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  // Not logged in state (only after auth check completes)
  if (!authLoading && !user) {
    return <LandingPage />;
  }

  // 데이터 로딩 중 스켈레톤 표시 (뒤로가기 시 번쩍임 방지)
  if (loading || authLoading) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center font-body">
        <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl relative">
          <header className="sticky top-0 z-40 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl pt-12 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between min-h-[40px] px-4">
              <div className="flex items-center gap-3">
                <img src="/gijilai_icon.png" alt={t('common.appName')} className="w-7 h-7 rounded-lg object-contain" />
                <span className="text-xl font-logo tracking-wide text-primary dark:text-white pt-0.5">{t('common.appName')}</span>
              </div>
              <div className="w-14 h-6 bg-gray-100 dark:bg-surface-dark rounded-full animate-pulse" />
            </div>
          </header>
          <main className="flex-1 flex flex-col items-center pt-12 px-6">
            <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-surface-dark animate-pulse" />
            <div className="w-24 h-4 bg-gray-100 dark:bg-surface-dark rounded-full mt-8 animate-pulse" />
            <div className="w-40 h-3 bg-gray-50 dark:bg-surface-dark/50 rounded-full mt-3 animate-pulse" />
          </main>
        </div>
      </div>
    );
  }

  // Calculate age string
  const ageString = mainChild?.birth_date ? (() => {
    const birth = new Date(mainChild.birth_date);
    const today = new Date();
    const totalMonths = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    if (totalMonths <= 36) return t('home.ageMonths', { months: totalMonths });
    const years = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;
    if (remainingMonths === 0) return t('home.ageYears', { years });
    return t('home.ageYearsMonths', { years, months: remainingMonths });
  })() : t('home.noBirthInfo');

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center justify-center font-body pb-0">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-hidden relative">
        <header className="sticky top-0 z-40 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl pt-12 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between min-h-[40px] px-4">
            <div className="flex items-center gap-3">
              <img src="/gijilai_icon.png" alt={t('common.appName')} className="w-7 h-7 rounded-lg object-contain" />
              <span className="text-xl font-logo tracking-wide text-primary dark:text-white pt-0.5">{t('common.appName')}</span>
            </div>
            {(() => {
              if (subscription) {
                const isCancelled = !!subscription.cancelled_at;
                return (
                  <button
                    onClick={() => router.push('/settings/subscription')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary/20 text-primary text-xs font-semibold"
                  >
                    <span className="material-symbols-outlined text-sm">workspace_premium</span>
                    <span>{t('home.subscribing')}</span>
                    {isCancelled && (
                      <span className="text-[10px] text-text-muted dark:text-gray-400">
                        ~{new Date(subscription.current_period_end).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                      </span>
                    )}
                  </button>
                );
              }
              const trial = user?.created_at ? db.getTrialStatus(user.created_at) : null;
              if (trial?.isActive) {
                return (
                  <button
                    onClick={() => router.push('/pricing')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 dark:bg-secondary/20 text-secondary"
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    <span>{t('home.trialDays', { days: trial.daysRemaining })}</span>
                  </button>
                );
              }
              return (
                <button
                  onClick={() => router.push('/pricing')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 dark:bg-primary/20 text-primary"
                >
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  <span>{t('home.startPremium')}</span>
                </button>
              );
            })()}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar pb-32">
          {mainChild ? (
            /* [기존 사용자] 아이가 등록된 상태 */
            <div className="animate-in fade-in duration-700">
              {/* 상단 프로필 섹션 */}
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
                        <img alt={childName} className="w-full h-full object-cover" src={mainChild.image_url} />
                      ) : temperamentInfo?.child?.image ? (
                        <img alt={childName} className="w-full h-full object-cover" src={temperamentInfo.child.image} />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                          <span className="material-icons-round text-5xl">face</span>
                          <span className="text-[10px] font-bold mt-1">{t('home.registerPhoto')}</span>
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
                      onClick={() => router.push(temperamentInfo ? '/report?tab=child' : '/survey/intro')}
                      className="bg-white dark:bg-surface-dark text-primary dark:text-white px-3 py-1 rounded-full text-[12px] font-bold shadow-sm inline-flex items-center gap-1 border border-primary/10 cursor-pointer active:scale-95 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[14px] text-child">child_care</span>
                      {temperamentInfo ? temperamentInfo.child.label : t('home.assessTemperament')}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center mt-6">
                    <div className="relative">
                      <h1
                        className={`text-2xl font-bold text-text-main dark:text-white tracking-tight inline-flex items-center gap-1 ${children.length > 1 ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
                        onClick={() => { if (children.length > 1) setShowChildDropdown(!showChildDropdown); }}
                      >
                        {childName} ({ageString})
                        {children.length > 1 && (
                          <span className={`material-symbols-outlined text-[20px] text-gray-400 transition-transform ${showChildDropdown ? 'rotate-180' : ''}`}>expand_more</span>
                        )}
                      </h1>
                      {showChildDropdown && children.length > 1 && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowChildDropdown(false)} />
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-1 min-w-[160px] z-50 animate-in fade-in zoom-in-95 duration-200">
                            {children.map((child, idx) => (
                              <button
                                key={child.id}
                                onClick={() => { handleChildSelect(idx); setShowChildDropdown(false); }}
                                className={`w-full px-5 py-3 text-sm font-bold text-left transition-colors ${
                                  mainChild?.id === child.id
                                    ? 'text-primary bg-primary/5'
                                    : 'text-text-main dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                      onClick={() => {
                        if (!parentTemperament?.hasData) return;
                        if (!temperamentInfo) {
                          alert(t('home.childTestAlert', { name: childName }));
                          router.push('/survey/intro');
                          return;
                        }
                        router.push('/report?tab=parent');
                      }}
                      className={`mt-2 bg-white/60 dark:bg-surface-dark/60 backdrop-blur-sm text-text-main dark:text-gray-200 px-3.5 py-1.5 rounded-full text-[12px] font-medium shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] inline-flex items-center gap-1.5 ring-1 ring-black/5 dark:ring-white/10 ${parentTemperament?.hasData ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
                    >
                      <span className="material-symbols-outlined text-[16px] text-caregiver">volunteer_activism</span>
                      {TCI_TERMINOLOGY.REPORT.PARENT_NAME} <span className="mx-0.5 text-gray-300 dark:text-gray-600">|</span> <span className="font-bold text-caregiver">{parentTemperament?.hasData ? parentTemperament.label : t('home.assessNeeded')}</span>
                    </div>
                  </div>
                </div>
                <p className="text-text-sub dark:text-gray-400 text-sm font-light mt-2 break-keep text-center px-8">
                  {t('home.dailyMessage')}
                </p>
              </div>

              {/* 기능 카드 리스트 */}
              <div className="px-6 flex flex-col gap-5 mt-8">
                {/* 아이 기질 검사 유도 카드 */}
                {!temperamentInfo && (
                  <div className="bg-primary dark:bg-surface-dark rounded-2xl p-6 shadow-card relative overflow-hidden mb-2">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="relative z-10">
                      <div className="flex flex-col gap-1 mb-4">
                        <span className="text-white/80 text-xs font-medium bg-black/10 px-2 py-1 rounded inline-block w-fit">{t('home.firstStep')}</span>
                        <h3 className="text-xl font-bold text-white leading-snug tracking-tight">{childName}{t('home.temperamentTest')}</h3>
                      </div>
                      <p className="text-sm text-white/90 mb-6">{t('home.testDescription')}</p>
                      <Link href="/survey/intro">
                        <button className="w-full py-4 rounded-xl bg-white text-primary font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                          <span>{t('home.startTest')}</span>
                          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                        </button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* 양육자 검사 유도 카드 */}
                {(!parentSurvey && Object.keys(atqResponses).length < PARENT_QUESTIONS.length) && temperamentInfo?.child && (
                  <div className="bg-secondary dark:bg-surface-dark rounded-2xl p-6 shadow-card relative overflow-hidden mb-2">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-white/80 text-xs font-medium bg-black/10 px-2 py-1 rounded inline-block w-fit">{t('home.requiredStep')}</span>
                          <h3 className="text-xl font-bold text-white leading-snug tracking-tight">{t('home.parentStyleTest')}</h3>
                        </div>
                      </div>
                      <p className="text-sm text-white/90 mb-6">{t('home.parentTestDescription')}</p>
                      <Link href="/survey?type=PARENT">
                        <button className="w-full py-4 rounded-xl bg-white text-secondary font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                          <span>{Object.keys(atqResponses).length > 0 ? t('home.continueTest') : t('home.startTestButton')}</span>
                          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                        </button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* 마법의 한마디 캐러셀 */}
                {magicWords.length > 0 && (
                  <div className="bg-[#519E8A] rounded-2xl p-5 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                        <span className="text-[13px] font-black">{t('home.todaysMagicWord')}</span>
                      </div>
                      <div className="min-h-[84px] mb-3">
                        <p className="text-[16px] font-medium leading-relaxed line-clamp-3 break-keep">
                          &ldquo;{magicWords[magicWordIndex].word}&rdquo;
                        </p>
                      </div>
                      <p className="text-[11px] text-white/60">
                        {new Date(magicWords[magicWordIndex].date).toLocaleDateString('ko-KR')}
                        {magicWords[magicWordIndex].childName && ` · ${magicWords[magicWordIndex].childName}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* 오늘의 실천 카드 */}
                {practices.uncheckedCount > 0 && (
                  <Link href="/practices" className="block">
                    <div className="bg-white dark:bg-surface-dark/50 rounded-2xl p-5 shadow-soft border border-primary/20 active:scale-[0.99] transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px] text-primary">checklist</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-[14px] font-bold text-text-main dark:text-white">{t('home.todaysPractice')}</h3>
                          <p className="text-[11px] text-text-sub dark:text-gray-400">{t('home.practiceItemsRemaining', { count: practices.uncheckedCount })}</p>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-primary/50">arrow_forward</span>
                      </div>
                      {practices.uncheckedItems.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
                          {practices.uncheckedItems.slice(0, 3).map((item) => (
                            <div key={item.id} className="flex items-center gap-2.5">
                              <div className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                              <span className="text-[13px] text-text-main dark:text-gray-300 truncate flex-1">{item.title}</span>
                            </div>
                          ))}
                          {practices.uncheckedItems.length > 3 && (
                            <p className="text-[11px] text-text-sub dark:text-gray-500 pl-6.5">{t('home.moreItems', { count: practices.uncheckedItems.length - 3 })}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                )}

                {/* 상담 유도 카드 — 상담 이력이 없거나 진행 중 실천이 없을 때 */}
                {showConsultCTA && temperamentInfo?.child && (
                  <Link href="/consult" className="block">
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-surface-dark dark:to-surface-dark rounded-2xl p-5 shadow-soft border border-amber-200/60 dark:border-amber-500/30 active:scale-[0.99] transition-all relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-28 h-28 bg-amber-200/30 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                      <div className="relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400">chat_bubble</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-[14px] font-bold text-text-main dark:text-white">{t('home.consultCTA')}</h3>
                            <p className="text-[11px] text-text-sub dark:text-gray-400">{t('home.consultCTADescription', { name: childName })}</p>
                          </div>
                          <span className="material-symbols-outlined text-[18px] text-amber-400">arrow_forward</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {/* 기질 분석 리포트 */}
                {temperamentInfo?.child && (
                  <Link href="/report" className="block">
                    <div className="bg-white dark:bg-surface-dark/50 rounded-2xl p-5 shadow-soft border border-primary/10 dark:border-primary/50 flex justify-between items-center gap-4 active:scale-[0.99] transition-all">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <span className="material-symbols-outlined text-[20px]">description</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-bold text-text-main dark:text-white">{t('home.temperamentAnalysisReport')}</h3>
                          <p className="text-[11px] text-text-sub dark:text-gray-400 break-keep">{t('home.reportSubtitle')}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-primary/50 shrink-0">arrow_forward</span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            /* [신규 사용자] 아이가 등록되지 않은 상테 - 히어로 전용 UI */
            <div className="px-6 pb-12 animate-in slide-in-from-bottom-8 duration-1000">
              {/* 통합 환영 하이라이트 카드 */}
              <div className="bg-gradient-to-br from-white to-primary/5 dark:from-surface-dark/80 dark:to-primary/20 rounded-[2.5rem] p-8 mt-12 mb-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] border border-primary/10 dark:border-primary/30 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none group-hover:bg-primary/20 transition-all duration-700"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/10 rounded-full blur-[60px] -ml-24 -mb-24 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-[2rem] bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center text-primary mb-8 rotate-3 group-hover:rotate-0 transition-transform duration-500 ring-4 ring-primary/5">
                    <span className="material-symbols-outlined text-[46px] fill-1 scale-110">child_care</span>
                  </div>

                  <h2 className="text-[28px] font-black text-text-main dark:text-white leading-tight break-keep mb-4">
                    {t('home.welcomeGreeting', { name: profile?.full_name || t('home.defaultParentName') })}<br />
                    <span className="text-primary">{t('home.welcomeSubtitle')}</span>
                  </h2>
                  <p className="text-text-sub dark:text-gray-400 text-sm leading-relaxed break-keep mb-10 whitespace-pre-line">
                    {t('home.welcomeDescription')}
                  </p>

                  <Link href="/settings/child/new" className="w-full">
                    <button className="w-full bg-primary hover:bg-primary-dark py-5 rounded-[1.5rem] text-white font-bold text-[17px] shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                      <span>{t('home.registerChildProfile')}</span>
                      <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </button>
                  </Link>
                </div>
              </div>

            </div>
          )}

        </main>

        <BottomNav />

        {/* Modal Sections */}
        {showOnboarding && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-500">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>

              <div className="relative z-10 p-8 flex flex-col items-center">
                <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center mb-8 rotate-3 shadow-xl">
                  <img src="/gijilai_icon.png" alt={t('common.appName')} className="w-16 h-16 object-contain" />
                </div>

                <div className="text-center space-y-3 mb-10">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white font-display break-keep whitespace-pre-line">
                    {t('home.onboardingTitle')}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed break-keep px-4 whitespace-pre-line">
                    {t('home.onboardingDescription')}
                  </p>
                </div>

                <div className="w-full space-y-4 mb-10">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center shrink-0">
                      <span className="text-lg">🧬</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('home.scientificAnalysis')}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t('home.scientificAnalysisDesc')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center shrink-0">
                      <span className="text-lg">💬</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('home.customPrescription')}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t('home.customPrescriptionDesc')}</p>
                    </div>
                  </div>
                </div>

                <div className="w-full">
                  <button
                    onClick={() => {
                      setShowOnboarding(false);
                      router.push('/settings/child/new');
                    }}
                    className="w-full bg-primary text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                  >
                    <span className="text-lg">{t('home.registerChildInfo')}</span>
                    <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </button>
                  <button
                    onClick={() => setShowOnboarding(false)}
                    className="w-full py-4 text-slate-400 text-xs font-bold hover:text-slate-600 transition-colors mt-2"
                  >
                    {t('home.laterButton')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSurveyIntro && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSurveyIntro(false)}></div>
            <div className="relative bg-background-light dark:bg-surface-dark w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-5 shadow-lg animate-bounce-subtle">
                  <img src="/gijilai_icon.png" alt={t('common.appName')} className="w-12 h-12 object-contain" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3 font-display">
                  {t('home.surveyIntroTitle')}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-8 break-keep whitespace-pre-line">
                  {t('home.surveyIntroDescription')}
                </p>

                <div className="w-full space-y-3">
                  <button
                    onClick={() => {
                      resetSurveyOnly();
                      router.push('/survey');
                    }}
                    className="w-full bg-[#2E7D32] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#2E7D32]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <span>{t('home.startTestSurvey')}</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                  <button
                    onClick={() => setShowSurveyIntro(false)}
                    className="w-full py-3 text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
                  >
                    {t('home.laterSurvey')}
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

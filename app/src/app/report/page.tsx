'use client';

import React, { useMemo, useState, useEffect, Suspense } from 'react';
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
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js';
import { Radar, Bar } from 'react-chartjs-2';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TemperamentScorer } from '@/lib/TemperamentScorer';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { ParentClassifier } from '@/lib/ParentClassifier';
import { PRESCRIPTION_DATA } from '@/lib/PrescriptionData';
import { TCI_TERMINOLOGY } from '@/constants/terminology';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
);

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const isChildOnly = searchParams.get('child_only') === 'true';

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'child' | 'parent' | 'parenting'>('child');
  const { intake, cbqResponses, atqResponses, parentingResponses, isPaid } = useAppStore();

  const [childAiReport, setChildAiReport] = useState<any>(null);
  const [parentAiReport, setParentAiReport] = useState<any>(null);
  const [harmonyAiReport, setHarmonyAiReport] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // DB에서 로드된 점수 데이터 (상세 보기용)
  const [savedChildScores, setSavedChildScores] = useState<any>(null);
  const [savedParentScores, setSavedParentScores] = useState<any>(null);
  const [savedStyleScores, setSavedStyleScores] = useState<any>(null);

  // DB Sync States
  const [dbChildId, setDbChildId] = useState<string | null>(null);
  const [dbSurveyIds, setDbSurveyIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tabParam === 'parent') {
      setActiveTab('parent');
    } else if (tabParam === 'child') {
      setActiveTab('child');
    } else if (tabParam === 'parenting') {
      setActiveTab('parenting');
    }
  }, [tabParam]);

  const reportId = searchParams.get('id');

  // URL ID가 있을 경우 DB에서 리포트 로드
  useEffect(() => {
    if (reportId && user) {
      loadSavedReport(reportId);
    }
  }, [reportId, user]);

  const loadSavedReport = async (id: string) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*, surveys(*), children(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        const analysis = data.analysis_json;
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
          setChildAiReport(analysis);
          setSavedChildScores(surveyData?.scores);
          setDbChildId(data.child_id);
          setDbSurveyIds(prev => ({ ...prev, CHILD: data.survey_id }));
          setActiveTab('child');
        } else if (data.type === 'PARENT') {
          setParentAiReport(analysis);
          setSavedParentScores(surveyData?.scores);
          setDbChildId(data.child_id);
          setDbSurveyIds(prev => ({ ...prev, PARENT: data.survey_id }));
          setActiveTab('parent');
        } else if (data.type === 'HARMONY') {
          setHarmonyAiReport(analysis);
          setDbChildId(data.child_id);
          setDbSurveyIds(prev => ({ ...prev, PARENTING_STYLE: data.survey_id }));
          // 조화 분석 시에는 아이/부모 점수가 모두 필요할 수 있으므로 저장된 데이터가 있다면 복원
          setActiveTab('parenting');
        }
      }
    } catch (e) {
      console.error('Failed to load report:', e);
      alert('리포트를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 안A: 아이 리포트 선공 - 아동 설문 완료 직후 자동으로 AI 리포트 생성
  useEffect(() => {
    if (isChildOnly && !childAiReport && !isGenerating && !reportId && Object.keys(cbqResponses).length > 0) {
      generateChildAIReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChildOnly, reportId]);

  const handleTabChange = (tab: 'child' | 'parent' | 'parenting') => {
    setActiveTab(tab);
  };

  // DB 저장 헬퍼
  const ensureChildAndSurvey = async (type: 'CHILD' | 'PARENT' | 'PARENTING_STYLE') => {
    if (!user) return { childId: null, surveyId: null };

    try {
      let childId = dbChildId;
      // 1. 아이 프로필 생성/확인
      if (!childId) {
        const child = await db.createChild({
          parent_id: user.id,
          name: intake.childName || '아이',
          gender: (intake.gender as 'male' | 'female') || 'male',
          birth_date: intake.birthDate || new Date().toISOString().split('T')[0],
          birth_time: intake.birthTime,
          image_url: null,
        });
        childId = child.id;
        setDbChildId(childId);
      }

      // 2. 설문 응답 저장
      let surveyId = dbSurveyIds[type];
      if (!surveyId) {
        const responses = type === 'CHILD' ? cbqResponses : (type === 'PARENT' ? atqResponses : parentingResponses);
        const scores = type === 'CHILD' ? childScores : (type === 'PARENT' ? parentScores : styleScores);

        const survey = await db.saveSurvey({
          user_id: user.id,
          child_id: childId,
          type,
          answers: responses as any,
          scores: scores as any,
          status: 'COMPLETED'
        });
        surveyId = survey.id;
        setDbSurveyIds(prev => ({ ...prev, [type]: surveyId }));
      }

      return { childId, surveyId };
    } catch (e) {
      console.error('DB Sync Error:', e);
      return { childId: null, surveyId: null };
    }
  };

  const generateChildAIReport = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const scores = childScores;
      const answers = Object.entries(cbqResponses).map(([id, score]) => ({
        questionId: id,
        score: score as number
      }));
      const res = await fetch('/api/llm/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: intake.childName || '아이', scores, type: 'CHILD', answers })
      });
      if (!res.ok) throw new Error('Report generation failed');
      const data = await res.json();
      setChildAiReport(data.report);

      // DB 저장
      const { childId, surveyId } = await ensureChildAndSurvey('CHILD');
      if (user && childId && surveyId) {
        await db.saveReport({
          user_id: user.id,
          child_id: childId,
          survey_id: surveyId,
          type: 'CHILD',
          analysis_json: data.report as any,
          model_used: 'gpt-4o'
        });
      }
    } catch (error) {
      console.error(error);
      alert('리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateParentAIReport = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const scores = parentScores;
      const answers = Object.entries(atqResponses).map(([id, score]) => ({
        questionId: id,
        score: score as number
      }));
      const res = await fetch('/api/llm/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: '양육자', scores, type: 'PARENT', answers })
      });
      if (!res.ok) throw new Error('Report generation failed');
      const data = await res.json();
      setParentAiReport(data.report);

      // DB 저장
      const { childId, surveyId } = await ensureChildAndSurvey('PARENT');
      if (user && childId && surveyId) {
        await db.saveReport({
          user_id: user.id,
          child_id: childId, // Parent reports are also linked to a child
          survey_id: surveyId,
          type: 'PARENT',
          analysis_json: data.report as any,
          model_used: 'gpt-4o'
        });
      }
    } catch (error) {
      console.error(error);
      alert('리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateHarmonyAIReport = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      // 모든 응답 통합 (양육 태도 포함)
      const answers = [
        ...Object.entries(cbqResponses),
        ...Object.entries(atqResponses),
        ...Object.entries(parentingResponses)
      ].map(([id, score]) => ({
        questionId: id,
        score: score as number
      }));

      const res = await fetch('/api/llm/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: intake.childName || '아이',
          scores: childScores,
          parentScores: parentScores,
          type: 'HARMONY',
          answers
        })
      });
      if (!res.ok) throw new Error('Harmony report generation failed');
      const data = await res.json();
      setHarmonyAiReport(data.report);

      // DB 저장 (Harmony는 우선 설문 데이터와 연결하여 'CHILD' 타입 리포트로 확장 저장)
      const { childId, surveyId } = await ensureChildAndSurvey('PARENTING_STYLE');
      if (user && childId && surveyId) {
        await db.saveReport({
          user_id: user.id,
          child_id: childId,
          survey_id: surveyId,
          type: 'HARMONY', // Changed to HARMONY type
          analysis_json: data.report as any,
          model_used: 'gpt-4o'
        });
      }
    } catch (error) {
      console.error(error);
      alert('조화 분석 리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAIReport = async () => {
    if (activeTab === 'child') await generateChildAIReport();
    else if (activeTab === 'parent') await generateParentAIReport();
    else if (activeTab === 'parenting') await generateHarmonyAIReport();
  };

  const childScores = useMemo(() => {
    if (savedChildScores) return savedChildScores;
    return TemperamentScorer.calculate(CHILD_QUESTIONS, cbqResponses as any);
  }, [cbqResponses, savedChildScores]);

  const parentScores = useMemo(() => {
    if (savedParentScores) return savedParentScores;
    return TemperamentScorer.calculate(PARENT_QUESTIONS, atqResponses as any);
  }, [atqResponses, savedParentScores]);

  // Parenting Style Scores
  const styleScores = useMemo(() => {
    if (savedStyleScores) return savedStyleScores;
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
    }
  }, [parentingResponses]);

  // Temperament Classification
  const childType = useMemo(() => TemperamentClassifier.analyze(childScores, parentScores), [childScores, parentScores]);
  const prescription = useMemo(() => PRESCRIPTION_DATA[childType.label] || PRESCRIPTION_DATA["무한한 잠재력의 아이"], [childType]);

  const isStyleSurveyComplete = useMemo(() => {
    return PARENTING_STYLE_QUESTIONS.every(q => !!parentingResponses[q.id.toString()]);
  }, [parentingResponses]);

  const parentReport = useMemo(() => ParentClassifier.analyze(parentScores), [parentScores]);
  const isParentSurveyComplete = useMemo(() => Object.keys(atqResponses).length >= PARENT_QUESTIONS.length, [atqResponses]);

  const isChildSurveyComplete = useMemo(() => {
    return Object.keys(cbqResponses).length > 0 || !!savedChildScores;
  }, [cbqResponses, savedChildScores]);

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
        data: [childScores.NS, childScores.HA, childScores.RD, childScores.P],
        backgroundColor: 'rgba(78, 205, 196, 0.2)',
        borderColor: '#4ECDC4',
        borderWidth: 3,
        pointBackgroundColor: '#4ECDC4',
        pointRadius: 4,
      },
      {
        label: TCI_TERMINOLOGY.REPORT.PARENT_NAME,
        data: [parentScores.NS, parentScores.HA, parentScores.RD, parentScores.P],
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderColor: '#FF6B6B',
        borderWidth: 2,
        pointBackgroundColor: '#FF6B6B',
        pointRadius: 0,
        borderDash: [5, 5],
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
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 12, font: { size: 12, weight: 'bold' as const } }
      }
    }
  };

  const barData = {
    labels: ['양육 효능감', '자율성 지지', '정서적 반응성'],
    datasets: [
      {
        data: [styleScores.Efficacy, styleScores.Autonomy, styleScores.Responsiveness],
        backgroundColor: ['#FFD93D', '#6C5CE7', '#FF6B6B'],
        borderRadius: 8,
        barThickness: 32,
      }
    ]
  };

  // Temperament Harmony Index (THI) Logic
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: { display: false },
        ticks: { font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 11, weight: 'bold' as const } }
      }
    },
    plugins: {
      legend: { display: false }
    }
  };

  const ghiScore = useMemo(() => {
    const diff =
      Math.abs(childScores.NS - parentScores.NS) +
      Math.abs(childScores.HA - parentScores.HA) +
      Math.abs(childScores.RD - parentScores.RD) +
      Math.abs(childScores.P - parentScores.P);
    return diff / 4;
  }, [childScores, parentScores]);

  const analysisResult = useMemo(() => {
    let type = 'NORMAL';
    let message = '서로 다른 기질이지만, 부모님의 노력으로 균형을 맞춰가고 있습니다.';
    const isHighGHI = ghiScore >= 40;
    const isConflictPattern = childScores.NS >= 70 && parentScores.HA >= 70;

    if (isHighGHI || isConflictPattern) {
      if (styleScores.Autonomy >= 70) {
        type = 'MITIGATED';
        message = '기질적인 차이가 크지만, 부모님의 높은 [자율성 지지] 덕분을 통해 아이가 이를 건강하게 극복하고 있습니다.';
      } else if (styleScores.Responsiveness <= 50) {
        type = 'CRISIS';
        message = '현재 기질적 갈등이 심화되고 있습니다. 아이의 마음을 먼저 읽어주는 [정서적 반응성]을 높이는 노력이 필요합니다.';
      } else {
        message = '기질 차이로 인한 갈등 가능성이 있습니다. 서로의 다름을 인정하는 대화가 필요합니다.';
      }
    }
    return { type, message };
  }, [ghiScore, childScores, parentScores, styleScores]);

  const ghiColor = ghiScore < 25 ? 'text-teal-600' : (ghiScore < 55 ? 'text-indigo-600' : 'text-rose-500');
  const ghiBg = ghiScore < 25 ? 'bg-teal-500' : (ghiScore < 55 ? 'bg-indigo-500' : 'bg-rose-500');
  const ghiLabel = ghiScore < 25 ? '안정적 조화' : (ghiScore < 55 ? '균형 잡힌 관계' : '주의 깊은 관찰 필요');

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
        <main className={`flex-1 overflow-y-auto no-scrollbar ${isChildOnly ? 'pb-40' : 'pb-24'}`}>
          {/* Header Overlay */}
          <div className="bg-primary pt-6 pb-24 px-6 rounded-b-[3rem] shadow-xl relative overflow-hidden z-10 mx-[-1px]">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between mb-4 relative z-20">
              <button
                onClick={() => router.back()}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors"
                aria-label="뒤로 가기"
              >
                <Icon name="arrow_back" size="sm" />
              </button>
            </div>
            
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <div className="relative z-10 text-center space-y-2">
              {isChildOnly ? (
                <>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 bg-white/20 rounded-full text-[11px] font-bold text-white/90 tracking-wide backdrop-blur-sm">
                    ✨ {childAiReport ? 'AI 정밀 분석 완료' : '아이 기질 검사 완료!'}
                  </div>
                  <h1 className="text-3xl font-black text-white tracking-tight">
                    {childAiReport?.title?.split(':')[0]?.trim() || intake.childName || '아이'}의
                    <br /> {childAiReport ? '심층 리포트' : '기질 리포트'}
                  </h1>
                  <p className="text-white/70 text-sm font-medium">기질아이가 발견한 우리 아이의 타고난 세계</p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl font-black text-white tracking-tight">분석 리포트</h1>
                  <p className="text-white/70 text-sm font-medium">기질아이가 발견한 {intake.childName || '아이'}의 세상</p>
                </>
              )}
            </div>
          </div>

          {/* Tab Switcher - 아이 리포트 선공 모드에서는 숨김 */}
          {!isChildOnly && (
            <div className="max-w-md mx-auto px-6 -mt-14 mb-8 relative z-30">
              <div className="bg-white/20 backdrop-blur-xl p-1 rounded-2xl flex gap-1 border border-white/30 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                <button
                  onClick={() => handleTabChange('child')}
                  className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all ${activeTab === 'child' ? 'bg-white text-primary shadow-md' : 'text-white/80 hover:text-white'}`}
                >
                  아이 진단
                </button>
                <button
                  onClick={() => {
                    if (isParentSurveyComplete) handleTabChange('parent');
                    else if (confirm('부모 기질 검사를 먼저 완료해야 확인할 수 있어요. 지금 시작할까요?')) {
                      router.push('/survey?type=PARENT');
                    }
                  }}
                  className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all ${activeTab === 'parent' ? 'bg-white text-primary shadow-md' : 'text-white/80 hover:text-white'}`}
                >
                  양육자 분석
                </button>
                <button
                  onClick={() => {
                    if (isStyleSurveyComplete) handleTabChange('parenting');
                    else if (confirm('양육 태도 검사를 먼저 완료해야 확인할 수 있어요. 지금 시작할까요?')) {
                      router.push('/survey?type=STYLE');
                    }
                  }}
                  className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all ${activeTab === 'parenting' ? 'bg-white text-primary shadow-md' : 'text-white/80 hover:text-white'}`}
                >
                  기질 맞춤 양육
                </button>
              </div>
            </div>
          )}
          {/* child_only 모드: 헤더와 컨텐츠 사이 간격 */}
          {isChildOnly && <div className="h-8" />}

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
                      {intake.childName || '아이'}의 기질을<br />알아볼 시간이에요!
                    </h2>
                    <p className="text-text-sub dark:text-slate-400 text-[15px] leading-relaxed break-keep px-4">
                      아이의 타고난 빛을 발견하기 위한<br />
                      첫 번째 단계, 기질 검사를 먼저 시작해볼까요?<br />
                      <span className="text-[12px] opacity-70 mt-2 block">(약 3-5분 정도 소요됩니다)</span>
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    fullWidth
                    className="h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
                    onClick={() => router.push('/survey')}
                  >
                    기질 검사 시작하기
                  </Button>
                </div>
              ) : (
                <>
                  {/* Phase 1: Archetype Discovery */}
                  <div className="bg-white dark:bg-surface-dark rounded-2xl p-8 shadow-card border border-beige-main/20 flex flex-col items-center text-center space-y-8 relative overflow-hidden">
                    <div className="w-48 h-48 relative flex items-center justify-center">
                      <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20"></div>
                      <div className="absolute inset-4 bg-primary/20 rounded-full animate-pulse opacity-30"></div>
                      <div className="relative text-8xl drop-shadow-2xl z-10 hover:scale-110 transition-transform cursor-pointer">
                        {childType.emoji}
                      </div>
                    </div>

                    <div className="space-y-4 px-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-beige-light dark:bg-surface-dark font-black text-[10px] text-text-sub uppercase tracking-widest">
                        Current Manifestation
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-4xl font-black text-text-main dark:text-white leading-tight">
                          {childAiReport?.title?.split(':')[1]?.trim() || childType.label}
                        </h2>
                        <p className="text-text-sub dark:text-slate-400 text-[15px] leading-relaxed break-keep px-4 font-medium">
                          {childAiReport?.intro || childType.desc}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Phase 2: Relationship Foundation (Parent VS Child) */}
                  <div className="space-y-4">
                    <h3 className="px-4 text-[13px] font-black text-text-sub uppercase tracking-[0.2em] flex items-center gap-2">
                      <Icon name="diversity_3" size="sm" /> 아이와 나의 기질 궁합
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Parent Card */}
                      <section className="bg-gradient-to-br from-white to-orange-50/30 dark:from-surface-dark dark:to-orange-900/10 rounded-2xl p-6 shadow-card border border-orange-100/50 dark:border-orange-900/20 relative group">
                        <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-4 transition-transform group-hover:scale-110">
                          <Icon name="person" size="sm" />
                        </div>
                        <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block mb-1">양육자 기질</span>
                        <h4 className="text-[14px] font-black text-text-main dark:text-white mb-2 leading-tight break-keep">{childType.soil.label}</h4>
                        <p className="text-[11px] text-text-sub dark:text-slate-400 leading-snug break-keep opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute inset-0 p-6 bg-white/95 dark:bg-surface-dark/95 flex items-center rounded-2xl">
                          {childType.soil.desc}
                        </p>
                      </section>

                      {/* Child Card */}
                      <section className="bg-gradient-to-br from-white to-teal-50/30 dark:from-surface-dark dark:to-teal-900/10 rounded-2xl p-6 shadow-card border border-teal-100/50 dark:border-teal-900/20 relative group">
                        <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4 transition-transform group-hover:scale-110">
                          <Icon name="child_care" size="sm" />
                        </div>
                        <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest block mb-1">아이 기질</span>
                        <h4 className="text-[14px] font-black text-text-main dark:text-white mb-2 leading-tight break-keep">{childType.seed.label}</h4>
                        <p className="text-[11px] text-text-sub dark:text-slate-400 leading-snug break-keep opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute inset-0 p-6 bg-white/95 dark:bg-surface-dark/95 flex items-center rounded-2xl">
                          {childType.seed.desc}
                        </p>
                      </section>
                    </div>
                  </div>

                  {/* Phase 3: Harmony Dynamics (The "Why") */}
                  <section className="bg-slate-900 dark:bg-white rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl -mr-16 -mt-16"></div>
                    <div className="relative z-10 space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">Temperament Dynamics</span>
                          <h3 className="text-2xl font-black text-white dark:text-text-main">"{childType.harmony.title}"</h3>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-white/10 dark:bg-background-light flex items-center justify-center border border-white/20 dark:border-beige-main/20">
                          <Icon name="psychology" className="text-primary" />
                        </div>
                      </div>
                      <p className="text-white/80 dark:text-text-sub text-[14px] leading-relaxed break-keep font-medium">
                        {childType.harmony.desc}
                      </p>
                      <div className="pt-4 flex items-center gap-4 text-[11px] font-bold text-slate-500 italic">
                        <div className="flex-1 h-[1px] bg-slate-800 dark:bg-slate-200"></div>
                        <span>Relationship Insights</span>
                        <div className="flex-1 h-[1px] bg-slate-800 dark:bg-slate-200"></div>
                      </div>
                    </div>
                  </section>

                  {/* AI 심층 분석 리포트 (JSON 기반 렌더링) */}
                  <section className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="font-black text-text-main dark:text-white text-xl flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">✨</span>
                        AI 전문가 심층 리포트
                      </h3>
                    </div>

                    {childAiReport ? (
                      <div className="relative group">
                        <div className={`space-y-8 animate-fade-in-up transition-all duration-1000 ${!isPaid ? 'blur-xl grayscale opacity-40 pointer-events-none select-none' : ''}`}>
                          {/* AI 별명 및 서문 */}
                          <div className="bg-white dark:bg-surface-dark rounded-2xl p-8 shadow-card border-t-8 border-primary relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl italic font-black uppercase tracking-tighter pointer-events-none">Insight</div>
                            <h4 className="text-2xl font-black text-text-main dark:text-white mb-4 leading-tight">
                              {childAiReport.title}
                            </h4>
                            <p className="text-sm text-text-sub dark:text-slate-400 leading-relaxed break-keep font-medium">
                              {childAiReport.intro}
                            </p>
                          </div>

                          {/* 핵심 분석 & 인사이트 */}
                          <div className="grid grid-cols-1 gap-6">
                            <div className="bg-white dark:bg-surface-dark rounded-2xl p-8 shadow-card space-y-4">
                              <div className="inline-flex px-3 py-1 rounded-full bg-indigo-50 text-indigo-500 text-[10px] font-black uppercase tracking-widest">Core Analysis</div>
                              <p className="text-[14px] text-text-main dark:text-text-sub leading-relaxed break-keep whitespace-pre-wrap">
                                {childAiReport.analysis?.summary}
                              </p>
                            </div>
                            <div className="bg-indigo-900 rounded-[2.5rem] p-8 shadow-xl space-y-4 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl -mr-16 -mt-16"></div>
                              <div className="inline-flex px-3 py-1 rounded-full bg-white/10 text-white/80 text-[10px] font-black uppercase tracking-widest">Secret Heart</div>
                              <h5 className="text-white font-bold">아이의 숨겨진 목소리</h5>
                              <p className="text-[14px] text-indigo-100 leading-relaxed break-keep whitespace-pre-wrap italic">
                                {childAiReport.analysis?.insight}
                              </p>
                            </div>
                          </div>

                          {/* 양육 팁 */}
                          <div className="space-y-4">
                            <h5 className="text-sm font-black text-text-sub px-4 uppercase tracking-[0.2em]">Parenting Solutions</h5>
                            {childAiReport.parentingTips?.map((tip: any, idx: number) => (
                              <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-card border border-beige-main/20">
                                <h6 className="font-bold text-text-main dark:text-white mb-3 flex items-center gap-2 text-sm">
                                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">{idx + 1}</span>
                                  {tip.situation}
                                </h6>
                                <ul className="space-y-2">
                                  {tip.tips?.map((t: string, i: number) => (
                                    <li key={i} className="text-[13px] text-text-sub dark:text-slate-400 flex gap-2">
                                      <span className="text-primary mt-1 shrink-0">•</span>
                                      <span className="leading-snug break-keep">{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>

                          {/* 실전 스크립트 - 웹 샘플형 */}
                          <div className="bg-beige-light dark:bg-surface-dark rounded-2xl p-8 space-y-6 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-black text-text-sub uppercase tracking-widest">Magic Scripts</h5>
                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">PREMIUM</span>
                            </div>

                            <div className="space-y-4">
                              {childAiReport.scripts?.slice(0, 1).map((s: any, idx: number) => (
                                <div key={idx} className="bg-white dark:bg-background-dark p-5 rounded-2xl shadow-sm border-l-4 border-primary">
                                  <span className="text-[10px] font-bold text-text-sub block mb-1">{s.situation}</span>
                                  <p className="text-[15px] font-black text-primary mb-2">"{s.script}"</p>
                                  <p className="text-[11px] text-text-sub">{s.guide}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 카톡 공유 메시지 */}
                          {childAiReport.shareText && (
                            <div className="bg-[#FAE100]/10 rounded-2xl p-6 border border-[#FAE100]/30">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg">💬</span>
                                <span className="text-xs font-bold text-[#3C1E1E]">배우자에게 공유하기 지침</span>
                              </div>
                              <p className="text-[12px] text-[#3C1E1E]/80 leading-relaxed font-medium">
                                {childAiReport.shareText}
                              </p>
                            </div>
                          )}
                        </div>

                        {!isPaid && (
                          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4">
                            <div className="w-full bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl p-8 rounded-2xl shadow-card border border-primary/20 text-center animate-in zoom-in-95 duration-500 space-y-6">
                              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-4xl mb-2">🔒</div>
                              <div className="space-y-2">
                                <h4 className="text-2xl font-black text-text-main dark:text-white break-keep">아이의 마음을 통역해드릴까요?</h4>
                                <p className="text-text-sub dark:text-slate-400 text-sm leading-relaxed break-keep px-4">
                                  기질 전문가가 분석한 정밀 리포트와<br />
                                  오늘 저녁 바로 써먹는 [마법의 한마디]가 포함되어 있어요.
                                </p>
                              </div>
                              <div className="pt-4 space-y-4">
                                <Button onClick={() => router.push('/payment')} variant="primary" fullWidth className="h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20">
                                  990원에 심층 리포트 열기
                                </Button>
                                <p className="text-[10px] text-slate-400 font-medium">커피 한 잔보다 가벼운 우리 아이를 위한 이해</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-surface-dark rounded-2xl p-10 text-center space-y-6 shadow-card border border-primary/10">
                        <div className="w-20 h-20 mx-auto bg-primary/5 rounded-full flex items-center justify-center text-3xl animate-pulse">
                          🧬
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-bold text-text-main dark:text-white">준비된 리포트가 없습니다</h4>
                          <p className="text-sm text-text-sub leading-relaxed break-keep">
                            아이의 세부 문항 응답 데이터까지 분석하여<br />
                            가장 정확한 양육 가이드를 생성합니다.
                          </p>
                        </div>
                        <Button
                          onClick={generateChildAIReport}
                          variant="primary"
                          fullWidth
                          className="h-14 rounded-2xl"
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <div className="flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                              <span>분석 보고서 작성 중...</span>
                            </div>
                          ) : 'AI 정밀 리포트 생성하기'}
                        </Button>
                      </div>
                    )}
                  </section>

                  {/* Scientific Indicators */}
                  <div className="space-y-8">
                    {/* Radar Chart Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl space-y-8">
                      <h3 className="font-black text-slate-800 dark:text-white text-lg flex items-center gap-2">
                        <Icon name="analytics" className="text-primary" /> 기질 분석 데이터
                      </h3>
                      <div className="h-64 relative">
                        <Radar data={radarData} options={radarOptions} />
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl text-[11px] text-slate-400 leading-relaxed text-center italic text-balance">
                        * 양육자의 **기질**과 아이의 **기질**이 만나 <br />어떤 **시너지**를 내고 있는지 데이터 지표로 보여줍니다.
                      </div>
                    </div>

                    {/* GHI Section */}
                    <div className={`bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border-2 transition-all ${analysisResult.type === 'CRISIS' ? 'border-rose-400' : (analysisResult.type === 'MITIGATED' ? 'border-teal-400' : 'border-transparent')}`}>
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-800 dark:text-white text-lg">조화 지수 (GHI)</h3>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${ghiScore < 40 ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-600'}`}>
                          {ghiLabel}
                        </span>
                      </div>

                      <div className="space-y-6">
                        <div className="relative">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Similarity Gap</span>
                            <span className={`text-2xl font-black ${ghiColor}`}>{Math.round(ghiScore)}</span>
                          </div>
                          <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, ghiScore)}%` }}
                              className={`h-full transition-all duration-1000 ease-out ${ghiBg}`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Locked Content Preview (Only for Child-focused premium results) */}
                    {!isPaid && (
                      <div className="bg-slate-800 rounded-[2.5rem] p-10 text-center space-y-6">
                        <div className="text-4xl mb-2">🔒</div>
                        <h4 className="text-xl font-bold text-white">더 깊은 처방이 필요한가요?</h4>
                        <p className="text-slate-400 text-sm leading-relaxed px-4">
                          아이의 행동을 통역해주는 [마음 처방전]과<br />
                          오늘 밤 바로 써먹는 [마법의 한마디]를 확인하세요.
                        </p>
                        <Button onClick={() => router.push('/payment')} variant="primary" fullWidth className="h-14 rounded-2xl">
                          990원에 처방전 구매하기
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  {!isChildOnly && (
                    <div className="flex flex-col gap-4 pt-10 pb-10 text-center">
                      <Button variant="secondary" onClick={() => router.push('/share')} fullWidth className="h-14 rounded-2xl border-none bg-white shadow-lg">
                        결과 공유하고 할인권 받기
                      </Button>
                      <Link href="/" className="text-slate-400 text-sm font-bold hover:text-primary transition-colors">
                        홈으로 돌아가기
                      </Link>
                    </div>
                  )}
                </>
              )
            ) : activeTab === 'parent' ? (
              <div className="animate-fade-in space-y-12">
                {/* Parent Report Header */}
                <header className="text-center space-y-4 py-6">
                  <div className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2">Parent Self-Report</div>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white leading-snug break-keep">
                    양육자 <span className="text-primary">나</span>의<br />중심을 잡는 마음 기질
                  </h2>
                  <p className="text-slate-500 text-[13px] font-medium leading-relaxed break-keep">
                    당신은 누군가의 부모이기 이전에,<br />그 자체로 고유한 결을 가진 소중한 사람입니다.
                  </p>
                </header>

                {/* Parent Section 1: Temperament Analysis (Individual) */}
                <section className="bg-white dark:bg-slate-800 rounded-[3rem] p-10 shadow-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
                  <div className="relative z-10 space-y-6">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">01. 나의 기질 분석</span>
                      <h3 className="text-xl font-black text-slate-800 dark:text-white">{parentReport.soilName}</h3>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                      <p className="text-slate-600 dark:text-slate-300 text-[14px] leading-relaxed break-keep font-medium italic">
                        {parentReport.analysis}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Parent Section 2: Magic Season & Drought */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section className="bg-[#fff9f0] rounded-[2.5rem] p-8 shadow-sm border border-orange-100 relative overflow-hidden">
                    <div className="absolute top-4 right-6 text-2xl">✨</div>
                    <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block mb-1">02. 나의 마법의 계절</span>
                    <h4 className="text-md font-bold text-slate-800 mb-2">내가 가장 빛나는 순간</h4>
                    <p className="text-[12px] text-slate-600 leading-relaxed break-keep">
                      {parentReport.magicSeason}
                    </p>
                  </section>
                  <section className="bg-[#f0f9ff] rounded-[2.5rem] p-8 shadow-sm border border-blue-100 relative overflow-hidden">
                    <div className="absolute top-4 right-6 text-2xl">☁️</div>
                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-1">03. 마음의 가뭄</span>
                    <h4 className="text-md font-bold text-slate-800 mb-2">에너지가 고갈되는 신호</h4>
                    <p className="text-[12px] text-slate-600 leading-relaxed break-keep">
                      {parentReport.drought}
                    </p>
                  </section>
                </div>

                {/* 부모 AI 심층 분석 리포트 (JSON 기반) */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-black text-slate-800 dark:text-white text-xl flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">👤</span>
                      부모 기질 심층 분석
                    </h3>
                  </div>

                  {parentAiReport ? (
                    <div className="relative group">
                      <div className={`space-y-8 animate-fade-in-up transition-all duration-1000 ${!isPaid ? 'blur-xl grayscale opacity-40 pointer-events-none select-none' : ''}`}>
                        {/* 타이틀 카드 */}
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 shadow-xl border-l-[12px] border-indigo-500 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-5 text-8xl font-black italic">YOU</div>
                          <h4 className="text-2xl font-black text-slate-800 dark:text-white mb-4 leading-tight">
                            {parentAiReport.title}
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-keep font-medium">
                            {parentAiReport.intro}
                          </p>
                        </div>

                        {/* 부모 기질 섹션들 */}
                        <div className="space-y-6">
                          {parentAiReport.sections?.map((section: any) => (
                            <div key={section.id} className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-lg border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center justify-between mb-4">
                                <h5 className="font-black text-slate-800 dark:text-white text-lg">{section.heading}</h5>
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500">{section.badge}</span>
                              </div>
                              <p className="text-[14px] text-slate-600 dark:text-slate-400 leading-relaxed break-keep whitespace-pre-wrap">
                                {section.content}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* 퍼스널 솔루션 */}
                        <div className="bg-indigo-900 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-3xl -mr-32 -mt-32"></div>
                          <h5 className="text-white font-black text-lg mb-8 flex items-center gap-2">
                            <span className="text-2xl">💊</span> 나를 위한 마음 영양제
                          </h5>
                          <div className="space-y-6">
                            {parentAiReport.solutions?.map((sol: any, idx: number) => (
                              <div key={idx} className="bg-white/10 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                                <h6 className="text-primary font-bold mb-2">{sol.name}</h6>
                                <p className="text-white text-[14px] leading-relaxed mb-3">{sol.action}</p>
                                <div className="text-[11px] text-white/40 flex items-center gap-2">
                                  <span className="shrink-0">💡 근거:</span>
                                  <span>{sol.reason}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 다정한 편지 */}
                        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-[2.5rem] p-10 text-center relative">
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 shadow-md px-4 py-1 rounded-full text-xs font-bold text-rose-500">
                            From. 아이나
                          </div>
                          <p className="text-rose-700 dark:text-rose-300 italic leading-loose break-keep font-serif text-lg py-4">
                            "{parentAiReport.letter}"
                          </p>
                        </div>
                      </div>

                      {!isPaid && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4">
                          <div className="w-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-indigo-200 text-center animate-in zoom-in-95 duration-500 space-y-6">
                            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-4xl mb-2">🧘</div>
                            <div className="space-y-2">
                              <h4 className="text-2xl font-black text-slate-800 dark:text-white break-keep">나를 위한 쉼표가 필요하신가요?</h4>
                              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed break-keep px-4">
                                부모로서의 나를 깊이 이해하고<br />
                                지치지 않는 양육 에너지를 채워주는 전문 리포트입니다.
                              </p>
                            </div>
                            <div className="pt-4 space-y-4">
                              <Button onClick={() => router.push('/payment')} variant="primary" fullWidth className="h-16 rounded-2xl font-black text-lg bg-indigo-600 shadow-xl shadow-indigo-200 hover:bg-indigo-700">
                                990원에 부모 정밀 분석 열기
                              </Button>
                              <p className="text-[10px] text-slate-400 font-medium">나를 먼저 돌보는 인지가 조화로운 육아의 시작입니다</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 text-center space-y-6 shadow-xl">
                      <div className="w-20 h-20 mx-auto bg-indigo-50 rounded-full flex items-center justify-center text-3xl">
                        🧘
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-800 dark:text-white">나의 기질 분석이 준비되었습니다</h4>
                        <p className="text-sm text-slate-500 leading-relaxed break-keep">
                          나의 타고난 성향을 깊이 있게 이해하고<br />
                          지치지 않는 양육을 위한 에너지를 얻으세요.
                        </p>
                      </div>
                      <Button
                        onClick={generateAIReport}
                        variant="primary"
                        fullWidth
                        className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700"
                        disabled={isGenerating}
                      >
                        {isGenerating ? '분석 중...' : '부모 전문 리포트 생성하기'}
                      </Button>
                    </div>
                  )}
                </section>

                {/* Parent Section 4: Letter */}
                <section className="bg-primary/5 rounded-[3rem] p-10 border-2 border-dashed border-primary/20 text-center space-y-6">
                  <div className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center mx-auto -mt-14">
                    <span className="text-3xl">💌</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800">나에게 보내는 다정한 편지</h3>
                  <p className="text-slate-600 text-[14px] leading-relaxed italic break-keep px-4">
                    "{parentReport.letter}"
                  </p>
                </section>

                {/* Footer Actions */}
                <div className="flex flex-col gap-4 pt-10 pb-10 text-center">
                  <Button variant="secondary" onClick={() => router.push('/share')} fullWidth className="h-14 rounded-2xl border-none bg-white shadow-lg">
                    나의 결과 공유하기
                  </Button>
                  <Link href="/" className="text-slate-400 text-sm font-bold hover:text-primary transition-colors">
                    홈으로 돌아가기
                  </Link>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in space-y-12">
                {/* AI 조화 분석 리포트 (Harmony & Style) */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-black text-slate-800 dark:text-white text-xl flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">🤝</span>
                      두 기질의 화학 반응 분석
                    </h3>
                  </div>

                  {harmonyAiReport ? (
                    <div className="relative group">
                      <div className={`space-y-8 animate-fade-in-up transition-all duration-1000 ${!isPaid ? 'blur-xl grayscale opacity-40 pointer-events-none select-none' : ''}`}>
                        {/* 관계 타이틀 및 점수 */}
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 shadow-xl border-b-8 border-green-500 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-8 text-7xl font-black opacity-5">MATCH</div>
                          <div className="flex justify-between items-start mb-6">
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Our Harmony Name</span>
                              <h4 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                                {harmonyAiReport.harmonyTitle}
                              </h4>
                            </div>
                            <div className="text-right">
                              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Fit Score</span>
                              <span className="text-4xl font-black text-green-500">{harmonyAiReport.compatibilityScore}%</span>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-keep font-medium">
                            {harmonyAiReport.dynamics?.description}
                          </p>
                        </div>

                        {/* 시너지 & 갈등 포인트 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-green-50 dark:bg-green-900/10 rounded-[2rem] p-7 border border-green-100 dark:border-green-800/50">
                            <h5 className="font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                              <span>✨</span> 우리만의 시너지
                            </h5>
                            <p className="text-[13px] text-green-800/70 dark:text-green-300/60 leading-relaxed break-keep">
                              {harmonyAiReport.dynamics?.synergy}
                            </p>
                          </div>
                          <div className="bg-rose-50 dark:bg-rose-900/10 rounded-[2rem] p-7 border border-rose-100 dark:border-rose-800/50">
                            <h5 className="font-bold text-rose-700 dark:text-rose-400 mb-3 flex items-center gap-2">
                              <span>⚠️</span> 조심해야 할 스파크
                            </h5>
                            <p className="text-[13px] text-rose-800/70 dark:text-rose-300/60 leading-relaxed break-keep">
                              {harmonyAiReport.dynamics?.conflictPoint}
                            </p>
                          </div>
                        </div>

                        {/* 양육 태도 진단 */}
                        <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl space-y-8 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl -mr-16 -mt-16"></div>
                          <div>
                            <span className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-2 block">Parenting Audit</span>
                            <h5 className="text-white text-xl font-black mb-4">현재 나의 양육 온도</h5>
                            <p className="text-slate-400 text-[14px] leading-relaxed break-keep border-l-2 border-green-500/30 pl-4">
                              <strong>[{harmonyAiReport.parentingAudit?.currentStyle}]</strong> {harmonyAiReport.parentingAudit?.evaluation}
                            </p>
                          </div>
                          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <h6 className="text-green-400 text-xs font-black uppercase mb-2">Key Adjustment</h6>
                            <p className="text-white/80 text-[13px] leading-relaxed break-keep">
                              {harmonyAiReport.parentingAudit?.adjustment}
                            </p>
                          </div>
                        </div>

                        {/* 실전 액션 플랜 - 웹 요약형 */}
                        <div className="space-y-6 relative">
                          <div className="flex items-center justify-between px-4">
                            <h5 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Action Plans</h5>
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">APP ONLY</span>
                          </div>

                          {/* 첫 번째 것만 샘플로 보여주고 나머지는 앱 유도 */}
                          {harmonyAiReport.actionPlans?.slice(0, 1).map((plan: any, idx: number) => (
                            <div key={idx} className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 shadow-lg border border-slate-100 dark:border-slate-700 relative group overflow-hidden opacity-90">
                              <h6 className="text-lg font-black text-slate-800 dark:text-white mb-2">{plan.title}</h6>
                              <p className="text-[14px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4 break-keep">{plan.desc}</p>
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-900 text-primary text-[11px] font-bold">
                                기대 효과: {plan.expect}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 마지막 한마디 */}
                        <div className="text-center py-10 px-6">
                          <div className="text-4xl mb-4">🏠</div>
                          <p className="text-slate-800 dark:text-white text-xl font-black leading-snug break-keep max-w-[280px] mx-auto">
                            "{harmonyAiReport.summaryQuote}"
                          </p>
                        </div>
                      </div>

                      {!isPaid && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4">
                          <div className="w-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-green-200 text-center animate-in zoom-in-95 duration-500 space-y-6">
                            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto text-4xl mb-2">🤝</div>
                            <div className="space-y-2">
                              <h4 className="text-2xl font-black text-slate-800 dark:text-white break-keep">두 기질의 완벽한 조화를 찾고 싶나요?</h4>
                              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed break-keep px-4">
                                아이와 부모의 기질이 만났을 때 생기는<br />
                                특유의 역동성과 관계 해법을 분석해 드립니다.
                              </p>
                            </div>
                            <div className="pt-4 space-y-4">
                              <Button onClick={() => router.push('/payment')} variant="primary" fullWidth className="h-16 rounded-2xl font-black text-lg bg-green-600 shadow-xl shadow-green-200 hover:bg-green-700">
                                990원에 조화 분석 열기
                              </Button>
                              <p className="text-[10px] text-slate-400 font-medium">서로의 결을 맞추는 것이 행복한 육아의 지름길입니다</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-10 text-center space-y-6 shadow-xl border border-green-500/10">
                      <div className="w-20 h-20 mx-auto bg-green-50 rounded-full flex items-center justify-center text-3xl">
                        🖇️
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-800 dark:text-white">두 사람을 위한 기질 맞춤 리포트</h4>
                        <p className="text-sm text-slate-500 leading-relaxed break-keep">
                          아이와 부모의 기질이 만났을 때 생기는<br />
                          특유의 역동성과 솔루션을 1인칭으로 분석합니다.
                        </p>
                      </div>
                      <Button
                        onClick={generateHarmonyAIReport}
                        variant="primary"
                        fullWidth
                        className="h-14 rounded-2xl bg-green-600 hover:bg-green-700"
                        disabled={isGenerating}
                      >
                        {isGenerating ? '조화 분석 구성 중...' : '맞춤 양육 시너지 분석하기'}
                      </Button>
                    </div>
                  )}
                </section>

                {/* Footer Actions & App Nudge */}
                <div className="space-y-8 pt-10 pb-16">
                  {/* App Download Nudge - 프리미엄 경험 강조 */}
                  <div className="px-2">
                    <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-[3rem] p-8 text-center relative overflow-hidden shadow-2xl">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-3xl -mr-32 -mt-32"></div>
                      <div className="relative z-10 space-y-6">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto backdrop-blur-md border border-white/20">
                          <span className="text-3xl animate-bounce-subtle">✨</span>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-black text-white leading-tight">
                            21일 맞춤형<br />실천 플랜이 생성되었습니다
                          </h3>
                          <p className="text-slate-300 text-[13px] leading-relaxed px-4 break-keep">
                            {intake.childName || '아이'}의 기질에 딱 맞는 매일의 대화 처방과<br />발달 변화 기록까지, 이제 앱에서 시작하세요.
                          </p>
                        </div>
                        <div className="pt-2 space-y-3">
                          <Button
                            variant="primary"
                            fullWidth
                            className="h-14 rounded-2xl bg-white text-slate-900 font-black text-base shadow-xl"
                            onClick={() => window.open('https://aina.garden/app', '_blank')}
                          >
                            앱 설치하고 실천 아이템 받기
                          </Button>
                          <p className="text-[10px] text-white/30 uppercase tracking-widest font-black">
                            Available on iOS & Android
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 text-center px-4">
                    <Button variant="secondary" onClick={() => router.push('/share')} fullWidth className="h-14 rounded-2xl border-none bg-white shadow-lg text-slate-800 font-bold">
                      결과 공유하고 할인권 받기
                    </Button>
                    <Link href="/" className="text-slate-400 text-sm font-bold hover:text-primary transition-colors">
                      홈으로 돌아가기
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
        <BottomNav />
      </div>

      {isChildOnly && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-md mx-auto">
            <div className="m-3 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-slate-50 px-5 py-3 border-b border-slate-100">
                <p className="text-[11px] font-bold text-primary text-center">
                  🔬 부모님 기질까지 추가하면 더 정밀해져요
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[12px] text-slate-500 text-center mb-3 leading-relaxed">
                  두 기질의 <strong className="text-slate-700">조화 지수(GHI)</strong>와 <strong className="text-slate-700">맞춤 양육 솔루션</strong>을<br />지금 바로 확인해 보세요.
                </p>
                <button
                  onClick={() => router.push('/survey?type=PARENT')}
                  className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <span>부모님 기질 검사 이어하기</span>
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
              </div>
            </div>
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

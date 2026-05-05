'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/db';
import { useLocale } from '@/i18n/LocaleProvider';
import { childNamePossessive } from '@/lib/koreanUtils';

type TemperamentScores = { NS: number; HA: number; RD: number; P: number };
type InsightItem = { scene: string; content: string };
type ParentingTip = { situation: string; tips?: string[] };
type ScriptItem = { situation: string; script: string; guide: string };
type SharedAnalysis = {
  label?: string;
  desc?: string;
  intro?: string;
  scores?: TemperamentScores;
  analysis?: {
    dimensions?: Record<'NS' | 'HA' | 'RD' | 'P', string | undefined>;
    insight?: string | InsightItem[];
    strengths?: string;
  };
  parentingTips?: ParentingTip[];
  scripts?: ScriptItem[];
};

interface SharedReport {
  id: string;
  type: string;
  analysis: SharedAnalysis;
  createdAt: string;
  child: { name: string; gender: string; birth_date: string } | null;
  scores: TemperamentScores | null;
}

export default function SharedReportPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;
  const { user } = useAuth();
  const { locale, t } = useLocale();

  const [report, setReport] = useState<SharedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasOwnReport, setHasOwnReport] = useState(false);

  // Load report from public API
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/report/shared/${reportId}`);
        if (!res.ok) {
          setError(res.status === 404 ? t('shared.reportNotFound') : t('shared.reportLoadError'));
          return;
        }
        const data = await res.json();
        setReport(data);
      } catch {
        setError(t('shared.reportLoadError'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reportId, t]);

  // Check if logged-in user has their own report
  useEffect(() => {
    async function checkOwnReport() {
      if (!user) return;
      try {
        const reports = await db.getReports(user.id);
        const childReport = reports.find(r => r.type === 'CHILD');
        if (childReport) setHasOwnReport(true);
      } catch {}
    }
    checkOwnReport();
  }, [user]);

  const analysis = report?.analysis;
  const childName = report?.child?.name || t('report.child');
  const childPossessiveName = locale === 'ko' ? childNamePossessive(childName) : childName;
  const childTemperamentTypeTitle = locale === 'ko'
    ? `${childPossessiveName} 기질 유형`
    : `${childName}${t('shared.temperamentType')}`;
  const childScoreTitle = locale === 'ko'
    ? `${childPossessiveName} 기질 점수`
    : `${childName}${t('report.temperamentScores')}`;
  const scores = report?.scores || analysis?.scores;

  const childType = (() => {
    if (scores) {
      return TemperamentClassifier.analyzeChild(scores);
    }
    if (analysis?.label) {
      return { label: analysis.label, desc: analysis.desc, image: '', keywords: [], emoji: '' };
    }
    return null;
  })();

  const handleCTA = () => {
    if (hasOwnReport) {
      router.push('/report');
    } else if (user) {
      router.push('/survey');
    } else {
      router.push('/login?redirect=/survey');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-text-sub text-sm font-bold">{t('shared.loadingResult')}</p>
        </div>
      </div>
    );
  }

  if (error || !report || !childType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark px-6">
        <div className="text-center space-y-4">
          <p className="text-5xl">{'\uD83D\uDE22'}</p>
          <p className="text-text-main dark:text-white font-bold text-lg">{error || t('shared.reportNotFound')}</p>
          <Button variant="primary" onClick={() => router.push('/')}>{t('common.goHome')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
        <main className="flex-1 pb-8">
          {/* Hero Image */}
          <div className="relative">
            {childType.image && (
              <Image src={childType.image} alt={childType.label} className="w-full aspect-[4/3] object-cover" width={1200} height={900} />
            )}
            {!childType.image && (
              <div className="w-full aspect-[4/3] bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E4]" />
            )}
          </div>

          {/* Type Info */}
          <div className="dark:bg-surface-dark text-center px-6 pt-8 -mt-6 rounded-t-3xl pb-4 space-y-3 relative z-10" style={{ backgroundColor: 'var(--background-light)' }}>
            <p className="text-text-sub text-sm font-medium">{childTemperamentTypeTitle}</p>
            <h1 className="text-3xl font-black text-text-main dark:text-white tracking-tight">
              {childType.label}
            </h1>
            {childType.keywords && childType.keywords.length > 0 && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {childType.keywords.map((kw: string) => (
                  <span key={kw} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-bold">#{kw}</span>
                ))}
              </div>
            )}
            <p className="text-text-sub text-[13px] break-keep">{childType.desc}</p>
          </div>

          <div className="h-8" />

          {/* Report Content */}
          <div className="max-w-2xl mx-auto px-6 space-y-5">
            {/* 1. 아이나의 한마디 */}
            {analysis?.intro && (
              <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10">
                <p className="text-[12px] font-black text-primary mb-2.5 flex items-center gap-1.5">
                  <Icon name="chat_bubble" size="sm" /> {t('report.ainaComment')}
                </p>
                <p className="text-[15px] text-text-main dark:text-slate-300 leading-[1.85] break-keep">
                  {analysis.intro}
                </p>
              </section>
            )}

            {/* 2. 기질 점수 카드 */}
            {scores && (
              <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-6 shadow-card border border-beige-main/10 space-y-5">
                <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                  <Icon name="bar_chart" size="sm" /> {childScoreTitle}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'NS', label: t('report.noveltySeekingName'), color: '#E5A150', desc: t('report.noveltySeekingDesc') },
                    { key: 'HA', label: t('report.harmAvoidanceName'), color: '#6B9E8A', desc: t('report.harmAvoidanceDesc') },
                    { key: 'RD', label: t('report.rewardDependenceName'), color: '#7B8EC4', desc: t('report.rewardDependenceDesc') },
                    { key: 'P', label: t('report.persistenceName'), color: '#D4805E', desc: t('report.persistenceDesc') },
                  ] as const).map(dim => {
                    const score = scores[dim.key];
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
            )}

            {/* 3. 기질 요소별 해석 */}
            {analysis?.analysis?.dimensions && Object.values(analysis.analysis.dimensions).some(Boolean) && (
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
                  const text = analysis.analysis?.dimensions?.[dim.key];
                  if (!text) return null;
                  return (
                    <div key={dim.key} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{dim.icon}</span>
                        <span className="text-[12px] font-bold" style={{ color: dim.color }}>{dim.label}</span>
                        {scores && <span className="text-[12px] font-black" style={{ color: dim.color }}>{scores[dim.key]}{t('common.points')}</span>}
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
            {analysis?.analysis?.insight && (
              <section className="space-y-3">
                <p className="text-[12px] font-black text-primary flex items-center gap-1.5 px-1">
                  <Icon name="favorite" size="sm" /> {t('report.hiddenFeelings')}
                </p>
                {Array.isArray(analysis.analysis.insight) ? (
                  analysis.analysis.insight.map((item: InsightItem, idx: number) => (
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
                      {analysis.analysis.insight}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* 5. 강점과 성장 가능성 */}
            {analysis?.analysis?.strengths && (
              <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2.5">
                <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                  <Icon name="emoji_events" size="sm" /> {t('report.strengthsGrowth')}
                </p>
                <p className="text-[14px] text-text-main dark:text-slate-300 leading-[1.85] break-keep whitespace-pre-wrap">
                  {analysis.analysis.strengths}
                </p>
              </section>
            )}

            {/* 6. 양육 가이드 */}
            {analysis?.parentingTips && analysis.parentingTips.length > 0 && (
              <section className="space-y-3">
                <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                  <Icon name="lightbulb" size="sm" /> {t('report.parentingGuide')}
                </p>
                {analysis.parentingTips.map((tip: ParentingTip, idx: number) => (
                  <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10">
                    <h6 className="font-bold text-text-main dark:text-white mb-3 text-[14px]">
                      {tip.situation}
                    </h6>
                    <ul className="space-y-2.5">
                      {tip.tips?.map((tipText: string, i: number) => (
                        <li key={i} className="text-[14px] text-text-sub dark:text-slate-400 flex gap-2">
                          <span className="text-primary mt-0.5 shrink-0">•</span>
                          <span className="leading-relaxed break-keep">{tipText}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            {/* 7. 마법의 한마디 */}
            {analysis?.scripts && analysis.scripts.length > 0 && (
              <section className="space-y-3">
                <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                  <Icon name="record_voice_over" size="sm" /> {t('report.magicWord')}
                </p>
                {analysis.scripts.map((s: ScriptItem, idx: number) => (
                  <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2">
                    <p className="text-[12px] font-bold text-text-sub">{s.situation}</p>
                    <p className="text-[16px] font-black text-primary leading-snug break-keep">&ldquo;{s.script.replace(/^[""\u201C]+|[""\u201D]+$/g, '')}&rdquo;</p>
                    <p className="text-[13px] text-text-sub leading-relaxed break-keep">{s.guide}</p>
                  </div>
                ))}
              </section>
            )}

            {/* 분석 날짜 */}
            {report.createdAt && (
              <p className="text-[11px] text-text-sub/50 text-center pt-4">
                {new Date(report.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} {t('common.analysis')}
              </p>
            )}
          </div>

          {/* CTA Section */}
          <div className="max-w-2xl mx-auto px-6 pt-10 pb-12">
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 rounded-2xl p-6 border border-primary/10 text-center space-y-4">
              <p className="text-3xl">{'\u2728'}</p>
              <h3 className="text-lg font-black text-text-main dark:text-white break-keep leading-snug">
                {t('shared.ctaTitle')}
              </h3>
              <p className="text-[13px] text-text-sub dark:text-gray-400 leading-relaxed break-keep">
                {t('shared.ctaDesc')}
              </p>
              <Button
                variant="primary"
                fullWidth
                className="h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
                onClick={handleCTA}
              >
                {hasOwnReport ? t('shared.viewMyResult') : t('shared.tryTest')}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

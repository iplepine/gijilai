'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/db';
import { useLocale } from '@/i18n/LocaleProvider';
import { childNamePossessive } from '@/lib/koreanUtils';
import {
  buildSharedReportSummary,
  getParentSectionContent,
  parseSharedAnalysis,
  type HarmonyPairAnalysis,
  type HarmonyPrinciple,
  type HarmonySituationalTip,
  type InsightItem,
  type ParentSceneItem,
  type ParentSolution,
  type ParentingTip,
  type ScriptItem,
} from '@/lib/shareReport';

interface SharedReport {
  id: string;
  type: string;
  analysis: unknown;
  createdAt: string;
  child: { name: string; gender: string; birth_date: string } | null;
  scores: unknown;
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

  const analysis = parseSharedAnalysis(report?.analysis);
  const childName = report?.child?.name || t('report.child');
  const summary = report
    ? buildSharedReportSummary({
      type: report.type,
      analysis,
      scores: report.scores,
      childName,
      locale,
      t,
    })
    : null;
  const scores = summary?.scores;
  const parentShining = getParentSectionContent(analysis, 'shining') || analysis?.shining;
  const parentVulnerability = getParentSectionContent(analysis, 'vulnerability') || analysis?.vulnerability;
  const childScoreTitle = locale === 'ko'
    ? `${childNamePossessive(childName)} 기질 점수`
    : `${childName}${t('report.temperamentScores')}`;

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

  if (error || !report || !summary || !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark px-6">
        <div className="w-full max-w-md min-h-screen flex items-center justify-center">
          <div className="w-full text-center space-y-4">
            <p className="text-5xl">{'\uD83D\uDE22'}</p>
            <p className="text-text-main dark:text-white font-bold text-lg">{error || t('shared.reportNotFound')}</p>
            <div className="flex justify-center">
              <Button variant="primary" onClick={() => router.push('/')}>{t('common.goHome')}</Button>
            </div>
          </div>
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
            {summary.image && (
              <Image src={summary.image} alt={summary.label} className="w-full aspect-[4/3] object-cover" width={1200} height={900} />
            )}
            {!summary.image && (
              <div className="w-full aspect-[4/3] bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E4]" />
            )}
          </div>

          {/* Type Info */}
          <div className="dark:bg-surface-dark text-center px-6 pt-8 -mt-6 rounded-t-3xl pb-4 space-y-3 relative z-10" style={{ backgroundColor: 'var(--background-light)' }}>
            <p className="text-text-sub text-sm font-medium">{summary.eyebrow}</p>
            <h1 className="text-3xl font-black text-text-main dark:text-white tracking-tight">
              {summary.label}
            </h1>
            {summary.keywords.length > 0 && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {summary.keywords.map((kw: string) => (
                  <span key={kw} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-bold">#{kw}</span>
                ))}
              </div>
            )}
            <p className="text-text-sub text-[13px] break-keep">{summary.description}</p>
          </div>

          <div className="h-8" />

          {/* Report Content */}
          <div className="max-w-2xl mx-auto px-6 space-y-5">
            {summary.type === 'CHILD' && (
              <>
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
              </>
            )}

            {summary.type === 'PARENT' && (
              <>
                {analysis.intro && (
                  <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10">
                    <p className="text-[12px] font-black text-primary mb-2.5 flex items-center gap-1.5">
                      <Icon name="chat_bubble" size="sm" /> {t('report.ainaComment')}
                    </p>
                    <p className="text-[15px] text-text-main dark:text-slate-300 leading-[1.85] break-keep">
                      {analysis.intro}
                    </p>
                  </section>
                )}

                {scores && (
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

                {analysis.dimensions && Object.values(analysis.dimensions).some(Boolean) && (
                  <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-4">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                      <Icon name="psychology" size="sm" /> {t('report.dimensionAnalysis')}
                    </p>
                    {([
                      { key: 'NS', label: t('report.noveltySeekingName'), color: '#E5A150' },
                      { key: 'HA', label: t('report.harmAvoidanceName'), color: '#6B9E8A' },
                      { key: 'RD', label: t('report.rewardDependenceName'), color: '#7B8EC4' },
                      { key: 'P', label: t('report.persistenceName'), color: '#D4805E' },
                    ] as const).map(dim => {
                      const text = analysis.dimensions?.[dim.key];
                      if (!text) return null;
                      return (
                        <div key={dim.key} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold" style={{ color: dim.color }}>{dim.label}</span>
                            {scores && <span className="text-[12px] font-black" style={{ color: dim.color }}>{scores[dim.key]}{t('common.points')}</span>}
                          </div>
                          <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.8] break-keep">
                            {text}
                          </p>
                        </div>
                      );
                    })}
                  </section>
                )}

                {parentShining && (
                  <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2.5">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                      <Icon name="auto_awesome" size="sm" /> {t('report.shiningMoment')}
                    </p>
                    <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep whitespace-pre-wrap">{parentShining}</p>
                  </section>
                )}

                {analysis.parentingStyle && analysis.parentingStyle.length > 0 && (
                  <section className="space-y-3">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                      <Icon name="child_care" size="sm" /> {t('report.parentingTemperament')}
                    </p>
                    {analysis.parentingStyle.map((item: ParentSceneItem, idx: number) => (
                      <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2">
                        <p className="text-[11px] font-black text-primary/70">{item.scene}</p>
                        <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep">{item.content}</p>
                      </div>
                    ))}
                  </section>
                )}

                {parentVulnerability && (
                  <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2.5">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                      <Icon name="battery_alert" size="sm" /> {t('report.energyWarning')}
                    </p>
                    <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep whitespace-pre-wrap">{parentVulnerability}</p>
                  </section>
                )}

                {analysis.solutions && analysis.solutions.length > 0 && (
                  <section className="space-y-3">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                      <Icon name="spa" size="sm" /> {t('report.mindNutrient')}
                    </p>
                    {analysis.solutions.map((solution: ParentSolution, idx: number) => (
                      <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-2">
                        <p className="text-[14px] font-black text-primary">{solution.name}</p>
                        <p className="text-[14px] text-text-main dark:text-slate-300 leading-relaxed break-keep">{solution.action}</p>
                        <p className="text-[12px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">{solution.reason}</p>
                      </div>
                    ))}
                  </section>
                )}

                {analysis.letter && (
                  <section className="bg-rose-50 dark:bg-rose-950/20 rounded-2xl px-6 py-5 shadow-card border border-rose-100 dark:border-rose-900/30 space-y-3">
                    <p className="text-[12px] font-black text-rose-500 flex items-center gap-1.5">
                      <Icon name="mail" size="sm" /> {t('report.ainaLetter')}
                    </p>
                    <p className="text-[14px] text-text-main dark:text-slate-300 leading-[1.9] break-keep whitespace-pre-wrap italic">{analysis.letter}</p>
                  </section>
                )}
              </>
            )}

            {summary.type === 'HARMONY' && (
              <>
                {typeof analysis.compatibilityScore === 'number' && (
                  <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-6 shadow-card border border-beige-main/10 text-center space-y-2">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center justify-center gap-1.5">
                      <Icon name="favorite" size="sm" /> {t('report.parentChildMatch')}
                    </p>
                    <p className="text-4xl font-black text-primary">{analysis.compatibilityScore}%</p>
                    {analysis.oneLiner && (
                      <p className="text-[14px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">{analysis.oneLiner}</p>
                    )}
                  </section>
                )}

                {([analysis.coreGap, analysis.coreMatch].filter(Boolean) as HarmonyPairAnalysis[]).map((item, idx) => (
                  <section key={`${item.label}-${idx}`} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-3">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                      <Icon name={idx === 0 ? 'compare_arrows' : 'diversity_1'} size="sm" /> {idx === 0 ? t('report.coreGap') : t('report.coreMatch')}
                    </p>
                    {item.label && <p className="text-[14px] font-black text-primary">{item.label}</p>}
                    {typeof item.childScore === 'number' && typeof item.parentScore === 'number' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-background-light dark:bg-background-dark p-3">
                          <p className="text-[11px] font-bold text-text-sub">{t('report.child')}</p>
                          <p className="text-xl font-black text-primary">{item.childScore}</p>
                        </div>
                        <div className="rounded-xl bg-background-light dark:bg-background-dark p-3">
                          <p className="text-[11px] font-bold text-text-sub">{t('report.parent')}</p>
                          <p className="text-xl font-black text-secondary">{item.parentScore}</p>
                        </div>
                      </div>
                    )}
                    {item.insight && <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep">{item.insight}</p>}
                    {item.reframe && <p className="text-[14px] text-text-main dark:text-slate-300 leading-[1.85] break-keep">{item.reframe}</p>}
                    {item.strength && <p className="text-[14px] text-text-main dark:text-slate-300 leading-[1.85] break-keep">{item.strength}</p>}
                  </section>
                ))}

                {analysis.parentingPrinciples && analysis.parentingPrinciples.length > 0 && (
                  <section className="space-y-3">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                      <Icon name="school" size="sm" /> {t('report.parentingPrinciples')}
                    </p>
                    {analysis.parentingPrinciples.map((principle: HarmonyPrinciple, idx: number) => (
                      <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-3">
                        <p className="text-[14px] font-black text-primary">{principle.title}</p>
                        <p className="text-[13px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">{principle.why}</p>
                        <div className="grid gap-2">
                          <p className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-[13px] text-emerald-700 dark:text-emerald-300 leading-relaxed break-keep">DO: {principle.do}</p>
                          <p className="rounded-xl bg-rose-50 dark:bg-rose-950/20 px-4 py-3 text-[13px] text-rose-700 dark:text-rose-300 leading-relaxed break-keep">DON&apos;T: {principle.dont}</p>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {analysis.situationalTips && analysis.situationalTips.length > 0 && (
                  <section className="space-y-3">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5 px-1">
                      <Icon name="tips_and_updates" size="sm" /> {t('report.situationalTips')}
                    </p>
                    {analysis.situationalTips.map((tip: HarmonySituationalTip, idx: number) => (
                      <div key={idx} className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-3">
                        <p className="text-[14px] font-black text-text-main dark:text-white">{tip.situation}</p>
                        <p className="text-[13px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">{tip.childFeeling}</p>
                        <p className="text-[13px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">{tip.parentTrap}</p>
                        <p className="text-[13px] text-text-main dark:text-slate-300 leading-relaxed break-keep">{tip.betterResponse}</p>
                        <p className="text-[15px] font-black text-primary leading-snug break-keep">&ldquo;{tip.script.replace(/^[""\u201C]+|[""\u201D]+$/g, '')}&rdquo;</p>
                      </div>
                    ))}
                  </section>
                )}

                {analysis.parentingAudit && (
                  <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-5 shadow-card border border-beige-main/10 space-y-3">
                    <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
                      <Icon name="tune" size="sm" /> {t('report.parentingStyleDiag')}
                    </p>
                    {analysis.parentingAudit.currentStyle && (
                      <span className="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-black">{analysis.parentingAudit.currentStyle}</span>
                    )}
                    {analysis.parentingAudit.evaluation && (
                      <p className="text-[14px] text-text-sub dark:text-slate-400 leading-[1.85] break-keep">{analysis.parentingAudit.evaluation}</p>
                    )}
                    {analysis.parentingAudit.adjustment && (
                      <p className="text-[14px] text-text-main dark:text-slate-300 leading-[1.85] break-keep">{analysis.parentingAudit.adjustment}</p>
                    )}
                  </section>
                )}

                {analysis.dailyReminder && (
                  <section className="bg-primary text-white rounded-2xl px-6 py-5 shadow-card space-y-2">
                    <p className="text-[12px] font-black text-white/70 flex items-center gap-1.5">
                      <Icon name="sticky_note_2" size="sm" /> {t('report.dailyReminder')}
                    </p>
                    <p className="text-xl font-black leading-snug break-keep">{analysis.dailyReminder}</p>
                  </section>
                )}
              </>
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

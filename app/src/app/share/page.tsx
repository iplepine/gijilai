'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { Navbar } from '@/components/layout/Navbar';

import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, ReportData, ChildProfile } from '@/lib/db';
import { TemperamentScorer } from '@/lib/TemperamentScorer';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { CHILD_QUESTIONS } from '@/data/questions';
import { eunNeun } from '@/lib/koreanUtils';
import { Suspense } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';
import type { Json } from '@/types/supabase';

type SharedAnalysis = {
  label?: string;
  desc?: string;
  intro?: string;
  scores?: { NS: number; HA: number; RD: number; P: number };
  analysis?: {
    strengths?: string;
  };
};

function parseAnalysis(value: Json | null): SharedAnalysis | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as unknown as SharedAnalysis;
}

function SharePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { intake, cbqResponses } = useAppStore();
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  // DB-loaded data
  const [report, setReport] = useState<ReportData | null>(null);
  const [child, setChild] = useState<ChildProfile | null>(null);

  const reportId = searchParams.get('id');

  const getNativeShareBridge = () => {
    if (typeof window === 'undefined') return null;
    return (window as Window & { ShareBridge?: { postMessage: (message: string) => void } }).ShareBridge || null;
  };

  const isMobileOrApp = () => {
    if (typeof navigator === 'undefined') return false;
    return /gijilai_app|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  };

  // Load report from DB if reportId is provided
  useEffect(() => {
    async function loadReport() {
      if (!reportId || !user) return;
      try {
        const reports = await db.getReports(user.id);
        const found = reports.find(r => r.id === reportId);
        if (found) {
          setReport(found);
          if (found.child_id) {
            const children = await db.getChildren(user.id);
            const foundChild = children.find(c => c.id === found.child_id);
            if (foundChild) setChild(foundChild);
          }
        }
      } catch (e) {
        console.error('Failed to load report:', e);
      }
    }
    loadReport();
  }, [reportId, user]);

  const canShareToOtherApps = useSyncExternalStore(
    () => () => undefined,
    () => isMobileOrApp() && (!!getNativeShareBridge() || !!navigator.share),
    () => false,
  );

  const childName = child?.name || intake.childName || t('share.defaultChildName');

  const referralCode = 'GIJILAI-' + (user?.id?.substring(0, 8) || 'FRIEND');

  // Initialize Kakao
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (!key) {
          console.warn('NEXT_PUBLIC_KAKAO_JS_KEY is not configured');
          return;
        }
        window.Kakao.init(key);
      }
    }
  }, []);

  // Calculate Temperament from DB report or local store
  const temperamentInfo = (() => {
    if (report?.analysis_json) {
      const analysis = parseAnalysis(report.analysis_json);
      if (analysis && analysis.label && analysis.desc) {
        if (analysis.scores) {
          const classified = TemperamentClassifier.analyzeChild(analysis.scores);
          return { label: analysis.label, desc: analysis.desc, image: classified.image, intro: analysis.intro, strengths: analysis.analysis?.strengths };
        }
        return { label: analysis.label, desc: analysis.desc, image: '', intro: analysis.intro, strengths: analysis.analysis?.strengths };
      }
    }

    if (!cbqResponses || Object.keys(cbqResponses).length === 0) return null;
    const scores = TemperamentScorer.calculate(CHILD_QUESTIONS, cbqResponses);
    const classified = TemperamentClassifier.analyzeChild(scores);
    return { label: classified.label, desc: classified.desc, image: classified.image, intro: undefined, strengths: undefined };
  })();

  const getShareUrl = () => {
    if (reportId) return `${window.location.origin}/shared/${reportId}`;
    return `${window.location.origin}?ref=${referralCode}`;
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKakaoShare = () => {
    if (!window.Kakao) return;

    const shareUrl = getShareUrl();

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${eunNeun(childName)} "${temperamentInfo?.label || '열정 탐험가'}"`,
        description: temperamentInfo?.intro
          ? `${temperamentInfo.desc}\n\n${temperamentInfo.intro}`.slice(0, 200)
          : temperamentInfo?.desc || t('share.kakaoDesc'),
        imageUrl: `https://gijilai.com${temperamentInfo?.image || '/child_type/type_lhl.jpg'}`,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
      buttons: [
        {
          title: t('share.tryTest'),
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
      ],
    });
  };

  const handleNativeShare = async () => {
    const sharePayload = {
      title: `${childName}${t('share.resultTitle')}`,
      text: [
        `${eunNeun(childName)} "${temperamentInfo?.label || '열정 탐험가'}"`,
        temperamentInfo?.desc,
        temperamentInfo?.intro,
        temperamentInfo?.strengths,
      ].filter(Boolean).join('\n\n'),
      url: getShareUrl(),
    };

    const bridge = getNativeShareBridge();
    if (bridge) {
      bridge.postMessage(JSON.stringify({ type: 'SHARE_REQUEST', ...sharePayload }));
      return;
    }

    try {
      if (!navigator.share) {
        await handleCopyCode();
        return;
      }
      await navigator.share(sharePayload);
    } catch {
      // User cancelled share - ignore
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl relative">
        <Navbar title={t('share.title')} showBack onBackClick={() => router.back()} />

        <main className="flex-1 px-6 py-8 space-y-8 pb-24">
          {/* 결과 카드 */}
          <div className="rounded-2xl overflow-hidden bg-white dark:bg-surface-dark shadow-card border border-primary/5 dark:border-white/5">
            <div
              className="w-full aspect-[4/5] bg-cover bg-center relative"
              style={{
                backgroundImage: `url("${temperamentInfo?.image || '/child_type/type_lhl.jpg'}")`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-7">
                <h3 className="text-2xl font-bold text-white mb-2 break-keep leading-snug">
                  {eunNeun(childName)}<br />
                  <span style={{ color: '#A8D8B9' }}>&quot;{temperamentInfo?.label || '열정 탐험가'}&quot;</span>
                </h3>
                <p className="text-sm text-white/80 leading-relaxed font-medium break-keep">
                  {temperamentInfo?.desc || t('share.defaultDesc')}
                </p>
                <div className="mt-5 pt-4 border-t border-white/20">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-white/40">{t('common.appName')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 공유 버튼들 */}
          <div className="space-y-3">
            <button
              onClick={handleKakaoShare}
              className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] active:scale-[0.98] transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 256 256"><path d="M128 36C70.6 36 24 72.4 24 116.8c0 28.9 19.2 54.2 48.1 68.6l-9.8 36.2c-.8 2.9 2.6 5.2 5.1 3.5l42.5-28.4c5.9.8 12 1.3 18.1 1.3 57.4 0 104-36.4 104-80.8S185.4 36 128 36z" fill="#191919"/></svg>
              {t('share.shareKakao')}
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleCopyCode}
                className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold active:scale-[0.98] transition-all border ${copied ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 text-text-sub'}`}
              >
                <span className="material-symbols-outlined text-[20px]">{copied ? 'check' : 'link'}</span>
                {copied ? t('share.copied') : t('share.copyLink')}
              </button>
              {canShareToOtherApps && (
                <button
                  onClick={handleNativeShare}
                  className="flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-text-sub active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">share</span>
                  {t('share.otherApps')}
                </button>
              )}
            </div>
          </div>

          {/* 안내 문구 */}
          <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-5 border border-primary/10">
            <p className="text-[13px] text-text-sub dark:text-gray-400 leading-relaxed break-keep text-center">
              {t('share.shareNotice')}<br />
              <strong className="text-text-main dark:text-white">{t('share.shareNoticeBold')}</strong>{t('share.shareNoticeEnd')}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
      <SharePageContent />
    </Suspense>
  );
}

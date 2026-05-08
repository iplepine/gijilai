'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { Navbar } from '@/components/layout/Navbar';

import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { TemperamentScorer } from '@/lib/TemperamentScorer';
import { CHILD_QUESTIONS } from '@/data/questions';
import { Suspense } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent } from '@/lib/analytics';
import type { Json } from '@/types/supabase';
import { supabase } from '@/lib/supabase';
import {
  buildCompactShareText,
  buildSharedReportSummary,
  parseSharedAnalysis,
  type SharedReportSummary,
  type TemperamentScores,
} from '@/lib/shareReport';

type ShareSummary = SharedReportSummary & {
  intro?: string;
  strengths?: string;
};

type SharedReport = {
  id: string;
  type: string;
  analysis: Json | null;
  createdAt: string;
  child: { name: string; gender: string; birth_date: string } | null;
  scores: Json | null;
};

const KAKAO_SDK_SCRIPT_ID = 'kakao-js-sdk';
const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js';
const KAKAO_SDK_LOAD_TIMEOUT_MS = 8000;
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || 'a2f3421d6022ef27e61c610c4b8ad025';

let kakaoSdkPromise: Promise<void> | null = null;

function getKakaoSdkScript(): HTMLScriptElement | null {
  return (
    document.getElementById(KAKAO_SDK_SCRIPT_ID) as HTMLScriptElement | null
  ) ?? document.querySelector<HTMLScriptElement>('script[src*="kakao_js_sdk"]');
}

function loadKakaoSdk(): Promise<void> {
  if (window.Kakao) return Promise.resolve();
  if (kakaoSdkPromise) return kakaoSdkPromise;

  kakaoSdkPromise = new Promise<void>((resolve, reject) => {
    const existingScript = getKakaoSdkScript();
    const script = existingScript ?? document.createElement('script');
    let timeoutId: number | null = null;

    function cleanup() {
      if (timeoutId) window.clearTimeout(timeoutId);
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    }

    function handleLoad() {
      cleanup();
      resolve();
    }

    function handleError() {
      cleanup();
      kakaoSdkPromise = null;
      reject(new Error('Kakao SDK failed to load'));
    }

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      script.id = KAKAO_SDK_SCRIPT_ID;
      script.src = KAKAO_SDK_URL;
      script.async = true;
      document.head.appendChild(script);
    }

    timeoutId = window.setTimeout(() => {
      cleanup();
      kakaoSdkPromise = null;
      reject(new Error('Kakao SDK load timed out'));
    }, KAKAO_SDK_LOAD_TIMEOUT_MS);
  });

  return kakaoSdkPromise;
}

async function ensureKakaoReady() {
  await loadKakaoSdk();

  const kakao = window.Kakao;
  if (!kakao) {
    kakaoSdkPromise = null;
    throw new Error('Kakao SDK is unavailable after loading');
  }

  if (!kakao.isInitialized()) {
    kakao.init(KAKAO_JS_KEY);
  }

  return kakao;
}

function logShareDebug(event: string, details: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  console.info(`[share-debug] ${event}`, details);
}

function buildKakaoExecutionParams(path: string) {
  return new URLSearchParams({ path }).toString();
}

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
};

function getNavigatorPlatformValues() {
  if (typeof navigator === 'undefined') return [];

  const nav = navigator as NavigatorWithUserAgentData;
  return [nav.userAgentData?.platform, navigator.platform]
    .filter((value): value is string => !!value)
    .map((value) => value.toLowerCase());
}

function isIpadOsRuntime() {
  if (typeof navigator === 'undefined') return false;

  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const userAgent = navigator.userAgent;
  const hasMacPlatform = getNavigatorPlatformValues().some((platform) =>
    platform.includes('mac'),
  );

  return hasMacPlatform && maxTouchPoints > 1 && /Macintosh|Mac OS/i.test(userAgent);
}

function isLikelyDesktopRuntime() {
  if (typeof navigator === 'undefined') return false;
  if (isIpadOsRuntime()) return false;

  const hasDesktopPlatform = getNavigatorPlatformValues().some((platform) =>
    platform.includes('win') ||
    platform.includes('mac') ||
    platform.includes('linux x86') ||
    platform.includes('x86_64') ||
    platform.includes('x64'),
  );

  if (hasDesktopPlatform) return true;
  if (typeof window === 'undefined') return false;

  return window.outerWidth > 0 &&
    window.innerWidth > 0 &&
    window.outerWidth - window.innerWidth > 320;
}

function hasMobileKakaoUserAgent() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isIpadOsRuntime();
}

function isDesktopMobileEmulation() {
  if (typeof navigator === 'undefined') return false;
  if (/gijilai_app/i.test(navigator.userAgent)) return false;
  return isLikelyDesktopRuntime() && hasMobileKakaoUserAgent();
}

function SharePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { intake, cbqResponses } = useAppStore();
  const { t, locale } = useLocale();
  const reportId = searchParams.get('id');
  const entrySource = searchParams.get('source') ?? 'direct';
  const entryCta = searchParams.get('entry_cta') ?? undefined;
  const reportKindParam = searchParams.get('report_kind') ?? undefined;
  const [copied, setCopied] = useState(false);
  const [isKakaoSharing, setIsKakaoSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isResolvingReportId, setIsResolvingReportId] = useState(!reportId);
  const [isReportLoading, setIsReportLoading] = useState(false);

  // DB-loaded data
  const [report, setReport] = useState<SharedReport | null>(null);

  const [resolvedReportId, setResolvedReportId] = useState<string | null>(reportId);

  const getNativeShareBridge = () => {
    if (typeof window === 'undefined') return null;
    return (window as Window & { ShareBridge?: { postMessage: (message: string) => void } }).ShareBridge || null;
  };

  const getNativeKakaoShareBridge = () => {
    if (typeof window === 'undefined') return null;
    return (window as Window & { KakaoShareBridge?: { postMessage: (message: string) => void } }).KakaoShareBridge || null;
  };

  const isMobileOrApp = () => {
    if (typeof navigator === 'undefined') return false;
    if (/gijilai_app/i.test(navigator.userAgent)) return true;
    if (isLikelyDesktopRuntime()) return false;
    return hasMobileKakaoUserAgent();
  };

  // Resolve report id so that sharing from /share (without id) still links to a public report.
  useEffect(() => {
    let isActive = true;

    async function resolveReportId() {
      if (reportId) {
        setResolvedReportId(reportId);
        setIsResolvingReportId(false);
        return;
      }

      if (authLoading) {
        setIsResolvingReportId(true);
        return;
      }

      if (!user?.id) {
        setResolvedReportId(null);
        setIsResolvingReportId(false);
        return;
      }

      setIsResolvingReportId(true);
      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .eq('user_id', user.id)
        .in('type', ['CHILD', 'PARENT', 'HARMONY'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isActive) return;
      if (error || !data?.id) {
        setResolvedReportId(null);
        setIsResolvingReportId(false);
        return;
      }

      setResolvedReportId(data.id);
      setIsResolvingReportId(false);
    }

    resolveReportId();

    return () => {
      isActive = false;
    };
  }, [authLoading, reportId, user?.id]);

  // Load the exact shared report row when reportId is resolved.
  useEffect(() => {
    let isActive = true;

    async function loadReport() {
      if (!resolvedReportId) {
        setReport(null);
        setIsReportLoading(false);
        return;
      }

      setIsReportLoading(true);
      try {
        const res = await fetch(`/api/report/shared/${resolvedReportId}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Shared report load failed: ${res.status}`);
        }
        const data = await res.json();
        if (isActive) setReport(data as SharedReport);
      } catch (e) {
        console.error('Failed to load report:', e);
        if (isActive) setReport(null);
      } finally {
        if (isActive) setIsReportLoading(false);
      }
    }

    loadReport();

    return () => {
      isActive = false;
    };
  }, [resolvedReportId]);

  const canShareToOtherApps = useSyncExternalStore(
    () => () => undefined,
    () => isMobileOrApp() && (!!getNativeShareBridge() || !!navigator.share),
    () => false,
  );

  const childName = report?.child?.name || intake.childName || t('share.defaultChildName');

  // Preload Kakao so the first tap does not race the async SDK script.
  useEffect(() => {
    if (isDesktopMobileEmulation() && !getNativeKakaoShareBridge()) return;

    ensureKakaoReady().catch((error) => {
      console.warn('Kakao SDK is not ready:', error);
    });
  }, []);

  // Calculate share card from DB report or local child store fallback.
  const shareInfo: ShareSummary | null = (() => {
    if (resolvedReportId && report) {
      const analysis = parseSharedAnalysis(report.analysis);
      const summary = buildSharedReportSummary({
        type: report.type,
        analysis,
        scores: report.scores,
        childName,
        locale,
        t,
      });

      return {
        ...summary,
        intro: analysis?.intro,
        strengths: analysis?.analysis?.strengths,
      };
    }

    if (!cbqResponses || Object.keys(cbqResponses).length === 0) return null;
    const scores = TemperamentScorer.calculate(CHILD_QUESTIONS, cbqResponses) as TemperamentScores;
    return buildSharedReportSummary({
      type: 'CHILD',
      analysis: null,
      scores,
      childName,
      locale,
      t,
    });
  })();

  const getReportShareUrl = () => {
    if (!resolvedReportId) return null;
    return `${window.location.origin}/shared/${resolvedReportId}`;
  };

  const getReportSharePath = () => {
    if (!resolvedReportId) return null;
    return `/shared/${resolvedReportId}`;
  };

  const getTryTestPath = () => {
    return '/survey/intro?source=share&entry_cta=kakao_try_test';
  };

  const getTryTestUrl = () => {
    return `${window.location.origin}${getTryTestPath()}`;
  };

  const getShareAnalyticsParams = (channel: string, extra: Record<string, string | number | boolean | undefined> = {}) => ({
    channel,
    source: entrySource,
    entry_cta: entryCta,
    report_kind: reportKindParam ?? report?.type?.toLowerCase(),
    has_report_id: !!resolvedReportId,
    ...extra,
  });

  const isShareUnavailable = !isResolvingReportId && !isReportLoading && !resolvedReportId;
  const isShareActionDisabled = isResolvingReportId || isReportLoading || isShareUnavailable;

  const copyShareUrl = async () => {
    const shareUrl = getReportShareUrl();
    if (!shareUrl) throw new Error('Report share URL is unavailable');

    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = async () => {
    setShareError(null);
    await copyShareUrl();
    trackEvent('share_action_completed', getShareAnalyticsParams('link_copy'));
  };

  const handleKakaoShare = async () => {
    const shareUrl = getReportShareUrl();
    if (!shareUrl) {
      logShareDebug('kakao_missing_report_url', {
        reportId,
        resolvedReportId,
        isResolvingReportId,
        isReportLoading,
        hasReport: !!report,
        origin: window.location.origin,
        href: window.location.href,
        userAgent: navigator.userAgent,
      });
      setShareError(t('share.reportUnavailable'));
      trackEvent('share_action_failed', getShareAnalyticsParams('kakao', {
        reason: 'missing_report_id',
      }));
      return;
    }

    const sharePath = getReportSharePath();
    if (!sharePath) {
      setShareError(t('share.reportUnavailable'));
      trackEvent('share_action_failed', getShareAnalyticsParams('kakao', {
        reason: 'missing_report_path',
      }));
      return;
    }

    const tryTestUrl = getTryTestUrl();
    const tryTestPath = getTryTestPath();
    const reportExecutionParams = buildKakaoExecutionParams(sharePath);
    const tryTestExecutionParams = buildKakaoExecutionParams(tryTestPath);
    const shareDescription = shareInfo?.textParts.slice(1).join('\n\n').slice(0, 200) || t('share.kakaoDesc');
    const kakaoPayload = {
      objectType: 'feed' as const,
      content: {
        title: `${shareInfo?.headline || childName} "${shareInfo?.label || t('share.childFallbackLabel')}"`,
        description: shareDescription,
        imageUrl: `https://gijilai.com${shareInfo?.image || '/child_type/type_lhl.jpg'}`,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
          androidExecutionParams: reportExecutionParams,
          iosExecutionParams: reportExecutionParams,
        },
      },
      buttons: [
        {
          title: t('share.tryTest'),
          link: {
            mobileWebUrl: tryTestUrl,
            webUrl: tryTestUrl,
            androidExecutionParams: tryTestExecutionParams,
            iosExecutionParams: tryTestExecutionParams,
          },
        },
      ],
    };

    logShareDebug('kakao_payload', {
      reportId,
      resolvedReportId,
      shareUrl,
      sharePath,
      tryTestUrl,
      tryTestPath,
      contentLink: kakaoPayload.content.link,
      buttonLink: kakaoPayload.buttons[0]?.link,
      reportExecutionParams,
      tryTestExecutionParams,
      isResolvingReportId,
      isReportLoading,
      hasReport: !!report,
      shareInfoType: shareInfo?.type,
      origin: window.location.origin,
      href: window.location.href,
      userAgent: navigator.userAgent,
      userAgentDataPlatform: (navigator as NavigatorWithUserAgentData).userAgentData?.platform,
      browserPlatform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      isLikelyDesktopRuntime: isLikelyDesktopRuntime(),
      isDesktopMobileEmulation: isDesktopMobileEmulation(),
      isMobileOrApp: isMobileOrApp(),
    });

    const kakaoBridge = getNativeKakaoShareBridge();
    if (kakaoBridge) {
      kakaoBridge.postMessage(JSON.stringify({
        type: 'KAKAO_SHARE_REQUEST',
        title: kakaoPayload.content.title,
        description: kakaoPayload.content.description,
        imageUrl: kakaoPayload.content.imageUrl,
        shareUrl,
        sharePath,
        buttonTitle: t('share.tryTest'),
        buttonUrl: tryTestUrl,
        buttonPath: tryTestPath,
      }));
      trackEvent('share_action_completed', getShareAnalyticsParams('kakao_native_bridge'));
      return;
    }

    if (isDesktopMobileEmulation()) {
      try {
        await copyShareUrl();
        trackEvent('share_action_failed', getShareAnalyticsParams('kakao', {
          reason: 'desktop_mobile_emulation_unsupported',
          fallback_used: true,
        }));
        trackEvent('share_action_completed', getShareAnalyticsParams('link_copy', {
          fallback_from: 'kakao_desktop_mobile_emulation',
        }));
        setShareError(t('share.kakaoDesktopFallback'));
      } catch {
        trackEvent('share_action_failed', getShareAnalyticsParams('kakao', {
          reason: 'desktop_mobile_emulation_unsupported',
          fallback_used: false,
        }));
        setShareError(t('share.kakaoFailed'));
      }
      return;
    }

    setIsKakaoSharing(true);
    setShareError(null);
    try {
      const kakao = await ensureKakaoReady();
      kakao.Share.sendDefault(kakaoPayload);
      trackEvent('share_action_completed', getShareAnalyticsParams('kakao'));
    } catch (error) {
      console.error('Kakao share failed:', error);
      try {
        await copyShareUrl();
        trackEvent('share_action_failed', getShareAnalyticsParams('kakao', {
          fallback_used: true,
        }));
        trackEvent('share_action_completed', getShareAnalyticsParams('link_copy', {
          fallback_from: 'kakao',
        }));
        setShareError(t('share.kakaoFallback'));
      } catch {
        trackEvent('share_action_failed', getShareAnalyticsParams('kakao', {
          fallback_used: false,
        }));
        setShareError(t('share.kakaoFailed'));
      }
    } finally {
      setIsKakaoSharing(false);
    }
  };

  const handleNativeShare = async () => {
    const shareUrl = getReportShareUrl();
    if (!shareUrl) {
      setShareError(t('share.reportUnavailable'));
      trackEvent('share_action_failed', getShareAnalyticsParams('web_share', {
        reason: 'missing_report_id',
      }));
      return;
    }

    const sharePayload = {
      title: shareInfo?.title || `${childName}${t('share.resultTitle')}`,
      text: buildCompactShareText({
        textParts: shareInfo?.textParts,
        fallback: t('share.kakaoDesc'),
        linkPrompt: t('share.openLinkForMore'),
      }),
      url: shareUrl,
    };

    const bridge = getNativeShareBridge();
    if (bridge) {
      bridge.postMessage(JSON.stringify({ type: 'SHARE_REQUEST', ...sharePayload }));
      trackEvent('share_action_completed', getShareAnalyticsParams('native_bridge'));
      return;
    }

    try {
      if (!navigator.share) {
        await handleCopyCode();
        return;
      }
      await navigator.share(sharePayload);
      trackEvent('share_action_completed', getShareAnalyticsParams('web_share'));
    } catch (error) {
      // User cancelled share - ignore
      const isUserCancelled = error instanceof DOMException && error.name === 'AbortError';
      trackEvent(isUserCancelled ? 'share_action_cancelled' : 'share_action_failed', getShareAnalyticsParams('web_share', {
        reason: isUserCancelled ? 'user_cancelled' : 'share_error',
      }));
    }
  };

  if (reportId && isReportLoading) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
        <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl relative">
          <Navbar title={t('share.title')} showBack onBackClick={() => router.back()} />
          <div className="flex flex-1 items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl relative">
        <Navbar title={t('share.title')} showBack onBackClick={() => router.back()} />

        <main className="app-page-scroll flex-1 px-6 py-8 space-y-8">
          {/* 결과 카드 */}
          <div className="rounded-2xl overflow-hidden bg-white dark:bg-surface-dark shadow-card border border-primary/5 dark:border-white/5">
            <div
              className="w-full aspect-[4/5] bg-cover bg-center relative"
              style={{
                backgroundImage: `url("${shareInfo?.image || '/child_type/type_lhl.jpg'}")`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-7">
                <p className="text-[11px] font-black tracking-widest uppercase text-white/55 mb-2">
                  {shareInfo?.eyebrow || t('share.childReportEyebrow')}
                </p>
                <h3 className="text-2xl font-bold text-white mb-2 break-keep leading-snug">
                  {shareInfo?.headline || childName}<br />
                  <span style={{ color: '#A8D8B9' }}>&quot;{shareInfo?.label || t('share.childFallbackLabel')}&quot;</span>
                </h3>
                <p className="text-sm text-white/80 leading-relaxed font-medium break-keep">
                  {shareInfo?.description || t('share.defaultDesc')}
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
              disabled={isKakaoSharing || isShareActionDisabled}
              className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] active:scale-[0.98] transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 256 256"><path d="M128 36C70.6 36 24 72.4 24 116.8c0 28.9 19.2 54.2 48.1 68.6l-9.8 36.2c-.8 2.9 2.6 5.2 5.1 3.5l42.5-28.4c5.9.8 12 1.3 18.1 1.3 57.4 0 104-36.4 104-80.8S185.4 36 128 36z" fill="#191919"/></svg>
              {isShareUnavailable ? t('share.reportUnavailableShort') : isShareActionDisabled ? t('share.preparingShare') : isKakaoSharing ? t('share.shareKakaoLoading') : t('share.shareKakao')}
            </button>
            {shareError && (
              <p className="text-xs font-medium leading-relaxed text-red-500 dark:text-red-300 px-1">
                {shareError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCopyCode}
                disabled={isShareActionDisabled}
                className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold active:scale-[0.98] transition-all border ${copied ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 text-text-sub'}`}
              >
                <span className="material-symbols-outlined text-[20px]">{copied ? 'check' : 'link'}</span>
                {copied ? t('share.copied') : t('share.copyLink')}
              </button>
              {canShareToOtherApps && (
                <button
                  onClick={handleNativeShare}
                  disabled={isShareActionDisabled}
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
              {shareInfo?.notice.prefix || t('share.shareNotice')}<br />
              <strong className="text-text-main dark:text-white">{shareInfo?.notice.bold || t('share.shareNoticeBold')}</strong>{shareInfo?.notice.suffix || t('share.shareNoticeEnd')}
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

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HomeLogoButton } from '@/components/layout/HomeLogoButton';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { trackEvent } from '@/lib/analytics';
import {
  buildAndroidIntentUrl,
  buildAppOpenPath,
  buildAppOpenUrl,
  detectBrowserPlatform,
  GIJILAI_APP_STORE_URL,
  GIJILAI_PLAY_STORE_URL,
  buildInstallPageUrl,
  getPrimaryStoreUrl,
  isAppWebView,
  type BrowserPlatform,
} from '@/lib/install';
import { useLocale } from '@/i18n/LocaleProvider';

type StoreKey = 'app_store' | 'play_store';

function subscribeToPlatformChange() {
  return () => undefined;
}

function getBrowserPlatformSnapshot() {
  return detectBrowserPlatform();
}

function getServerPlatformSnapshot(): BrowserPlatform {
  return 'other';
}

function getBrowserOriginSnapshot() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function getServerOriginSnapshot() {
  return '';
}

function getNativeAppSnapshot() {
  return isAppWebView();
}

function getServerNativeAppSnapshot() {
  return false;
}

function getNativeAppFallbackPath(from: string | null) {
  if (from === 'pricing') return '/pricing';
  if (from === 'payment') return '/payment';
  return '/';
}

function InstallAppContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const source = searchParams.get('source') ?? 'direct';
  const entryCta = searchParams.get('entry_cta') ?? undefined;
  const reportTab = searchParams.get('report_tab') ?? undefined;
  const reportKind = searchParams.get('report_kind') ?? undefined;
  const from = searchParams.get('from');
  const [copied, setCopied] = useState(false);
  const [isOpeningApp, setIsOpeningApp] = useState(false);
  const origin = useSyncExternalStore(
    subscribeToPlatformChange,
    getBrowserOriginSnapshot,
    getServerOriginSnapshot,
  );
  const platform = useSyncExternalStore(
    subscribeToPlatformChange,
    getBrowserPlatformSnapshot,
    getServerPlatformSnapshot,
  );
  const isNativeApp = useSyncExternalStore(
    subscribeToPlatformChange,
    getNativeAppSnapshot,
    getServerNativeAppSnapshot,
  );
  const primaryStoreUrl = useMemo(() => getPrimaryStoreUrl(platform), [platform]);
  const appOpenPath = useMemo(() => buildAppOpenPath(from), [from]);
  const installPagePath = useMemo(() => {
    const params: Record<string, string | undefined> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return buildInstallPageUrl(params);
  }, [searchParams]);
  const mobileInstallUrl = origin ? `${origin}${installPagePath}` : '';
  const qrCodeUrl = mobileInstallUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(mobileInstallUrl)}`
    : '';
  const desktopStoreOptions = useMemo(() => {
    return [
      {
        key: 'app_store' as StoreKey,
        name: 'App Store',
        caption: t('install.storeIosCaption'),
        url: GIJILAI_APP_STORE_URL,
      },
      {
        key: 'play_store' as StoreKey,
        name: 'Google Play',
        caption: t('install.storeAndroidCaption'),
        url: GIJILAI_PLAY_STORE_URL,
      },
    ];
  }, [t]);

  useEffect(() => {
    if (isNativeApp) {
      router.replace(getNativeAppFallbackPath(from));
    }
  }, [from, isNativeApp, router]);

  useEffect(() => {
    if (isNativeApp) return;
    if (platform !== detectBrowserPlatform()) return;

    trackEvent('app_install_landing_viewed', {
      source,
      entry_cta: entryCta,
      report_tab: reportTab,
      report_kind: reportKind,
      platform,
    });
  }, [entryCta, isNativeApp, platform, reportKind, reportTab, source]);

  const openStore = useCallback((store: StoreKey, url: string) => {
    trackEvent('app_install_store_clicked', {
      source,
      entry_cta: entryCta,
      report_tab: reportTab,
      report_kind: reportKind,
      platform,
      store,
    });
    window.location.assign(url);
  }, [entryCta, platform, reportKind, reportTab, source]);

  const openAppWithStoreFallback = useCallback(() => {
    if (!primaryStoreUrl || platform === 'other') {
      return;
    }

    trackEvent('app_install_app_open_clicked', {
      source,
      entry_cta: entryCta,
      report_tab: reportTab,
      report_kind: reportKind,
      platform,
      target_path: appOpenPath,
    });

    setIsOpeningApp(true);
    let shouldFallback = true;
    let fallbackTimer: number | null = null;

    const cancelFallback = () => {
      shouldFallback = false;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', cancelFallback);
      window.removeEventListener('blur', cancelFallback);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) cancelFallback();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', cancelFallback, { once: true });
    window.addEventListener('blur', cancelFallback, { once: true });

    if (platform === 'android') {
      window.location.assign(buildAndroidIntentUrl(appOpenPath));
      fallbackTimer = window.setTimeout(() => {
        setIsOpeningApp(false);
        if (shouldFallback) openStore('play_store', primaryStoreUrl);
      }, 1600);
      return;
    }

    window.location.assign(buildAppOpenUrl(appOpenPath));
    fallbackTimer = window.setTimeout(() => {
      setIsOpeningApp(false);
      if (shouldFallback) openStore('app_store', primaryStoreUrl);
    }, 1400);
  }, [appOpenPath, entryCta, openStore, platform, primaryStoreUrl, reportKind, reportTab, source]);

  const copyInstallLink = useCallback(async () => {
    if (!mobileInstallUrl) return;

    try {
      await navigator.clipboard.writeText(mobileInstallUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      trackEvent('app_install_link_copied', {
        source,
        entry_cta: entryCta,
        report_tab: reportTab,
        report_kind: reportKind,
        platform,
      });
    } catch (error) {
      console.warn('Failed to copy install link:', error);
      window.prompt(t('install.copyFallbackPrompt'), mobileInstallUrl);
    }
  }, [entryCta, mobileInstallUrl, platform, reportKind, reportTab, source, t]);

  if (isNativeApp) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-text-sub">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl">
        <Navbar title={t('install.title')} showBack />

        <main className={`${platform === 'other' ? 'app-page-scroll' : 'app-fixed-cta-scroll'} flex-1 px-6 pt-7`}>
          <section className="overflow-hidden rounded-[28px] border border-primary/10 bg-white shadow-[0_22px_55px_rgba(47,79,62,0.10)] dark:border-white/10 dark:bg-surface-dark">
            <div className="relative px-6 pb-7 pt-6">
              <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(135deg,_rgba(47,79,62,0.14),_rgba(229,161,80,0.18))] dark:bg-[linear-gradient(135deg,_rgba(91,158,96,0.18),_rgba(237,170,84,0.16))]" />

              <div className="relative flex justify-center pt-2">
                <div className="flex size-20 shrink-0 items-center justify-center rounded-[24px] bg-white shadow-[0_14px_34px_rgba(47,79,62,0.16)] ring-1 ring-primary/10 dark:bg-[#252019] dark:ring-white/10">
                  <HomeLogoButton
                    className="justify-center"
                    imageClassName="rounded-2xl object-contain"
                    imageSize={54}
                    priority
                  />
                </div>
              </div>

              <div className="relative mt-8 space-y-3">
                <h2 className="text-[27px] font-black leading-[1.18] text-text-main dark:text-white">
                  {platform === 'other' ? t('install.desktopHeadline') : t('install.mobileHeadline')}
                </h2>
                <p className="text-[15px] leading-6 text-text-sub dark:text-gray-300">
                  {platform === 'other' ? t('install.desktopDescription') : t('install.mobileDescription')}
                </p>
              </div>
            </div>

            <div className="border-t border-primary/10 px-5 py-4 dark:border-white/10">
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-3 rounded-2xl bg-beige-light/70 px-4 py-4 dark:bg-white/5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/20">
                    <Icon name="payments" size="sm" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-main dark:text-white">
                      {t('install.featureSubscriptionTitle')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-text-sub dark:text-gray-300">
                      {t('install.featureSubscriptionBody')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-white px-4 py-4 dark:bg-white/5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
                    <Icon name="notifications" size="sm" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-main dark:text-white">
                      {t('install.featureReminderTitle')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-text-sub dark:text-gray-300">
                      {t('install.featureReminderBody')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {platform === 'other' && (
            <section id="install-phone-handoff" className="mt-5 rounded-[24px] border border-secondary/20 bg-[#FFF8F0] px-5 py-5 shadow-[0_16px_40px_rgba(229,161,80,0.10)] dark:border-secondary/20 dark:bg-secondary/10">
              <div className="text-center">
                <h3 className="text-[17px] font-black leading-snug text-text-main dark:text-white">
                  {t('install.qrTitle')}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-[13px] leading-5 text-text-sub dark:text-gray-300">
                  {t('install.qrDescription')}
                </p>
              </div>

              <div className="mt-5 flex justify-center">
                <div className="rounded-[24px] bg-white p-4 shadow-[0_14px_34px_rgba(47,79,62,0.12)] ring-1 ring-primary/10">
                  {qrCodeUrl ? (
                    // External QR rendering keeps the desktop handoff lightweight; copy link remains the fallback.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrCodeUrl}
                      alt={t('install.qrAlt')}
                      className="h-44 w-44"
                    />
                  ) : (
                    <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-beige-light text-xs text-text-sub">
                      {t('common.loading')}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <Button
                  variant="secondary"
                  fullWidth
                  icon={<Icon name={copied ? 'check' : 'content_copy'} size="md" />}
                  onClick={() => void copyInstallLink()}
                >
                  {copied ? t('install.copied') : t('install.copyInstallLink')}
                </Button>
                <p className="text-center text-[12px] leading-5 text-text-sub dark:text-gray-400">
                  {t('install.desktopFooterNote')}
                </p>
              </div>

              <div className="mt-5 border-t border-secondary/15 pt-4">
                <p className="text-center text-[12px] font-bold text-text-sub dark:text-gray-300">
                  {t('install.directStoreHint')}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {desktopStoreOptions.map((store) => (
                    <button
                      key={store.key}
                      type="button"
                      onClick={() => openStore(store.key, store.url)}
                      className="rounded-2xl border border-white/70 bg-white/80 px-3 py-3 text-center transition-colors hover:border-secondary/40 dark:border-white/10 dark:bg-white/5"
                    >
                      <p className="text-[13px] font-bold text-text-main dark:text-white">{store.name}</p>
                      <p className="mt-1 text-[11px] leading-4 text-text-sub dark:text-gray-300">{store.caption}</p>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {platform !== 'other' && (
            <section className="mt-5 rounded-[24px] border border-beige-main/40 bg-white/80 px-5 py-5 text-center dark:border-white/10 dark:bg-surface-dark/70">
              <h3 className="text-[17px] font-black leading-snug text-text-main dark:text-white">
                {t('install.mobileFallbackTitle')}
              </h3>
              <p className="mx-auto mt-2 max-w-xs text-[13px] leading-5 text-text-sub dark:text-gray-300">
                {t('install.mobileFallbackDescription')}
              </p>
            </section>
          )}
        </main>

        {platform !== 'other' && (
          <div className="app-fixed-cta fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-[#F9F8F6] via-[#F9F8F6]/96 to-transparent dark:from-[#161311] dark:via-[#161311]/96">
            <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-6 pt-6">
              <Button
                fullWidth
                disabled={isOpeningApp}
                icon={<Icon name="open_in_new" size="md" />}
                iconRight={<Icon name="arrow_forward" size="md" />}
                onClick={openAppWithStoreFallback}
              >
                {isOpeningApp ? t('install.openingApp') : t('install.openInstalledApp')}
              </Button>
              <p className="pb-2 text-center text-xs leading-5 text-text-sub dark:text-gray-400">
                {t('install.mobileFooterNote')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InstallAppPage() {
  return (
    <Suspense fallback={
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    }
    >
      <InstallAppContent />
    </Suspense>
  );
}

'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { trackEvent } from '@/lib/analytics';
import {
  detectBrowserPlatform,
  GIJILAI_APP_STORE_URL,
  GIJILAI_PLAY_STORE_URL,
  getPrimaryStoreUrl,
  type BrowserPlatform,
} from '@/lib/install';
import { useLocale } from '@/i18n/LocaleProvider';

function getPlatformBadge(platform: BrowserPlatform, t: (key: string) => string) {
  if (platform === 'ios') return t('install.badgeIos');
  if (platform === 'android') return t('install.badgeAndroid');
  return t('install.badgeDesktop');
}

function getPrimaryButtonLabel(platform: BrowserPlatform, t: (key: string) => string) {
  if (platform === 'ios') return t('install.openAppStore');
  if (platform === 'android') return t('install.openPlayStore');
  return t('install.chooseStore');
}

function InstallAppContent() {
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const source = searchParams.get('source') ?? 'direct';
  const entryCta = searchParams.get('entry_cta') ?? undefined;
  const platform = useMemo(() => detectBrowserPlatform(), []);
  const primaryStoreUrl = useMemo(() => getPrimaryStoreUrl(platform), [platform]);

  useEffect(() => {
    trackEvent('app_install_landing_viewed', {
      source,
      entry_cta: entryCta,
      platform,
    });
  }, [entryCta, platform, source]);

  const openStore = (store: 'app_store' | 'play_store', url: string) => {
    trackEvent('app_install_store_clicked', {
      source,
      entry_cta: entryCta,
      platform,
      store,
    });
    window.location.href = url;
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl">
        <Navbar title={t('install.title')} showBack />

        <main className="app-fixed-cta-scroll flex-1 px-6 pt-8">
          <section className="rounded-[32px] border border-primary/10 bg-[radial-gradient(circle_at_top,_rgba(122,143,110,0.16),_transparent_56%),linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(250,248,244,0.98))] px-6 py-7 shadow-[0_24px_60px_rgba(53,79,82,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,_rgba(34,36,31,0.96),_rgba(22,19,17,0.98))]">
            <div className="inline-flex items-center rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-xs font-bold text-primary dark:bg-white/10">
              {getPlatformBadge(platform, t)}
            </div>
            <div className="mt-5 space-y-3">
              <h2 className="text-[28px] font-black leading-[1.15] tracking-[-0.03em] text-text-main dark:text-white">
                {t('install.headline')}
              </h2>
              <p className="text-sm leading-6 text-text-sub dark:text-gray-300">
                {t('install.description')}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <div className="rounded-3xl border border-primary/10 bg-white/80 px-4 py-4 dark:bg-white/5">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon name="smartphone" size="sm" />
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
              </div>

              <div className="rounded-3xl border border-primary/10 bg-white/80 px-4 py-4 dark:bg-white/5">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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

          <section className="mt-5 rounded-[28px] border border-beige-main/20 bg-white/80 px-5 py-5 dark:bg-surface-dark/70">
            <h3 className="text-sm font-bold text-text-main dark:text-white">
              {t('install.availableStores')}
            </h3>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => openStore('app_store', GIJILAI_APP_STORE_URL)}
                className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left transition-colors hover:border-primary/30 dark:border-white/10 dark:bg-white/5"
              >
                <div>
                  <p className="text-sm font-bold text-text-main dark:text-white">App Store</p>
                  <p className="mt-1 text-xs text-text-sub dark:text-gray-300">{t('install.storeIosCaption')}</p>
                </div>
                <Icon name="arrow_forward_ios" className="text-text-sub text-sm" />
              </button>

              <button
                type="button"
                onClick={() => openStore('play_store', GIJILAI_PLAY_STORE_URL)}
                className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left transition-colors hover:border-primary/30 dark:border-white/10 dark:bg-white/5"
              >
                <div>
                  <p className="text-sm font-bold text-text-main dark:text-white">Google Play</p>
                  <p className="mt-1 text-xs text-text-sub dark:text-gray-300">{t('install.storeAndroidCaption')}</p>
                </div>
                <Icon name="arrow_forward_ios" className="text-text-sub text-sm" />
              </button>
            </div>
          </section>
        </main>

        <div className="app-fixed fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-[#F9F8F6] via-[#F9F8F6]/96 to-transparent dark:from-[#161311] dark:via-[#161311]/96">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-6 pt-6">
            <Button
              fullWidth
              onClick={() => {
                if (primaryStoreUrl) {
                  openStore(platform === 'ios' ? 'app_store' : 'play_store', primaryStoreUrl);
                  return;
                }
                openStore('app_store', GIJILAI_APP_STORE_URL);
              }}
            >
              {getPrimaryButtonLabel(platform, t)}
            </Button>
            <p className="pb-2 text-center text-xs leading-5 text-text-sub dark:text-gray-400">
              {t('install.footerNote')}
            </p>
          </div>
        </div>
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

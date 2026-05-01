'use client';

import { Suspense, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
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
  const platform = useSyncExternalStore(
    subscribeToPlatformChange,
    getBrowserPlatformSnapshot,
    getServerPlatformSnapshot,
  );
  const primaryStoreUrl = useMemo(() => getPrimaryStoreUrl(platform), [platform]);
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
    if (platform !== detectBrowserPlatform()) return;

    trackEvent('app_install_landing_viewed', {
      source,
      entry_cta: entryCta,
      platform,
    });
  }, [entryCta, platform, source]);

  const openStore = (store: StoreKey, url: string) => {
    trackEvent('app_install_store_clicked', {
      source,
      entry_cta: entryCta,
      platform,
      store,
    });
    window.location.assign(url);
  };

  const handlePrimaryCta = () => {
    if (primaryStoreUrl) {
      openStore(platform === 'ios' ? 'app_store' : 'play_store', primaryStoreUrl);
      return;
    }

    trackEvent('app_install_store_picker_clicked', {
      source,
      entry_cta: entryCta,
      platform,
    });
    document.getElementById('install-store-options')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl">
        <Navbar title={t('install.title')} showBack />

        <main className="app-fixed-cta-scroll flex-1 px-6 pt-7">
          <section className="overflow-hidden rounded-[28px] border border-primary/10 bg-white shadow-[0_22px_55px_rgba(47,79,62,0.10)] dark:border-white/10 dark:bg-surface-dark">
            <div className="relative px-6 pb-7 pt-6">
              <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(135deg,_rgba(47,79,62,0.14),_rgba(229,161,80,0.18))] dark:bg-[linear-gradient(135deg,_rgba(91,158,96,0.18),_rgba(237,170,84,0.16))]" />

              <div className="relative flex items-start justify-between gap-5">
                <div className="inline-flex items-center rounded-full border border-primary/15 bg-white/85 px-3 py-1 text-xs font-bold text-primary shadow-sm dark:border-white/10 dark:bg-white/10">
                  {getPlatformBadge(platform, t)}
                </div>
                <div className="flex size-20 shrink-0 items-center justify-center rounded-[24px] bg-white shadow-[0_14px_34px_rgba(47,79,62,0.16)] ring-1 ring-primary/10 dark:bg-[#252019] dark:ring-white/10">
                  <Image
                    src="/gijilai_icon.png"
                    alt={t('common.appName')}
                    width={54}
                    height={54}
                    className="rounded-2xl object-contain"
                    priority
                  />
                </div>
              </div>

              <div className="relative mt-8 space-y-3">
                <h2 className="text-[27px] font-black leading-[1.18] text-text-main dark:text-white">
                  {t('install.headline')}
                </h2>
                <p className="text-[15px] leading-6 text-text-sub dark:text-gray-300">
                  {t('install.description')}
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
            <section id="install-store-options" className="mt-5 rounded-[24px] border border-beige-main/40 bg-white/80 px-5 py-5 dark:border-white/10 dark:bg-surface-dark/70">
              <h3 className="text-sm font-bold text-text-main dark:text-white">
                {t('install.availableStores')}
              </h3>
              <div className="mt-4 space-y-3">
                {desktopStoreOptions.map((store) => (
                  <button
                    key={store.key}
                    type="button"
                    onClick={() => openStore(store.key, store.url)}
                    className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left transition-colors hover:border-primary/30 dark:border-white/10 dark:bg-white/5"
                  >
                    <div>
                      <p className="text-sm font-bold text-text-main dark:text-white">{store.name}</p>
                      <p className="mt-1 text-xs text-text-sub dark:text-gray-300">{store.caption}</p>
                    </div>
                    <Icon name="arrow_forward_ios" className="text-sm text-text-sub" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>

        <div className="app-fixed fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-[#F9F8F6] via-[#F9F8F6]/96 to-transparent dark:from-[#161311] dark:via-[#161311]/96">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-6 pt-6">
            <Button
              fullWidth
              icon={<Icon name={platform === 'other' ? 'apps' : 'download'} size="md" />}
              iconRight={<Icon name="arrow_forward" size="md" />}
              onClick={handlePrimaryCta}
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

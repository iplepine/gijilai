'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent } from '@/lib/analytics';
import { getPreviewPath, PREVIEW_SCENARIOS, QUICK_ASSESSMENT_HREF, type PreviewScenario } from '@/lib/preview';

export default function ParentingPreview({ scenario }: { scenario: PreviewScenario }) {
  const { t } = useLocale();
  const [copyState, setCopyState] = useState<{ scenario: PreviewScenario; status: 'copied' | 'failed' } | null>(null);
  const status = copyState?.scenario === scenario ? copyState.status : null;
  const shareUrl = `https://gijilai.com${getPreviewPath(scenario)}`;
  const content = (key: string) => t(`preview.${scenario}.${key}`);

  useEffect(() => {
    trackEvent('preview_viewed', { scenario });
  }, [scenario]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState({ scenario, status: 'copied' });
      trackEvent('preview_link_copied', { scenario });
    } catch {
      setCopyState({ scenario, status: 'failed' });
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Navbar title={t('preview.navTitle')} showBack={false} />
      <main className="app-page-scroll mx-auto max-w-3xl px-5 pt-8 md:pt-12">
        <p className="text-xs font-bold tracking-wide text-primary dark:text-primary-light">{t('preview.eyebrow')}</p>
        <h2 className="mt-3 text-3xl font-black leading-snug text-text-main dark:text-white break-keep md:text-4xl">{t('preview.title')}</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-sub break-keep">{t('preview.description')}</p>

        <nav aria-label={t('preview.chooseScenario')} className="mt-7 flex flex-wrap gap-2">
          {PREVIEW_SCENARIOS.map((item) => (
            <Link key={item} href={getPreviewPath(item)} replace scroll={false}
              aria-current={item === scenario ? 'page' : undefined}
              onClick={() => trackEvent('preview_scenario_selected', { scenario: item })}
              className={`min-h-11 rounded-full border px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${item === scenario ? 'border-primary bg-primary text-white' : 'border-beige-main/50 bg-white text-text-main hover:border-primary dark:bg-surface-dark dark:text-white'}`}>
              {t(`preview.${item}.label`)}
            </Link>
          ))}
        </nav>

        <article className="mt-6 overflow-hidden rounded-3xl border border-beige-main/40 bg-white shadow-soft dark:bg-surface-dark" aria-labelledby="scenario-title">
          <div className="border-b border-beige-main/30 px-6 py-6 md:px-8">
            <p className="text-xs font-bold text-text-sub">{t('preview.sampleLabel')}</p>
            <h3 id="scenario-title" className="mt-2 text-xl font-bold leading-snug text-text-main dark:text-white">{content('title')}</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-sub">{content('context')}</p>
          </div>
          <div className="space-y-7 px-6 py-7 md:px-8">
            <section>
              <h4 className="text-xs font-bold text-primary dark:text-primary-light">{t('preview.sayLabel')}</h4>
              <blockquote className="mt-3 border-l-4 border-primary/40 pl-4 text-xl font-bold leading-relaxed text-text-main dark:text-white break-keep">{content('phrase')}</blockquote>
            </section>
            <section>
              <h4 className="text-sm font-bold text-text-main dark:text-white">{t('preview.practiceLabel')}</h4>
              <p className="mt-2 text-sm leading-relaxed text-text-sub">{content('practice')}</p>
            </section>
            <p className="rounded-xl bg-beige-light p-4 text-xs leading-relaxed text-text-sub dark:bg-background-dark">{t('preview.limit')}</p>
          </div>
        </article>

        <section className="mt-8 rounded-2xl bg-primary/5 p-6 dark:bg-primary/15">
          <h3 className="text-lg font-bold text-text-main dark:text-white">{t('preview.nextTitle')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-sub">{t('preview.nextDescription')}</p>
          <Link href={QUICK_ASSESSMENT_HREF}
            onClick={() => trackEvent('preview_signup_clicked', { scenario })}
            className="mt-5 flex min-h-14 items-center justify-center rounded-2xl bg-primary px-4 py-3 text-center font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            {t('preview.startTest')}
          </Link>
          <p className="mt-3 text-center text-xs leading-relaxed text-text-sub">{t('preview.signupHint')}</p>
        </section>

        <div className="mb-6 mt-5 text-center">
          <button type="button" onClick={copyLink} className="min-h-11 px-4 py-3 text-sm font-bold text-primary underline underline-offset-4 dark:text-primary-light">
            {t('preview.copyLink')}
          </button>
          <p role="status" className="text-xs text-text-sub">{status === 'copied' ? t('preview.copied') : status === 'failed' ? t('preview.copyFailed') : ''}</p>
          {status === 'failed' && <input aria-label={t('preview.copyLink')} readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-lg border border-beige-main bg-transparent p-3 text-sm text-text-main dark:text-white" />}
          <Link href="/" className="mt-2 block py-3 text-sm text-text-sub">{t('preview.backHome')}</Link>
        </div>
      </main>
    </div>
  );
}

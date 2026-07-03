'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import { Navbar } from '@/components/layout/Navbar';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { TabLoadingScreen } from '@/components/ui/TabLoadingScreen';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent } from '@/lib/analytics';
import { getApiErrorMessage, readJsonResponse } from '@/lib/api';
import { validateConsultProblemInput } from '@/lib/consultInputValidation';
import type { AiTranslateResult } from '@/lib/aiTranslatePrompt';

const MAX_INPUT = 500;

type Step = 'INPUT' | 'RESULT';

function TranslateInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const { t } = useLocale();
    const { selectedChildId } = useAppStore();

    const prefill = useMemo(() => (searchParams.get('input') ?? '').slice(0, MAX_INPUT), [searchParams]);

    const [input, setInput] = useState(prefill);
    const [step, setStep] = useState<Step>('INPUT');
    const [result, setResult] = useState<AiTranslateResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user && typeof window !== 'undefined') {
            router.replace('/login?redirect=/translate');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        trackEvent('translate_opened', { has_prefill: prefill.trim().length > 0 });
    }, [prefill]);

    const handleTranslate = useCallback(async () => {
        if (isLoading) return;
        const trimmed = input.trim();
        const validation = validateConsultProblemInput(trimmed);
        if (!validation.ok) {
            setError(
                validation.code === 'empty'
                    ? t('translate.errorEmpty')
                    : validation.code === 'gibberish'
                        ? t('translate.errorGibberish')
                        : t('translate.errorTooShort')
            );
            return;
        }

        setError(null);
        setIsLoading(true);
        trackEvent('translate_started', { length: trimmed.length, has_child: !!selectedChildId });
        try {
            const res = await fetch('/api/consult/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: trimmed, childId: selectedChildId ?? null }),
            });
            if (res.status === 429) {
                setError(t('translate.errorQuota'));
                return;
            }
            if (!res.ok) {
                const payload = await readJsonResponse<{ error?: string; code?: string }>(res).catch(() => null);
                const code = payload?.code;
                if (code === 'too_short') setError(t('translate.errorTooShort'));
                else if (code === 'gibberish') setError(t('translate.errorGibberish'));
                else if (code === 'empty') setError(t('translate.errorEmpty'));
                else setError(getApiErrorMessage(payload, t('translate.errorGeneric')));
                return;
            }
            const payload = await readJsonResponse<{ result: AiTranslateResult }>(res);
            if (!payload?.result) {
                setError(t('translate.errorGeneric'));
                return;
            }
            setResult(payload.result);
            setStep('RESULT');
            trackEvent('translate_result_shown', { has_child: !!selectedChildId });
            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
            setError(t('translate.errorGeneric'));
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, selectedChildId, t]);

    const handleContinueConsult = useCallback(() => {
        trackEvent('translate_continue_consult', {});
        const params = new URLSearchParams({
            source: 'translate',
            entry_cta: 'translate_result',
            prefill: input.trim().slice(0, 500),
        });
        router.push(`/consult?${params.toString()}`);
    }, [input, router]);

    const handleRetry = useCallback(() => {
        setStep('INPUT');
        setResult(null);
        setError(null);
    }, []);

    if (authLoading || (!user && typeof window !== 'undefined')) {
        return <TabLoadingScreen />;
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark">
            <Navbar title={t('translate.navTitle')} onBackClick={() => router.push('/')} />

            <main className="mx-auto w-full max-w-xl px-5 pb-40 pt-6">
                {step === 'INPUT' && (
                    <div className="animate-in fade-in duration-300">
                        <h1 className="text-[20px] font-black leading-snug text-text-main dark:text-white break-keep">
                            {t('translate.inputTitle')}
                        </h1>
                        <p className="mt-2 text-[13px] leading-relaxed text-text-sub break-keep">
                            {t('translate.inputDescription')}
                        </p>

                        <div className="relative mt-5">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
                                placeholder={t('translate.inputPlaceholder')}
                                rows={6}
                                className="w-full resize-none rounded-2xl border border-beige-main/30 bg-white p-4 pr-12 text-[14px] leading-relaxed text-text-main outline-none placeholder:text-gray-400 focus:border-secondary focus:ring-2 focus:ring-secondary/40 dark:bg-surface-dark dark:text-white"
                            />
                            <div className="absolute bottom-3 right-3">
                                <VoiceInputButton value={input} onChange={setInput} maxLength={MAX_INPUT} />
                            </div>
                        </div>
                        <p className="mt-2 text-[12px] text-text-sub/80 break-keep">{t('translate.inputHint')}</p>
                        {selectedChildId && (
                            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-secondary/8 px-3 py-1.5 text-[12px] font-bold text-secondary dark:bg-secondary/15">
                                <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                                {t('translate.personalizeNote')}
                            </p>
                        )}
                        {error && <p className="mt-3 text-[13px] text-red-500 break-keep">{error}</p>}
                    </div>
                )}

                {step === 'RESULT' && result && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-[11px] font-black uppercase tracking-wide text-secondary">
                            {t('translate.resultNeedLabel')}
                        </p>
                        <h1 className="mt-1 text-[19px] font-black leading-snug text-text-main dark:text-white break-keep">
                            {result.need}
                        </h1>

                        <section className="mt-5 rounded-2xl border border-secondary/15 bg-secondary/5 p-5 dark:bg-secondary/10">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[19px] text-secondary">record_voice_over</span>
                                <h2 className="text-[13px] font-black text-secondary">{t('translate.resultVoiceLabel')}</h2>
                            </div>
                            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-text-main dark:text-gray-100 break-keep">
                                {result.childVoice}
                            </p>
                        </section>

                        <section className="mt-4 rounded-2xl border border-beige-main/30 bg-white p-5 dark:bg-surface-dark">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[19px] text-text-main dark:text-white">forum</span>
                                <h2 className="text-[13px] font-black text-text-main dark:text-white">{t('translate.resultReplyLabel')}</h2>
                            </div>
                            <p className="mt-3 whitespace-pre-line text-[15px] font-medium leading-relaxed text-text-main dark:text-gray-100 break-keep">
                                {result.parentReply}
                            </p>
                        </section>

                        <MedicalDisclaimer
                            className="mt-5"
                            title={t('translate.disclaimerTitle')}
                            body={t('translate.disclaimerBody')}
                        />
                    </div>
                )}
            </main>

            {step === 'INPUT' && !isLoading && (
                <FixedCta label={t('translate.translateButton')} disabled={!input.trim()} onClick={handleTranslate} />
            )}

            {step === 'RESULT' && result && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-background-light/95 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 backdrop-blur-xl dark:border-gray-800 dark:bg-background-dark/95">
                    <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
                        <button
                            onClick={handleContinueConsult}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-4 text-[15px] font-black text-white shadow-sm transition-transform active:scale-[0.98]"
                        >
                            <span>{t('translate.continueConsult')}</span>
                            <span className="material-symbols-outlined text-[19px]">arrow_forward</span>
                        </button>
                        <button
                            onClick={handleRetry}
                            className="w-full rounded-2xl py-3 text-[14px] font-bold text-text-sub transition-colors active:text-text-main"
                        >
                            {t('translate.retry')}
                        </button>
                    </div>
                </div>
            )}

            {isLoading && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background-light/90 px-8 backdrop-blur-md dark:bg-background-dark/90">
                    <span className="h-12 w-12 animate-spin rounded-full border-4 border-secondary/15 border-t-secondary" />
                    <p className="text-center text-[15px] font-medium text-text-sub dark:text-gray-300">{t('translate.loading')}</p>
                </div>
            )}
        </div>
    );
}

function FixedCta({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-background-light/95 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 backdrop-blur-xl dark:border-gray-800 dark:bg-background-dark/95">
            <div className="mx-auto w-full max-w-xl">
                <button
                    onClick={onClick}
                    disabled={disabled}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-4 text-[15px] font-black text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-40"
                >
                    <span>{label}</span>
                    <span className="material-symbols-outlined text-[19px]">translate</span>
                </button>
            </div>
        </div>
    );
}

export default function TranslatePage() {
    return (
        <Suspense fallback={<TabLoadingScreen />}>
            <TranslateInner />
        </Suspense>
    );
}

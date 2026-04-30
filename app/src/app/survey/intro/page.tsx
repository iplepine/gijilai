'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useSurveyStore } from '@/store/surveyStore';
import { Navbar } from '@/components/layout/Navbar';
import { useLocale } from '@/i18n/LocaleProvider';

export default function IntroPage() {
    const router = useRouter();
    const { resetAll, setCbqResponse, setAtqResponse, setParentingResponse, setSurveyProgress } = useAppStore();
    const { t } = useLocale();

    const resetSurveyState = () => {
        resetAll();
        useSurveyStore.getState().resetSurvey();
    };

    const startSurvey = (flow: 'quick' | 'full') => {
        resetSurveyState();
        router.replace(`/survey?flow=${flow}`);
    };

    const startWithRandomData = () => {
        resetSurveyState();

        for (let i = 1; i <= 20; i++) {
            setCbqResponse(i.toString(), Math.floor(Math.random() * 5) + 1);
        }
        for (let i = 21; i <= 40; i++) {
            setAtqResponse(i.toString(), Math.floor(Math.random() * 5) + 1);
        }
        for (let i = 41; i <= 50; i++) {
            setParentingResponse(i.toString(), Math.floor(Math.random() * 5) + 1);
        }

        setSurveyProgress(100);
        router.replace('/report');
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar title={t('survey.introTitle')} showBack />
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="max-w-md w-full space-y-8 animate-fadeIn">
                        <div className="relative w-52 h-52 mx-auto mb-4">
                            <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
                            <div className="absolute inset-3 rounded-full bg-white dark:bg-surface-dark shadow-lg overflow-hidden">
                                <Image src="/survey_icon.png" alt={t('survey.title')} fill className="object-cover scale-125" />
                            </div>
                        </div>

                        <h1 className="text-3xl font-bold text-text-main dark:text-white leading-tight">
                            {t('survey.introHeadline1')}<br />
                            <span>{t('survey.introHeadline2')}</span>
                        </h1>

                        <p className="text-lg text-text-sub whitespace-pre-line">
                            {t('survey.introDescription')}
                        </p>

                        <div className="pt-6 space-y-3">
                            <button
                                onClick={() => startSurvey('quick')}
                                className="w-full font-black py-4 px-8 rounded-2xl bg-primary text-white shadow-card transform transition hover:scale-105 active:scale-95 text-lg"
                            >
                                {t('survey.startQuickReport')}
                            </button>
                            <p className="text-[13px] text-text-sub leading-relaxed break-keep whitespace-pre-line px-2">
                                {t('survey.startQuickReportHint')}
                            </p>
                            <button
                                onClick={() => startSurvey('full')}
                                className="w-full font-bold py-4 px-8 rounded-2xl bg-white dark:bg-surface-dark text-text-main dark:text-white border border-primary/15 shadow-sm transform transition hover:scale-[1.02] active:scale-95 text-base"
                            >
                                {t('survey.startFullAnalysis')}
                            </button>
                            <p className="text-[12px] text-text-sub/80 leading-relaxed break-keep px-2">
                                {t('survey.startFullAnalysisHint')}
                            </p>
                            {process.env.NODE_ENV === 'development' && (
                                <button
                                    onClick={startWithRandomData}
                                    className="mt-4 w-full text-text-sub/50 text-xs font-medium underline underline-offset-4 hover:text-primary transition-colors"
                                >
                                    {t('survey.devRandomData')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

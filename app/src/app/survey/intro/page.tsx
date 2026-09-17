'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useSurveyStore } from '@/store/surveyStore';
import { Navbar } from '@/components/layout/Navbar';
import { useLocale } from '@/i18n/LocaleProvider';
import { CHILD_QUESTIONS, PARENT_QUESTIONS, PARENTING_STYLE_QUESTIONS } from '@/data/questions';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/lib/db';
import { loadSurveyEntry } from '@/lib/surveyEntry';

export default function IntroPage() {
    const router = useRouter();
    const { selectedChildId, resetSurveyOnly, setCbqResponse, setAtqResponse, setParentingResponse, setSurveyProgress } = useAppStore();
    const { user, loading: authLoading } = useAuth();
    const toast = useToast();
    const { t } = useLocale();
    const [isStarting, setIsStarting] = useState(false);
    const [entryError, setEntryError] = useState<string | null>(null);
    const requestVersion = useRef(0);
    const startingRef = useRef(false);
    const mounted = useRef(false);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => () => { requestVersion.current += 1; }, [user?.id, selectedChildId]);

    const startSurvey = async (flow: 'quick' | 'full') => {
        if (authLoading || startingRef.current) return;
        if (!user) {
            router.replace(`/login?redirect=${encodeURIComponent('/survey/intro')}`);
            return;
        }
        startingRef.current = true;
        setIsStarting(true);
        setEntryError(null);
        const version = ++requestVersion.current;
        const entry = await loadSurveyEntry(user.id, selectedChildId, db);
        if (!mounted.current) return;

        if (version !== requestVersion.current || useAppStore.getState().selectedChildId !== selectedChildId) {
            setEntryError(t('survey.entrySelectionChanged'));
            toast.error(t('survey.entrySelectionChanged'));
        } else if (entry.kind === 'read_failed') {
            setEntryError(t('survey.entryLoadFailed'));
            toast.error(t('survey.entryLoadFailed'));
        } else if (entry.kind === 'selection_unavailable') {
            setEntryError(t('survey.entrySelectionChanged'));
            toast.error(t('survey.entrySelectionChanged'));
        } else {
            const store = useAppStore.getState();
            store.resetSurveyOnly();
            store.resetIntake();
            useSurveyStore.getState().resetSurvey();
            if (entry.kind === 'intake') {
                store.setSelectedChildId(null);
                router.replace('/intake');
            } else {
                store.setSelectedChildId(entry.childId);
                store.setIntake(entry.intake);
                store.restoreSurveyFromDB(entry.responses);
                router.replace(`/survey?flow=${flow}`);
            }
        }
        startingRef.current = false;
        setIsStarting(false);
    };

    const startWithRandomData = () => {
        if (process.env.NODE_ENV !== 'development') return;
        resetSurveyOnly();
        useSurveyStore.getState().resetSurvey();

        // The developer shortcut fills the existing legacy report question IDs.
        for (const question of CHILD_QUESTIONS) {
            setCbqResponse(String(question.id), Math.floor(Math.random() * (question.choices?.length ?? 5)) + 1);
        }
        for (const question of PARENT_QUESTIONS) {
            setAtqResponse(String(question.id), Math.floor(Math.random() * (question.choices?.length ?? 5)) + 1);
        }
        for (const question of PARENTING_STYLE_QUESTIONS) {
            setParentingResponse(String(question.id), Math.floor(Math.random() * (question.choices?.length ?? 5)) + 1);
        }

        setSurveyProgress(100);
        router.replace('/report');
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar title={t('survey.introTitle')} showBack />
                <main className="app-page-scroll flex-1 overflow-y-auto px-6 pt-6 text-center">
                    <div className="min-h-full flex flex-col items-center justify-center">
                        <div className="max-w-md w-full space-y-8 py-8 animate-fadeIn">
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
                                    disabled={authLoading || isStarting}
                                    className="w-full font-black py-4 px-8 rounded-2xl bg-primary text-white shadow-card transform transition hover:scale-105 active:scale-95 text-lg disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {t(isStarting ? 'survey.preparingEntry' : 'survey.continueQuickReport')}
                                </button>
                                <p className="text-[13px] text-text-sub leading-relaxed break-keep whitespace-pre-line px-2">
                                    {t('survey.continueQuickReportHint')}
                                </p>
                                <button
                                    onClick={() => startSurvey('full')}
                                    disabled={authLoading || isStarting}
                                    className="w-full font-bold py-4 px-8 rounded-2xl bg-white dark:bg-surface-dark text-text-main dark:text-white border border-primary/15 shadow-sm transform transition hover:scale-[1.02] active:scale-95 text-base disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {t('survey.startFullAnalysis')}
                                </button>
                                <p className="text-[12px] text-text-sub/80 leading-relaxed break-keep px-2">
                                    {t('survey.startFullAnalysisHint')}
                                </p>
                                {entryError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{entryError}</p>}
                                {process.env.NODE_ENV === 'development' && (
                                    <button
                                        onClick={startWithRandomData}
                                        disabled={authLoading || isStarting}
                                        className="mt-4 w-full text-text-sub/50 text-xs font-medium underline underline-offset-4 hover:text-primary transition-colors"
                                    >
                                        {t('survey.devRandomData')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

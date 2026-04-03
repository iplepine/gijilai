'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSurveyStore } from '../../../store/surveyStore';
import { PARENTING_STYLE_QUESTIONS } from '../../../data/questions';
import { SurveyLayout } from '../../../components/survey/SurveyLayout';
import { QuestionCard } from '../../../components/survey/QuestionCard';
import { useLocale } from '@/i18n/LocaleProvider';

export default function ParentingStyleSurveyPage() {
    const router = useRouter();
    const { t } = useLocale();
    const {
        currentStep,
        answers,
        setAnswer,
        nextStep,
        prevStep,
        setSurveyType,
        setStep,
    } = useSurveyStore();

    const [showBridge, setShowBridge] = useState(true);

    const questions = PARENTING_STYLE_QUESTIONS;
    const currentQuestion = questions[currentStep - 1]; // Use local index if store's step is global, but store resets step on Type change so this is correct.
    const totalQuestions = questions.length;
    const progress = Math.round((currentStep / totalQuestions) * 100);

    const startStyleSurvey = () => {
        setSurveyType('PARENTING_STYLE');
        setShowBridge(false);
    };

    const handleAnswer = (score: number) => {
        if (!currentQuestion) return;
        setAnswer(currentQuestion.id, score);

        if (currentStep < totalQuestions) {
            setTimeout(() => nextStep(), 200);
        } else {
            setTimeout(() => router.replace('/report'), 200);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            prevStep();
        } else {
            router.replace('/survey/parent');
        }
    }

    // Effect to handle navigation to this page directly without proper state
    // Skipping relative to 'intro' for now to keep it simple.

    if (showBridge) {
        return (
            <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl">
                    <div className="text-5xl mb-6">🌱</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                        {t('survey.parentingBridgeTitle')}
                    </h2>
                    <p className="text-gray-600 mb-8 leading-relaxed whitespace-pre-line">
                        {t('survey.parentingBridgeDesc')}
                        <span className="text-sm text-gray-500 mt-2 block">{t('survey.parentingBridgeQuestionCount')}</span>
                    </p>
                    <button
                        onClick={startStyleSurvey}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
                        style={{ backgroundColor: '#4CAF50' }}
                    >
                        {t('survey.parentingBridgeButton')}
                    </button>
                </div>
            </div>
        );
    }

    if (!currentQuestion) return <div>{t('common.loading')}</div>;

    return (
        <SurveyLayout
            title={t('survey.parentingStyle')}
            progress={progress}
            themeColor="#8BC34A"
            onBack={handleBack}
        >
            <div className="w-full max-w-md py-6">
                <div className="mb-4 text-center">
                    <span className="inline-block px-3 py-1 text-sm font-bold mb-2 rounded-full" style={{ backgroundColor: '#8BC34A33', color: '#558B2F' }}>
                        {t('survey.parentingPartLabel')}
                    </span>
                </div>
                <QuestionCard
                    question={currentQuestion}
                    currentAnswer={answers[currentQuestion.id]}
                    onAnswer={handleAnswer}
                />
            </div>
        </SurveyLayout>
    );
}

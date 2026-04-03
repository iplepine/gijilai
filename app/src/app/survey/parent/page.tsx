'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSurveyStore } from '../../../store/surveyStore';
import { PARENT_QUESTIONS } from '../../../data/questions';
import { SurveyLayout } from '../../../components/survey/SurveyLayout';
import { QuestionCard } from '../../../components/survey/QuestionCard';
import { useLocale } from '@/i18n/LocaleProvider';

export default function ParentSurveyPage() {
    const router = useRouter();
    const { t } = useLocale();
    const {
        currentStep,
        answers,
        setAnswer,
        nextStep,
        prevStep,
        setSurveyType,
        getProgress,
        setStep
    } = useSurveyStore();

    const [showBridge, setShowBridge] = useState(true);

    const questions = PARENT_QUESTIONS;
    const currentQuestion = questions[currentStep - 1];
    const totalQuestions = questions.length;
    // Progress needs to be calculated relative to THIS survey or global?
    // UX spec says bridge page separates them, so relative progress is fine.
    const progress = Math.round((currentStep / totalQuestions) * 100);

    useEffect(() => {
        // Only set type if strictly needed, but bridge logic might need careful handling of state
        if (showBridge) {
            // Initial state for this route
        }
    }, [showBridge]);

    const startParentSurvey = () => {
        setSurveyType('PARENT'); // Resets step to 1
        setShowBridge(false);
    };

    const handleAnswer = (score: number) => {
        if (!currentQuestion) return;
        setAnswer(currentQuestion.id, score);

        if (currentStep < totalQuestions) {
            setTimeout(() => nextStep(), 200);
        } else {
            setTimeout(() => router.replace('/survey/parenting-style'), 200);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            prevStep();
        } else {
            // Go back to bridge if at step 1? Or back to child survey?
            // Simplifying: Go back to child survey end
            router.replace('/survey/child');
        }
    }

    if (showBridge) {
        return (
            <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl">
                    <div className="text-5xl mb-6">🧬</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                        {t('survey.childBridgeTitle')}
                    </h2>
                    <p className="text-gray-600 mb-8 leading-relaxed whitespace-pre-line">
                        {t('survey.childBridgeDesc')}
                        <span className="text-sm text-gray-500 mt-2 block">{t('survey.childBridgeQuestionCount')}</span>
                    </p>
                    <button
                        onClick={startParentSurvey}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
                    >
                        {t('survey.childBridgeButton')}
                    </button>
                </div>
            </div>
        );
    }

    if (!currentQuestion) return <div>{t('common.loading')}</div>;

    return (
        <SurveyLayout
            title={t('survey.parentSurvey')}
            progress={progress}
            themeColor="#4A90E2"
            onBack={handleBack}
        >
            <div className="w-full max-w-md py-6">
                <div className="mb-4 text-center">
                    <span className="inline-block px-3 py-1 text-sm font-bold mb-2 rounded-full" style={{ backgroundColor: '#4A90E233', color: '#2C5E9E' }}>
                        {t('survey.parentPartLabel')}
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

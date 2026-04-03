'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSurveyStore } from '../../../store/surveyStore';
import { CHILD_QUESTIONS } from '../../../data/questions';
import { SurveyLayout } from '../../../components/survey/SurveyLayout';
import { QuestionCard } from '../../../components/survey/QuestionCard';
import { useLocale } from '@/i18n/LocaleProvider';

export default function ChildSurveyPage() {
    const router = useRouter();
    const { t } = useLocale();
    const {
        currentStep,
        answers,
        setAnswer,
        nextStep,
        prevStep,
        setSurveyType,
        getProgress
    } = useSurveyStore();

    const questions = CHILD_QUESTIONS;
    const currentQuestion = questions[currentStep - 1];
    const totalQuestions = questions.length;
    const progress = getProgress(totalQuestions);

    useEffect(() => {
        setSurveyType('CHILD');
    }, [setSurveyType]);

    const handleAnswer = (score: number) => {
        if (!currentQuestion) return;
        setAnswer(currentQuestion.id, score);

        // Smooth scroll to top or simple transition
        if (currentStep < totalQuestions) {
            setTimeout(() => nextStep(), 200);
        } else {
            // Navigate to bridge/next section
            setTimeout(() => router.replace('/survey/parent'), 200);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            prevStep();
        } else {
            router.replace('/survey/intro');
        }
    }

    if (!currentQuestion) return <div>{t('common.loading')}</div>;

    return (
        <SurveyLayout
            title={t('survey.childSurvey')}
            progress={progress}
            themeColor="#FFD700"
            onBack={handleBack}
        >
            <div className="w-full max-w-md py-6">
                <div className="mb-4 text-center">
                    <span className="inline-block px-3 py-1 text-sm font-bold mb-2 rounded-full" style={{ backgroundColor: '#FFD70033', color: '#B29600' }}>
                        {t('survey.childPartLabel')}
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

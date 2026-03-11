'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSurveyStore } from '../../../store/surveyStore';
import { PARENTING_STYLE_QUESTIONS } from '../../../data/questions';
import { SurveyLayout } from '../../../components/survey/SurveyLayout';
import { QuestionCard } from '../../../components/survey/QuestionCard';

export default function ParentingStyleSurveyPage() {
    const router = useRouter();
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
                        마지막 단계입니다!
                    </h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        평소 아이와 함께하는 상황을 떠올려주세요.<br />
                        <strong>나의 양육 스타일</strong>을 점검합니다.<br />
                        <span className="text-sm text-gray-500 mt-2 block">(총 10문항)</span>
                    </p>
                    <button
                        onClick={startStyleSurvey}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
                        style={{ backgroundColor: '#4CAF50' }}
                    >
                        양육 스타일 점검하기
                    </button>
                </div>
            </div>
        );
    }

    if (!currentQuestion) return <div>Loading...</div>;

    return (
        <SurveyLayout
            title="양육 스타일 검사"
            progress={progress}
            themeColor="#8BC34A"
            onBack={handleBack}
        >
            <div className="w-full max-w-md py-6">
                <div className="mb-4 text-center">
                    <span className="inline-block px-3 py-1 text-sm font-bold mb-2 rounded-full" style={{ backgroundColor: '#8BC34A33', color: '#558B2F' }}>
                        Part 3. 양육 스타일
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

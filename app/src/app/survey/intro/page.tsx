'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useSurveyStore } from '@/store/surveyStore';
import { Navbar } from '@/components/layout/Navbar';

export default function IntroPage() {
    const router = useRouter();
    const { resetAll, setCbqResponse, setAtqResponse, setParentingResponse, setSurveyProgress } = useAppStore();

    const startSurvey = () => {
        resetAll();
        useSurveyStore.getState().resetSurvey();
        router.replace('/survey');
    };

    const startWithRandomData = () => {
        resetAll();
        useSurveyStore.getState().resetSurvey();

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
                <Navbar title="기질 검사 소개" showBack />
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="max-w-md w-full space-y-8 animate-fadeIn">
                        <div className="relative w-48 h-48 mx-auto mb-8">
                            <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
                            <div className="absolute inset-4 bg-white dark:bg-surface-dark rounded-full shadow-lg flex items-center justify-center">
                                <span className="text-4xl">👨‍👩‍👧‍👦</span>
                            </div>
                        </div>

                        <h1 className="text-3xl font-bold text-text-main dark:text-white leading-tight">
                            우리 아이,<br />
                            <span>도대체 왜 그럴까요?</span>
                        </h1>

                        <p className="text-lg text-text-sub">
                            기질을 알면 육아가 쉬워집니다.<br />
                            3분 만에 아이의 기질과<br />
                            나의 양육 태도를 점검해보세요.
                        </p>

                        <div className="pt-8">
                            <button
                                onClick={startSurvey}
                                className="w-full font-black py-4 px-8 rounded-2xl bg-primary text-white shadow-card transform transition hover:scale-105 active:scale-95 text-lg"
                            >
                                지금 바로 시작하기
                            </button>
                            {process.env.NODE_ENV === 'development' && (
                                <button
                                    onClick={startWithRandomData}
                                    className="mt-4 w-full text-text-sub/50 text-xs font-medium underline underline-offset-4 hover:text-primary transition-colors"
                                >
                                    [개발용] 랜덤 데이터로 결과 확인하기
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

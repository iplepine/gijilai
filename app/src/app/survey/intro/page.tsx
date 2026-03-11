'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';

export default function IntroPage() {
    const router = useRouter();
    const { resetAll, setCbqResponse, setAtqResponse, setParentingResponse, setSurveyProgress } = useAppStore();

    const startSurvey = () => {
        resetAll();
        router.replace('/survey');
    };

    const startWithRandomData = () => {
        resetAll();

        // 아이 기질 (1-20)
        for (let i = 1; i <= 20; i++) {
            setCbqResponse(i.toString(), Math.floor(Math.random() * 5) + 1);
        }
        // 부모 기질 (21-40)
        for (let i = 21; i <= 40; i++) {
            setAtqResponse(i.toString(), Math.floor(Math.random() * 5) + 1);
        }
        // 양육 태도 (41-50)
        for (let i = 41; i <= 50; i++) {
            setParentingResponse(i.toString(), Math.floor(Math.random() * 5) + 1);
        }

        setSurveyProgress(100);
        router.replace('/survey'); // Then it will likely redirect to report or allow finishing
        // Actually, let's go straight to report to see results
        router.replace('/report');
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative items-center justify-center p-6 text-center">
                <div className="max-w-md w-full space-y-8 animate-fadeIn">
                    <div className="relative w-48 h-48 mx-auto mb-8">
                        {/* Placeholder for Illustration */}
                        <div className="absolute inset-0 rounded-full opacity-50 animate-pulse" style={{ backgroundColor: '#11d4d420' }}></div>
                        <div className="absolute inset-4 bg-white rounded-full shadow-lg flex items-center justify-center">
                            <span className="text-4xl">👨‍👩‍👧‍👦</span>
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                        우리 아이,<br />
                        <span style={{ color: '#0d1b1b' }}>도대체 왜 그럴까요?</span>
                    </h1>

                    <p className="text-lg text-gray-600">
                        기질을 알면 육아가 쉬워집니다.<br />
                        3분 만에 아이의 기질과<br />
                        나의 양육 태도를 점검해보세요.
                    </p>

                    <div className="pt-8">
                        <button
                            onClick={startSurvey}
                            className="w-full font-black py-4 px-8 rounded-xl shadow-lg shadow-teal-200 transform transition hover:scale-105 active:scale-95 text-lg"
                            style={{ backgroundColor: '#11d4d4', color: '#0d1b1b' }}
                        >
                            지금 바로 시작하기
                        </button>
                        {/* Test Button */}
                        <button
                            onClick={startWithRandomData}
                            className="mt-4 w-full text-slate-400 text-xs font-medium underline underline-offset-4 hover:text-primary transition-colors"
                        >
                            [개발용] 랜덤 데이터로 결과 확인하기
                        </button>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-100 text-sm text-gray-400">
                        <p>Aina Garden</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

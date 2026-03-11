'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NotificationsPage() {
    const router = useRouter();
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [marketingEnabled, setMarketingEnabled] = useState(false);

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <div className="max-w-md mx-auto relative min-h-screen flex flex-col">
                <header className="sticky top-0 z-40 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl pt-12 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="relative flex items-center justify-center w-full px-4 min-h-[40px]">
                        <div className="absolute left-4">
                            <button onClick={() => router.back()} className="size-10 flex items-center justify-center text-navy dark:text-white">
                                <span className="material-symbols-outlined">arrow_back_ios</span>
                            </button>
                        </div>
                        <h1 className="text-lg font-bold text-navy dark:text-white text-center">알림 설정</h1>
                    </div>
                </header>

                <main className="flex-1 px-4 py-8">
                    <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-soft border border-gray-100 dark:border-gray-800 space-y-8">

                        <div className="flex items-center justify-between">
                            <div className="flex-1 pr-6 flex flex-col gap-1">
                                <h2 className="text-[15px] font-bold text-navy dark:text-white">앱 푸시 알림</h2>
                                <p className="text-[13px] text-gray-500 break-keep">매일 저녁 실천 미션 리마인드 및 기질 처방전 알림을 앱으로 받습니다.</p>
                            </div>
                            <button
                                onClick={() => setPushEnabled(!pushEnabled)}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${pushEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${pushEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-800" />

                        <div className="flex items-center justify-between">
                            <div className="flex-1 pr-6 flex flex-col gap-1">
                                <h2 className="text-[15px] font-bold text-navy dark:text-white">이메일 알림</h2>
                                <p className="text-[13px] text-gray-500 break-keep">최종 기질 분석 리포트 및 중요 공지를 가입하신 이메일로 받습니다.</p>
                            </div>
                            <button
                                onClick={() => setEmailEnabled(!emailEnabled)}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${emailEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-800" />

                        <div className="flex items-center justify-between">
                            <div className="flex-1 pr-6 flex flex-col gap-1">
                                <h2 className="text-[15px] font-bold text-navy dark:text-white">이벤트/마케팅 정보 수신</h2>
                                <p className="text-[13px] text-gray-500 break-keep">새로운 기능 출시 및 육아 관련 추천 콘텐츠, 이벤트 알림을 받습니다.</p>
                            </div>
                            <button
                                onClick={() => setMarketingEnabled(!marketingEnabled)}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${marketingEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${marketingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}

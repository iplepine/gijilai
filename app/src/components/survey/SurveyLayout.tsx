'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ProgressBar } from './ProgressBar';

interface SurveyLayoutProps {
    children: React.ReactNode;
    progress: number;
    title: string;
    themeColor?: string;
    onBack?: () => void;
}

export const SurveyLayout: React.FC<SurveyLayoutProps> = ({ children, progress, title, themeColor, onBack }) => {
    const router = useRouter();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background-dark flex flex-col">
            <header className="bg-white dark:bg-surface-dark px-4 py-3 shadow-sm sticky top-0 z-10">
                <div className="app-shell-width mx-auto">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            onClick={handleBack}
                            className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                        <h1 className="text-base font-semibold text-gray-800 dark:text-white">{title}</h1>
                        <div className="w-8"></div> {/* Spacer for centering */}
                    </div>
                    <ProgressBar progress={progress} themeColor={themeColor} />
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center p-4">
                {children}
            </main>
        </div>
    );
};

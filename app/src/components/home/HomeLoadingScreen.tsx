'use client';

import Image from 'next/image';
import { useLocale } from '@/i18n/LocaleProvider';

export function HomeLoadingScreen() {
    const { t } = useLocale();

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center font-body">
            <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl relative">
                <header className="sticky top-0 z-40 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl pt-12 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between min-h-[40px] px-4">
                        <div className="flex items-center gap-3">
                            <Image src="/gijilai_icon.png" alt={t('common.appName')} width={28} height={28} className="rounded-lg object-contain" />
                            <span className="text-xl font-logo tracking-wide text-primary dark:text-white pt-0.5">{t('common.appName')}</span>
                        </div>
                        <div className="w-14 h-6 bg-gray-100 dark:bg-surface-dark rounded-full animate-pulse" />
                    </div>
                </header>
                <main className="flex-1 flex flex-col items-center pt-12 px-6">
                    <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-surface-dark animate-pulse" />
                    <div className="w-24 h-4 bg-gray-100 dark:bg-surface-dark rounded-full mt-8 animate-pulse" />
                    <div className="w-40 h-3 bg-gray-50 dark:bg-surface-dark/50 rounded-full mt-3 animate-pulse" />
                </main>
            </div>
        </div>
    );
}

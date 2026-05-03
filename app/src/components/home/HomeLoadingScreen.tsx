'use client';

import Image from 'next/image';
import { useLocale } from '@/i18n/LocaleProvider';

export function HomeLoadingScreen() {
    const { t } = useLocale();

    return (
        <div className="min-h-screen bg-background-light text-text-main dark:bg-background-dark dark:text-gray-100 font-body">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-8 text-center shadow-2xl">
                <div className="flex flex-col items-center">
                    <div className="h-28 w-28 overflow-hidden rounded-[2rem] shadow-[0_18px_44px_rgba(47,79,62,0.16)]">
                        <Image
                            src="/gijilai_icon.png"
                            alt={t('common.appName')}
                            width={112}
                            height={112}
                            priority
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <h1 className="mt-7 text-[28px] font-black tracking-normal text-primary dark:text-white">
                        {t('common.appName')}
                    </h1>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-text-sub dark:text-gray-400">
                        {t('common.splashTagline')}
                    </p>
                    <div className="mt-10 h-1 w-32 overflow-hidden rounded-full bg-primary/10 dark:bg-white/10">
                        <div className="h-full w-2/3 rounded-full bg-secondary animate-pulse" />
                    </div>
                    <p className="mt-4 text-[12px] font-bold text-text-sub/70 dark:text-gray-500">
                        {t('common.loading')}
                    </p>
                </div>
            </div>
        </div>
    );
}

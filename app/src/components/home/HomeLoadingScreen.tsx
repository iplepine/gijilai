'use client';

import { useLocale } from '@/i18n/LocaleProvider';

export function HomeLoadingScreen() {
    const { t } = useLocale();

    return (
        <div className="min-h-screen bg-background-light text-text-main dark:bg-background-dark dark:text-gray-100 font-body">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-8 text-center shadow-2xl">
                <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 animate-fade-in">
                    <div className="size-10 rounded-full border-2 border-primary/25 border-t-primary animate-spin" aria-hidden="true" />
                    <p className="text-[14px] font-semibold text-text-sub dark:text-gray-400">
                        {t('common.loading')}
                    </p>
                </div>
            </div>
        </div>
    );
}

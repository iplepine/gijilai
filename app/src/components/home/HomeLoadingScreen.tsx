'use client';

import { useLocale } from '@/i18n/LocaleProvider';
import { TabLoadingIndicator } from '@/components/ui/TabLoadingIndicator';

export function HomeLoadingScreen() {
    const { t } = useLocale();

    return (
        <div className="min-h-screen bg-background-light text-text-main dark:bg-background-dark dark:text-gray-100 font-body">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-8 text-center shadow-2xl">
                <TabLoadingIndicator label={t('common.loading')} className="animate-fade-in" />
            </div>
        </div>
    );
}

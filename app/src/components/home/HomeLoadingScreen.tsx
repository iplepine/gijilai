'use client';

import { useLocale } from '@/i18n/LocaleProvider';
import { TemperamentLoadingState } from '@/components/ui/TemperamentLoadingState';

export function HomeLoadingScreen() {
    const { t } = useLocale();

    return (
        <div className="min-h-screen bg-background-light text-text-main dark:bg-background-dark dark:text-gray-100 font-body">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-8 text-center shadow-2xl">
                <TemperamentLoadingState
                    title={t('common.splashLoadingTitle')}
                    message={t('common.splashLoadingMessage')}
                    note={t('common.splashTagline')}
                    imageSrc="/child_type/type_lhh.jpg"
                    imageAlt={t('common.defaultTemperamentImageAlt')}
                    imagePriority
                />
            </div>
        </div>
    );
}

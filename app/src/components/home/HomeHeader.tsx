'use client';

import Image from 'next/image';
import { db, SubscriptionData } from '@/lib/db';
import { useLocale } from '@/i18n/LocaleProvider';

type HomeHeaderProps = {
    userCreatedAt?: string;
    subscription: SubscriptionData | null;
    onSubscriptionClick: () => void;
    onPricingClick: () => void;
};

export function HomeHeader({
    userCreatedAt,
    subscription,
    onSubscriptionClick,
    onPricingClick,
}: HomeHeaderProps) {
    const { t } = useLocale();
    const trial = userCreatedAt ? db.getTrialStatus(userCreatedAt) : null;

    return (
        <header className="sticky top-0 z-40 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl pt-12 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between min-h-[40px] px-4">
                <div className="flex items-center gap-3">
                    <Image src="/gijilai_icon.png" alt={t('common.appName')} width={28} height={28} className="rounded-lg object-contain" />
                    <span className="text-xl font-logo tracking-wide text-primary dark:text-white pt-0.5">{t('common.appName')}</span>
                </div>
                {subscription ? (
                    <button
                        onClick={onSubscriptionClick}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary/20 text-primary text-xs font-semibold"
                    >
                        <span className="material-symbols-outlined text-sm">workspace_premium</span>
                        <span>{t('home.subscribing')}</span>
                        {subscription.cancelled_at && (
                            <span className="text-[10px] text-text-muted dark:text-gray-400">
                                ~{new Date(subscription.current_period_end).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                            </span>
                        )}
                    </button>
                ) : trial?.isActive ? (
                    <button
                        onClick={onPricingClick}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 dark:bg-secondary/20 text-secondary"
                    >
                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                        <span>{t('home.trialDays', { days: trial.daysRemaining })}</span>
                    </button>
                ) : (
                    <button
                        onClick={onPricingClick}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 dark:bg-primary/20 text-primary"
                    >
                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                        <span>{t('home.startPremium')}</span>
                    </button>
                )}
            </div>
        </header>
    );
}

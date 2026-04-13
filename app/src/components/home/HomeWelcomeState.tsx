'use client';

import Link from 'next/link';
import { UserProfile } from '@/lib/db';
import { useLocale } from '@/i18n/LocaleProvider';

type HomeWelcomeStateProps = {
    profile: UserProfile | null;
};

export function HomeWelcomeState({ profile }: HomeWelcomeStateProps) {
    const { t } = useLocale();

    return (
        <div className="px-6 pb-12 animate-in slide-in-from-bottom-8 duration-1000">
            <div className="bg-gradient-to-br from-white to-primary/5 dark:from-surface-dark/80 dark:to-primary/20 rounded-[2.5rem] p-8 mt-12 mb-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] border border-primary/10 dark:border-primary/30 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none group-hover:bg-primary/20 transition-all duration-700"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/10 rounded-full blur-[60px] -ml-24 -mb-24 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-[2rem] bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center text-primary mb-8 rotate-3 group-hover:rotate-0 transition-transform duration-500 ring-4 ring-primary/5">
                        <span className="material-symbols-outlined text-[46px] fill-1 scale-110">child_care</span>
                    </div>

                    <h2 className="text-[28px] font-black text-text-main dark:text-white leading-tight break-keep mb-4">
                        {t('home.welcomeGreeting', { name: profile?.full_name || t('home.defaultParentName') })}<br />
                        <span className="text-primary">{t('home.welcomeSubtitle')}</span>
                    </h2>
                    <p className="text-text-sub dark:text-gray-400 text-sm leading-relaxed break-keep mb-10 whitespace-pre-line">
                        {t('home.welcomeDescription')}
                    </p>

                    <Link href="/settings/child/new" className="w-full">
                        <button className="w-full bg-primary hover:bg-primary-dark py-5 rounded-[1.5rem] text-white font-bold text-[17px] shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                            <span>{t('home.registerChildProfile')}</span>
                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}

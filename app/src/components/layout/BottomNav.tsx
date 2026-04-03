'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleProvider';

export default function BottomNav() {
    const pathname = usePathname();
    const { t } = useLocale();

    const navItems = [
        { href: '/', label: t('nav.home'), icon: 'home' },
        { href: '/practices', label: t('nav.practices'), icon: 'checklist' },
        { href: '/consult', label: t('nav.consult'), icon: 'add', isCenter: true },
        { href: '/consultations', label: t('nav.records'), icon: 'folder_open' },
        { href: '/settings/profile', label: t('nav.profile'), icon: 'person' },
    ];

    return (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/80 dark:bg-surface-dark/80 backdrop-blur-lg border-t border-primary/5 px-4 pb-8 pt-2 flex justify-between items-end z-50 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
            {navItems.map((item) => {
                const isActive = pathname === item.href;

                if (item.isCenter) {
                    return (
                        <Link key={item.href} href={item.href} className="relative -top-6 group w-20 flex justify-center">
                            <div className="w-14 h-14 rounded-full bg-primary text-white shadow-xl shadow-primary/30 flex items-center justify-center transform transition-all group-hover:scale-105 active:scale-95 border-[4px] border-background-light dark:border-background-dark">
                                <span className="material-symbols-outlined text-white text-[32px]">
                                    {isActive ? 'chat_bubble' : 'add'}
                                </span>
                            </div>
                            <span className="absolute -bottom-[26px] text-[10px] font-bold text-primary">{item.label}</span>
                        </Link>
                    );
                }

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="flex flex-col items-center justify-center gap-1 flex-1 transition-all active:scale-90"
                    >
                        <div className={`p-1.5 rounded-full transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                            <span
                                className={`material-symbols-outlined text-[24px] ${isActive ? 'fill-1' : ''}`}
                            >
                                {item.icon}
                            </span>
                        </div>
                        <span className={`text-[10px] font-bold transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                            {item.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}

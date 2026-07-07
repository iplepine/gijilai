'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import BottomNav from '@/components/layout/BottomNav';
import { useAuth } from '@/components/auth/AuthProvider';
import { useLocale } from '@/i18n/LocaleProvider';
import { formatCaregiverLabel, type CaregiverLabel } from '@/lib/coParent';

type NotificationItem = {
    id: string;
    type: 'CO_PARENT_CONSULTATION';
    actorLabel: CaregiverLabel | null;
    childName: string | null;
    sessionId: string | null;
    sessionTitle: string | null;
    read: boolean;
    createdAt: string;
};

export default function NotificationsPage() {
    const router = useRouter();
    const { t } = useLocale();
    const { user, loading: authLoading } = useAuth();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    const relativeTime = useCallback((iso: string): string => {
        const then = new Date(iso).getTime();
        if (!Number.isFinite(then)) return '';
        const min = Math.floor((Date.now() - then) / 60000);
        if (min < 1) return t('notifications.justNow');
        if (min < 60) return t('notifications.minutesAgo', { n: min });
        const hr = Math.floor(min / 60);
        if (hr < 24) return t('notifications.hoursAgo', { n: hr });
        const day = Math.floor(hr / 24);
        return t('notifications.daysAgo', { n: day });
    }, [t]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            return;
        }
        let active = true;
        (async () => {
            try {
                const res = await fetch('/api/notifications');
                const data = res.ok ? await res.json() : null;
                if (active && Array.isArray(data?.items)) setItems(data.items);
                // 목록 진입 시 모두 읽음 처리(뱃지 즉시 해제)
                if (data && data.unreadCount > 0) {
                    fetch('/api/notifications/read', { method: 'POST' }).catch(() => {});
                }
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [user, authLoading]);

    const composeText = (n: NotificationItem): string => {
        const actor = formatCaregiverLabel(n.actorLabel);
        return n.childName
            ? t('notifications.coParentConsultation', { actor, child: n.childName })
            : t('notifications.coParentConsultationNoChild', { actor });
    };

    const openItem = (n: NotificationItem) => {
        router.push(n.sessionId ? `/consultations/${n.sessionId}` : '/consultations');
    };

    return (
        <div className="bg-background-light dark:bg-background-dark h-[100dvh] min-h-[100dvh] overflow-hidden flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-0 flex flex-col shadow-2xl overflow-hidden relative">
                <Navbar title={t('notifications.title')} showBack />

                <main className="app-bottom-nav-scroll w-full max-w-md min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar p-4">
                    {loading ? (
                        <div className="py-24 flex justify-center">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="py-24 flex flex-col items-center text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="w-20 h-20 bg-primary/5 dark:bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-primary/30">notifications</span>
                            </div>
                            <div className="space-y-1.5">
                                <p className="font-bold text-text-main dark:text-white">{t('notifications.empty')}</p>
                                <p className="text-text-sub text-sm leading-relaxed break-keep px-8">
                                    {t('notifications.emptyHint')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <ul className="space-y-2 animate-in fade-in duration-300">
                            {items.map((n) => (
                                <li key={n.id}>
                                    <button
                                        onClick={() => openItem(n)}
                                        className={`w-full text-left rounded-2xl p-4 flex items-start gap-3 border transition-colors active:scale-[0.99] ${
                                            n.read
                                                ? 'bg-white dark:bg-surface-dark border-gray-100 dark:border-gray-800'
                                                : 'bg-primary/5 dark:bg-primary/10 border-primary/15'
                                        }`}
                                    >
                                        <span className="mt-0.5 shrink-0 size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[20px]">forum</span>
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-text-main dark:text-white break-keep">
                                                {composeText(n)}
                                            </span>
                                            {n.sessionTitle && (
                                                <span className="block text-[13px] text-text-sub truncate mt-0.5">
                                                    “{n.sessionTitle}”
                                                </span>
                                            )}
                                            <span className="block text-[11px] text-text-muted dark:text-gray-500 mt-1">
                                                {relativeTime(n.createdAt)}
                                            </span>
                                        </span>
                                        {!n.read && <span className="mt-1 shrink-0 size-2 rounded-full bg-primary" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </main>

                <BottomNav />
            </div>
        </div>
    );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';
import { isCoParentInvitesEnabled } from '@/lib/coParent';

// 홈 상단바의 알림 벨. 안 읽은 개수를 뱃지로 표시하고 /notifications로 이동한다.
// 현재 알림은 공동양육자 상담뿐이므로 공동양육자 기능이 꺼져 있으면 벨도 숨긴다.
// (Phase 1: 실시간 구독 없이 화면 진입 시점에 카운트를 가져온다.)
export function NotificationBell() {
    const { t } = useLocale();
    const pathname = usePathname();
    const [count, setCount] = useState(0);
    const enabled = isCoParentInvitesEnabled();

    useEffect(() => {
        if (!enabled) return;
        let active = true;
        fetch('/api/notifications')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (active && d && typeof d.unreadCount === 'number') setCount(d.unreadCount);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [pathname, enabled]);

    if (!enabled) return null;

    return (
        <Link
            href="/notifications"
            aria-label={t('notifications.title')}
            className="relative flex items-center justify-center size-9 rounded-full text-text-main dark:text-white active:scale-95 transition-transform"
        >
            <span className="material-symbols-outlined text-[24px]">notifications</span>
            {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {count > 9 ? '9+' : count}
                </span>
            )}
        </Link>
    );
}

// 서버 측: 인앱 알림 조회/읽음 처리. service-role admin 클라이언트로 조합한다.
// 발송(INSERT)은 DB 트리거(마이그레이션 026)가 담당하므로 여기서는 읽기/읽음만 다룬다.
// 항상 인증된 세션의 userId로 스코프를 강제한다(관리자 키를 쓰지만 타인 데이터 접근 불가).

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { isCaregiverLabel, type CaregiverLabel } from '@/lib/coParent';

export type NotificationType = 'CO_PARENT_CONSULTATION';

export type EnrichedNotification = {
    id: string;
    type: NotificationType;
    actorLabel: CaregiverLabel | null; // 발생시킨 양육자의 호칭(표시 문구는 클라이언트가 조합)
    childName: string | null;
    sessionId: string | null;
    sessionTitle: string | null;
    read: boolean;
    createdAt: string;
};

const LIST_LIMIT = 50;

function admin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function listNotificationsForUser(userId: string): Promise<{
    items: EnrichedNotification[];
    unreadCount: number;
}> {
    const supabase = admin();

    const [{ data: rows }, { count }] = await Promise.all([
        supabase
            .from('notifications')
            .select('id, type, actor_id, child_id, session_id, data, read_at, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(LIST_LIMIT),
        supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('read_at', null),
    ]);

    const list = rows ?? [];
    const unreadCount = count ?? list.filter((r) => !(r as { read_at?: string | null }).read_at).length;
    if (list.length === 0) return { items: [], unreadCount };

    const childIds = [
        ...new Set(
            list
                .map((r) => (r as { child_id?: string | null }).child_id)
                .filter((v): v is string => Boolean(v)),
        ),
    ];

    // 아이 정보(이름 + 소유자 + 소유자 호칭)
    const childMap = new Map<string, {
        name: string | null;
        parentId: string | null;
        ownerLabel: CaregiverLabel | null;
    }>();
    // childId -> (양육자 userId -> 호칭)
    const coParentLabelMap = new Map<string, Map<string, CaregiverLabel | null>>();

    if (childIds.length > 0) {
        const [{ data: children }, { data: coParents }] = await Promise.all([
            supabase
                .from('children')
                .select('id, name, parent_id, owner_label')
                .in('id', childIds),
            supabase
                .from('child_co_parents')
                .select('child_id, co_parent_id, label')
                .in('child_id', childIds)
                .eq('status', 'ACCEPTED'),
        ]);

        for (const c of children ?? []) {
            const row = c as {
                id: string;
                name?: string | null;
                parent_id?: string | null;
                owner_label?: string | null;
            };
            childMap.set(row.id, {
                name: row.name ?? null,
                parentId: row.parent_id ?? null,
                ownerLabel: isCaregiverLabel(row.owner_label) ? row.owner_label : null,
            });
        }

        for (const cp of coParents ?? []) {
            const row = cp as {
                child_id?: string | null;
                co_parent_id?: string | null;
                label?: string | null;
            };
            if (!row.child_id || !row.co_parent_id) continue;
            if (!coParentLabelMap.has(row.child_id)) coParentLabelMap.set(row.child_id, new Map());
            coParentLabelMap
                .get(row.child_id)!
                .set(row.co_parent_id, isCaregiverLabel(row.label) ? row.label : null);
        }
    }

    const items: EnrichedNotification[] = list.map((r) => {
        const row = r as {
            id: string;
            type: string;
            actor_id?: string | null;
            child_id?: string | null;
            session_id?: string | null;
            data?: { sessionTitle?: string | null } | null;
            read_at?: string | null;
            created_at?: string | null;
        };
        const child = row.child_id ? childMap.get(row.child_id) : undefined;

        let actorLabel: CaregiverLabel | null = null;
        if (child && row.actor_id) {
            actorLabel = row.actor_id === child.parentId
                ? child.ownerLabel
                : (row.child_id ? coParentLabelMap.get(row.child_id)?.get(row.actor_id) ?? null : null);
        }

        return {
            id: row.id,
            type: (row.type as NotificationType),
            actorLabel,
            childName: child?.name ?? null,
            sessionId: row.session_id ?? null,
            sessionTitle: row.data?.sessionTitle ?? null,
            read: Boolean(row.read_at),
            createdAt: row.created_at ?? '',
        };
    });

    return { items, unreadCount };
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
    const supabase = admin();
    let query = supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
    if (ids && ids.length > 0) {
        query = query.in('id', ids);
    }
    await query;
}

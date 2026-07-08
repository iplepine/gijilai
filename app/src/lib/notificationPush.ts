// 서버 측 푸시 문구 조합. 인앱과 동일한 호칭 모델(coParent)을 재사용한다.
// 1차 로케일은 한국어(앱 기본 언어). i18n 확장은 Phase 2.5 후보.
import { formatCaregiverLabel, isCaregiverLabel, type CaregiverLabel } from '@/lib/coParent';
import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationRecord = {
    type?: string;
    actor_id?: string | null;
    child_id?: string | null;
    session_id?: string | null;
    data?: { sessionTitle?: string | null } | null;
};

export async function composeCoParentPushText(
    admin: SupabaseClient,
    record: NotificationRecord,
): Promise<{ title: string; body: string; url: string }> {
    let actorLabel: CaregiverLabel | null = null;
    let childName: string | null = null;

    if (record.child_id) {
        const { data: child } = await admin
            .from('children')
            .select('name, parent_id, owner_label')
            .eq('id', record.child_id)
            .maybeSingle();

        childName = (child as { name?: string | null } | null)?.name ?? null;

        if (child && record.actor_id) {
            const parentId = (child as { parent_id?: string | null }).parent_id ?? null;
            if (record.actor_id === parentId) {
                const ownerLabel = (child as { owner_label?: string | null }).owner_label ?? null;
                actorLabel = isCaregiverLabel(ownerLabel) ? ownerLabel : null;
            } else {
                const { data: cp } = await admin
                    .from('child_co_parents')
                    .select('label')
                    .eq('child_id', record.child_id)
                    .eq('co_parent_id', record.actor_id)
                    .eq('status', 'ACCEPTED')
                    .maybeSingle();
                const label = (cp as { label?: string | null } | null)?.label ?? null;
                actorLabel = isCaregiverLabel(label) ? label : null;
            }
        }
    }

    const actor = formatCaregiverLabel(actorLabel);
    const body = childName
        ? `${actor}가 ${childName} 상담을 남겼어요`
        : `${actor}가 새 상담을 남겼어요`;
    const url = record.session_id ? `/consultations/${record.session_id}` : '/notifications';

    return { title: '기질아이', body, url };
}

// 서버 측: 상담 LLM 프롬프트에 주입할 양육자 컨텍스트를 빌드한다.
// 클라이언트 측 coParentMap.ts와 분리해 service-role admin 호출 가능.

import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
    formatCaregiverLabel,
    formatCaregiverLabelWithName,
    isCaregiverLabel,
    type CaregiverLabel,
} from '@/lib/coParent';
import type { ConsultCaregiverContext } from '@/lib/consultPromptBuilders';

type CaregiverInfo = {
    userId: string;
    label: CaregiverLabel | null;
    displayName: string | null;
    role: 'OWNER' | 'CO_PARENT';
};

export async function buildConsultCaregiverContext(params: {
    actorUserId: string;
    childId: string | null | undefined;
    previousAuthorUserIds?: string[];
}): Promise<ConsultCaregiverContext | null> {
    if (!params.childId) return null;
    const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: child } = await admin
        .from('children')
        .select(
            'parent_id, owner_label, parent:profiles!children_parent_id_fkey(full_name)',
        )
        .eq('id', params.childId)
        .maybeSingle();

    if (!child) return null;

    const caregivers: CaregiverInfo[] = [];
    const ownerLabelRaw = (child as { owner_label?: string | null }).owner_label ?? null;
    const ownerLabel = isCaregiverLabel(ownerLabelRaw) ? ownerLabelRaw : null;
    const parentRaw = (child as {
        parent?: { full_name?: string | null } | { full_name?: string | null }[] | null;
    }).parent;
    const ownerProfile = Array.isArray(parentRaw) ? parentRaw[0] : parentRaw;
    if (child.parent_id) {
        caregivers.push({
            userId: child.parent_id,
            label: ownerLabel,
            displayName: ownerProfile?.full_name ?? null,
            role: 'OWNER',
        });
    }

    const { data: collaborators } = await admin
        .from('child_co_parents')
        .select(
            'co_parent_id, label, ' +
                'co_parent:profiles!child_co_parents_co_parent_id_fkey(full_name)',
        )
        .eq('child_id', params.childId)
        .eq('status', 'ACCEPTED');

    for (const row of collaborators ?? []) {
        const userId = (row as { co_parent_id?: string | null }).co_parent_id;
        if (!userId) continue;
        const labelRaw = (row as { label?: string | null }).label ?? null;
        const cpRaw = (row as {
            co_parent?: { full_name?: string | null } | { full_name?: string | null }[] | null;
        }).co_parent;
        const cpProfile = Array.isArray(cpRaw) ? cpRaw[0] : cpRaw;
        caregivers.push({
            userId,
            label: isCaregiverLabel(labelRaw) ? labelRaw : null,
            displayName: cpProfile?.full_name ?? null,
            role: 'CO_PARENT',
        });
    }

    if (caregivers.length === 0) return null;

    // 호칭 충돌 여부
    const labels = caregivers.map((c) => c.label).filter((l): l is CaregiverLabel => Boolean(l));
    const hasCollision = labels.length >= 2 && new Set(labels).size < labels.length;

    const labelText = (info: CaregiverInfo): string => {
        if (info.label) return formatCaregiverLabelWithName(info.label, info.displayName, hasCollision);
        return info.displayName ?? formatCaregiverLabel(null);
    };

    const actor = caregivers.find((c) => c.userId === params.actorUserId);
    const other = caregivers.find((c) => c.userId !== params.actorUserId);

    // 작성자 식별 실패 시 컨텍스트 생략(어색한 출력 방지)
    if (!actor) return null;

    // 공동양육자가 없으면 컨텍스트 생략 (솔로 사용자 UX 영향 X)
    if (!other) return null;

    const actorLabelText = labelText(actor);
    const coParentLabelText = labelText(other);

    const previousAuthors: Array<{ consultationIndex: number; labelText: string }> = [];
    if (params.previousAuthorUserIds && params.previousAuthorUserIds.length > 0) {
        params.previousAuthorUserIds.forEach((uid, idx) => {
            const author = caregivers.find((c) => c.userId === uid);
            previousAuthors.push({
                consultationIndex: idx,
                labelText: author ? labelText(author) : '함께 사용하는 분',
            });
        });
    }

    return {
        actorLabelText,
        coParentLabelText,
        previousAuthors: previousAuthors.length > 0 ? previousAuthors : undefined,
    };
}

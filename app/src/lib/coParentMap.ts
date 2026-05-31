// 작성자(user_id)를 호칭(CaregiverLabel)으로 매핑하기 위한 헬퍼.
// 클라이언트에서 한 아이의 owner + co-parent 정보를 한 번 가져와 캐싱.

import { supabase } from '@/lib/supabase';
import { type CaregiverLabel, isCaregiverLabel } from '@/lib/coParent';

export type CaregiverEntry = {
  userId: string;
  role: 'OWNER' | 'CO_PARENT';
  label: CaregiverLabel | null;
  displayName: string | null;
};

export type CaregiverMap = {
  childId: string;
  ownerUserId: string | null;
  byUserId: Record<string, CaregiverEntry>;
};

const EMPTY_MAP: Omit<CaregiverMap, 'childId'> = {
  ownerUserId: null,
  byUserId: {},
};

// 아이별 양육자(owner + co-parent) 정보를 1회 조회한다.
// 호출자는 가시성 보장 안에서 child를 select할 수 있는 사용자여야 한다.
export async function loadCaregiverMap(childId: string): Promise<CaregiverMap> {
  if (!childId) return { childId, ...EMPTY_MAP };

  // owner 정보(자기 또는 co-parent로 보이는 경우 둘 다 access 가능)
  const { data: child } = await supabase
    .from('children')
    .select('id, parent_id, owner_label, parent:profiles!children_parent_id_fkey(full_name)')
    .eq('id', childId)
    .maybeSingle();

  if (!child) return { childId, ...EMPTY_MAP };

  const ownerLabelRaw = (child as { owner_label?: string | null }).owner_label ?? null;
  const ownerLabel = isCaregiverLabel(ownerLabelRaw) ? ownerLabelRaw : null;
  const parentRaw = (child as { parent?: { full_name?: string | null } | { full_name?: string | null }[] | null }).parent;
  const ownerProfile = Array.isArray(parentRaw) ? parentRaw[0] : parentRaw;

  const byUserId: Record<string, CaregiverEntry> = {};
  if (child.parent_id) {
    byUserId[child.parent_id] = {
      userId: child.parent_id,
      role: 'OWNER',
      label: ownerLabel,
      displayName: ownerProfile?.full_name ?? null,
    };
  }

  // co-parent 정보
  const { data: collaborators } = await supabase
    .from('child_co_parents')
    .select(
      'co_parent_id, label, status, ' +
        'co_parent:profiles!child_co_parents_co_parent_id_fkey(full_name)'
    )
    .eq('child_id', childId)
    .eq('status', 'ACCEPTED');

  for (const row of collaborators ?? []) {
    const userId = (row as { co_parent_id?: string | null }).co_parent_id;
    if (!userId) continue;
    const labelRaw = (row as { label?: string | null }).label ?? null;
    const cpRaw = (row as { co_parent?: { full_name?: string | null } | { full_name?: string | null }[] | null }).co_parent;
    const cpProfile = Array.isArray(cpRaw) ? cpRaw[0] : cpRaw;
    byUserId[userId] = {
      userId,
      role: 'CO_PARENT',
      label: isCaregiverLabel(labelRaw) ? labelRaw : null,
      displayName: cpProfile?.full_name ?? null,
    };
  }

  return {
    childId,
    ownerUserId: child.parent_id ?? null,
    byUserId,
  };
}

export function isCoParentLinked(map: CaregiverMap | null | undefined): boolean {
  if (!map) return false;
  return Object.values(map.byUserId).filter((e) => e.role === 'CO_PARENT').length > 0;
}

export function findCaregiver(
  map: CaregiverMap | null | undefined,
  userId: string | null | undefined
): CaregiverEntry | null {
  if (!map || !userId) return null;
  return map.byUserId[userId] ?? null;
}

// 두 양육자가 같은 호칭(예: 둘 다 'MOM')인지 — 표시 시 이름 1자 부착용
export function hasLabelCollision(map: CaregiverMap | null | undefined): boolean {
  if (!map) return false;
  const labels = Object.values(map.byUserId)
    .map((e) => e.label)
    .filter((l): l is CaregiverLabel => Boolean(l));
  return labels.length >= 2 && new Set(labels).size < labels.length;
}

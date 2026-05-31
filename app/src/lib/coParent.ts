// 공동양육자(co-parent) 정책 헬퍼
// 정책: docs/product/policies/co-parent.md
// ADR 2026-05-31

export type CaregiverLabel = 'MOM' | 'DAD' | 'CARER';

export const CAREGIVER_LABELS: CaregiverLabel[] = ['MOM', 'DAD', 'CARER'];

export function isCaregiverLabel(value: unknown): value is CaregiverLabel {
  return typeof value === 'string' && (CAREGIVER_LABELS as string[]).includes(value);
}

export function formatCaregiverLabel(label: CaregiverLabel | null | undefined): string {
  switch (label) {
    case 'MOM':
      return '엄마';
    case 'DAD':
      return '아빠';
    case 'CARER':
      return '보호자';
    default:
      return '양육자';
  }
}

// 두 양육자가 같은 호칭을 골랐을 때 표시용 보조 — 첫 이름 1자 부착
export function formatCaregiverLabelWithName(
  label: CaregiverLabel | null | undefined,
  displayName: string | null | undefined,
  hasCollision: boolean
): string {
  const base = formatCaregiverLabel(label);
  if (!hasCollision) return base;
  const initial = (displayName ?? '').trim().slice(0, 1);
  return initial ? `${base}(${initial})` : base;
}

export type ChildAccessRole = 'OWNER' | 'CO_PARENT' | 'NONE';

export type CoParentInviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface CoParentInviteRow {
  id: string;
  child_id: string;
  invited_by: string;
  co_parent_id: string | null;
  invite_token: string;
  label: CaregiverLabel | null;
  status: CoParentInviteStatus;
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

// invite token 생성 — crypto.randomUUID 기반 (Node 19+/edge runtime 호환)
export function generateInviteToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    // 32 hex chars, dash 없음. URL-safe.
    return crypto.randomUUID().replace(/-/g, '');
  }
  // 폴백: 시간 + 무작위
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`;
}

// 초대 링크 표준 형태
export function buildInviteLink(token: string, origin: string): string {
  const trimmed = origin.replace(/\/$/, '');
  return `${trimmed}/invite/${token}`;
}

// 환경변수 기반 feature flag
export function isCoParentInvitesEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_ENABLE_CO_PARENT_INVITES;
  // 기본은 켜짐. 명시적으로 'false'/'0'/'off'면 끔.
  if (flag == null) return true;
  const lowered = flag.toString().trim().toLowerCase();
  return !(lowered === 'false' || lowered === '0' || lowered === 'off');
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type CaregiverLabel,
  CAREGIVER_LABELS,
  formatCaregiverLabel,
  isCoParentInvitesEnabled,
} from '@/lib/coParent';
import { trackEvent } from '@/lib/analytics';
import { Icon } from '@/components/ui/Icon';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useToast } from '@/components/ui/Toast';

// 인라인용 작은 스피너 — TabLoadingIndicator의 LoadingSpinner와 같은 패턴, 사이즈만 작게.
function InlineSpinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

// 발급 중처럼 시간이 약간 걸리는 동작에 인디터미네이트(indeterminate) 진행 바를 노출한다.
// globals.css의 `--animate-progress` 키프레임(0→80→100%)을 재사용한다.
function IndeterminateProgressBar({ className = '' }: { className?: string }) {
  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label="진행 중"
      className={`relative h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 ${className}`}
    >
      <div className="h-full animate-progress rounded-full bg-[#4CAF50]" />
    </div>
  );
}

type Collaborator = {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  label: CaregiverLabel | null;
  invitedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  coParentDisplayName: string | null;
  isCurrentUser: boolean;
};

type CollaboratorsResponse = {
  role?: 'OWNER' | 'CO_PARENT';
  child?: { id: string; ownerLabel: CaregiverLabel | null };
  collaborators?: Collaborator[];
  error?: string;
};

type InviteResponse = {
  invite?: {
    id: string;
    token: string;
    link: string;
    expiresAt: string;
    status: string;
    childName: string;
  };
  error?: string;
  detail?: string;
  code?: string;
};

type Props = {
  childId: string;
  initialOwnerLabel: CaregiverLabel | null;
  childName: string;
  onOwnerLabelChange: (label: CaregiverLabel) => Promise<void>;
};

export function OwnerCoParentSection({
  childId,
  initialOwnerLabel,
  childName,
  onOwnerLabelChange,
}: Props) {
  const featureOn = useMemo(() => isCoParentInvitesEnabled(), []);
  const [ownerLabel, setOwnerLabel] = useState<CaregiverLabel | null>(initialOwnerLabel);
  const [savingLabel, setSavingLabel] = useState<CaregiverLabel | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  const labelBusy = savingLabel !== null;

  const acceptedCollaborator = collaborators?.find((c) => c.status === 'ACCEPTED') ?? null;
  const pendingCollaborator = collaborators?.find((c) => c.status === 'PENDING') ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/children/${childId}/collaborators`);
      const payload = (await res.json().catch(() => null)) as CollaboratorsResponse | null;
      if (res.ok && payload?.collaborators) {
        setCollaborators(payload.collaborators);
      } else {
        setCollaborators([]);
      }
    } catch (err) {
      console.error('[OwnerCoParentSection] refresh error:', err);
      setCollaborators([]);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    if (!featureOn) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [featureOn, refresh]);

  const handleLabelSelect = async (label: CaregiverLabel) => {
    if (labelBusy) return;
    setSavingLabel(label);
    setActionError(null);
    try {
      await onOwnerLabelChange(label);
      setOwnerLabel(label);
    } catch (err) {
      console.error('[OwnerCoParentSection] label save error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setActionError(`호칭 저장에 실패했어요: ${message}`);
    } finally {
      setSavingLabel(null);
    }
  };

  const handleGenerate = async () => {
    if (generating) return;
    if (!ownerLabel) {
      setActionError('먼저 본인의 호칭을 골라주세요.');
      return;
    }
    setGenerating(true);
    setActionError(null);
    try {
      const res = await fetch('/api/co-parent/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId }),
      });
      const payload = (await res.json().catch(() => null)) as InviteResponse | null;
      if (!res.ok || !payload?.invite) {
        const err = payload?.error ?? 'INVITE_CREATE_FAILED';
        if (err === 'CO_PARENT_ALREADY_LINKED') {
          setActionError('이미 함께 보는 분이 연결돼 있어요.');
        } else {
          const detail = payload?.detail ? ` (${payload.detail})` : '';
          setActionError(`초대 링크 발급에 실패했어요: ${err}${detail}`);
        }
        return;
      }
      setInviteLink(payload.invite.link);
      trackEvent('co_parent_invite_generated', { child_id: childId });
      await refresh();
    } catch (err) {
      console.error('[OwnerCoParentSection] generate error:', err);
      setActionError('초대 링크 발급에 실패했어요.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareLink = async (link: string) => {
    const shareData = {
      title: `${childName}의 양육을 함께 봐요`,
      text: `${childName}의 기질 리포트와 상담·실천 기록을 함께 보고 싶어 초대했어요. 링크를 열어 수락해주세요. (7일 안에)`,
      url: link,
    };
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(shareData);
        trackEvent('co_parent_invite_link_shared', { channel: 'native_share' });
        return;
      }
    } catch (err) {
      // 사용자가 취소했거나 미지원 — 클립보드로 폴백
      console.warn('[OwnerCoParentSection] navigator.share failed:', err);
    }
    try {
      await navigator.clipboard.writeText(link);
      trackEvent('co_parent_invite_link_shared', { channel: 'copy' });
      // 성공 안내 — actionError(빨간 글씨)로 보내면 복사 성공이 오류처럼 보인다.
      toast.success('초대 링크를 복사했어요. 카카오톡으로 보내주세요.');
    } catch (err) {
      console.error('[OwnerCoParentSection] clipboard error:', err);
      setActionError('초대 링크 복사에 실패했어요. 링크를 직접 복사해주세요.');
    }
  };

  const handleRevoke = async (membershipId: string) => {
    const ok = await confirm({
      title: '함께 보는 분 연결을 해제할까요?',
      description: '해제하면 상대방은 이 아이의 리포트·상담·실천 기록을 더 이상 볼 수 없어요. 다시 초대할 수는 있어요.',
      confirmLabel: '해제하기',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(
        `/api/children/${childId}/collaborators?membershipId=${encodeURIComponent(membershipId)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        trackEvent('co_parent_revoked', { by: 'OWNER' });
        await refresh();
      } else {
        setActionError('해제에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    } catch (err) {
      console.error('[OwnerCoParentSection] revoke error:', err);
      setActionError('해제에 실패했어요.');
    }
  };

  if (!featureOn) return null;

  return (
    <section className="mt-8 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">함께 보는 분</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          배우자나 공동양육자를 초대해 같은 아이의 리포트, 상담, 실천 기록을 함께 봐요. (1명까지)
        </p>
      </div>

      {/* Owner 본인 호칭 */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">내 호칭</div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              상담과 기록에 표시돼요. 한 번 고른 뒤에도 바꿀 수 있어요.
            </p>
          </div>
          {labelBusy && (
            <span className="text-[#4CAF50]">
              <InlineSpinner />
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          {CAREGIVER_LABELS.map((label) => {
            const isSaving = savingLabel === label;
            const isSelected = ownerLabel === label;
            return (
              <button
                key={label}
                onClick={() => handleLabelSelect(label)}
                disabled={labelBusy}
                aria-busy={isSaving}
                className={`flex-1 h-11 rounded-xl border text-sm font-medium transition-all inline-flex items-center justify-center gap-2 ${
                  isSelected
                    ? 'border-2 border-[#4CAF50] bg-[#E8F5E9]/50 dark:bg-[#4CAF50]/10 text-[#2E7D32] dark:text-[#4CAF50]'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSaving && <InlineSpinner className="text-current" />}
                {formatCaregiverLabel(label)}
              </button>
            );
          })}
        </div>
        {labelBusy && (
          <div className="mt-3">
            <IndeterminateProgressBar />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              저장 중이에요...
            </p>
          </div>
        )}
      </div>

      {/* 협력자 상태 카드 */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        {loading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">불러오는 중...</div>
        ) : acceptedCollaborator ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCaregiverLabel(acceptedCollaborator.label)}{' '}
                  {acceptedCollaborator.coParentDisplayName
                    ? `· ${acceptedCollaborator.coParentDisplayName}`
                    : ''}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  함께 보고 있어요
                </div>
              </div>
              <button
                onClick={() => handleRevoke(acceptedCollaborator.id)}
                className="text-xs text-red-500 font-medium"
              >
                해제
              </button>
            </div>
          </div>
        ) : pendingCollaborator ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              초대 링크가 발급돼 있어요. 카카오톡 등으로 공유해주세요.
            </div>
            {inviteLink && (
              <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3 text-xs break-all text-gray-600 dark:text-gray-300">
                {inviteLink}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => inviteLink && handleShareLink(inviteLink)}
                disabled={!inviteLink}
                className="flex-1 h-11 rounded-xl bg-[#2E7D32] dark:bg-[#4CAF50] text-white font-semibold text-sm disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1">
                  <Icon name="share" size="sm" /> 링크 공유
                </span>
              </button>
              <button
                onClick={() => handleRevoke(pendingCollaborator.id)}
                className="h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {childName}의 양육을 함께 하는 분을 초대해보세요.
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !ownerLabel}
              aria-busy={generating}
              className="w-full h-11 rounded-xl bg-[#2E7D32] dark:bg-[#4CAF50] text-white font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {generating && <InlineSpinner className="text-white" />}
              {generating ? '발급 중...' : '초대 링크 만들기'}
            </button>
            {generating && (
              <div>
                <IndeterminateProgressBar />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  안전한 초대 토큰을 만드는 중이에요...
                </p>
              </div>
            )}
            {!generating && !ownerLabel && (
              <p className="text-xs text-gray-500 dark:text-gray-400">먼저 내 호칭을 골라주세요.</p>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div className="text-xs text-red-500 px-1">{actionError}</div>
      )}
    </section>
  );
}

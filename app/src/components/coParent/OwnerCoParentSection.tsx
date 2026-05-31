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
  const [savingLabel, setSavingLabel] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    if (savingLabel) return;
    setSavingLabel(true);
    setActionError(null);
    try {
      await onOwnerLabelChange(label);
      setOwnerLabel(label);
    } catch (err) {
      console.error('[OwnerCoParentSection] label save error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setActionError(`호칭 저장에 실패했어요: ${message}`);
    } finally {
      setSavingLabel(false);
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
          setActionError('초대 링크 발급에 실패했어요. 잠시 후 다시 시도해주세요.');
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
      title: '기질아이 함께 보기',
      text: `${childName}의 기질 리포트와 상담·실천 기록을 함께 봐요.`,
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
      setActionError('초대 링크를 복사했어요. 카카오톡으로 보내주세요.');
    } catch (err) {
      console.error('[OwnerCoParentSection] clipboard error:', err);
      setActionError('초대 링크 복사에 실패했어요. 링크를 직접 복사해주세요.');
    }
  };

  const handleRevoke = async (membershipId: string) => {
    if (!confirm('함께 보는 분 연결을 해제할까요?')) return;
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
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">내 호칭</div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          상담과 기록에 표시돼요. 한 번 고른 뒤에도 바꿀 수 있어요.
        </p>
        <div className="mt-3 flex gap-2">
          {CAREGIVER_LABELS.map((label) => (
            <button
              key={label}
              onClick={() => handleLabelSelect(label)}
              disabled={savingLabel}
              className={`flex-1 h-11 rounded-xl border text-sm font-medium transition-all ${
                ownerLabel === label
                  ? 'border-2 border-[#4CAF50] bg-[#E8F5E9]/50 dark:bg-[#4CAF50]/10 text-[#2E7D32] dark:text-[#4CAF50]'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
              } disabled:opacity-50`}
            >
              {formatCaregiverLabel(label)}
            </button>
          ))}
        </div>
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
              className="w-full h-11 rounded-xl bg-[#2E7D32] dark:bg-[#4CAF50] text-white font-semibold text-sm disabled:opacity-50"
            >
              {generating ? '발급 중...' : '초대 링크 만들기'}
            </button>
            {!ownerLabel && (
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

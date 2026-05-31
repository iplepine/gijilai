'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  CAREGIVER_LABELS,
  formatCaregiverLabel,
  isCoParentInvitesEnabled,
  type CaregiverLabel,
} from '@/lib/coParent';
import { trackEvent } from '@/lib/analytics';

type PreviewResponse = {
  preview?: {
    status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
    expiresAt: string;
    acceptedAt: string | null;
    child: { name: string | null; ownerLabel: CaregiverLabel | null } | null;
    ownerDisplayName: string | null;
  };
  error?: string;
};

type AcceptResponse = {
  membership?: { id: string; childId: string; acceptedAt: string; label: CaregiverLabel | null };
  error?: string;
  status?: string;
};

export default function CoParentInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = (params?.token as string) ?? '';
  const featureOn = useMemo(() => isCoParentInvitesEnabled(), []);

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewResponse['preview'] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [label, setLabel] = useState<CaregiverLabel | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // 토큰 미리보기 (비로그인도 가능)
  useEffect(() => {
    if (!featureOn) {
      setLoading(false);
      setErrorCode('FEATURE_DISABLED');
      return;
    }
    if (!token) {
      setLoading(false);
      setErrorCode('MISSING_TOKEN');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/co-parent/invites/${encodeURIComponent(token)}`);
        const payload = (await res.json().catch(() => null)) as PreviewResponse | null;
        if (cancelled) return;
        if (res.ok && payload?.preview) {
          setPreview(payload.preview);
          trackEvent('co_parent_invite_viewed', {
            token_age_days: Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(payload.preview.expiresAt).getTime()) / (1000 * 60 * 60 * 24)
              ) + 7
            ),
          });
        } else {
          setErrorCode(payload?.error ?? 'INVITE_LOOKUP_FAILED');
        }
      } catch (err) {
        console.error('[InvitePage] preview error:', err);
        if (!cancelled) setErrorCode('INVITE_LOOKUP_FAILED');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, featureOn]);

  // 로그인 사용자 확인
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!cancelled) setUserId(user?.id ?? null);
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const childName = preview?.child?.name ?? null;
  const ownerLabel = preview?.child?.ownerLabel ?? null;
  const ownerDisplayName = preview?.ownerDisplayName ?? null;

  const ownerCaption = useMemo(() => {
    if (ownerLabel) return formatCaregiverLabel(ownerLabel);
    if (ownerDisplayName) return ownerDisplayName;
    return '함께 사용하는 분';
  }, [ownerLabel, ownerDisplayName]);

  const handleAccept = useCallback(async () => {
    if (submitting) return;
    if (!label) {
      setAcceptError('호칭을 골라주세요.');
      return;
    }
    if (!consent) {
      setAcceptError('동의가 필요해요.');
      return;
    }
    setSubmitting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/co-parent/invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, consentAccepted: true }),
      });
      const payload = (await res.json().catch(() => null)) as AcceptResponse | null;
      if (!res.ok || !payload?.membership) {
        const err = payload?.error ?? 'INVITE_ACCEPT_FAILED';
        if (err === 'INVITE_EXPIRED') setAcceptError('초대가 만료됐어요. 초대한 분에게 새 링크를 받아주세요.');
        else if (err === 'INVITE_NOT_PENDING') setAcceptError('이미 처리된 초대예요.');
        else if (err === 'CO_PARENT_ALREADY_LINKED') setAcceptError('이미 다른 분이 연결돼 있어요.');
        else if (err === 'CANNOT_ACCEPT_OWN_INVITE') setAcceptError('본인이 만든 초대는 수락할 수 없어요.');
        else if (err === 'OWNER_CANNOT_BE_CO_PARENT') setAcceptError('아이를 등록한 분은 협력자로 연결될 수 없어요.');
        else setAcceptError('수락에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      trackEvent('co_parent_invite_accepted', {
        label,
      });
      router.replace('/');
    } catch (err) {
      console.error('[InvitePage] accept error:', err);
      setAcceptError('수락에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, label, consent, token, router]);

  const redirectToLogin = useCallback(() => {
    const target = `/invite/${encodeURIComponent(token)}`;
    router.push(`/login?redirect=${encodeURIComponent(target)}`);
  }, [token, router]);

  if (!featureOn) {
    return (
      <FullCenterMessage
        title="지금은 사용할 수 없어요"
        description="공동양육자 초대 기능은 현재 비활성화되어 있어요."
      />
    );
  }

  if (loading) {
    return <FullCenterMessage title="초대 정보를 확인하는 중..." />;
  }

  if (errorCode || !preview) {
    return (
      <FullCenterMessage
        title={
          errorCode === 'INVITE_NOT_FOUND'
            ? '초대를 찾을 수 없어요'
            : '초대를 확인할 수 없어요'
        }
        description="초대 링크가 만료됐거나 잘못된 링크일 수 있어요. 초대한 분에게 다시 받아주세요."
      />
    );
  }

  if (preview.status === 'EXPIRED') {
    return (
      <FullCenterMessage
        title="초대가 만료됐어요"
        description="초대 링크는 발급일로부터 7일간 유효해요. 초대한 분에게 새 링크를 받아주세요."
      />
    );
  }

  if (preview.status === 'REVOKED') {
    return (
      <FullCenterMessage
        title="초대가 취소됐어요"
        description="초대한 분이 링크를 취소했어요. 새 링크가 필요해요."
      />
    );
  }

  if (preview.status === 'ACCEPTED') {
    return (
      <FullCenterMessage
        title="이미 연결돼 있어요"
        description={`${childName ?? '아이'}의 기록을 함께 보고 있어요.`}
        action={{ label: '홈으로', href: '/' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-main dark:text-[#E8E2D6] font-sans flex justify-center">
      <div className="relative flex h-full min-h-screen w-full max-w-[480px] flex-col overflow-x-hidden">
        <main className="app-fixed-cta-scroll flex-1 px-6 pt-10">
          <div className="text-sm text-[#4CAF50] font-semibold">기질아이 함께 보기</div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white leading-snug">
            {childName ? `${childName}의 기록을` : '같은 아이의 기록을'}
            <br />
            {ownerCaption}와 함께 보아요.
          </h1>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            기질 리포트, 상담 이력, 실천 기록을 함께 봐요. 한 명이 잊어도 옆에 있는 분이
            끌어와요. 아이 정보 수정과 구독 변경은 처음 등록하신 분({ownerCaption})만 가능해요.
          </p>

          {authChecking ? (
            <div className="mt-8 text-sm text-gray-500">로그인 상태를 확인하는 중...</div>
          ) : !userId ? (
            <div className="mt-8 space-y-3">
              <button
                onClick={redirectToLogin}
                className="w-full h-12 rounded-2xl bg-[#2E7D32] dark:bg-[#4CAF50] text-white font-bold text-base"
              >
                로그인하고 이어가기
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
                본인 계정으로 로그인해주세요. 다른 분과 같은 계정을 함께 쓰지 않아요.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  내 호칭을 골라주세요
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  상담과 기록에 표시돼요.
                </p>
                <div className="mt-3 flex gap-2">
                  {CAREGIVER_LABELS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setLabel(opt)}
                      className={`flex-1 h-12 rounded-xl border text-sm font-medium transition-all ${
                        label === opt
                          ? 'border-2 border-[#4CAF50] bg-[#E8F5E9]/50 dark:bg-[#4CAF50]/10 text-[#2E7D32] dark:text-[#4CAF50]'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {formatCaregiverLabel(opt)}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded text-[#4CAF50] focus:ring-[#4CAF50]"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  아이의 기질 리포트, 상담 이력, 실천 기록을 함께 봅니다.{' '}
                  <strong className="text-[#2E7D32] dark:text-[#4CAF50]">동의하고 시작하기.</strong>
                </span>
              </label>

              {acceptError && (
                <div className="text-xs text-red-500 px-1">{acceptError}</div>
              )}
            </div>
          )}
        </main>

        {userId && !authChecking ? (
          <div className="app-fixed-cta fixed bottom-0 left-0 right-0 p-6 flex justify-center z-40 bg-gradient-to-t from-[#FAFCFA] via-[#FAFCFA]/90 to-transparent dark:from-[#161311] dark:via-[#161311]/90 pointer-events-none">
            <div className="max-w-[480px] w-full pointer-events-auto">
              <button
                onClick={handleAccept}
                disabled={!label || !consent || submitting}
                className="w-full bg-[#2E7D32] dark:bg-[#4CAF50] text-white font-bold text-lg h-16 rounded-2xl shadow-xl disabled:opacity-50"
              >
                {submitting ? '연결 중...' : '동의하고 시작하기'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FullCenterMessage({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background-light dark:bg-background-dark">
      <div className="max-w-sm space-y-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{description}</p>
        )}
        {action && (
          <Link
            href={action.href}
            className="inline-block mt-4 h-11 px-6 rounded-2xl bg-[#2E7D32] dark:bg-[#4CAF50] text-white font-semibold text-sm flex items-center justify-center"
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

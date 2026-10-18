'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent } from '@/lib/analytics';
import { isCoParentInvitesEnabled } from '@/lib/coParent';

type CaregiversResponse = {
  caregivers?: Array<{ role: 'OWNER' | 'CO_PARENT'; isCurrentUser: boolean }>;
};

type InviteResponse = {
  invite?: { link: string };
  error?: string;
};

type ShareWindow = Window & { ShareBridge?: { postMessage: (message: string) => void } };

/**
 * 리포트에서 바로 배우자(공동양육자)를 초대하는 카드. 아이를 등록한 사람이고 아직 함께 보는 사람이 없을 때만 보인다.
 * 초대받은 사람이 양육자 검사를 하면 두 사람의 기질 비교(CoParentInsightCard)가 열려, 한 명이 다른 한 명을 데려오는 유입 고리가 된다.
 */
export function CoParentInviteCard({ childId, childName, source }: { childId: string; childName: string; source: string }) {
  const { t } = useLocale();
  const toast = useToast();
  const featureOn = useMemo(() => isCoParentInvitesEnabled(), []);
  const [eligible, setEligible] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setEligible(false);
    if (!featureOn) return;
    let cancelled = false;
    fetch(`/api/children/${encodeURIComponent(childId)}/caregivers`)
      .then(async (res) => (res.ok ? await res.json() as CaregiversResponse : null))
      .then((payload) => {
        if (cancelled || !payload?.caregivers) return;
        const me = payload.caregivers.find((caregiver) => caregiver.isCurrentUser);
        const show = me?.role === 'OWNER' && payload.caregivers.length < 2;
        setEligible(show);
        if (show) trackEvent('co_parent_invite_card_viewed', { source });
      })
      .catch((error) => console.warn('[CoParentInviteCard] caregivers load failed:', error));
    return () => {
      cancelled = true;
    };
  }, [childId, featureOn, source]);

  if (!eligible) return null;

  const shareLink = async (link: string) => {
    const payload = {
      title: t('coParentInvite.shareTitle', { name: childName }),
      text: t('coParentInvite.shareText', { name: childName }),
      url: link,
    };

    const bridge = (window as ShareWindow).ShareBridge;
    if (bridge) {
      bridge.postMessage(JSON.stringify({ type: 'SHARE_REQUEST', ...payload }));
      trackEvent('co_parent_invite_link_shared', { channel: 'native_bridge', source });
      return;
    }

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        trackEvent('co_parent_invite_link_shared', { channel: 'native_share', source });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${payload.text}\n${link}`);
      trackEvent('co_parent_invite_link_shared', { channel: 'copy', source });
      toast.success(t('coParentInvite.copied'));
    } catch {
      toast.error(t('coParentInvite.copyFailed'));
    }
  };

  const handleInvite = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/co-parent/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId }),
      });
      const payload = (await res.json().catch(() => null)) as InviteResponse | null;
      if (!res.ok || !payload?.invite) {
        if (payload?.error === 'CO_PARENT_ALREADY_LINKED') {
          setEligible(false);
          toast.info(t('coParentInvite.alreadyLinked'));
        } else {
          toast.error(t('coParentInvite.createFailed'));
        }
        return;
      }
      trackEvent('co_parent_invite_generated', { child_id: childId, source });
      await shareLink(payload.invite.link);
    } catch {
      toast.error(t('coParentInvite.createFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-6 shadow-card border border-beige-main/10 space-y-4 text-left">
      <div className="space-y-1.5">
        <p className="text-[12px] font-black text-primary flex items-center gap-1.5">
          <Icon name="group_add" size="sm" /> {t('coParentInvite.eyebrow')}
        </p>
        <h4 className="text-[17px] font-black text-text-main dark:text-white leading-snug break-keep">
          {t('coParentInvite.title')}
        </h4>
        <p className="text-[13px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">
          {t('coParentInvite.description', { name: childName })}
        </p>
      </div>
      <Button
        variant="secondary"
        fullWidth
        className="h-12 rounded-2xl font-bold"
        onClick={handleInvite}
        disabled={sending}
      >
        {t('coParentInvite.cta')}
      </Button>
    </section>
  );
}

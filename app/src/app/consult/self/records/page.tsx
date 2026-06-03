'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { db, type PracticeItemData, type SessionData } from '@/lib/db';
import { Navbar } from '@/components/layout/Navbar';
import { TabLoadingScreen } from '@/components/ui/TabLoadingScreen';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent } from '@/lib/analytics';
import {
  isSelfParentPrescription,
  type SelfParentPrescription,
} from '@/lib/selfParentPrescription';
import { getLocalDateString } from '@/lib/date';

type ActivePractice = PracticeItemData & { consultation_sessions: SessionData };
type ConsultationRow = {
  id: string;
  problem_description: string | null;
  ai_prescription: unknown;
  created_at: string;
};

type CheckinChoice = 'helped' | 'unsure' | 'not_yet';

export default function SelfRecordsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t, locale } = useLocale();

  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActivePractice[]>([]);
  const [history, setHistory] = useState<ConsultationRow[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [activeItems, consults] = await Promise.all([
        db.getActiveSelfParentPractices(user.id).catch(() => []),
        db.getSelfParentConsultations(user.id).catch(() => []),
      ]);
      setActive(activeItems as ActivePractice[]);
      setHistory(consults as ConsultationRow[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/consult/self/records');
      return;
    }
    void load();
  }, [authLoading, user, load, router]);

  if (authLoading || loading) {
    return <TabLoadingScreen navbarTitle={t('selfParent.recordsNavTitle')} showBack label={t('common.loading')} />;
  }

  const isEmpty = active.length === 0 && history.length === 0;

  return (
    <div className="min-h-[100dvh] bg-background-light dark:bg-background-dark flex flex-col items-center font-body">
      <div className="w-full max-w-md flex flex-col min-h-[100dvh]">
        <Navbar title={t('selfParent.recordsNavTitle')} showBack />
        <main className="app-bottom-nav-scroll flex-1 px-6 pb-24 pt-6">
          {isEmpty ? (
            <div className="py-20 flex flex-col items-center text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-secondary/8 flex items-center justify-center">
                <span className="material-symbols-outlined text-[40px] text-secondary/40">self_improvement</span>
              </div>
              <p className="text-[14px] text-text-sub leading-relaxed">{t('selfParent.recordsEmpty')}</p>
              <p className="text-[14px] font-bold text-primary leading-relaxed whitespace-pre-line">
                {t('catchphrase.short')}
              </p>
              <button
                onClick={() => router.push('/consult/self')}
                className="h-12 px-6 rounded-2xl bg-secondary text-white font-bold text-[14px] active:scale-[0.98] transition-all"
              >
                {t('selfParent.recordsEmptyCta')}
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* 진행 중인 자기 돌봄 */}
              {active.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-secondary rounded-full" />
                    <h3 className="text-[13px] font-bold text-text-main dark:text-white">
                      {t('selfParent.recordsActiveTitle')}
                    </h3>
                  </div>
                  {active.map((item) => (
                    <ActiveCareCard key={item.id} item={item} userId={user!.id} t={t} onDone={load} />
                  ))}
                </section>
              )}

              {/* 지나온 마음 */}
              {history.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-[#D08B5B] rounded-full" />
                    <h3 className="text-[13px] font-bold text-text-main dark:text-white">
                      {t('selfParent.recordsHistoryTitle')}
                    </h3>
                  </div>
                  {history.map((c) => (
                    <HistoryCard key={c.id} consultation={c} locale={locale} />
                  ))}
                </section>
              )}

              <p className="text-center text-[13px] font-bold text-primary leading-relaxed whitespace-pre-line pt-4">
                {t('catchphrase.main')}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ActiveCareCard({
  item,
  userId,
  t,
  onDone,
}: {
  item: ActivePractice;
  userId: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onDone: () => void;
}) {
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [choice, setChoice] = useState<CheckinChoice | null>(null);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const choiceLabel = useCallback(
    (c: CheckinChoice) =>
      c === 'helped'
        ? t('selfParent.checkinHelped')
        : c === 'unsure'
          ? t('selfParent.checkinUnsure')
          : t('selfParent.checkinNotYet'),
    [t],
  );

  const submit = useCallback(async () => {
    if (submitting || !choice) return;
    setSubmitting(true);
    try {
      // 1) 가벼운 체크인 로그 (하루 1개)
      await db
        .createPracticeLog({
          practice_id: item.id,
          user_id: userId,
          date: getLocalDateString(),
          done: choice === 'helped',
          memo: memo.trim() || null,
        })
        .catch((err) => console.warn('[self records] log failed:', err));

      // 2) 회고 저장 (선택 메모 + 선택지). content는 not null이라 최소 선택지 라벨로 채움.
      const reviewContent = memo.trim() ? `${choiceLabel(choice)} — ${memo.trim()}` : choiceLabel(choice);
      await supabase
        .from('practice_reviews')
        .insert({ practice_id: item.id, user_id: userId, content: reviewContent })
        .then(undefined, (err: unknown) => console.warn('[self records] review failed:', err));

      // 3) 실천 완료 처리 (데일리 강요 없이 한 번의 부드러운 마무리)
      await db.updatePracticeItem(item.id, { status: 'COMPLETED' }).catch((err) =>
        console.warn('[self records] complete failed:', err),
      );

      trackEvent('self_parent_checkin_done', { choice });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, choice, item.id, userId, memo, choiceLabel]);

  if (done) {
    return (
      <div className="rounded-2xl bg-secondary/8 dark:bg-secondary/15 p-5 text-center space-y-2 animate-in fade-in duration-300">
        <span className="material-symbols-outlined text-[28px] text-secondary">favorite</span>
        <p className="text-[15px] font-bold text-text-main dark:text-white">{t('selfParent.checkinDoneTitle')}</p>
        <p className="text-[13px] text-text-sub dark:text-gray-400 leading-relaxed">{t('selfParent.checkinDoneBody')}</p>
        <button onClick={onDone} className="mt-2 text-[12px] font-bold text-secondary">
          {t('common.confirm')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-surface-dark p-5 border border-secondary/20">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-secondary/12 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px] text-secondary">spa</span>
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-bold text-text-main dark:text-white leading-snug">{item.title}</p>
          <p className="text-[13px] text-text-sub dark:text-gray-400 leading-relaxed mt-1">{item.description}</p>
        </div>
      </div>

      {!checkinOpen ? (
        <button
          onClick={() => {
            setCheckinOpen(true);
            trackEvent('self_parent_checkin_opened', {});
          }}
          className="mt-4 w-full h-11 rounded-xl border border-secondary/30 text-secondary font-bold text-[13px] active:scale-[0.99] transition-all"
        >
          {t('selfParent.checkinPrompt')}
        </button>
      ) : (
        <div className="mt-4 space-y-3 animate-in fade-in duration-200">
          <p className="text-[13px] font-bold text-text-main dark:text-white">{t('selfParent.checkinPrompt')}</p>
          <div className="grid grid-cols-3 gap-2">
            {(['helped', 'unsure', 'not_yet'] as CheckinChoice[]).map((c) => (
              <button
                key={c}
                onClick={() => setChoice(c)}
                className={`h-12 rounded-xl border text-[12px] font-medium transition-all px-1 leading-tight ${choice === c ? 'border-2 border-secondary bg-secondary/5 text-secondary' : 'border-beige-main/30 text-text-sub'}`}
              >
                {choiceLabel(c)}
              </button>
            ))}
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, 300))}
            placeholder={t('selfParent.checkinMemoPlaceholder')}
            rows={2}
            className="w-full rounded-xl border border-beige-main/30 bg-white dark:bg-surface-dark p-3 text-[13px] leading-relaxed text-text-main dark:text-white placeholder:text-gray-400 outline-none resize-none"
          />
          <button
            onClick={submit}
            disabled={!choice || submitting}
            className="w-full h-11 rounded-xl bg-secondary text-white font-bold text-[13px] active:scale-[0.99] transition-all disabled:opacity-40"
          >
            {t('selfParent.checkinSubmit')}
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  consultation,
  locale,
}: {
  consultation: ConsultationRow;
  locale: 'ko' | 'en';
}) {
  const rx = consultation.ai_prescription;
  const prescription: SelfParentPrescription | null = isSelfParentPrescription(rx) ? rx : null;
  const dateText = new Date(consultation.created_at).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US');

  return (
    <div className="rounded-2xl bg-white dark:bg-surface-dark p-4 border border-beige-main/20">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold text-text-main dark:text-white">
          {prescription?.sessionTitle || '내 마음'}
        </p>
        <span className="text-[11px] text-text-sub/80">{dateText}</span>
      </div>
      {prescription?.magicWordForSelf && (
        <div className="mt-2 flex items-start gap-1.5 text-secondary/80">
          <span className="material-symbols-outlined text-[16px] leading-none mt-0.5 shrink-0">format_quote</span>
          <p className="text-[12.5px] font-medium leading-relaxed">{prescription.magicWordForSelf}</p>
        </div>
      )}
    </div>
  );
}

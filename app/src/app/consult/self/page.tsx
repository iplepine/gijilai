'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/layout/Navbar';
import { ConsultModeToggle } from '@/components/consult/ConsultModeToggle';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { TabLoadingScreen } from '@/components/ui/TabLoadingScreen';
import { useLocale } from '@/i18n/LocaleProvider';
import { createConsultRequestController, isAbortError } from '@/lib/consultRequest';
import { trackEvent } from '@/lib/analytics';
import { getApiErrorMessage, readJsonResponse } from '@/lib/api';
import {
  formatSelfParentTool,
  isSelfParentPrescription,
  type SelfParentPrescription,
} from '@/lib/selfParentPrescription';
import type { SafetyCategory, SafetyResource } from '@/lib/selfReflectionGuardrail';

type Step = 'INPUT' | 'QUESTIONS' | 'RESULT';
const MAX_INPUT = 1000;

type QuestionOption = { id: string; text: string; freeText?: boolean };
type Question = { id: string; text: string; type: 'CHOICE' | 'TEXT'; options?: QuestionOption[] };

type SafetyPayload = {
  safetyTriggered: true;
  category: SafetyCategory;
  resources: SafetyResource[];
};

type QuestionsPayload = {
  safetyTriggered: false;
  empathy: string;
  questions: Question[];
};

type PrescriptionPayload = {
  safetyTriggered: false;
  prescription: SelfParentPrescription;
  sessionId: string | null;
  consultationId: string | null;
};

function SelfConsultInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const { selectedChildId } = useAppStore();

  const fromChildSession = searchParams.get('from') === 'child_consult';

  const [step, setStep] = useState<Step>('INPUT');
  const [reflection, setReflection] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  // LLM 호출 취소/타임아웃 — 없으면 통신이 멎었을 때 전체화면 스피너에 갇힌다.
  const consultRequest = useRef(createConsultRequestController()).current;
  const [error, setError] = useState<string | null>(null);

  const [empathy, setEmpathy] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);

  const [prescription, setPrescription] = useState<SelfParentPrescription | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [savedConsultId, setSavedConsultId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [safety, setSafety] = useState<SafetyPayload | null>(null);

  useEffect(() => {
    trackEvent('self_parent_consult_opened', { from: fromChildSession ? 'child_consult' : 'direct' });
  }, [fromChildSession]);

  const childIdParam = useMemo(() => selectedChildId ?? null, [selectedChildId]);

  const handleStart = useCallback(async () => {
    if (isLoading) return;
    const trimmed = reflection.trim();
    if (!trimmed) {
      setError(t('selfParent.emptyError'));
      return;
    }
    setError(null);
    setIsLoading(true);
    setLoadingLabel(t('selfParent.questionsLoading'));
    try {
      const res = await consultRequest.run('/api/consult/self/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reflection: trimmed, childId: childIdParam }),
      });
      if (res.status === 402) {
        // 구독 필요 — 가격 페이지로
        router.push('/pricing?from=self_consult');
        return;
      }
      const payload = await readJsonResponse<SafetyPayload | QuestionsPayload | { error?: string; code?: string }>(res);
      if (!res.ok || !payload) {
        const code = (payload as { code?: string })?.code;
        if (code === 'too_short') setError(t('selfParent.tooShortError'));
        else if (code === 'empty') setError(t('selfParent.emptyError'));
        else setError(getApiErrorMessage(payload, t('selfParent.genericError')));
        return;
      }
      if ((payload as SafetyPayload).safetyTriggered) {
        const sp = payload as SafetyPayload;
        setSafety(sp);
        trackEvent('self_parent_safety_triggered', { category: sp.category, stage: 'questions' });
        return;
      }
      const qp = payload as QuestionsPayload;
      setEmpathy(qp.empathy);
      setQuestions(qp.questions);
      setQuestionIndex(0);
      setStep('QUESTIONS');
      trackEvent('self_parent_questions_received', {});
    } catch (err) {
      // 취소는 실패가 아니다 — 적어둔 반성문은 그대로 두고 조용히 입력 화면으로.
      if (isAbortError(err)) {
        if (consultRequest.reasonRef.current === 'timeout') setError(t('consult.timeoutRetry'));
        return;
      }
      console.error('[self consult] start error:', err);
      setError(t('selfParent.genericError'));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, reflection, childIdParam, router, t, consultRequest]);

  const submitForPrescription = useCallback(async () => {
    if (isLoading) return;
    setError(null);
    setIsLoading(true);
    setLoadingLabel(t('selfParent.prescriptionLoading'));
    try {
      const res = await consultRequest.run('/api/consult/self/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reflection: reflection.trim(),
          questions: questions.map((q) => ({ id: q.id, text: q.text })),
          answers,
          childId: childIdParam,
        }),
      });
      if (res.status === 402) {
        router.push('/pricing?from=self_consult');
        return;
      }
      const payload = await readJsonResponse<SafetyPayload | PrescriptionPayload | { error?: string }>(res);
      if (!res.ok || !payload) {
        setError(getApiErrorMessage(payload, t('selfParent.genericError')));
        return;
      }
      if ((payload as SafetyPayload).safetyTriggered) {
        const sp = payload as SafetyPayload;
        setSafety(sp);
        trackEvent('self_parent_safety_triggered', { category: sp.category, stage: 'prescription' });
        return;
      }
      const pp = payload as PrescriptionPayload;
      if (!isSelfParentPrescription(pp.prescription)) {
        setError(t('selfParent.genericError'));
        return;
      }
      setPrescription(pp.prescription);
      setSavedSessionId(pp.sessionId);
      setSavedConsultId(pp.consultationId);
      setStep('RESULT');
      trackEvent('self_parent_prescription_received', { tool: pp.prescription.action.tool });
    } catch (err) {
      if (isAbortError(err)) {
        if (consultRequest.reasonRef.current === 'timeout') setError(t('consult.timeoutRetry'));
        return;
      }
      console.error('[self consult] prescription error:', err);
      setError(t('selfParent.genericError'));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, reflection, questions, answers, childIdParam, router, t, consultRequest]);

  const handleQuestionNext = useCallback(() => {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((i) => i + 1);
    } else {
      void submitForPrescription();
    }
  }, [questionIndex, questions.length, submitForPrescription]);

  // "마음에 담기" — action을 SELF_PARENT 실천으로 저장하고 내 마음 기록으로 이동
  const handleSaveAction = useCallback(async () => {
    if (!prescription || saving) return;
    trackEvent('self_parent_consult_done', { tool: prescription.action.tool });
    // 저장 컨텍스트가 없으면(처방 저장 실패 등) 그냥 기록 화면으로
    if (!savedSessionId || !savedConsultId) {
      router.push('/consult/self/records');
      return;
    }
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('practice_items').insert({
        session_id: savedSessionId,
        consultation_id: savedConsultId,
        title: prescription.action.title,
        description: prescription.action.description,
        duration: prescription.action.duration,
        encouragement: prescription.magicWordForSelf || null,
        type: 'SELF_PARENT',
        status: 'ACTIVE',
      });
      if (insertError) throw insertError;
      trackEvent('self_parent_practice_saved', { tool: prescription.action.tool });
    } catch (err) {
      console.warn('[self consult] save action failed:', err);
      // 저장 실패해도 기록 화면으로 (상담 기록은 이미 저장됨)
    } finally {
      setSaving(false);
      router.push('/consult/self/records');
    }
  }, [prescription, saving, savedSessionId, savedConsultId, router]);

  if (authLoading) {
    return <TabLoadingScreen navbarTitle={t('selfParent.navTitle')} showBack label={t('common.loading')} />;
  }
  if (!user) {
    if (typeof window !== 'undefined') router.replace('/login?redirect=/consult/self');
    return null;
  }

  // 위기 안내 화면 (전체 대체)
  if (safety) {
    return <SafetyView safety={safety} t={t} onClose={() => router.push('/')} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background-light dark:bg-background-dark flex flex-col items-center font-body">
      <div className="w-full max-w-md flex flex-col min-h-[100dvh]">
        <Navbar
          title={step === 'RESULT' ? t('selfParent.navTitleResult') : t('selfParent.navTitle')}
          showBack
        />

        <main className="app-fixed-cta-scroll flex-1 px-6 pb-32">
          {step === 'INPUT' && (
            <div className="pt-6 animate-in fade-in duration-300">
              <div className="mb-6">
                <ConsultModeToggle current="self" />
              </div>
              <p className="text-[12px] font-bold text-secondary tracking-wide">{t('selfParent.heroEyebrow')}</p>
              <h1 className="mt-2 text-[24px] font-black text-text-main dark:text-white leading-snug whitespace-pre-line">
                {t('selfParent.heroTitle')}
              </h1>
              <div className="mt-4 rounded-[20px] bg-secondary/8 dark:bg-secondary/15 px-4 py-3.5">
                <p className="text-[13px] font-medium text-secondary/90 dark:text-secondary leading-relaxed whitespace-pre-line">
                  {t('selfParent.heroReassure')}
                </p>
              </div>
              <p className="mt-4 text-[14px] text-text-sub dark:text-gray-400 leading-relaxed">
                {t('selfParent.heroDesc')}
              </p>

              <div className="mt-6 relative">
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value.slice(0, MAX_INPUT))}
                  placeholder={t('selfParent.inputPlaceholder')}
                  rows={6}
                  className="w-full rounded-2xl border border-beige-main/30 bg-white dark:bg-surface-dark p-4 pr-12 text-[14px] leading-relaxed text-text-main dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-secondary/40 focus:border-secondary outline-none resize-none"
                />
                <div className="absolute right-3 bottom-3">
                  <VoiceInputButton value={reflection} onChange={setReflection} maxLength={MAX_INPUT} />
                </div>
              </div>
              <p className="mt-2 text-[12px] text-text-sub/80">{t('selfParent.inputHint')}</p>
              {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}
            </div>
          )}

          {step === 'QUESTIONS' && questions.length > 0 && (
            <div className="pt-8 animate-in fade-in duration-300">
              {empathy && questionIndex === 0 && (
                <div className="mb-6 rounded-2xl bg-secondary/8 dark:bg-secondary/15 p-5">
                  <p className="text-[14px] text-text-main dark:text-gray-200 leading-relaxed">{empathy}</p>
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-4">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === questionIndex ? 'w-8 bg-secondary' : i < questionIndex ? 'w-4 bg-secondary/50' : 'w-4 bg-gray-200 dark:bg-gray-700'}`}
                  />
                ))}
              </div>
              <QuestionCard
                question={questions[questionIndex]}
                value={answers[questions[questionIndex].id] ?? ''}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [questions[questionIndex].id]: v }))}
                t={t}
              />
              {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}
            </div>
          )}

          {step === 'RESULT' && prescription && (
            <ResultView
              prescription={prescription}
              t={t}
              saving={saving}
              onSave={handleSaveAction}
              onLater={() => {
                trackEvent('self_parent_consult_done', { tool: prescription.action.tool, saved: false });
                router.push('/');
              }}
            />
          )}
        </main>

        {/* 하단 고정 CTA */}
        {!isLoading && step === 'INPUT' && (
          <FixedCta
            label={t('selfParent.startButton')}
            disabled={!reflection.trim()}
            onClick={handleStart}
          />
        )}
        {!isLoading && step === 'QUESTIONS' && questions.length > 0 && (
          <FixedCta
            label={questionIndex < questions.length - 1 ? t('selfParent.questionNext') : t('selfParent.questionComplete')}
            disabled={false}
            onClick={handleQuestionNext}
          />
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-5 px-8">
            <span className="h-12 w-12 animate-spin rounded-full border-4 border-secondary/15 border-t-secondary" />
            <p className="text-[15px] font-medium text-text-sub dark:text-gray-300 text-center">{loadingLabel}</p>
            {/* 이 오버레이는 화면 전체(내비 포함)를 덮는다 — 빠져나갈 길을 같이 준다. */}
            <button
              type="button"
              onClick={() => consultRequest.cancel()}
              className="px-5 py-2.5 rounded-full text-[13px] font-bold text-text-sub dark:text-gray-400 border border-text-sub/20 dark:border-gray-600 active:scale-[0.98] transition-all"
            >
              {t('consult.cancelGenerating')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FixedCta({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="app-fixed-cta fixed bottom-0 left-0 right-0 p-6 flex justify-center z-40 bg-gradient-to-t from-[#FAFCFA] via-[#FAFCFA]/90 to-transparent dark:from-[#161311] dark:via-[#161311]/90 pointer-events-none">
      <div className="max-w-md w-full pointer-events-auto">
        <button
          onClick={onClick}
          disabled={disabled}
          className="w-full h-14 rounded-2xl bg-secondary text-white font-bold text-[15px] shadow-lg shadow-secondary/20 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {label}
        </button>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  value,
  onChange,
  t,
}: {
  question: Question;
  value: string;
  onChange: (v: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [freeTextActive, setFreeTextActive] = useState(false);
  const freeOption = question.options?.find((o) => o.freeText);

  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-bold text-text-main dark:text-white leading-snug">{question.text}</h2>
      {question.type === 'CHOICE' && question.options ? (
        <div className="space-y-2">
          {question.options.map((opt) => {
            const isFree = !!opt.freeText;
            const selected = isFree ? freeTextActive : value === opt.text && !freeTextActive;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (isFree) {
                    setFreeTextActive(true);
                    onChange('');
                  } else {
                    setFreeTextActive(false);
                    onChange(opt.text);
                  }
                }}
                className={`w-full text-left rounded-2xl p-4 border-2 transition-all active:scale-[0.99] ${selected ? 'border-secondary bg-secondary/5' : 'border-beige-main/20 bg-white dark:bg-surface-dark'}`}
              >
                <span className="text-[14px] font-medium text-text-main dark:text-gray-200">{opt.text}</span>
              </button>
            );
          })}
          {freeOption && freeTextActive && (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t('selfParent.answerPlaceholder')}
              rows={3}
              className="w-full rounded-2xl border border-secondary/40 bg-white dark:bg-surface-dark p-4 text-[14px] leading-relaxed text-text-main dark:text-white placeholder:text-gray-400 outline-none resize-none"
            />
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('selfParent.answerPlaceholder')}
          rows={4}
          className="w-full rounded-2xl border border-beige-main/30 bg-white dark:bg-surface-dark p-4 text-[14px] leading-relaxed text-text-main dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-secondary/40 outline-none resize-none"
        />
      )}
    </div>
  );
}

function ResultView({
  prescription,
  t,
  saving,
  onSave,
  onLater,
}: {
  prescription: SelfParentPrescription;
  t: (key: string, params?: Record<string, string | number>) => string;
  saving: boolean;
  onSave: () => void;
  onLater: () => void;
}) {
  return (
    <div className="pt-6 space-y-4 animate-in fade-in duration-300">
      {/* 1. 인정 */}
      <div className="rounded-2xl bg-white dark:bg-surface-dark p-5 border border-secondary/20">
        <p className="text-[12px] font-bold text-secondary flex items-center gap-1.5 mb-2">
          <span className="material-symbols-outlined text-[16px] fill-1">favorite</span>
          {t('selfParent.ackTitle')}
        </p>
        <p className="text-[15px] font-medium text-text-main dark:text-white leading-relaxed">
          {prescription.acknowledgment}
        </p>
      </div>

      {/* 2. 마음 비춰보기 */}
      <div className="rounded-2xl bg-white dark:bg-surface-dark p-5 border border-beige-main/30">
        <p className="text-[12px] font-bold text-[#D08B5B] flex items-center gap-1.5 mb-2">
          <span className="material-symbols-outlined text-[16px]">self_improvement</span>
          {t('selfParent.reflectionTitle')}
        </p>
        <p className="text-[14px] text-text-main dark:text-gray-200 leading-relaxed">{prescription.reflection}</p>
      </div>

      {/* 3. 나에게 해줄 한 마디 */}
      <div className="rounded-2xl bg-secondary p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
        <div className="relative z-10">
          <p className="text-[13px] font-black flex items-center gap-1.5 mb-3">
            <span className="material-symbols-outlined text-[18px]">format_quote</span>
            {t('selfParent.magicWordTitle')}
          </p>
          <p className="text-[17px] font-bold leading-relaxed">&ldquo;{prescription.magicWordForSelf}&rdquo;</p>
        </div>
      </div>

      {/* 4. 오늘 나를 위한 한 가지 */}
      <div className="rounded-2xl bg-white dark:bg-surface-dark p-5 border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px] text-primary">spa</span>
          </div>
          <div>
            <p className="text-[15px] font-black text-text-main dark:text-white">{t('selfParent.actionTitle')}</p>
            <p className="text-[11px] text-primary font-medium">{formatSelfParentTool(prescription.action.tool)}</p>
          </div>
        </div>
        <p className="text-[15px] font-bold text-text-main dark:text-white leading-snug mb-2">
          {prescription.action.title}
        </p>
        <p className="text-[13px] text-text-sub dark:text-gray-400 leading-relaxed">
          {prescription.action.description}
        </p>
        <p className="mt-3 text-[12px] text-secondary font-medium">
          {t('selfParent.actionDays', { days: prescription.action.duration })}
        </p>
        <p className="mt-1 text-[12px] text-text-sub/70">{t('selfParent.actionOptional')}</p>
      </div>

      {/* 5. 캐치프라이즈 */}
      <div className="text-center py-6 space-y-2">
        <p className="text-[15px] font-bold text-primary leading-relaxed whitespace-pre-line">
          {t('catchphrase.main')}
        </p>
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="w-full h-14 rounded-2xl bg-secondary text-white font-bold text-[15px] shadow-lg shadow-secondary/20 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {saving ? t('selfParent.starting') : t('selfParent.saveActionButton')}
      </button>
      <button
        onClick={onLater}
        disabled={saving}
        className="w-full py-3 text-[14px] font-bold text-text-sub transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {t('selfParent.doLater')}
      </button>
    </div>
  );
}

function SafetyView({
  safety,
  t,
  onClose,
}: {
  safety: SafetyPayload;
  t: (key: string, params?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  // headline/body는 서버 가드레일과 같은 톤. 여기선 카테고리별 정적 메시지를 클라이언트에서 재구성.
  const headlineMap: Record<SafetyCategory, string> = {
    SELF_HARM: '지금 많이 힘드시군요. 혼자 견디지 않으셔도 돼요.',
    VIOLENCE: '많이 지치고 한계에 다다른 순간이 있으셨던 것 같아요.',
    PERSISTENT_DISTRESS: '꽤 오래 무거운 마음을 안고 계셨던 것 같아요.',
  };
  const bodyMap: Record<SafetyCategory, string> = {
    SELF_HARM:
      'AI 상담보다 지금은 사람의 도움이 더 필요한 순간일 수 있어요. 아래로 연결하면 24시간 이야기를 들어줄 분이 있어요. 양육자님의 안전이 무엇보다 먼저예요.',
    VIOLENCE:
      '그런 마음이 든다는 게 양육자님이 나쁜 사람이라는 뜻은 아니에요. 다만 아이와 양육자님 모두의 안전을 위해, 지금은 전문기관의 도움을 받는 것이 가장 좋아요.',
    PERSISTENT_DISTRESS:
      '이 정도로 오래 힘드셨다면 양육 기술의 문제가 아니라 양육자님 자신을 먼저 돌봐야 할 때예요. 전문 상담은 약함의 표시가 아니라 회복의 시작이에요.',
  };

  return (
    <div className="min-h-[100dvh] bg-background-light dark:bg-background-dark flex flex-col items-center font-body">
      <div className="w-full max-w-md flex flex-col min-h-[100dvh]">
        <Navbar title={t('selfParent.safetyTitle')} showBack />
        <main className="flex-1 px-6 pt-10 pb-32">
          <div className="rounded-2xl bg-white dark:bg-surface-dark p-6 border border-secondary/20 space-y-3">
            <p className="text-[18px] font-bold text-text-main dark:text-white leading-snug">
              {headlineMap[safety.category]}
            </p>
            <p className="text-[14px] text-text-sub dark:text-gray-300 leading-relaxed">{bodyMap[safety.category]}</p>
          </div>

          <div className="mt-6">
            <p className="text-[12px] font-bold text-text-sub uppercase tracking-wide mb-3">
              {t('selfParent.safetyResourcesLabel')}
            </p>
            <div className="space-y-2.5">
              {safety.resources.map((r, i) => (
                <a
                  key={i}
                  href={`tel:${r.contact.replace(/[^0-9]/g, '')}`}
                  className="flex items-center justify-between rounded-2xl bg-white dark:bg-surface-dark p-4 border border-beige-main/30 active:scale-[0.99] transition-all"
                >
                  <div>
                    <p className="text-[15px] font-bold text-text-main dark:text-white">{r.name}</p>
                    {r.note && <p className="text-[12px] text-text-sub mt-0.5">{r.note}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 text-primary">
                    <span className="material-symbols-outlined text-[18px]">call</span>
                    <span className="text-[15px] font-black">{r.contact}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <p className="mt-6 text-[12px] text-text-sub/80 leading-relaxed text-center">
            {t('selfParent.safetyReassure')}
          </p>
        </main>

        <div className="app-fixed-cta fixed bottom-0 left-0 right-0 p-6 flex justify-center z-40 bg-gradient-to-t from-[#FAFCFA] via-[#FAFCFA]/90 to-transparent dark:from-[#161311] dark:via-[#161311]/90 pointer-events-none">
          <div className="max-w-md w-full pointer-events-auto">
            <button
              onClick={onClose}
              className="w-full h-14 rounded-2xl bg-secondary text-white font-bold text-[15px] active:scale-[0.98] transition-all"
            >
              {t('selfParent.safetyClose')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SelfConsultPage() {
  return (
    <Suspense fallback={null}>
      <SelfConsultInner />
    </Suspense>
  );
}

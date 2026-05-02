'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { useLocale } from '@/i18n/LocaleProvider';

export type ChildReactionType =
    | 'cooperated'
    | 'resisted_then_settled'
    | 'escalated'
    | 'no_clear_reaction'
    | 'not_tried'
    | 'custom';

export type PracticeAiFeedback = {
    reactionInsight: string;
    tomorrowAdjustment: string;
    parentEncouragement: string;
};

export type PracticeCheckSaveResult = {
    aiFeedback?: PracticeAiFeedback | null;
};

interface PracticeCheckModalProps {
    practiceTitle: string;
    onSave: (
        done: boolean,
        memo: string | null,
        childReactionType?: ChildReactionType | null,
        childReactionNote?: string | null,
    ) => Promise<PracticeCheckSaveResult | null | void>;
    onClose: () => void;
    existingDone?: boolean;
    existingMemo?: string | null;
    existingChildReactionType?: ChildReactionType | null;
    existingChildReactionNote?: string | null;
    existingAiFeedback?: PracticeAiFeedback | null;
    enableChildReactionFeedback?: boolean;
    recentFailCount?: number;
    sessionId?: string;
}

export function PracticeCheckModal({
    practiceTitle,
    onSave,
    onClose,
    existingDone,
    existingMemo,
    existingChildReactionType,
    existingChildReactionNote,
    existingAiFeedback,
    enableChildReactionFeedback = false,
    recentFailCount = 0,
    sessionId,
}: PracticeCheckModalProps) {
    const router = useRouter();
    const { t } = useLocale();
    const [done, setDone] = useState(existingDone ?? true);
    const [memo, setMemo] = useState(existingMemo || '');
    const [childReactionType, setChildReactionType] = useState<ChildReactionType | null>(existingChildReactionType ?? null);
    const [childReactionNote, setChildReactionNote] = useState(existingChildReactionNote || '');
    const [aiFeedback, setAiFeedback] = useState<PracticeAiFeedback | null>(existingAiFeedback ?? null);
    const [savedWithFeedback, setSavedWithFeedback] = useState(false);
    const [reactionError, setReactionError] = useState(false);
    const [saving, setSaving] = useState(false);

    const reactionOptions: Array<{ value: ChildReactionType; label: string }> = [
        { value: 'cooperated', label: t('practices.reactionCooperated') },
        { value: 'resisted_then_settled', label: t('practices.reactionSettled') },
        { value: 'escalated', label: t('practices.reactionEscalated') },
        { value: 'no_clear_reaction', label: t('practices.reactionNoClear') },
        ...(done ? [] : [{ value: 'not_tried' as const, label: t('practices.reactionNotTried') }]),
        { value: 'custom', label: t('practices.reactionCustom') },
    ];

    const handleSave = async () => {
        if (enableChildReactionFeedback && !childReactionType) {
            setReactionError(true);
            return;
        }

        setSaving(true);
        try {
            const result = await onSave(
                done,
                memo.trim() || null,
                enableChildReactionFeedback ? childReactionType : null,
                enableChildReactionFeedback ? childReactionNote.trim() || null : null,
            );
            const nextFeedback = result && 'aiFeedback' in result ? result.aiFeedback ?? null : null;
            if (nextFeedback) {
                setAiFeedback(nextFeedback);
                setSavedWithFeedback(true);
                return;
            }
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-sm max-h-[92vh] bg-white dark:bg-surface-dark rounded-3xl shadow-2xl overflow-y-auto animate-slide-up">
                <div className="p-6 border-b border-beige-main/10 dark:border-white/5 bg-beige-main/5 dark:bg-white/5">
                    <h4 className="font-bold text-lg text-text-main dark:text-white">{t('practices.todayRecord')}</h4>
                    <p className="text-[13px] text-text-sub mt-1">{practiceTitle}</p>
                </div>

                <div className="p-6 space-y-5">
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setDone(true);
                                if (childReactionType === 'not_tried') {
                                    setChildReactionType(null);
                                }
                            }}
                            className={`flex-1 h-14 rounded-2xl border-2 text-[15px] font-bold transition-all flex items-center justify-center gap-2 ${
                                done
                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                                    : 'bg-white dark:bg-surface-dark border-beige-main/20 text-text-sub'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            {t('practices.didIt')}
                        </button>
                        <button
                            onClick={() => setDone(false)}
                            className={`flex-1 h-14 rounded-2xl border-2 text-[15px] font-bold transition-all flex items-center justify-center gap-2 ${
                                !done
                                    ? 'bg-orange-50 border-orange-300 text-orange-600'
                                    : 'bg-white dark:bg-surface-dark border-beige-main/20 text-text-sub'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">schedule</span>
                            {t('practices.didNot')}
                        </button>
                    </div>

                    {!done && (
                        <p className="text-[13px] text-text-sub leading-relaxed bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3">
                            {t('practices.encourageMessage')}
                            {recentFailCount >= 2 && sessionId && (
                                <button
                                    onClick={() => {
                                        onClose();
                                        router.push(`/consult?sessionId=${sessionId}`);
                                    }}
                                    className="block mt-2 text-primary font-bold text-[12px] underline underline-offset-2"
                                >
                                    {t('practices.findAlternative')}
                                </button>
                            )}
                        </p>
                    )}

                    <div>
                        <label className="block text-[11px] font-bold text-text-sub mb-2 uppercase tracking-wider">{t('practices.memoLabel')}</label>
                        <p className="mb-2 text-[12px] text-text-muted dark:text-gray-500">{t('practices.memoHelper')}</p>
                        <div className="relative">
                            <textarea
                                value={memo}
                                onChange={(e) => setMemo(e.target.value.slice(0, 200))}
                                maxLength={200}
                                placeholder={t('practices.memoPlaceholder')}
                                className="w-full h-24 p-4 pr-14 text-[14px] leading-relaxed rounded-lg border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-white dark:bg-surface-dark dark:text-white"
                            />
                            <VoiceInputButton
                                value={memo}
                                onChange={setMemo}
                                maxLength={200}
                                className="absolute bottom-3 right-3 h-9 w-9"
                            />
                        </div>
                    </div>

                    {enableChildReactionFeedback && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-bold text-text-sub mb-2 uppercase tracking-wider">{t('practices.childReactionLabel')}</label>
                                <p className="mb-2 text-[12px] text-text-muted dark:text-gray-500">{t('practices.childReactionHelper')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {reactionOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                setChildReactionType(option.value);
                                                setReactionError(false);
                                            }}
                                            className={`rounded-full px-3 py-2 text-[12px] font-bold transition-all ${
                                                childReactionType === option.value
                                                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                                    : 'bg-primary/5 text-text-sub dark:text-slate-300'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                {reactionError && (
                                    <p className="mt-2 text-[12px] font-medium text-orange-600">{t('practices.childReactionRequired')}</p>
                                )}
                            </div>

                            <div className="relative">
                                <textarea
                                    value={childReactionNote}
                                    onChange={(e) => setChildReactionNote(e.target.value.slice(0, 200))}
                                    maxLength={200}
                                    placeholder={t('practices.childReactionPlaceholder')}
                                    className="w-full h-20 p-4 pr-14 text-[14px] leading-relaxed rounded-lg border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-white dark:bg-surface-dark dark:text-white"
                                />
                                <VoiceInputButton
                                    value={childReactionNote}
                                    onChange={setChildReactionNote}
                                    maxLength={200}
                                    className="absolute bottom-3 right-3 h-9 w-9"
                                />
                            </div>

                            {aiFeedback && (
                                <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4 space-y-3">
                                    <p className="text-[12px] font-black text-primary flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
                                        {t('practices.aiFeedbackTitle')}
                                    </p>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-[11px] font-bold text-text-sub">{t('practices.aiFeedbackInsight')}</p>
                                            <p className="text-[13px] text-text-main dark:text-white leading-relaxed">{aiFeedback.reactionInsight}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-text-sub">{t('practices.aiFeedbackAdjustment')}</p>
                                            <p className="text-[13px] text-text-main dark:text-white leading-relaxed">{aiFeedback.tomorrowAdjustment}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-text-sub">{t('practices.aiFeedbackEncouragement')}</p>
                                            <p className="text-[13px] text-text-main dark:text-white leading-relaxed">{aiFeedback.parentEncouragement}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-beige-main/5 dark:bg-white/5 flex gap-3">
                    {savedWithFeedback ? (
                        <Button variant="primary" fullWidth onClick={onClose}>
                            {t('common.close')}
                        </Button>
                    ) : (
                        <>
                            <Button variant="secondary" fullWidth onClick={onClose}>{t('common.cancel')}</Button>
                            <Button variant="primary" fullWidth onClick={handleSave} disabled={saving}>
                                {saving ? t('practices.generatingFeedback') : t('common.save')}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

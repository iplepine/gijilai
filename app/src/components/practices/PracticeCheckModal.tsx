'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { useLocale } from '@/i18n/LocaleProvider';

export type PracticeAttemptType =
    | 'as_prescribed'
    | 'changed_words'
    | 'shortened'
    | 'adapted_to_situation'
    | 'barely_tried';

export type ChildReactionType =
    | 'cooperated'
    | 'resisted_then_settled'
    | 'escalated'
    | 'no_clear_reaction'
    | 'not_tried'
    | 'custom';

export type ParentImpressionType =
    | 'this_is_it'
    | 'seems_right'
    | 'not_sure'
    | 'seems_wrong'
    | 'want_to_adjust';

export type PracticeAiFeedback = {
    reactionInsight: string;
    tomorrowAdjustment: string;
    parentEncouragement: string;
};

export type PracticeCheckSavePayload = {
    done: boolean;
    memo: string | null;
    practiceAttemptType?: PracticeAttemptType | null;
    practiceAttemptNote?: string | null;
    childReactionType?: ChildReactionType | null;
    childReactionNote?: string | null;
    parentImpressionType?: ParentImpressionType | null;
};

export type PracticeCheckSaveResult = {
    aiFeedback?: PracticeAiFeedback | null;
};

interface PracticeCheckModalProps {
    practiceTitle: string;
    onSave: (payload: PracticeCheckSavePayload) => Promise<PracticeCheckSaveResult | null | void>;
    onClose: () => void;
    onChangePractice?: () => void;
    existingDone?: boolean;
    existingMemo?: string | null;
    existingPracticeAttemptType?: PracticeAttemptType | null;
    existingPracticeAttemptNote?: string | null;
    existingChildReactionType?: ChildReactionType | null;
    existingChildReactionNote?: string | null;
    existingParentImpressionType?: ParentImpressionType | null;
    existingAiFeedback?: PracticeAiFeedback | null;
    enableChildReactionFeedback?: boolean;
    recentFailCount?: number;
}

export function PracticeCheckModal({
    practiceTitle,
    onSave,
    onClose,
    onChangePractice,
    existingDone,
    existingMemo,
    existingPracticeAttemptType,
    existingPracticeAttemptNote,
    existingChildReactionType,
    existingChildReactionNote,
    existingParentImpressionType,
    existingAiFeedback,
    enableChildReactionFeedback = false,
    recentFailCount = 0,
}: PracticeCheckModalProps) {
    const { t } = useLocale();
    const [done, setDone] = useState(existingDone ?? true);
    const [memo, setMemo] = useState(existingMemo || '');
    const [practiceAttemptType, setPracticeAttemptType] = useState<PracticeAttemptType | null>(existingPracticeAttemptType ?? null);
    const [practiceAttemptNote, setPracticeAttemptNote] = useState(existingPracticeAttemptNote || '');
    const [childReactionType, setChildReactionType] = useState<ChildReactionType | null>(existingChildReactionType ?? null);
    const [childReactionNote, setChildReactionNote] = useState(existingChildReactionNote || '');
    const [parentImpressionType, setParentImpressionType] = useState<ParentImpressionType | null>(existingParentImpressionType ?? null);
    const [aiFeedback, setAiFeedback] = useState<PracticeAiFeedback | null>(existingAiFeedback ?? null);
    const [savedWithFeedback, setSavedWithFeedback] = useState(false);
    const [attemptError, setAttemptError] = useState(false);
    const [reactionError, setReactionError] = useState(false);
    const [impressionError, setImpressionError] = useState(false);
    const [saving, setSaving] = useState(false);

    const attemptOptions: Array<{ value: PracticeAttemptType; label: string }> = [
        { value: 'as_prescribed', label: t('practices.attemptAsPrescribed') },
        { value: 'changed_words', label: t('practices.attemptChangedWords') },
        { value: 'shortened', label: t('practices.attemptShortened') },
        { value: 'adapted_to_situation', label: t('practices.attemptAdapted') },
        { value: 'barely_tried', label: t('practices.attemptBarelyTried') },
    ];

    const reactionOptions: Array<{ value: ChildReactionType; label: string }> = [
        { value: 'cooperated', label: t('practices.reactionCooperated') },
        { value: 'resisted_then_settled', label: t('practices.reactionSettled') },
        { value: 'escalated', label: t('practices.reactionEscalated') },
        { value: 'no_clear_reaction', label: t('practices.reactionNoClear') },
        ...(done ? [] : [{ value: 'not_tried' as const, label: t('practices.reactionNotTried') }]),
        { value: 'custom', label: t('practices.reactionCustom') },
    ];

    const impressionOptions: Array<{ value: ParentImpressionType; label: string }> = [
        { value: 'this_is_it', label: t('practices.impressionThisIsIt') },
        { value: 'seems_right', label: t('practices.impressionSeemsRight') },
        { value: 'not_sure', label: t('practices.impressionNotSure') },
        { value: 'seems_wrong', label: t('practices.impressionSeemsWrong') },
        { value: 'want_to_adjust', label: t('practices.impressionWantToAdjust') },
    ];

    const showPracticeChangeAction = enableChildReactionFeedback && !!aiFeedback && !!onChangePractice;

    const handleSave = async () => {
        if (enableChildReactionFeedback) {
            const missingAttempt = !practiceAttemptType;
            const missingReaction = !childReactionType;
            const missingImpression = !parentImpressionType;
            setAttemptError(missingAttempt);
            setReactionError(missingReaction);
            setImpressionError(missingImpression);
            if (missingAttempt || missingReaction || missingImpression) {
                return;
            }
        }

        setSaving(true);
        try {
            const result = await onSave({
                done,
                memo: enableChildReactionFeedback ? null : memo.trim() || null,
                practiceAttemptType: enableChildReactionFeedback ? practiceAttemptType : null,
                practiceAttemptNote: enableChildReactionFeedback ? practiceAttemptNote.trim() || null : null,
                childReactionType: enableChildReactionFeedback ? childReactionType : null,
                childReactionNote: enableChildReactionFeedback ? childReactionNote.trim() || null : null,
                parentImpressionType: enableChildReactionFeedback ? parentImpressionType : null,
            });
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
        <div className="app-modal-overlay fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="app-modal-panel-scroll w-full max-w-sm bg-white dark:bg-surface-dark rounded-3xl shadow-2xl animate-slide-up">
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
                                if (practiceAttemptType === 'barely_tried') {
                                    setPracticeAttemptType(null);
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
                            onClick={() => {
                                setDone(false);
                                setPracticeAttemptType((current) => current ?? 'barely_tried');
                                setChildReactionType((current) => current ?? 'not_tried');
                                setParentImpressionType((current) => current ?? 'not_sure');
                                setAttemptError(false);
                                setReactionError(false);
                                setImpressionError(false);
                            }}
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
                            {recentFailCount >= 2 && onChangePractice && (
                                <button
                                    onClick={onChangePractice}
                                    className="block mt-2 text-primary font-bold text-[12px] underline underline-offset-2"
                                >
                                    {t('practices.findAlternative')}
                                </button>
                            )}
                        </p>
                    )}

                    {!enableChildReactionFeedback && (
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
                    )}

                    {enableChildReactionFeedback && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-text-sub mb-2 uppercase tracking-wider">{t('practices.attemptLabel')}</label>
                                <p className="mb-2 text-[12px] text-text-muted dark:text-gray-500">{t('practices.attemptHelper')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {attemptOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                setPracticeAttemptType(option.value);
                                                setAttemptError(false);
                                            }}
                                            className={`rounded-full px-3 py-2 text-[12px] font-bold transition-all ${
                                                practiceAttemptType === option.value
                                                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                                    : 'bg-primary/5 text-text-sub dark:text-slate-300'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                {attemptError && (
                                    <p className="mt-2 text-[12px] font-medium text-orange-600">{t('practices.attemptRequired')}</p>
                                )}
                            </div>

                            <div className="relative">
                                <textarea
                                    value={practiceAttemptNote}
                                    onChange={(e) => setPracticeAttemptNote(e.target.value.slice(0, 240))}
                                    maxLength={240}
                                    placeholder={t('practices.attemptPlaceholder')}
                                    className="w-full h-20 p-4 pr-14 text-[14px] leading-relaxed rounded-lg border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-white dark:bg-surface-dark dark:text-white"
                                />
                                <VoiceInputButton
                                    value={practiceAttemptNote}
                                    onChange={setPracticeAttemptNote}
                                    maxLength={240}
                                    className="absolute bottom-3 right-3 h-9 w-9"
                                />
                            </div>

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

                            <div>
                                <label className="block text-[11px] font-bold text-text-sub mb-2 uppercase tracking-wider">{t('practices.parentImpressionLabel')}</label>
                                <p className="mb-2 text-[12px] text-text-muted dark:text-gray-500">{t('practices.parentImpressionHelper')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {impressionOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                setParentImpressionType(option.value);
                                                setImpressionError(false);
                                            }}
                                            className={`rounded-full px-3 py-2 text-[12px] font-bold transition-all ${
                                                parentImpressionType === option.value
                                                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                                    : 'bg-primary/5 text-text-sub dark:text-slate-300'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                {impressionError && (
                                    <p className="mt-2 text-[12px] font-medium text-orange-600">{t('practices.parentImpressionRequired')}</p>
                                )}
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
                                    {showPracticeChangeAction && (
                                        <button
                                            type="button"
                                            onClick={onChangePractice}
                                            className="w-full h-11 rounded-xl bg-white dark:bg-surface-dark border border-primary/15 text-primary text-[13px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                                            {t('practices.changePracticeCta')}
                                        </button>
                                    )}
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
                                {saving ? (enableChildReactionFeedback ? t('practices.generatingFeedback') : t('common.saving')) : t('common.save')}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

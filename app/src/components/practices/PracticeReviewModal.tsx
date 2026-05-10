'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { useLocale } from '@/i18n/LocaleProvider';

interface PracticeReviewModalProps {
    practiceTitle: string;
    doneDays: number;
    totalDays: number;
    sessionId?: string;
    reviewMode?: 'complete' | 'due' | 'stale';
    onSave: (content: string) => Promise<void>;
    onResolveSession?: () => Promise<void>;
    onClose: () => void;
}

export function PracticeReviewModal({
    practiceTitle,
    doneDays,
    totalDays,
    sessionId,
    reviewMode = 'complete',
    onSave,
    onResolveSession,
    onClose,
}: PracticeReviewModalProps) {
    const router = useRouter();
    const { t } = useLocale();
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const preferAdjustment = reviewMode !== 'complete';
    const title =
        reviewMode === 'stale'
            ? t('practices.staleReviewTitle')
            : reviewMode === 'due'
                ? t('practices.reviewDueModalTitle')
                : t('practices.reviewTitle');
    const question =
        reviewMode === 'stale'
            ? t('practices.staleReviewQuestion')
            : reviewMode === 'due'
                ? t('practices.reviewDueQuestion')
                : t('practices.reviewQuestion');

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(content.trim());
            setSaved(true);
        } finally {
            setSaving(false);
        }
    };

    const handleResolveSession = async () => {
        if (!onResolveSession) return;
        setActionError(null);
        setResolving(true);
        try {
            await onResolveSession();
            onClose();
        } catch (error) {
            console.error('Failed to resolve consultation session:', error);
            setActionError(t('practices.reviewNextStepError'));
        } finally {
            setResolving(false);
        }
    };

    const goToAdjustmentConsult = () => {
        onClose();
        router.push(sessionId ? `/consult?sessionId=${sessionId}` : '/consult');
    };

    const goToNewConcernConsult = () => {
        onClose();
        router.push('/consult?source=practice_review_shift');
    };

    if (saved) {
        return (
            <div className="app-modal-overlay fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
                <div className="app-modal-panel relative w-full max-w-sm bg-white dark:bg-surface-dark rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('common.close')}
                        className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-text-sub transition-colors hover:bg-black/5 hover:text-text-main dark:hover:bg-white/10"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                    <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-[32px] text-primary fill-1">celebration</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-lg text-text-main dark:text-white">
                                {reviewMode === 'complete'
                                    ? t('practices.reviewComplete', { days: String(doneDays) })
                                    : t('practices.reviewSavedTitle')}
                            </h4>
                            <p className="text-[13px] text-text-sub mt-2 leading-relaxed">
                                {t('practices.reviewNextStepDesc')}
                            </p>
                        </div>
                    </div>
                    <div className="p-4 bg-beige-main/5 dark:bg-white/5 flex flex-col gap-2">
                        {preferAdjustment ? (
                            <>
                                <Button
                                    variant="primary"
                                    fullWidth
                                    onClick={goToAdjustmentConsult}
                                >
                                    {t('practices.reviewAdjustConsultCta')}
                                </Button>
                                <p className="px-2 text-center text-[12px] leading-relaxed text-text-sub">
                                    {t('practices.reviewAdjustConsultDesc')}
                                </p>
                                {onResolveSession && (
                                    <Button
                                        variant="secondary"
                                        fullWidth
                                        onClick={handleResolveSession}
                                        disabled={resolving}
                                    >
                                        {resolving
                                            ? t('common.saving')
                                            : t('practices.reviewResolveSessionCta')}
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                {onResolveSession && (
                                    <Button
                                        variant="primary"
                                        fullWidth
                                        onClick={handleResolveSession}
                                        disabled={resolving}
                                    >
                                        {resolving
                                            ? t('common.saving')
                                            : t('practices.reviewResolveSessionCta')}
                                    </Button>
                                )}
                                <Button
                                    variant={onResolveSession ? 'secondary' : 'primary'}
                                    fullWidth
                                    onClick={goToAdjustmentConsult}
                                >
                                    {t('practices.reviewAdjustConsultCta')}
                                </Button>
                                <p className="px-2 text-center text-[12px] leading-relaxed text-text-sub">
                                    {t('practices.reviewAdjustConsultDesc')}
                                </p>
                            </>
                        )}
                        <button
                            onClick={goToNewConcernConsult}
                            className="w-full py-3 text-[13px] font-bold text-secondary transition-all active:scale-[0.98]"
                        >
                            {t('practices.reviewNewConcernCta')}
                        </button>
                        {actionError && (
                            <p className="text-center text-[12px] font-medium text-red-500">
                                {actionError}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-modal-overlay fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="app-modal-panel w-full max-w-sm bg-white dark:bg-surface-dark rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
                <div className="p-6 border-b border-beige-main/10 dark:border-white/5 bg-secondary/5">
                    <h4 className="font-bold text-lg text-text-main dark:text-white">{title}</h4>
                    <p className="text-[13px] text-text-sub mt-1">{practiceTitle}</p>
                    <div className="flex items-center gap-2 mt-3">
                        <div className="flex-1 h-2 bg-primary/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${Math.round((doneDays / totalDays) * 100)}%` }}
                            />
                        </div>
                        <span className="text-[12px] font-bold text-primary">{doneDays}/{totalDays}{t('common.days')}</span>
                    </div>
                </div>

                <div className="p-6">
                    <label className="block text-[13px] font-bold text-text-main dark:text-white mb-3">
                        {question}
                        <span className="ml-1 text-[12px] font-medium text-text-sub">
                            {t('practices.reviewOptionalBadge')}
                        </span>
                    </label>
                    <p className="-mt-1 mb-3 text-[12px] leading-relaxed text-text-sub">
                        {t('practices.reviewOptionalHelper')}
                    </p>
                    <div className="relative">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value.slice(0, 500))}
                            maxLength={500}
                            placeholder={t('practices.reviewPlaceholder')}
                            className="w-full h-36 p-4 pr-16 text-[14px] leading-relaxed rounded-2xl border border-secondary/20 focus:outline-none focus:ring-2 focus:ring-secondary/20 resize-none bg-white dark:bg-surface-dark dark:text-white"
                            autoFocus
                        />
                        <VoiceInputButton
                            value={content}
                            onChange={setContent}
                            maxLength={500}
                            className="absolute bottom-4 right-4"
                        />
                    </div>
                </div>

                <div className="p-4 bg-beige-main/5 dark:bg-white/5 flex gap-3">
                    <Button variant="secondary" fullWidth onClick={onClose}>{t('practices.laterShort')}</Button>
                    <Button variant="primary" fullWidth onClick={handleSave} disabled={saving}>
                        {saving ? t('common.saving') : t('practices.reviewSave')}
                    </Button>
                </div>
            </div>
        </div>
    );
}

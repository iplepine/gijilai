'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface PracticeReviewModalProps {
    practiceTitle: string;
    doneDays: number;
    totalDays: number;
    onSave: (content: string) => Promise<void>;
    onClose: () => void;
}

export function PracticeReviewModal({ practiceTitle, doneDays, totalDays, onSave, onClose }: PracticeReviewModalProps) {
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!content.trim()) {
            alert('회고 내용을 적어주세요.');
            return;
        }
        setSaving(true);
        try {
            await onSave(content.trim());
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
                <div className="p-6 border-b border-beige-main/10 dark:border-white/5 bg-secondary/5">
                    <h4 className="font-bold text-lg text-text-main dark:text-white">실천 회고</h4>
                    <p className="text-[13px] text-text-sub mt-1">{practiceTitle}</p>
                    <div className="flex items-center gap-2 mt-3">
                        <div className="flex-1 h-2 bg-primary/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${Math.round((doneDays / totalDays) * 100)}%` }}
                            />
                        </div>
                        <span className="text-[12px] font-bold text-primary">{doneDays}/{totalDays}일</span>
                    </div>
                </div>

                <div className="p-6">
                    <label className="block text-[13px] font-bold text-text-main dark:text-white mb-3">
                        해보니 어떠셨어요?
                    </label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value.slice(0, 500))}
                        maxLength={500}
                        placeholder="실천하면서 아이에게 어떤 변화가 있었는지, 양육자님은 어떤 걸 느끼셨는지 자유롭게 적어주세요."
                        className="w-full h-36 p-4 text-[14px] leading-relaxed rounded-2xl border border-secondary/20 focus:outline-none focus:ring-2 focus:ring-secondary/20 resize-none bg-white dark:bg-surface-dark dark:text-white"
                        autoFocus
                    />
                </div>

                <div className="p-4 bg-beige-main/5 dark:bg-white/5 flex gap-3">
                    <Button variant="secondary" fullWidth onClick={onClose}>나중에</Button>
                    <Button variant="primary" fullWidth onClick={handleSave} disabled={saving}>
                        {saving ? '저장 중...' : '회고 저장'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

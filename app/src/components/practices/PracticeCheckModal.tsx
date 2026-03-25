'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface PracticeCheckModalProps {
    practiceTitle: string;
    onSave: (done: boolean, memo: string | null) => Promise<void>;
    onClose: () => void;
    existingDone?: boolean;
    existingMemo?: string | null;
}

export function PracticeCheckModal({ practiceTitle, onSave, onClose, existingDone, existingMemo }: PracticeCheckModalProps) {
    const [done, setDone] = useState(existingDone ?? true);
    const [memo, setMemo] = useState(existingMemo || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(done, memo.trim() || null);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
                <div className="p-6 border-b border-beige-main/10 dark:border-white/5 bg-beige-main/5 dark:bg-white/5">
                    <h4 className="font-bold text-lg text-text-main dark:text-white">오늘의 실천 기록</h4>
                    <p className="text-[13px] text-text-sub mt-1">{practiceTitle}</p>
                </div>

                <div className="p-6 space-y-5">
                    <div className="flex gap-3">
                        <button
                            onClick={() => setDone(true)}
                            className={`flex-1 h-14 rounded-2xl border-2 text-[15px] font-bold transition-all flex items-center justify-center gap-2 ${
                                done
                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                                    : 'bg-white dark:bg-surface-dark border-beige-main/20 text-text-sub'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            실천했어요
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
                            못했어요
                        </button>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-text-sub mb-2 uppercase tracking-wider">한줄 메모 (선택)</label>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value.slice(0, 200))}
                            maxLength={200}
                            placeholder="오늘 실천하면서 느낀 점이 있나요?"
                            className="w-full h-24 p-4 text-[14px] leading-relaxed rounded-2xl border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-white dark:bg-surface-dark dark:text-white"
                        />
                    </div>
                </div>

                <div className="p-4 bg-beige-main/5 dark:bg-white/5 flex gap-3">
                    <Button variant="secondary" fullWidth onClick={onClose}>취소</Button>
                    <Button variant="primary" fullWidth onClick={handleSave} disabled={saving}>
                        {saving ? '저장 중...' : '저장'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

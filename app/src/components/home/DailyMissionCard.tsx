'use client';

import { DailyMission } from '@/types/gardening';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLocale } from '@/i18n/LocaleProvider';

interface DailyMissionCardProps {
    mission: DailyMission;
    onComplete: (id: string) => void;
}

export function DailyMissionCard({ mission, onComplete }: DailyMissionCardProps) {
    const { t } = useLocale();
    const [isOpen, setIsOpen] = useState(false);
    const [completed, setCompleted] = useState(mission.isCompleted);

    const handleCheck = () => {
        if (completed) return; // Prevent toggle off for now (positive reinforcement only)
        setCompleted(true);
        onComplete(mission.id);
    };

    return (
        <div className={`bg-white rounded-2xl p-5 shadow-sm border transition-all duration-300 ${completed ? 'border-green-200 bg-green-50/50' : 'border-gray-100'}`}>
            <div className="flex items-start gap-4">
                {/* Checkbox */}
                <button
                    onClick={handleCheck}
                    className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-green-400'
                        }`}
                >
                    {completed && <Icon name="check" size="sm" />}
                </button>

                {/* Content */}
                <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Today's Mission</span>
                        {completed && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{t('home.completed')}</span>}
                    </div>

                    <h3 className={`font-medium text-lg text-gray-800 mb-2 leading-snug ${completed ? 'line-through text-gray-400 scale-95 origin-left transition-transform' : ''}`}>
                        {mission.title}
                    </h3>

                    {/* Guide Accordion */}
                    <div className="mt-3">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                            <Icon name={isOpen ? "expand_less" : "expand_more"} />
                            {isOpen ? t('home.guideCollapse') : t('home.guideExpand')}
                        </button>

                        {isOpen && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-xl text-sm text-gray-600 leading-relaxed border border-gray-100 animate-in slide-in-from-top-2 fade-in duration-200">
                                💡 {mission.guide}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

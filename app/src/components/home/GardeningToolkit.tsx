'use client';

import { Icon } from '@/components/ui/Icon';

export function GardeningToolkit() {
    const tools = [
        {
            icon: 'thumb_up',
            iconColor: 'text-blue-500',
            iconBg: 'bg-blue-100',
            title: '칭찬 한 마디',
            description: '아이의 작은 노력 발견하기',
        },
        {
            icon: 'self_improvement',
            iconColor: 'text-green-600',
            iconBg: 'bg-green-100',
            title: '셀프 케어 (명상)',
            description: '양육자를 위한 5분 휴식',
        },
        {
            icon: 'sentiment_satisfied',
            iconColor: 'text-orange-500',
            iconBg: 'bg-orange-100',
            title: '스트레스 해소',
            description: '오늘의 걱정 비워내기',
        }
    ];

    return (
        <section className="px-6 mb-12">
            <div className="flex items-center gap-2 mb-6">
                <h3 className="font-display font-bold text-lg text-[var(--navy)]">양육자 돌봄 툴킷</h3>
                <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-bold">DAILY</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {tools.map((tool, index) => (
                    <button
                        key={index}
                        className="flex items-center gap-4 p-5 bg-white/60 rounded-2xl border border-white/80 active:scale-[0.98] transition-all shadow-sm"
                    >
                        <div className={`w-12 h-12 rounded-xl ${tool.iconBg} flex items-center justify-center ${tool.iconColor}`}>
                            <Icon name={tool.icon} size="md" className="text-3xl" />
                        </div>
                        <div className="text-left flex-1">
                            <p className="text-sm font-bold text-gray-800">{tool.title}</p>
                            <p className="text-xs text-gray-500">{tool.description}</p>
                        </div>
                        <Icon name="chevron_right" className="text-gray-300" />
                    </button>
                ))}
            </div>
        </section>
    );
}

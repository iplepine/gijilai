'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

const CHILD_TYPES = [
    { src: '/child_type/type_hll.jpg', label: '열정 탐험가' },
    { src: '/child_type/type_hlh.jpg', label: '사교적 리더' },
    { src: '/child_type/type_lll.jpg', label: '평화로운 관찰자' },
    { src: '/child_type/type_llh.jpg', label: '섬세한 예술가' },
    { src: '/child_type/type_hhl.jpg', label: '신중한 전략가' },
    { src: '/child_type/type_lhl.jpg', label: '조용한 사색가' },
    { src: '/child_type/type_hhh.jpg', label: '창의적 몽상가' },
    { src: '/child_type/type_lhh.jpg', label: '세심한 돌봄이' },
];

const PARENT_TYPES = [
    { src: '/parent_type/type_parent_hll.jpg', label: '열정형 부모' },
    { src: '/parent_type/type_parent_hlh.jpg', label: '사교형 부모' },
    { src: '/parent_type/type_parent_lll.jpg', label: '안정형 부모' },
    { src: '/parent_type/type_parent_llh.jpg', label: '섬세형 부모' },
    { src: '/parent_type/type_parent_hhl.jpg', label: '전략형 부모' },
    { src: '/parent_type/type_parent_lhl.jpg', label: '사색형 부모' },
    { src: '/parent_type/type_parent_hhh.jpg', label: '몽상형 부모' },
    { src: '/parent_type/type_parent_lhh.jpg', label: '돌봄형 부모' },
];

const STEPS = [
    {
        step: '01',
        icon: 'edit_note' as const,
        title: '기질 설문',
        desc: '아이와 양육자의 기질을 CBQ/ATQ 기반 설문으로 측정합니다.',
    },
    {
        step: '02',
        icon: 'psychology' as const,
        title: 'AI 기질 분석',
        desc: '설문 결과를 분석해 아이의 기질 유형과 부모-자녀 궁합을 파악합니다.',
    },
    {
        step: '03',
        icon: 'description' as const,
        title: '맞춤 리포트',
        desc: '기질별 양육 가이드와 "마법의 한마디" 대화 스크립트를 받아보세요.',
    },
    {
        step: '04',
        icon: 'forum' as const,
        title: '상담 & 실천',
        desc: '구체적인 육아 고민을 AI 상담으로 해결하고, 매일 실천해보세요.',
    },
];

export default function LandingPage() {
    const ALL_TYPES = [...CHILD_TYPES.map(t => ({ ...t, kind: 'child' as const })), ...PARENT_TYPES.map(t => ({ ...t, kind: 'parent' as const }))];
    const QUESTIONS = { child: '우리 아이는 어떤 유형일까', parent: '나는 어떤 부모일까' };
    const [currentIndex, setCurrentIndex] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % ALL_TYPES.length);
        }, 1800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark overflow-x-hidden">
            {/* Hero Section */}
            <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 flex flex-col items-center overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[800px] bg-gradient-to-b from-primary/5 via-primary/2 to-transparent rounded-full blur-[100px] -z-10" />

                <div className="container max-w-6xl mx-auto px-6 flex flex-col items-center text-center">
                    <h1 className="text-[32px] sm:text-[40px] md:text-6xl lg:text-7xl font-black text-text-main dark:text-white leading-[1.15] mb-6 tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-1000 break-keep">
                        우리 아이는<br />
                        어떤 <span className="text-primary">기질</span>일까
                    </h1>

                    <p className="max-w-xl text-text-sub dark:text-slate-400 text-base md:text-lg leading-relaxed mb-10 break-keep animate-in fade-in duration-1000 delay-200 px-4">
                        과학적 기질 검사로 아이와 부모의 성향을 분석하고,<br className="hidden md:block" />
                        우리 가족에게 맞는 대화법과 양육 가이드를 받아보세요.
                    </p>

                    <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-400">
                        <Link href="/login">
                            <Button size="lg" fullWidth className="h-16 rounded-2xl text-lg font-black shadow-glow hover:scale-[1.02] transition-transform bg-primary text-white">
                                무료로 기질 검사 시작하기
                            </Button>
                        </Link>
                    </div>

                    {/* Animated Type Cycling — single card */}
                    <div className="mt-16 md:mt-20 w-full max-w-[280px] md:max-w-[320px] mx-auto animate-in fade-in zoom-in-95 duration-1000 delay-600">
                        <div className="relative aspect-square rounded-3xl overflow-hidden shadow-card">
                            {mounted && ALL_TYPES.map((type, i) => (
                                <img
                                    key={type.src}
                                    src={type.src}
                                    alt="기질 유형"
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                                        i === currentIndex ? 'opacity-100' : 'opacity-0'
                                    }`}
                                />
                            ))}
                            {/* Dark overlay + blur */}
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                            {/* Question + hint text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                <span className="text-white/90 text-xl md:text-2xl font-black">
                                    {mounted ? QUESTIONS[ALL_TYPES[currentIndex].kind] : '우리 아이는 어떤 유형일까'}
                                </span>
                                <span className="text-white/40 text-xs tracking-widest">검사로 알아보세요</span>
                            </div>
                        </div>
                        <p className="text-center text-sm text-text-sub mt-5 break-keep">검사 후 결과가 공개됩니다</p>
                    </div>
                </div>
            </section>

            {/* Process Section */}
            <section className="py-20 md:py-28 bg-white dark:bg-background-dark">
                <div className="container max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16 space-y-4">
                        <span className="text-primary font-black tracking-widest text-xs uppercase">How it works</span>
                        <h2 className="text-3xl md:text-4xl font-black text-text-main dark:text-white tracking-tight break-keep">
                            4단계로 완성하는<br />맞춤 육아 가이드
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
                        {STEPS.map((s, i) => (
                            <div key={s.step} className="relative flex flex-col items-center text-center">
                                {i < STEPS.length - 1 && (
                                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px border-t-2 border-dashed border-beige-main/40" />
                                )}
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                                    <Icon name={s.icon} className="text-primary w-7 h-7" />
                                </div>
                                <span className="text-[11px] font-black text-primary tracking-widest mb-2">{s.step}</span>
                                <h3 className="text-lg font-black text-text-main dark:text-white mb-2">{s.title}</h3>
                                <p className="text-sm text-text-sub leading-relaxed break-keep max-w-[240px]">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 md:py-28 bg-beige-light dark:bg-background-dark/50">
                <div className="container max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16 space-y-4">
                        <span className="text-primary font-black tracking-widest text-xs uppercase">Features</span>
                        <h2 className="text-3xl md:text-4xl font-black text-text-main dark:text-white tracking-tight break-keep">
                            기질을 이해하면<br />육아가 달라집니다
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-8 rounded-2xl bg-white dark:bg-surface-dark border border-beige-main/30 shadow-soft">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                                <Icon name="psychology" className="text-primary w-7 h-7" />
                            </div>
                            <h3 className="text-lg font-black text-text-main dark:text-white mb-3">과학적 기질 분석</h3>
                            <p className="text-sm text-text-sub leading-relaxed break-keep">
                                CBQ(아동용)와 ATQ(성인용) 기반 검사로 아이와 부모의 기질을 측정합니다. 4개 기질 차원에서 8가지 유형으로 분류해요.
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-white dark:bg-surface-dark border border-beige-main/30 shadow-soft">
                            <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
                                <Icon name="forum" className="text-secondary w-7 h-7" />
                            </div>
                            <h3 className="text-lg font-black text-text-main dark:text-white mb-3">마법의 한마디</h3>
                            <p className="text-sm text-text-sub leading-relaxed break-keep">
                                "안 돼!" 대신 아이의 기질에 맞는 대화법을 제안합니다. 상황별 구체적인 대화 스크립트로 오늘 저녁부터 바로 써볼 수 있어요.
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-white dark:bg-surface-dark border border-beige-main/30 shadow-soft">
                            <div className="w-14 h-14 rounded-2xl bg-primary-light/10 flex items-center justify-center mb-6">
                                <Icon name="task_alt" className="text-primary-light w-7 h-7" />
                            </div>
                            <h3 className="text-lg font-black text-text-main dark:text-white mb-3">AI 상담 & 실천</h3>
                            <p className="text-sm text-text-sub leading-relaxed break-keep">
                                구체적인 육아 고민을 AI에게 상담하고, 맞춤 실천 과제를 받아 매일 체크하며 변화를 만들어가세요.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Example: Magic Word */}
            <section className="py-20 md:py-28 bg-beige-light dark:bg-background-dark/50">
                <div className="container max-w-4xl mx-auto px-6">
                    <div className="bg-white dark:bg-surface-dark rounded-2xl p-8 md:p-14 shadow-card">
                        <div className="text-center mb-10 space-y-3">
                            <span className="text-primary font-black tracking-widest text-xs uppercase">Magic Words</span>
                            <h2 className="text-2xl md:text-3xl font-black text-text-main dark:text-white break-keep">
                                이런 대화법을 제안해드려요
                            </h2>
                        </div>

                        <div className="space-y-5 max-w-lg mx-auto">
                            <div className="flex items-start gap-4 p-5 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                                <span className="text-red-400 text-lg mt-0.5">&#x2717;</span>
                                <div>
                                    <p className="text-sm font-bold text-red-500 mb-1">Before</p>
                                    <p className="text-text-main dark:text-white font-medium break-keep">"장난감 정리해! 몇 번을 말해!"</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-5 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                                <span className="text-green-500 text-lg mt-0.5">&#x2713;</span>
                                <div>
                                    <p className="text-sm font-bold text-green-600 mb-1">After</p>
                                    <p className="text-text-main dark:text-white font-medium break-keep">"장난감 친구들이 집에 가고 싶대~ 같이 도와줄까?"</p>
                                    <p className="text-xs text-text-sub mt-2">열정 탐험가 유형 | 놀이 전환 상황</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="py-20 md:py-28 px-6 relative overflow-hidden bg-[#1F3629]">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#2F4F3E]/20 rounded-full blur-[150px] -mr-48 -mt-48" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#E5A150]/10 rounded-full blur-[150px] -ml-48 -mb-48" />

                <div className="container max-w-3xl mx-auto text-center space-y-8 relative z-10">
                    <h2 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight break-keep">
                        아이를 이해하는 것부터<br />
                        <span className="text-[#F0B86E]">좋은 양육</span>이 시작됩니다
                    </h2>
                    <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto break-keep">
                        3분 설문으로 우리 아이의 기질 유형을 알아보세요.<br />
                        아이 기질 리포트는 무료입니다.
                    </p>
                    <div className="flex flex-col items-center gap-4">
                        <Link href="/login" className="w-full max-w-sm">
                            <Button variant="secondary" size="lg" fullWidth className="h-16 rounded-2xl !bg-white !text-[#1F3629] text-lg font-black hover:bg-gray-100 transition-all shadow-glow">
                                기질 검사 시작하기
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-16 px-6 bg-white dark:bg-background-dark border-t border-beige-main/20">
                <div className="container max-w-6xl mx-auto space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex flex-col items-center md:items-start gap-3">
                            <span className="text-2xl font-logo tracking-[0.3em] text-primary dark:text-white uppercase">기질아이</span>
                            <p className="text-[11px] text-text-sub text-center md:text-left leading-relaxed max-w-xs uppercase tracking-tighter">
                                &copy; 2026 GIJILAI. ALL RIGHTS RESERVED.<br />
                                본 서비스는 의학적 진단을 대체하지 않습니다.
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-8 text-[11px] font-bold text-text-sub uppercase tracking-widest">
                            <Link href="/legal/terms" className="hover:text-primary transition-colors">Terms</Link>
                            <Link href="/legal/privacy" className="hover:text-primary transition-colors">Privacy</Link>
                            <Link href="/legal/refund" className="hover:text-primary transition-colors">Refund</Link>
                            <Link href="/legal/support" className="hover:text-primary transition-colors">Support</Link>
                        </div>
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                        <p className="text-[10px] text-text-sub/60 text-center leading-relaxed">
                            데브호하우스 | 대표: 박정호 | 사업자등록번호: 898-35-01596<br />
                            통신판매업신고번호: 2026-서울중랑-0133<br />
                            서울특별시 중랑구 신내로 155, 804동 1501호(신내동, 두산위브, 화성아파트) | 전화: 010-3830-8960 | 문의: devhohouse@gmail.com
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

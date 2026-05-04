'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { HomeLogoButton } from '@/components/layout/HomeLogoButton';
import { useLocale } from '@/i18n/LocaleProvider';

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

export default function LandingPage() {
    const { t } = useLocale();

    const STEPS = [
        {
            step: '01',
            icon: 'edit_note' as const,
            title: t('landing.step01Title'),
            desc: t('landing.step01Desc'),
        },
        {
            step: '02',
            icon: 'psychology' as const,
            title: t('landing.step02Title'),
            desc: t('landing.step02Desc'),
        },
        {
            step: '03',
            icon: 'description' as const,
            title: t('landing.step03Title'),
            desc: t('landing.step03Desc'),
        },
        {
            step: '04',
            icon: 'forum' as const,
            title: t('landing.step04Title'),
            desc: t('landing.step04Desc'),
        },
    ];

    const ALL_TYPES = [...CHILD_TYPES.map(t => ({ ...t, kind: 'child' as const })), ...PARENT_TYPES.map(t => ({ ...t, kind: 'parent' as const }))];
    const QUESTIONS = { child: t('landing.childQuestion'), parent: t('landing.parentQuestion') };
    const [currentIndex, setCurrentIndex] = useState(0);
    const [mounted] = useState(() => typeof window !== 'undefined');

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % ALL_TYPES.length);
        }, 1800);
        return () => clearInterval(interval);
    }, [ALL_TYPES.length]);

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark overflow-x-hidden">
            {/* Hero Section */}
            <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 flex flex-col items-center overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[800px] bg-gradient-to-b from-primary/5 via-primary/2 to-transparent rounded-full blur-[100px] -z-10" />

                <div className="container max-w-6xl mx-auto px-6 flex flex-col items-center text-center">
                    <h1 className="text-[32px] sm:text-[40px] md:text-6xl lg:text-7xl font-black text-text-main dark:text-white leading-[1.15] mb-6 tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-1000 break-keep">
                        {t('landing.heroTitle1')}<br />
                        {t('landing.heroTitle2')}<span className="text-primary">{t('landing.heroTitle3')}</span>{t('landing.heroTitle4')}
                    </h1>

                    <p className="max-w-xl text-text-sub dark:text-slate-400 text-base md:text-lg leading-relaxed mb-10 break-keep animate-in fade-in duration-1000 delay-200 px-4">
                        {t('landing.heroDesc')}
                    </p>

                    <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-400">
                        <Link
                            href="/login"
                            onClick={() => trackEvent('landing_cta_clicked', { placement: 'hero' })}
                        >
                            <Button size="lg" fullWidth className="h-16 rounded-2xl text-lg font-black shadow-glow hover:scale-[1.02] transition-transform bg-primary text-white">
                                {t('landing.startFree')}
                            </Button>
                        </Link>
                    </div>

                    {/* Animated Type Cycling */}
                    <div className="mt-16 md:mt-20 w-full max-w-[280px] md:max-w-[320px] mx-auto animate-in fade-in zoom-in-95 duration-1000 delay-600">
                        <div className="relative aspect-square rounded-3xl overflow-hidden shadow-card">
                            {mounted && ALL_TYPES.map((type, i) => (
                                <Image
                                    key={type.src}
                                    src={type.src}
                                    alt={t('landing.temperamentType')}
                                    fill
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                                        i === currentIndex ? 'opacity-100' : 'opacity-0'
                                    }`}
                                />
                            ))}
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                <span className="text-white/90 text-xl md:text-2xl font-black">
                                    {mounted ? QUESTIONS[ALL_TYPES[currentIndex].kind] : t('landing.childQuestion')}
                                </span>
                                <span className="text-white/40 text-xs tracking-widest">{t('landing.revealAfterTest')}</span>
                            </div>
                        </div>
                        <p className="text-center text-sm text-text-sub mt-5 break-keep">{t('landing.revealAfterTest')}</p>
                    </div>
                </div>
            </section>

            {/* Process Section */}
            <section className="py-20 md:py-28 bg-white dark:bg-background-dark">
                <div className="container max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16 space-y-4">
                        <span className="text-primary font-black tracking-widest text-xs uppercase">How it works</span>
                        <h2 className="text-3xl md:text-4xl font-black text-text-main dark:text-white tracking-tight break-keep">
                            {t('landing.processTitle')}
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
                            {t('landing.featuresTitle')}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-8 rounded-2xl bg-white dark:bg-surface-dark border border-beige-main/30 shadow-soft">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                                <Icon name="psychology" className="text-primary w-7 h-7" />
                            </div>
                            <h3 className="text-lg font-black text-text-main dark:text-white mb-3">{t('landing.feature1Title')}</h3>
                            <p className="text-sm text-text-sub leading-relaxed break-keep">
                                {t('landing.feature1Desc')}
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-white dark:bg-surface-dark border border-beige-main/30 shadow-soft">
                            <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
                                <Icon name="forum" className="text-secondary w-7 h-7" />
                            </div>
                            <h3 className="text-lg font-black text-text-main dark:text-white mb-3">{t('landing.feature2Title')}</h3>
                            <p className="text-sm text-text-sub leading-relaxed break-keep">
                                {t('landing.feature2Desc')}
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-white dark:bg-surface-dark border border-beige-main/30 shadow-soft">
                            <div className="w-14 h-14 rounded-2xl bg-primary-light/10 flex items-center justify-center mb-6">
                                <Icon name="task_alt" className="text-primary-light w-7 h-7" />
                            </div>
                            <h3 className="text-lg font-black text-text-main dark:text-white mb-3">{t('landing.feature3Title')}</h3>
                            <p className="text-sm text-text-sub leading-relaxed break-keep">
                                {t('landing.feature3Desc')}
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
                                {t('landing.magicWordsTitle')}
                            </h2>
                        </div>

                        <div className="space-y-5 max-w-lg mx-auto">
                            <div className="flex items-start gap-4 p-5 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                                <span className="text-red-400 text-lg mt-0.5">&#x2717;</span>
                                <div>
                                    <p className="text-sm font-bold text-red-500 mb-1">Before</p>
                                    <p className="text-text-main dark:text-white font-medium break-keep">{t('landing.beforeExample')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-5 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                                <span className="text-green-500 text-lg mt-0.5">&#x2713;</span>
                                <div>
                                    <p className="text-sm font-bold text-green-600 mb-1">After</p>
                                    <p className="text-text-main dark:text-white font-medium break-keep">{t('landing.afterExample')}</p>
                                    <p className="text-xs text-text-sub mt-2">{t('landing.afterContext')}</p>
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
                        {t('landing.ctaTitle')}<br />
                        <span className="text-[#F0B86E]">{t('landing.ctaHighlight')}</span>{t('landing.ctaTitleEnd')}
                    </h2>
                    <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto break-keep">
                        {t('landing.ctaDesc')}
                    </p>
                    <div className="flex flex-col items-center gap-4">
                        <Link
                            href="/login"
                            className="w-full max-w-sm"
                            onClick={() => trackEvent('landing_cta_clicked', { placement: 'final_cta' })}
                        >
                            <Button variant="secondary" size="lg" fullWidth className="h-16 rounded-2xl !bg-white !text-[#1F3629] text-lg font-black hover:bg-gray-100 transition-all shadow-glow">
                                {t('landing.startTest')}
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
                            <HomeLogoButton
                                variant="brand"
                                className="gap-0"
                                imageClassName="hidden"
                                textClassName="text-2xl font-logo tracking-[0.3em] text-primary dark:text-white uppercase"
                            />
                            <p className="text-[11px] text-text-sub text-center md:text-left leading-relaxed max-w-xs uppercase tracking-tighter">
                                &copy; 2026 GIJILAI. ALL RIGHTS RESERVED.<br />
                                {t('landing.footerDisclaimer')}
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
                            {t('landing.footerCompanyInfo')}
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

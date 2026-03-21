'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark overflow-x-hidden">
            {/* Hero Section */}
            <section className="relative pt-32 pb-24 flex flex-col items-center overflow-hidden">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[800px] bg-gradient-to-b from-primary/5 via-primary/2 to-transparent rounded-full blur-[100px] -z-10"></div>
                <div className="absolute top-40 -left-20 w-80 h-80 bg-secondary/5 rounded-full blur-[80px] -z-10"></div>
                <div className="absolute top-60 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-[100px] -z-10"></div>

                <div className="container max-w-6xl mx-auto px-6 flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/80 dark:bg-surface-dark backdrop-blur-md shadow-soft border border-primary/10 mb-10 animate-in fade-in slide-in-from-top-4 duration-1000">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                        <span className="text-[12px] font-black text-primary tracking-[0.2em] uppercase">990원으로 시작하는 데이터 기반 맞춤 육아</span>
                    </div>

                    <h1 className="text-[36px] sm:text-[44px] md:text-7xl lg:text-8xl font-black text-text-main dark:text-white leading-[1.1] mb-8 tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 break-keep">
                        아이의 신호를<br />
                        <span className="text-primary italic whitespace-nowrap">올바르게 통역</span>하세요
                    </h1>

                    <p className="max-w-2xl text-text-sub dark:text-slate-400 text-base md:text-xl leading-relaxed mb-12 break-keep animate-in fade-in duration-1000 delay-400 px-4">
                        과학적 기질 분석(TCI/CBQ)과 AI 전문가의 통찰을 결합하여<br className="hidden md:block" />
                        우리 아이만을 위한 정밀한 대화 처방과 성장 지도를 제공합니다.
                    </p>

                    <div className="w-full max-w-md flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-600">
                        <Link href="/login">
                            <Button size="lg" fullWidth className="h-20 rounded-2xl text-xl font-black shadow-glow hover:scale-[1.02] transition-transform bg-primary text-white">
                                우리 아이 맞춤 가이드 받기 (990원)
                            </Button>
                        </Link>
                        <div className="flex items-center justify-center gap-3">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-beige-light overflow-hidden">
                                        <img src={`https://i.pravatar.cc/100?u=user${i}`} alt="" />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[13px] font-medium text-text-sub">현재 <span className="text-text-main dark:text-white font-bold">12,482명</span>의 양육자가 분석 중</p>
                        </div>
                    </div>

                    <div className="mt-24 relative w-full max-w-5xl mx-auto px-4 md:px-10 animate-in fade-in zoom-in duration-1500 delay-800">
                        <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-2xl blur-2xl"></div>
                        <div className="relative bg-white/40 dark:bg-surface-dark/40 backdrop-blur-sm p-4 rounded-2xl border border-white/20 shadow-card">
                            <img
                                src="/landing_hero.png"
                                alt="Gijilai Sample Report"
                                className="w-full rounded-2xl shadow-lg"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Premium Features Section */}
            <section className="py-32 bg-white dark:bg-background-dark">
                <div className="container max-w-6xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20 space-y-6">
                        <span className="text-primary font-black tracking-widest text-xs uppercase">Why Gijilai?</span>
                        <h2 className="text-4xl md:text-5xl font-black text-text-main dark:text-white tracking-tight">전문가들이 설계한<br />체계적인 분석 시스템</h2>
                        <p className="text-text-sub text-lg break-keep">양육자의 94%가 아이의 기질을 이해한 후 양육 효능감이 높아졌다고 응답했습니다.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div className="group p-10 rounded-2xl bg-background-light dark:bg-surface-dark border border-beige-main/30 hover:shadow-card transition-all duration-500">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                                <Icon name="psychology" className="text-primary w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-text-main dark:text-white mb-4">과학적 검증 데이터</h3>
                            <p className="text-text-sub leading-relaxed break-keep">TCI 및 CBQ 기반의 공인된 아동 발달 이론을 바탕으로 아이의 기질을 정밀하게 타격합니다.</p>
                        </div>

                        <div className="group p-10 rounded-2xl bg-background-light dark:bg-surface-dark border border-beige-main/30 hover:shadow-card transition-all duration-500">
                            <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                                <Icon name="forum" className="text-secondary w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-text-main dark:text-white mb-4">맞춤형 대화 처방</h3>
                            <p className="text-text-sub leading-relaxed break-keep">"안 돼" 대신 아이의 마음을 움직이는 [마법의 한마디]를 기질별 시나리오로 제공합니다.</p>
                        </div>

                        <div className="group p-10 rounded-2xl bg-background-light dark:bg-surface-dark border border-beige-main/30 hover:shadow-card transition-all duration-500">
                            <div className="w-16 h-16 rounded-2xl bg-primary-light/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                                <Icon name="task_alt" className="text-primary-light w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-text-main dark:text-white mb-4">데일리 미션 서비스</h3>
                            <p className="text-text-sub leading-relaxed break-keep">이론으로 끝나지 않고 매일 실천할 수 있는 1분 미션을 통해 양육 태도의 변화를 이끌어냅니다.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonial Section */}
            <section className="py-24 md:py-32 px-4 md:px-6 bg-beige-light dark:bg-background-dark/50">
                <div className="container max-w-6xl mx-auto">
                    <div className="bg-white dark:bg-surface-dark rounded-2xl p-8 md:p-20 relative overflow-hidden shadow-card">
                        <div className="absolute top-0 right-0 p-10 opacity-5 text-7xl md:text-9xl font-black pointer-events-none select-none text-primary">LOVE</div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
                            <div className="space-y-6 md:space-y-8 relative z-10">
                                <h2 className="text-2xl md:text-4xl font-black text-text-main dark:text-white leading-tight break-keep">
                                    "아이의 떼쓰기가<br />
                                    <span className="text-primary italic text-3xl md:text-5xl">사랑스러운 자기표현</span>으로<br />
                                    보이기 시작했어요"
                                </h2>
                                <div className="space-y-4">
                                    <p className="text-text-sub dark:text-slate-300 text-base md:text-lg leading-relaxed break-keep">
                                        기질 분석을 통해 우리 아이가 왜 그렇게 반응했는지 이해하게 된 것만으로도 육아의 난이도가 절반으로 줄었습니다.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 bg-beige-light">
                                            <img src="https://i.pravatar.cc/150?u=mom" alt="user" className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-text-main dark:text-white">김지영 님</p>
                                            <p className="text-[11px] text-text-sub font-bold uppercase tracking-wider">5세 남아 수아 엄마</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative order-first md:order-last">
                                <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full"></div>
                                <img src="/social_proof.png" alt="Happy Families" className="relative w-full rounded-2xl shadow-card" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="py-24 md:py-32 px-6 relative overflow-hidden bg-primary-dark">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[150px] -mr-64 -mt-64"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[150px] -ml-64 -mb-64"></div>

                <div className="container max-w-4xl mx-auto text-center space-y-12 relative z-10">
                    <h2 className="text-3xl md:text-6xl font-black text-white leading-tight tracking-tight break-keep">
                        양육자의 <span className="text-secondary">작은&nbsp;변화</span>가<br />
                        아이의 인생을 바꿉니다
                    </h2>
                    <p className="text-white/60 text-base md:text-xl max-w-2xl mx-auto break-keep">
                        지금 990원으로 우리 아이를 위한<br className="md:hidden" /> 인생 가이드북을 열어보세요.
                    </p>
                    <div className="flex flex-col items-center gap-6">
                        <Link href="/login" className="w-full max-w-sm">
                            <Button variant="secondary" size="lg" fullWidth className="h-16 md:h-20 rounded-2xl bg-white text-primary-dark !text-primary-dark text-lg md:text-xl font-black hover:bg-beige-light transition-all shadow-glow">
                                바로 분석 시작하기
                            </Button>
                        </Link>
                        <p className="text-white/30 text-[11px] font-bold uppercase tracking-[0.3em] italic">limited time offer: 990 KRW only</p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 px-6 bg-white dark:bg-background-dark border-t border-beige-main/20">
                <div className="container max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-10">
                        <div className="flex flex-col items-center md:items-start gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-logo tracking-[0.3em] text-primary dark:text-white uppercase">기질아이</span>
                            </div>
                            <p className="text-[11px] text-text-sub text-center md:text-left leading-relaxed max-w-xs uppercase tracking-tighter">
                                © 2026 GIJILAI. ADVANCED CHILDCARE INSIGHTS.<br />
                                ALL RIGHTS RESERVED. 본 서비스는 의학적 보건 의료 전문가의 진단을 대체하지 않습니다.
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-8 text-[11px] font-bold text-text-sub uppercase tracking-widest">
                            <Link href="/settings/terms" className="hover:text-primary transition-colors">Terms</Link>
                            <Link href="/settings/privacy" className="hover:text-primary transition-colors">Privacy</Link>
                            <Link href="/settings/support" className="hover:text-primary transition-colors">Support</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

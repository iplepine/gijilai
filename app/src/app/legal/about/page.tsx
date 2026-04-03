'use client';

import { Navbar } from '@/components/layout/Navbar';

export default function AboutPage() {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <div className="app-shell-width mx-auto relative min-h-screen flex flex-col">
                <Navbar title="회사 소개" showBack />

                <main className="flex-1 px-6 py-8">
                    <div className="bg-white dark:bg-surface-dark rounded-[2rem] p-6 shadow-soft border border-gray-100 dark:border-gray-800">
                        <h2 className="text-xl font-bold mb-6 mt-2">기질아이</h2>
                        <div className="space-y-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                            <section>
                                <p>기질아이는 아이의 타고난 기질을 과학적으로 분석하여, 부모가 아이를 더 깊이 이해하고 올바른 양육 방향을 찾을 수 있도록 돕는 서비스입니다.</p>
                            </section>

                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-3">사업자 정보</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex">
                                        <span className="text-gray-400 w-28 shrink-0">상호</span>
                                        <span className="text-navy dark:text-white font-medium">데브호하우스</span>
                                    </div>
                                    <div className="flex">
                                        <span className="text-gray-400 w-28 shrink-0">대표</span>
                                        <span className="text-navy dark:text-white font-medium">박정호</span>
                                    </div>
                                    <div className="flex">
                                        <span className="text-gray-400 w-28 shrink-0">사업자등록번호</span>
                                        <span className="text-navy dark:text-white font-medium">898-35-01596</span>
                                    </div>
                                    <div className="flex">
                                        <span className="text-gray-400 w-28 shrink-0">통신판매업</span>
                                        <span className="text-navy dark:text-white font-medium">2026-서울중랑-0133</span>
                                    </div>
                                    <div className="flex">
                                        <span className="text-gray-400 w-28 shrink-0">주소</span>
                                        <span className="text-navy dark:text-white font-medium">서울특별시 중랑구 신내로 155, 804동 1501호(신내동, 두산위브, 화성아파트)</span>
                                    </div>
                                    <div className="flex">
                                        <span className="text-gray-400 w-28 shrink-0">전화</span>
                                        <span className="text-navy dark:text-white font-medium">010-3830-8960</span>
                                    </div>
                                    <div className="flex">
                                        <span className="text-gray-400 w-28 shrink-0">이메일</span>
                                        <span className="text-navy dark:text-white font-medium">devhohouse@gmail.com</span>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

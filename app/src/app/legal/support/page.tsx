'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';

function SupportContent() {
    const [faqOpen, setFaqOpen] = useState<number | null>(null);

    const faqs = [
        {
            q: "아이의 기질은 바뀔 수 없나요?",
            a: "기질은 생물학적으로 타고나는 특상이지만, 양육 환경과 경험에 따라 그 표현 방식과 강도가 다스려질 수 있습니다. 아이기질 앱은 그 기질을 '고치는' 것이 아니라 어떻게 '이해하고 소통할지'를 돕습니다."
        },
        {
            q: "결과 리포트가 실제와 다르게 느껴져요.",
            a: "검사 당시 양육자의 스트레스나 직전의 특정 이벤트가 응답에 영향을 미쳤을 수 있습니다. 또한, 양육자가 바라는 아이의 모습이 투영되었을 수도 있어요. 일주일 정도 아이를 관찰하신 후 재검사해보시는 것을 권장합니다."
        },
        {
            q: "가족끼리 아이 프로필을 공유할 수 있나요?",
            a: "현재 공유 기능을 준비 중입니다. 조만간 업데이트를 통해 엄마, 아빠는 물론 조부모님과도 아이의 기질과 대화 카드를 공유할 수 있게 됩니다!"
        },
        {
            q: "결제를 취소/환불하고 싶어요.",
            a: "웹 구독은 devhohouse@gmail.com으로 환불 사유와 결제 정보를 보내주시면 확인 후 처리합니다. 결제 후 AI 상담 생성, 후속 상담, 구독자 전용 실천 기록 전체 열람 등 유료 기능을 이용하지 않은 7일 이내 건은 전액 환불, 이용 중 환불 요청 건은 남은 미사용 일수 기준으로 부분 환불됩니다. 앱 스토어 결제는 애플/구글 플레이의 환불 정책과 절차가 우선 적용됩니다."
        }
    ];

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <div className="max-w-md mx-auto relative min-h-screen flex flex-col">
                <Navbar title="고객센터" />

                <main className="flex-1 px-4 py-8 space-y-8">
                    {/* Contact Option */}
                    <section className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-soft border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                            <span className="material-symbols-outlined text-[32px]">support_agent</span>
                        </div>
                        <h2 className="text-[17px] font-bold text-navy dark:text-white mb-2">무엇을 도와드릴까요?</h2>
                        <p className="text-[13px] text-gray-500 mb-6 break-keep leading-relaxed">
                            앱 이용 중 불편하신 점이나 궁금한 점이 있으시면<br />
                            이메일 문의를 남겨 주시면 확인 후 답변드리겠습니다.
                        </p>
                        <Link
                            href="mailto:devhohouse@gmail.com?subject=%EA%B8%B0%EC%A7%88%EC%95%84%EC%9D%B4%20%EB%AC%B8%EC%9D%98"
                            className="w-full h-12 bg-primary text-white font-bold rounded-xl active:scale-95 transition-all shadow-md inline-flex items-center justify-center"
                        >
                            이메일로 문의하기
                        </Link>
                    </section>

                    {/* FAQ */}
                    <section className="space-y-4">
                        <h3 className="text-[14px] font-bold text-navy dark:text-white px-2">자주 묻는 질문</h3>
                        <div className="bg-white dark:bg-surface-dark rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
                            {faqs.map((faq, idx) => (
                                <div key={idx} className={`border-b border-gray-100 dark:border-gray-800 last:border-0`}>
                                    <button
                                        onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                                        className="w-full px-5 py-4 flex items-center justify-between text-left active:bg-gray-50 dark:active:bg-gray-800/50 transition-colors"
                                    >
                                        <span className="text-[14px] font-bold text-navy dark:text-white flex-1 pr-4">{faq.q}</span>
                                        <span className={`material-symbols-outlined text-gray-400 transition-transform ${faqOpen === idx ? 'rotate-180' : ''}`}>
                                            keyboard_arrow_down
                                        </span>
                                    </button>
                                    <div
                                        className={`px-5 overflow-hidden transition-all duration-300 bg-gray-50/50 dark:bg-gray-900/30 ${faqOpen === idx ? 'max-h-48 py-4 opacity-100' : 'max-h-0 py-0 opacity-0'
                                            }`}
                                    >
                                        <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed break-keep">
                                            {faq.a}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}

export default function SupportPage() {
    return (
        <Suspense fallback={<div className="bg-background-light dark:bg-background-dark min-h-screen" />}>
            <SupportContent />
        </Suspense>
    );
}

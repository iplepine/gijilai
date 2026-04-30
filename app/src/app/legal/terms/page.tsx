'use client';

import { Suspense } from 'react';
import { Navbar } from '@/components/layout/Navbar';

function TermsContent() {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <div className="max-w-md mx-auto relative min-h-screen flex flex-col">
                <Navbar title="서비스 이용약관" />

                <main className="app-page-scroll flex-1 px-6 py-8">
                    <div className="bg-white dark:bg-surface-dark rounded-[2rem] p-6 shadow-soft border border-gray-100 dark:border-gray-800 overflow-y-auto" style={{ maxHeight: '75vh' }}>
                        <h2 className="text-xl font-bold mb-6 mt-2">아이기질 이용약관</h2>
                        <div className="space-y-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제1조 (목적)</h3>
                                <p>본 약관은 회사가 제공하는 &apos;아이기질(가칭)&apos; 서비스(이하 “서비스”)의 이용과 관련하여 회사와 회원 간의 권리, 의무, 책임사항 및 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
                            </section>
                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제2조 (용어의 정의)</h3>
                                <p>본 약관에서 사용하는 용어의 정의는 다음과 같습니다.<br />
                                    1. &quot;회원&quot;이란 회사와 서비스 이용계약을 체결하고 회사가 제공하는 서비스를 이용하는 자를 말합니다.<br />
                                    2. &quot;기질 검사&quot;란 회사가 제공하는 아동 및 양육자의 심리적 반응성 검사를 의미합니다.</p>
                            </section>
                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제3조 (약관의 효력 및 변경)</h3>
                                <p>회사는 본 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다. 회사는 합리적인 사유가 발생할 경우 관련 법령을 위배하지 않는 범위 내에서 이 약관을 개정할 수 있습니다.</p>
                            </section>
                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제4조 (회원가입 및 계정 정보)</h3>
                                <p>회원가입은 회원이 되고자 하는 자가 약관의 내용에 동의하고, 회사가 정한 양식에 따라 정보를 기입한 후 가입을 신청함으로써 이루어집니다. 소셜 로그인 시 제공되는 이메일 등과 같은 정보의 관리에 대한 책임은 회원 본인에게 있습니다.</p>
                            </section>
                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제5조 (서비스의 제공 및 중단)</h3>
                                <p>회사는 연중무휴 1일 24시간 서비스 제공을 원칙으로 합니다. 다만, 설비 점검 및 통신망 문제 등의 사유로 인하여 일시적으로 서비스가 중단될 수 있습니다.</p>
                            </section>
                            <div className="pt-6 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                                시행일: 2026년 3월 1일
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default function TermsPage() {
    return (
        <Suspense fallback={<div className="bg-background-light dark:bg-background-dark min-h-screen" />}>
            <TermsContent />
        </Suspense>
    );
}

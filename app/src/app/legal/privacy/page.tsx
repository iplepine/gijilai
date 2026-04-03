'use client';

import { Navbar } from '@/components/layout/Navbar';

export default function PrivacyPage() {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <div className="app-shell-width mx-auto relative min-h-screen flex flex-col">
                <Navbar title="개인정보 처리방침" />

                <main className="flex-1 px-6 py-8">
                    <div className="bg-white dark:bg-surface-dark rounded-[2rem] p-6 shadow-soft border border-gray-100 dark:border-gray-800 overflow-y-auto" style={{ maxHeight: '75vh' }}>
                        <h2 className="text-xl font-bold mb-6 mt-2">아이기질 개인정보 처리방침</h2>
                        <div className="space-y-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                            <p>본 방침은 '아이기질'(이하 "회사") 서비스에서 수집하는 개인정보의 항목, 목적 및 보호 정책에 대해 안내합니다.</p>
                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">1. 수집하는 개인정보 항목</h3>
                                <p className="mb-2">회사는 서비스 제공을 위해 아래와 같은 정보를 수집합니다.</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>회원가입 시: 닉네임, 이메일 주소, 프로필 이미지 (소셜 연동 정보)</li>
                                    <li>자녀 등록 시: 아이 이름(태명), 성별, 생년월일, 관계 정보</li>
                                    <li>서비스 이용 시: 문진표 응답 데이터, AI 상담 대화 기록, 기기/로그 정보</li>
                                </ul>
                            </section>
                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">2. 개인정보의 수집 및 이용 목적</h3>
                                <p>회사는 수집한 정보를 다음의 목적으로 이용합니다.</p>
                                <ul className="list-disc pl-5 space-y-1 mt-2">
                                    <li>기질 분석 및 AI 맞춤형 처방전 등 핵심 서비스 제공</li>
                                    <li>회원 식별, 부정 이용 방지, 고객 지원 서비스</li>
                                    <li>신규 서비스 및 마케팅(동의 시) 관련 정보 안내</li>
                                </ul>
                            </section>
                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">3. 개인정보의 보유 및 이용 기간</h3>
                                <p>회원 탈퇴를 요청하거나 개인정보 처리 목적이 달성될 경우, 회사는 지체 없이 해당 개인정보를 파기합니다. (단, 법령에 의한 데이터 보관 의무 발생 시 해당 기간 동안 안전하게 분리 보관합니다.)</p>
                            </section>
                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">4. AI 분석 데이터 관련 안내</h3>
                                <p>상담 및 진단 시 사용되는 문진 및 AI 대화 내용은 개인을 직접 식별할 수 없는 형태로 비식별화되어 서비스의 품질 개선 및 AI 모델 학습 목적으로(사전 고지 범위 내에서) 활용될 수 있습니다.</p>
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

'use client';

import { Suspense } from 'react';
import { Navbar } from '@/components/layout/Navbar';

function RefundPolicyContent() {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <div className="max-w-md mx-auto relative min-h-screen flex flex-col">
                <Navbar title="환불 정책" showBack />

                <main className="app-page-scroll flex-1 px-6 py-8">
                    <div className="bg-white dark:bg-surface-dark rounded-[2rem] p-6 shadow-soft border border-gray-100 dark:border-gray-800 overflow-y-auto" style={{ maxHeight: '75vh' }}>
                        <h2 className="text-xl font-bold mb-6 mt-2">환불 및 취소 정책</h2>
                        <div className="space-y-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제1조 (적용 범위)</h3>
                                <p>본 환불 정책은 데브호하우스(이하 &quot;회사&quot;)가 운영하는 기질아이 서비스에서 제공하는 모든 유료 상품(구독 서비스)에 적용됩니다.</p>
                            </section>

                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제2조 (결제 오류 환불)</h3>
                                <p>1. 결제 오류, 중복 결제 등 회사 귀책 사유로 인한 경우에는 전액 환불합니다.</p>
                            </section>

                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제3조 (구독 서비스 환불)</h3>
                                <p>1. 구독 결제일로부터 7일 이내이고, 결제 이후 AI 상담 생성, 후속 상담, 구독자 전용 실천 기록 전체 열람 등 유료 기능을 이용하지 않은 경우 전액 환불이 가능합니다 (쿨링오프).<br />
                                2. 결제 오류, 중복 결제, 시스템 오류 등 회사 귀책 사유가 있는 경우에는 전액 환불합니다.<br />
                                3. 구독 기간 중 환불을 요청한 경우, 환불 요청일 다음 날부터 해당 결제 주기 종료일까지의 미사용 일수에 대해 일할 계산하여 부분 환불합니다.<br />
                                4. 부분 환불 금액은 실제 결제금액 × 남은 미사용 일수 ÷ 해당 결제 주기의 총 일수로 산정하며, 원 단위 미만은 절사합니다.<br />
                                5. 부분 환불 처리 후 해당 구독 기간의 유료 기능 이용 권한은 종료됩니다.<br />
                                6. 단순 구독 해지만 요청하는 경우에는 즉시 환불이 아닌, 현재 결제 기간 종료일까지 서비스를 이용할 수 있으며 다음 결제 주기부터 과금이 중단됩니다.</p>
                            </section>

                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제4조 (부분 환불 예시)</h3>
                                <p>월 구독료 12,000원을 결제한 30일 이용권에서 10일 이용 후 환불을 요청한 경우, 남은 20일에 해당하는 8,000원을 환불합니다.</p>
                            </section>

                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제5조 (환불 절차)</h3>
                                <p>1. 환불을 원하시는 경우 고객센터(devhohouse@gmail.com)로 환불 사유와 함께 요청해 주시기 바랍니다.<br />
                                2. 환불 요청 접수 후 영업일 기준 3일 이내에 처리되며, 결제 수단에 따라 환불 완료까지 추가 소요 시간이 발생할 수 있습니다.<br />
                                3. 카드 결제의 경우 카드사 정책에 따라 환불 처리에 3~7 영업일이 소요될 수 있습니다.</p>
                            </section>

                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제6조 (환불 제외 사유)</h3>
                                <p>1. 쿠폰, 프로모션 등 무료로 제공된 혜택은 현금으로 환불되지 않습니다.<br />
                                2. 관련 법령 또는 결제수단 정책에 따라 환불이 제한되는 경우에는 해당 기준을 우선 적용합니다.</p>
                            </section>

                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제7조 (앱스토어 결제)</h3>
                                <p>Apple App Store 또는 Google Play Store를 통한 인앱 결제의 경우, 각 스토어의 환불 정책이 우선 적용됩니다. 해당 스토어를 통해 직접 환불을 요청해 주시기 바랍니다.</p>
                            </section>

                            <section>
                                <h3 className="font-bold text-navy dark:text-white text-base mb-2">제8조 (기타)</h3>
                                <p>1. 본 환불 정책은 전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령에 따릅니다.<br />
                                2. 본 정책에서 정하지 않은 사항은 관련 법령 및 회사의 이용약관에 따릅니다.<br />
                                3. 본 환불 정책은 2026년 4월 23일부터 시행됩니다.</p>
                            </section>

                            <section className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-400">
                                    사업자: 데브호하우스 | 대표: 박정호<br />
                                    사업자등록번호: 898-35-01596<br />
                                    통신판매업신고번호: 2026-서울중랑-0133<br />
                                    서울특별시 중랑구 신내로 155, 804동 1501호(신내동, 두산위브, 화성아파트)<br />
                                    전화: 010-3830-8960 | 문의: devhohouse@gmail.com
                                </p>
                            </section>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default function RefundPolicyPage() {
    return (
        <Suspense fallback={<div className="bg-background-light dark:bg-background-dark min-h-screen" />}>
            <RefundPolicyContent />
        </Suspense>
    );
}

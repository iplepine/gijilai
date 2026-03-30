'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
    const { user, signInWithGoogle, signInWithKakao, isLoadingGoogle, isLoadingKakao } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.replace('/');
        }
    }, [user, router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
            <div className="w-full max-w-sm text-center">
                <div className="mb-8 flex justify-center">
                    <img src="/gijilai_icon.png" alt="기질아이" className="w-16 h-16 rounded-2xl object-contain" />
                </div>

                <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2">
                    기질아이
                </h1>
                <p className="text-gray-500 mb-10">
                    아이의 신호를 올바르게 통역하는<br />우리 아이 맞춤 양육 가이드
                </p>

                <div className="space-y-3">
                    <button
                        onClick={signInWithKakao}
                        disabled={isLoadingKakao}
                        className="w-full bg-[#FEE500] text-[#191919] py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#FADA0A] transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {isLoadingKakao ? (
                            <div className="w-5 h-5 border-2 border-[#191919]/20 border-t-[#191919] rounded-full animate-spin" />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M9 3C5.13401 3 2 5.313 2 8.166C2 10 3.23 11.616 5.093 12.56L4.417 14.881C4.385 14.992 4.453 15.106 4.568 15.131C4.606 15.14 4.646 15.138 4.683 15.125L7.545 13.905C8.016 14.004 8.502 14.056 9 14.056C12.866 14.056 16 11.743 16 8.89C16 6.037 12.866 3.724 9 3.724V3Z" fill="#191919" />
                            </svg>
                        )}
                        {isLoadingKakao ? '로그인 중...' : '카카오로 계속하기'}
                    </button>

                    <button
                        onClick={signInWithGoogle}
                        disabled={isLoadingGoogle}
                        className="w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                    >
                        {isLoadingGoogle ? (
                            <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
                        ) : (
                            <Icon name="g_translate" size="sm" />
                        )}
                        {isLoadingGoogle ? '로그인 중...' : '구글로 계속하기'}
                    </button>
                </div>

                <p className="mt-8 text-xs text-gray-400">
                    로그인 시 이용약관 및 개인정보처리방침에 동의하게 됩니다.
                </p>
            </div>
        </div>
    );
}

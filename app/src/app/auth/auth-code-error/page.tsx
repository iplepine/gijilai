'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';

function ErrorContent() {
    const searchParams = useSearchParams();
    const [fragmentParams, setFragmentParams] = useState<Record<string, string>>({});

    useEffect(() => {
        // Parse fragment (#) parameters
        if (typeof window !== 'undefined' && window.location.hash) {
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const parsed: Record<string, string> = {};
            params.forEach((value, key) => {
                parsed[key] = value;
            });
            setFragmentParams(parsed);
        }
    }, []);

    const error = searchParams.get('error') || fragmentParams.error;
    const description = searchParams.get('description') || fragmentParams.error_description;
    const message = searchParams.get('message') || fragmentParams.message;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F8F4] p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-6">
                <Icon name="error_outline" size="lg" className="text-4xl" />
            </div>

            <h1 className="text-xl font-bold text-[var(--navy)] mb-2">
                로그인 중 문제가 발생했습니다
            </h1>

            <div className="text-gray-500 mb-8 max-w-xs space-y-2">
                <p>
                    인증 코드를 확인하는 과정에서 오류가 발생했습니다.<br />
                    잠시 후 다시 시도해주세요.
                </p>
                {(error || message || description) && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg text-xs text-red-600 font-mono break-all text-left">
                        {error && <p>Code: {error}</p>}
                        {description && <p>Desc: {description}</p>}
                        {message && <p>Msg: {message}</p>}
                    </div>
                )}
            </div>

            <Link href="/login" className="w-full max-w-xs">
                <button className="w-full bg-[var(--deep-green)] text-white py-3.5 rounded-xl font-bold">
                    로그인 페이지로 돌아가기
                </button>
            </Link>
        </div>
    );
}

export default function AuthCodeErrorPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ErrorContent />
        </Suspense>
    );
}

'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/db';

function ReferralHandlerContent() {
    const searchParams = useSearchParams();
    const { user } = useAuth();

    // Save referral code from URL to sessionStorage
    useEffect(() => {
        const ref = searchParams.get('ref');
        if (ref) {
            sessionStorage.setItem('referral_code', ref);
        }
    }, [searchParams]);

    // Apply referral code after login
    useEffect(() => {
        if (!user) return;

        const code = sessionStorage.getItem('referral_code');
        if (!code) return;

        // Only attempt once per session
        const applied = sessionStorage.getItem('referral_applied');
        if (applied) return;

        sessionStorage.setItem('referral_applied', 'true');

        db.applyReferralCode(user.id, code)
            .then((result) => {
                if (result) {
                    sessionStorage.removeItem('referral_code');
                }
            })
            .catch((err) => {
                console.warn('Referral apply failed (may not have table yet):', err);
            });
    }, [user]);

    return null;
}

export function ReferralHandler() {
    return (
        <Suspense fallback={null}>
            <ReferralHandlerContent />
        </Suspense>
    );
}

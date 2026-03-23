'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function ConsultationDetailRedirect() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    useEffect(() => {
        router.replace(`/consultations?view=${id}`);
    }, [id, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
}

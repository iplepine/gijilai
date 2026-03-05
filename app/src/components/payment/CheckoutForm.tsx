'use client';

import React, { useState } from 'react';
import {
    PaymentElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/Button';

interface CheckoutFormProps {
    onSuccess: () => void;
    amount: number;
}

export default function CheckoutForm({ onSuccess, amount }: CheckoutFormProps) {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsLoading(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Return URL is required by Stripe but for this flow we might just handle the success locally
                return_url: `${window.location.origin}/payment/success`,
            },
            redirect: 'if_required',
        });

        if (error) {
            setErrorMessage(error.message ?? 'An unexpected error occurred.');
            setIsLoading(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement />
            {errorMessage && (
                <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl border border-red-100">
                    {errorMessage}
                </div>
            )}
            <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={isLoading || !stripe || !elements}
                className="h-16 rounded-[24px] text-lg font-bold shadow-2xl shadow-primary/20"
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        <span>처리 중...</span>
                    </div>
                ) : (
                    `${amount.toLocaleString()}원 결제하기`
                )}
            </Button>
        </form>
    );
}

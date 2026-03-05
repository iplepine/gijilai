import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
});

export async function POST(req: Request) {
    try {
        const { amount, currency = 'krw' } = await req.json();

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: currency,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error: any) {
        console.error('Stripe Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 400 }
        );
    }
}

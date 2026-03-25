import { PortOneClient } from '@portone/server-sdk';

const portone = PortOneClient({ secret: process.env.PORTONE_API_SECRET as string });

export const PRICE_TABLE = {
  report_single: { KRW: 990, USD: 499 },
  subscription_monthly: { KRW: 9900, USD: 999 },
  subscription_yearly: { KRW: 79000, USD: 7999 },
} as const;

export type ProductCode = keyof typeof PRICE_TABLE;
export type Currency = 'KRW' | 'USD';

export function getAmount(product: ProductCode, currency: Currency): number {
  return PRICE_TABLE[product][currency];
}

export function getChannelKey(locale: string): string {
  if (locale === 'ko') {
    return process.env.PORTONE_CHANNEL_KEY_TOSS as string;
  }
  return process.env.PORTONE_CHANNEL_KEY_STRIPE as string;
}

export async function verifyPayment(paymentId: string) {
  const payment = await portone.payment.getPayment({ paymentId });
  return payment;
}

export async function payWithBillingKey(params: {
  billingKey: string;
  paymentId: string;
  orderName: string;
  amount: number;
  currency: Currency;
  customerId: string;
}) {
  const result = await portone.payment.payWithBillingKey({
    billingKey: params.billingKey,
    paymentId: params.paymentId,
    orderName: params.orderName,
    amount: { total: params.amount },
    currency: params.currency,
    customer: { id: params.customerId },
  });
  return result;
}

export { portone };

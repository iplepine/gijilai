import { PortOneClient, type PortOneClient as PortOneClientType } from '@portone/server-sdk';

let _portone: PortOneClientType | null = null;
function getPortone() {
  if (!_portone) {
    _portone = PortOneClient({ secret: process.env.PORTONE_API_SECRET as string });
  }
  return _portone;
}

export const PRICE_TABLE = {
  subscription_monthly: { KRW: 12000, USD: 1199 },
  subscription_yearly: { KRW: 89000, USD: 8999 },
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
  const payment = await getPortone().payment.getPayment({ paymentId });
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
  const result = await getPortone().payment.payWithBillingKey({
    billingKey: params.billingKey,
    paymentId: params.paymentId,
    orderName: params.orderName,
    amount: { total: params.amount },
    currency: params.currency,
    customer: { id: params.customerId },
  });
  return result;
}

export async function cancelPayment(paymentId: string, reason: string) {
  const result = await getPortone().payment.cancelPayment({
    paymentId,
    reason,
  });
  return result;
}

export { getPortone };

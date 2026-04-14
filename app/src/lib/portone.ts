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
  // [연 구독] 신뢰 확보 후 재활성화 예정 — 환불 산식/갱신 알림 구현 필요
  // subscription_yearly: { KRW: 89000, USD: 8999 },
} as const;

/** 월 구독 첫 달 할인율 (30%) */
export const FIRST_MONTH_DISCOUNT = 0.3;

export type ProductCode = keyof typeof PRICE_TABLE;
export type Currency = 'KRW' | 'USD';
export type PayMethod = 'KCP_CARD' | 'INICIS_CARD' | 'TOSSPAY' | 'NAVERPAY';

export function getAmount(product: ProductCode, currency: Currency): number {
  return PRICE_TABLE[product][currency];
}

/** 월 구독 첫 달 할인가 */
export function getFirstMonthAmount(currency: Currency): number {
  const regular = PRICE_TABLE.subscription_monthly[currency];
  return Math.round(regular * (1 - FIRST_MONTH_DISCOUNT));
}

/** 한국 결제수단별 채널키 반환 */
export function getKoChannelKey(payMethod: PayMethod): string {
  if (payMethod === 'INICIS_CARD') {
    return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_INICIS as string;
  }
  if (payMethod === 'NAVERPAY') {
    return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_NAVERPAY as string;
  }
  if (payMethod === 'TOSSPAY') {
    return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSS as string;
  }
  return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KCP as string;
}

/** locale 기반 기본 채널키 (한국: KCP 카드결제) */
export function getChannelKey(locale: string): string {
  if (locale === 'ko') {
    return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KCP as string;
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

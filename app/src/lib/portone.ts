import { PortOneClient, type PortOneClient as PortOneClientType } from '@portone/server-sdk';
import type { Json } from '@/types/supabase';

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
export type PayMethod = 'KCP_CARD' | 'INICIS_CARD';
export type PaymentMethodSnapshot = {
  type?: string;
  provider?: string;
  easyPayMethodType?: string;
  card?: {
    publisher?: string;
    issuer?: string;
    brand?: string;
    type?: string;
    ownerType?: string;
    bin?: string;
    name?: string;
    number?: string;
    approvalNumber?: string;
    installmentMonth?: number;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

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
  return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KCP as string;
}

/** locale 기반 기본 채널키 (한국: KG 이니시스 정기결제) */
export function getChannelKey(locale: string): string {
  if (locale === 'ko') {
    return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_INICIS as string;
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
  channelKey?: string;
}) {
  const result = await getPortone().payment.payWithBillingKey({
    billingKey: params.billingKey,
    channelKey: params.channelKey,
    paymentId: params.paymentId,
    orderName: params.orderName,
    amount: { total: params.amount },
    currency: params.currency,
    customer: { id: params.customerId },
  });
  return result;
}

export function getPaymentMethodSnapshot(payment: unknown): PaymentMethodSnapshot | null {
  const paymentRecord = asRecord(payment);
  const method = asRecord(paymentRecord?.method);
  if (!method) return null;

  const type = stringValue(method.type);

  if (type === 'PaymentMethodCard') {
    const card = asRecord(method.card);
    const installment = asRecord(method.installment);
    return {
      type: 'CARD',
      card: {
        publisher: stringValue(card?.publisher),
        issuer: stringValue(card?.issuer),
        brand: stringValue(card?.brand),
        type: stringValue(card?.type),
        ownerType: stringValue(card?.ownerType),
        bin: stringValue(card?.bin),
        name: stringValue(card?.name),
        number: stringValue(card?.number),
        approvalNumber: stringValue(method.approvalNumber),
        installmentMonth: numberValue(installment?.month),
      },
    };
  }

  if (type === 'PaymentMethodEasyPay') {
    const easyPayMethod = asRecord(method.easyPayMethod);
    return {
      type: 'EASY_PAY',
      provider: stringValue(method.provider),
      easyPayMethodType: stringValue(easyPayMethod?.type),
    };
  }

  return type ? { type } : null;
}

export function getPaymentMethodType(payment: unknown): string | null {
  return getPaymentMethodSnapshot(payment)?.type ?? null;
}

export function getPaymentPgProvider(payment: unknown): string | null {
  const paymentRecord = asRecord(payment);
  const channel = asRecord(paymentRecord?.channel);
  return stringValue(channel?.pgProvider) ?? null;
}

export function toPaymentMethodMetadata(payment: unknown, extra?: Record<string, Json>): Json {
  return {
    ...(extra ?? {}),
    paymentMethod: getPaymentMethodSnapshot(payment) as Json,
  };
}

export async function cancelPayment(paymentId: string, reason: string) {
  const result = await getPortone().payment.cancelPayment({
    paymentId,
    reason,
  });
  return result;
}

export { getPortone };

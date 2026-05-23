import { db, SubscriptionData } from '@/lib/db';

export async function getActiveSubscription(userId: string): Promise<SubscriptionData | null> {
  return db.getActiveSubscription(userId);
}

/**
 * 다음 결제일 계산.
 * - MONTHLY: +30일
 * - YEARLY: +1년 (윤년 안전, setFullYear)
 */
export function computePeriodEnd(plan: 'MONTHLY' | 'YEARLY', from: Date = new Date()): Date {
  const end = new Date(from);
  if (plan === 'YEARLY') {
    end.setFullYear(end.getFullYear() + 1);
    return end;
  }
  end.setDate(end.getDate() + 30);
  return end;
}

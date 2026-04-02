import { db, SubscriptionData } from '@/lib/db';

export async function getActiveSubscription(userId: string): Promise<SubscriptionData | null> {
  return db.getActiveSubscription(userId);
}

// [연 구독] 신뢰 확보 후 재활성화 예정 — plan 타입에 'YEARLY' 추가, else 분기 복원
// export function computePeriodEnd(plan: 'MONTHLY' | 'YEARLY', from: Date = new Date()): Date {
//   ...
//   } else { end.setDate(end.getDate() + 365); }
// }
export function computePeriodEnd(plan: 'MONTHLY', from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + 30);
  return end;
}

import { db, SubscriptionData } from '@/lib/db';

export type Feature = 'premium_report' | 'consult' | 'practice_full' | 'no_cooldown';

const FREE_MONTHLY_CONSULT_LIMIT = 2;

export async function getActiveSubscription(userId: string): Promise<SubscriptionData | null> {
  return db.getActiveSubscription(userId);
}

export async function hasAccess(
  userId: string,
  feature: Feature,
  resourceId?: string
): Promise<boolean> {
  const sub = await getActiveSubscription(userId);

  switch (feature) {
    case 'premium_report':
      if (sub) return true;
      if (!resourceId) return false;
      return isReportPaid(userId, resourceId);

    case 'consult':
      if (sub) return true;
      const count = await db.getMonthlyConsultCount(userId);
      return count < FREE_MONTHLY_CONSULT_LIMIT;

    case 'practice_full':
      return !!sub;

    case 'no_cooldown':
      return !!sub;
  }
}

export async function getRemainingConsults(userId: string): Promise<number> {
  const sub = await getActiveSubscription(userId);
  if (sub) return Infinity;
  const count = await db.getMonthlyConsultCount(userId);
  return Math.max(0, FREE_MONTHLY_CONSULT_LIMIT - count);
}

async function isReportPaid(userId: string, reportId: string): Promise<boolean> {
  const reports = await db.getReports(userId);
  const report = reports.find(r => r.id === reportId);
  return report?.is_paid ?? false;
}

export function computePeriodEnd(plan: 'MONTHLY' | 'YEARLY', from: Date = new Date()): Date {
  const end = new Date(from);
  if (plan === 'MONTHLY') {
    end.setDate(end.getDate() + 30);
  } else {
    end.setDate(end.getDate() + 365);
  }
  return end;
}

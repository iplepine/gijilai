import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, parseJsonBody } from '@/lib/api';
import { syncIapSubscription, verifyGoogleSubscription } from '@/lib/iap';

function mapGoogleNotificationType(notificationType: number) {
  switch (notificationType) {
    case 1: // RECOVERED
    case 2: // RENEWED
    case 4: // PURCHASED
    case 7: // RESTARTED
    case 8: // PRICE_CHANGE_CONFIRMED
    case 9: // DEFERRED
    case 11: // PAUSE_SCHEDULE_CHANGED
      return { subscriptionStatus: 'ACTIVE' as const, paymentStatus: 'PAID' as const, cancelAtPeriodEnd: false };
    case 3: // CANCELED
      return { subscriptionStatus: 'ACTIVE' as const, paymentStatus: null, cancelAtPeriodEnd: true };
    case 5: // ON_HOLD
    case 6: // IN_GRACE_PERIOD
    case 10: // PAUSED
      return { subscriptionStatus: 'PAST_DUE' as const, paymentStatus: 'FAILED' as const, cancelAtPeriodEnd: false };
    case 12: // REVOKED
      return { subscriptionStatus: 'CANCELLED' as const, paymentStatus: 'REFUNDED' as const, cancelAtPeriodEnd: false };
    case 13: // EXPIRED
      return { subscriptionStatus: 'EXPIRED' as const, paymentStatus: null, cancelAtPeriodEnd: false };
    default:
      return null;
  }
}

export async function POST(req: Request) {
  try {
    const expectedToken = process.env.GOOGLE_RTDN_TOKEN;
    const providedToken = new URL(req.url).searchParams.get('token');

    if (expectedToken && providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await parseJsonBody<{ message?: { data?: string } }>(req);
    const messageData = body?.message?.data;

    if (!messageData) {
      return NextResponse.json({ error: 'MISSING_MESSAGE_DATA' }, { status: 400 });
    }

    const decoded = JSON.parse(Buffer.from(messageData, 'base64').toString('utf8'));
    const subNotification = decoded.subscriptionNotification;

    if (!subNotification?.subscriptionId || !subNotification?.purchaseToken) {
      return NextResponse.json({ received: true, skipped: 'no_subscription_notification' });
    }

    const mapped = mapGoogleNotificationType(subNotification.notificationType);
    if (!mapped) {
      return NextResponse.json({ received: true, skipped: 'unsupported_notification_type' });
    }

    const verified = await verifyGoogleSubscription(
      subNotification.subscriptionId,
      subNotification.purchaseToken
    );

    const syncResult = await syncIapSubscription({
      platform: 'GOOGLE_PLAY',
      productId: verified.productId,
      transactionId: verified.transactionId,
      originalTransactionId: verified.originalTransactionId,
      expiresDate: verified.expiresDate,
      subscriptionStatus: mapped.subscriptionStatus,
      paymentStatus: mapped.paymentStatus,
      eventName: `GOOGLE_${subNotification.notificationType}`,
      cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
    });

    return NextResponse.json({ received: true, ok: syncResult.ok });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    console.error('Google RTDN error:', error);
    return NextResponse.json({ error: 'GOOGLE_RTDN_PROCESSING_FAILED' }, { status: 500 });
  }
}

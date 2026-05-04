import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, parseJsonBody } from '@/lib/api';
import {
  AppleJwsVerificationError,
  IapConfigurationError,
  syncIapSubscription,
  verifyAppleTransaction,
  verifyAppleSignedPayload,
} from '@/lib/iap';

function mapAppleNotificationToStatus(notificationType: string) {
  switch (notificationType) {
    case 'DID_FAIL_TO_RENEW':
      return { subscriptionStatus: 'PAST_DUE' as const, paymentStatus: 'FAILED' as const };
    case 'EXPIRED':
      return { subscriptionStatus: 'EXPIRED' as const, paymentStatus: null };
    case 'REFUND':
    case 'REVOKE':
      return { subscriptionStatus: 'CANCELLED' as const, paymentStatus: 'REFUNDED' as const };
    default:
      return { subscriptionStatus: 'ACTIVE' as const, paymentStatus: 'PAID' as const };
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody<{ signedPayload?: string }>(req);
    const signedPayload = body?.signedPayload;

    if (!signedPayload) {
      return NextResponse.json({ error: 'MISSING_SIGNED_PAYLOAD' }, { status: 400 });
    }

    const payload = verifyAppleSignedPayload<{
      notificationType: string;
      subtype?: string;
      data?: {
        signedTransactionInfo?: string;
      };
    }>(signedPayload);

    const txPayload = payload.data?.signedTransactionInfo
      ? verifyAppleSignedPayload<{
          transactionId: string;
        }>(payload.data.signedTransactionInfo)
      : null;

    if (!txPayload?.transactionId) {
      return NextResponse.json({ received: true, skipped: 'no_transaction' });
    }

    const verified = await verifyAppleTransaction(txPayload.transactionId);
    const mapped = mapAppleNotificationToStatus(payload.notificationType);

    if (payload.notificationType === 'DID_CHANGE_RENEWAL_STATUS') {
      const syncResult = await syncIapSubscription({
        platform: 'APPLE_IAP',
        productId: verified.productId,
        transactionId: verified.transactionId,
        originalTransactionId: verified.originalTransactionId,
        expiresDate: verified.expiresDate,
        subscriptionStatus: 'ACTIVE',
        paymentStatus: null,
        eventName: `APPLE_${payload.notificationType}`,
        cancelAtPeriodEnd: payload.subtype === 'AUTO_RENEW_DISABLED',
      });

      return NextResponse.json({ received: true, ok: syncResult.ok });
    }

    const syncResult = await syncIapSubscription({
      platform: 'APPLE_IAP',
      productId: verified.productId,
      transactionId: verified.transactionId,
      originalTransactionId: verified.originalTransactionId,
      expiresDate: verified.expiresDate,
      subscriptionStatus: mapped.subscriptionStatus,
      paymentStatus: mapped.paymentStatus,
      eventName: `APPLE_${payload.notificationType}`,
      cancelAtPeriodEnd: false,
    });

    return NextResponse.json({ received: true, ok: syncResult.ok });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    if (error instanceof AppleJwsVerificationError) {
      console.error('Apple IAP notification signature verification failed:', error);
      return NextResponse.json({ error: 'INVALID_APPLE_SIGNATURE' }, { status: 401 });
    }

    if (error instanceof IapConfigurationError) {
      console.error('Apple IAP notification is not configured:', error);
      return NextResponse.json({ error: 'APPLE_NOTIFICATION_MISCONFIGURED' }, { status: 500 });
    }

    console.error('Apple IAP notification error:', error);
    return NextResponse.json({ error: 'APPLE_NOTIFICATION_PROCESSING_FAILED' }, { status: 500 });
  }
}

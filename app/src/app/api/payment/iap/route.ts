import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, parseJsonBody } from '@/lib/api';
import { createClient } from '@/lib/supabaseServer';
import {
  getIapProductConfig,
  IapConfigurationError,
  syncIapSubscription,
  verifyAppleTransaction,
  verifyGoogleSubscription,
} from '@/lib/iap';

type Platform = 'APPLE_IAP' | 'GOOGLE_PLAY';

interface IAPRequestBody {
  platform: Platform;
  receiptToken: string;         // Apple: transactionId, Google: purchaseToken
  productId: string;            // e.g. 'monthly_premium'
  originalTransactionId?: string; // 갱신 추적용
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseJsonBody<IAPRequestBody>(req);
    const { platform, receiptToken, productId, originalTransactionId } = body;

    if (!platform || !receiptToken || !productId) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }

    if (platform !== 'APPLE_IAP' && platform !== 'GOOGLE_PLAY') {
      return NextResponse.json({ error: 'INVALID_PLATFORM' }, { status: 400 });
    }

    const product = getIapProductConfig(productId);

    let verification;
    if (platform === 'APPLE_IAP') {
      verification = await verifyAppleTransaction(receiptToken);
    } else {
      verification = await verifyGoogleSubscription(productId, receiptToken);
    }

    if (verification.productId !== productId) {
      return NextResponse.json({ error: 'PRODUCT_MISMATCH' }, { status: 400 });
    }

    const syncResult = await syncIapSubscription({
      platform,
      productId,
      transactionId: verification.transactionId,
      originalTransactionId:
        verification.originalTransactionId || originalTransactionId || verification.transactionId,
      expiresDate: verification.expiresDate,
      userId: session.user.id,
      subscriptionStatus: 'ACTIVE',
      paymentStatus: 'PAID',
      eventName: 'CLIENT_VERIFIED_PURCHASE',
    });

    if (!syncResult.ok) {
      return NextResponse.json({ error: 'SUBSCRIPTION_SYNC_FAILED' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: syncResult.subscriptionId,
        plan: product.plan,
        currentPeriodEnd: verification.expiresDate?.toISOString() || null,
        source: platform,
      },
    });
  } catch (error: unknown) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    console.error('IAP verification error:', error);
    if (error instanceof IapConfigurationError) {
      return NextResponse.json(
        { error: 'IAP_SERVER_MISCONFIGURED' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'IAP_VERIFICATION_FAILED' },
      { status: 500 }
    );
  }
}

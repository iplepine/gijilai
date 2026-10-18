import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, parseJsonBody } from '@/lib/api';
import { createClient } from '@/lib/supabaseServer';
import {
  getIapProductConfig,
  getSupabaseAdmin,
  IapConfigurationError,
  IapPurchaseNotCompletedError,
  syncIapSubscription,
  verifyAppleTransaction,
  verifyGoogleProductPurchase,
  verifyGoogleSubscription,
} from '@/lib/iap';
import { recordHarmonyPurchase } from '@/lib/harmonyAccess';
import { HARMONY_REPORT_IAP_PRODUCT_ID, HARMONY_REPORT_PRODUCT, isUuid } from '@/lib/harmonyUnlock';

type Platform = 'APPLE_IAP' | 'GOOGLE_PLAY';

interface IAPRequestBody {
  platform: Platform;
  receiptToken: string;         // Apple: transactionId, Google: purchaseToken
  productId: string;            // e.g. 'monthly_premium'
  originalTransactionId?: string; // 갱신 추적용
  childId?: string;             // 궁합 리포트 단품: 구매 대상 아이
}

/**
 * 궁합 리포트 단품(소모성). 아이 ID는 스토어 거래에 실린 계정 토큰을 우선 믿고,
 * 없으면(구형 StoreKit 경로 등) 앱이 보낸 값을 쓴다. 같은 거래는 한 번만 기록된다.
 */
async function handleHarmonyPurchase(params: {
  userId: string;
  platform: Platform;
  receiptToken: string;
  childId?: string;
}) {
  const verification = params.platform === 'APPLE_IAP'
    ? await verifyAppleTransaction(params.receiptToken)
    : await verifyGoogleProductPurchase(HARMONY_REPORT_IAP_PRODUCT_ID, params.receiptToken);

  if (verification.productId !== HARMONY_REPORT_IAP_PRODUCT_ID) {
    return NextResponse.json({ error: 'PRODUCT_MISMATCH' }, { status: 400 });
  }
  if (verification.revoked) {
    return NextResponse.json({ error: 'PURCHASE_REVOKED' }, { status: 409 });
  }

  const childId = isUuid(verification.accountToken) ? verification.accountToken : params.childId;
  if (!isUuid(childId)) {
    return NextResponse.json({ error: 'MISSING_CHILD_ID' }, { status: 400 });
  }

  await recordHarmonyPurchase(getSupabaseAdmin(), {
    userId: params.userId,
    childId,
    platform: params.platform,
    transactionId: verification.transactionId,
    amount: verification.paymentAmount,
    currency: verification.paymentCurrency,
  });

  return NextResponse.json({ success: true, product: HARMONY_REPORT_PRODUCT, childId });
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

    if (productId === HARMONY_REPORT_IAP_PRODUCT_ID) {
      return await handleHarmonyPurchase({
        userId: session.user.id,
        platform,
        receiptToken,
        childId: body.childId,
      });
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
      paymentAmount: verification.paymentAmount,
      paymentCurrency: verification.paymentCurrency,
      introductoryPaymentAmount: verification.introductoryPaymentAmount,
      introductoryPaymentCurrency: verification.introductoryPaymentCurrency,
      introductoryPricePeriod: verification.introductoryPricePeriod,
      introductoryPriceCycles: verification.introductoryPriceCycles,
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
    if (error instanceof IapPurchaseNotCompletedError) {
      return NextResponse.json({ error: 'PURCHASE_NOT_COMPLETED' }, { status: 409 });
    }
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

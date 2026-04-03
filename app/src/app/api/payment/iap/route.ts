import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { computePeriodEnd } from '@/lib/subscription';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type Platform = 'APPLE_IAP' | 'GOOGLE_PLAY';

interface IAPRequestBody {
  platform: Platform;
  receiptToken: string;         // Apple: transactionId, Google: purchaseToken
  productId: string;            // e.g. 'monthly_premium'
  originalTransactionId?: string; // 갱신 추적용
}

// Apple App Store Server API v2 — 영수증 검증
async function verifyAppleReceipt(transactionId: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction
    ? 'https://api.storekit.itunes.apple.com'
    : 'https://api.storekit-sandbox.itunes.apple.com';

  const response = await fetch(
    `${baseUrl}/inApps/v1/transactions/${transactionId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.APPLE_IAP_JWT}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apple verification failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  // signedTransactionInfo는 JWS 형식 — 페이로드 디코딩
  const payload = JSON.parse(
    Buffer.from(data.signedTransactionInfo.split('.')[1], 'base64').toString()
  );

  return {
    valid: true,
    productId: payload.productId,
    transactionId: payload.transactionId,
    originalTransactionId: payload.originalTransactionId,
    expiresDate: payload.expiresDate ? new Date(payload.expiresDate) : null,
  };
}

// Google Play Developer API — 구독 영수증 검증
async function verifyGoogleReceipt(productId: string, purchaseToken: string) {
  // Google OAuth2로 액세스 토큰 발급
  const credentials = JSON.parse(process.env.GOOGLE_PLAY_CREDENTIALS || '{}');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: await createGoogleJWT(credentials),
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Google OAuth token request failed');
  }

  const { access_token } = await tokenResponse.json();
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.devho.gijilai';

  const verifyResponse = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
    {
      headers: { Authorization: `Bearer ${access_token}` },
    }
  );

  if (!verifyResponse.ok) {
    const text = await verifyResponse.text();
    throw new Error(`Google verification failed (${verifyResponse.status}): ${text}`);
  }

  const data = await verifyResponse.json();

  return {
    valid: data.paymentState === 1 || data.paymentState === 2,
    productId,
    transactionId: purchaseToken,
    originalTransactionId: data.linkedPurchaseToken || purchaseToken,
    expiresDate: data.expiryTimeMillis ? new Date(parseInt(data.expiryTimeMillis)) : null,
  };
}

// Google 서비스 계정 JWT 생성
async function createGoogleJWT(credentials: {
  client_email: string;
  private_key: string;
}) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claimSet = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const unsignedToken = `${header}.${claimSet}`;

  // Node.js crypto로 RS256 서명
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(credentials.private_key, 'base64url');

  return `${unsignedToken}.${signature}`;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: IAPRequestBody = await req.json();
    const { platform, receiptToken, productId, originalTransactionId } = body;

    if (!platform || !receiptToken || !productId) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }

    if (platform !== 'APPLE_IAP' && platform !== 'GOOGLE_PLAY') {
      return NextResponse.json({ error: 'INVALID_PLATFORM' }, { status: 400 });
    }

    // 영수증 검증
    let verification;
    if (platform === 'APPLE_IAP') {
      verification = await verifyAppleReceipt(receiptToken);
    } else {
      verification = await verifyGoogleReceipt(productId, receiptToken);
    }

    if (!verification.valid) {
      return NextResponse.json({ error: 'INVALID_RECEIPT' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const userId = session.user.id;

    // 동일 트랜잭션 중복 처리 방지
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('id')
      .eq('app_transaction_id', verification.transactionId)
      .single();

    if (existingSub) {
      return NextResponse.json({ success: true, subscription: existingSub });
    }

    // 기존 활성 구독 확인
    const { data: activeSub } = await admin
      .from('subscriptions')
      .select('id, source')
      .eq('user_id', userId)
      .in('status', ['ACTIVE', 'PAST_DUE'])
      .single();

    if (activeSub) {
      return NextResponse.json({ error: 'ALREADY_SUBSCRIBED' }, { status: 400 });
    }

    // 구독 생성
    const now = new Date();
    const periodEnd = verification.expiresDate || computePeriodEnd('MONTHLY', now);

    const { data: subscription, error: subError } = await admin
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan: 'MONTHLY',
        status: 'ACTIVE',
        source: platform,
        currency: 'KRW',
        amount: platform === 'APPLE_IAP' ? 12000 : 12000,
        current_period_start: now.toISOString(),
        current_period_end: (periodEnd instanceof Date ? periodEnd : new Date(periodEnd)).toISOString(),
        app_transaction_id: verification.transactionId,
        app_original_transaction_id:
          verification.originalTransactionId || originalTransactionId || verification.transactionId,
      })
      .select()
      .single();

    if (subError) {
      console.error('IAP subscription creation failed:', subError);
      return NextResponse.json({ error: 'SUBSCRIPTION_CREATION_FAILED' }, { status: 500 });
    }

    // 결제 기록
    await admin.from('payments').insert({
      user_id: userId,
      subscription_id: subscription.id,
      type: 'SUBSCRIPTION',
      portone_payment_id: `iap_${platform.toLowerCase()}_${verification.transactionId}`,
      status: 'PAID',
      currency: 'KRW',
      amount: 12000,
      pg_provider: platform === 'APPLE_IAP' ? 'apple' : 'google',
      pay_method: platform === 'APPLE_IAP' ? 'applepay' : 'googlepay',
      paid_at: now.toISOString(),
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        currentPeriodEnd: subscription.current_period_end,
        source: subscription.source,
      },
    });
  } catch (error: any) {
    console.error('IAP verification error:', error);
    return NextResponse.json(
      { error: error.message || 'IAP 검증 실패' },
      { status: 500 }
    );
  }
}

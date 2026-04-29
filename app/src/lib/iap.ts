import { createClient as createAdminClient } from '@supabase/supabase-js';

type Platform = 'APPLE_IAP' | 'GOOGLE_PLAY';
type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
type PaymentStatus = 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
type PaymentType = 'SUBSCRIPTION' | 'RENEWAL';
type GoogleServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

export class IapConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IapConfigurationError';
  }
}

export interface VerifiedIapPurchase {
  platform: Platform;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  expiresDate: Date | null;
  cancelAtPeriodEnd?: boolean;
}

const MONTHLY_IAP_PRODUCT = {
  plan: 'MONTHLY' as const,
  currency: 'KRW',
  amount: 12000,
  pgProvider: {
    APPLE_IAP: 'apple',
    GOOGLE_PLAY: 'google',
  },
  payMethod: {
    APPLE_IAP: 'applepay',
    GOOGLE_PLAY: 'googlepay',
  },
};

const IAP_PRODUCTS = {
  monthly_premium: MONTHLY_IAP_PRODUCT,
  gijilai_premium_monthly: MONTHLY_IAP_PRODUCT,
} as const;

export function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function getIapProductConfig(productId: string) {
  const config = IAP_PRODUCTS[productId as keyof typeof IAP_PRODUCTS];
  if (!config) {
    throw new Error(`Unsupported IAP product: ${productId}`);
  }
  return config;
}

export function decodeJwsPayload<T = Record<string, unknown>>(token: string): T {
  const segments = token.split('.');
  if (segments.length < 2) {
    throw new Error('Invalid JWS payload');
  }
  return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as T;
}

export async function verifyAppleTransaction(transactionId: string): Promise<VerifiedIapPurchase> {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction
    ? 'https://api.storekit.itunes.apple.com'
    : 'https://api.storekit-sandbox.itunes.apple.com';

  const response = await fetch(`${baseUrl}/inApps/v1/transactions/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${process.env.APPLE_IAP_JWT}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apple verification failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const payload = decodeJwsPayload<{
    productId: string;
    transactionId: string;
    originalTransactionId?: string;
    expiresDate?: number;
  }>(data.signedTransactionInfo);

  return {
    platform: 'APPLE_IAP',
    productId: payload.productId,
    transactionId: payload.transactionId,
    originalTransactionId: payload.originalTransactionId || payload.transactionId,
    expiresDate: payload.expiresDate ? new Date(payload.expiresDate) : null,
  };
}

async function createGoogleJWT(credentials: { client_email: string; private_key: string }) {
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
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(credentials.private_key, 'base64url');

  return `${unsignedToken}.${signature}`;
}

function parseGoogleCredentials(rawValue: string | undefined): GoogleServiceAccountCredentials {
  if (!rawValue?.trim()) {
    throw new IapConfigurationError('GOOGLE_PLAY_CREDENTIALS is not configured');
  }

  const candidates = [rawValue.trim()];

  try {
    candidates.push(Buffer.from(rawValue.trim(), 'base64').toString('utf8'));
  } catch {
    // Ignore invalid base64 and keep JSON parsing error handling below.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<GoogleServiceAccountCredentials> | string;
      const credentials = typeof parsed === 'string'
        ? JSON.parse(parsed) as Partial<GoogleServiceAccountCredentials>
        : parsed;

      const clientEmail = credentials.client_email?.trim();
      const privateKey = credentials.private_key?.replace(/\\n/g, '\n').trim();

      if (!clientEmail || !privateKey) {
        throw new IapConfigurationError(
          'GOOGLE_PLAY_CREDENTIALS must include client_email and private_key'
        );
      }

      if (!privateKey.includes('BEGIN PRIVATE KEY')) {
        throw new IapConfigurationError(
          'GOOGLE_PLAY_CREDENTIALS.private_key must be a valid service account private key'
        );
      }

      return {
        client_email: clientEmail,
        private_key: privateKey,
      };
    } catch (error) {
      if (error instanceof IapConfigurationError) {
        throw error;
      }
    }
  }

  throw new IapConfigurationError(
    'GOOGLE_PLAY_CREDENTIALS must be a valid Google service account JSON'
  );
}

async function getGoogleAccessToken() {
  const credentials = parseGoogleCredentials(process.env.GOOGLE_PLAY_CREDENTIALS);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: await createGoogleJWT(credentials),
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Google OAuth token request failed (${tokenResponse.status}): ${errorText}`);
  }

  const { access_token } = await tokenResponse.json();
  return access_token as string;
}

export async function verifyGoogleSubscription(productId: string, purchaseToken: string): Promise<VerifiedIapPurchase> {
  const accessToken = await getGoogleAccessToken();
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.devho.gijilai';

  const verifyResponse = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!verifyResponse.ok) {
    const text = await verifyResponse.text();
    throw new Error(`Google verification failed (${verifyResponse.status}): ${text}`);
  }

  const data = await verifyResponse.json();
  const valid = data.paymentState === 1 || data.paymentState === 2 || data.autoResumeTimeMillis;

  if (!valid) {
    throw new Error('Google subscription is not active');
  }

  return {
    platform: 'GOOGLE_PLAY',
    productId,
    transactionId: purchaseToken,
    originalTransactionId: data.linkedPurchaseToken || purchaseToken,
    expiresDate: data.expiryTimeMillis ? new Date(parseInt(data.expiryTimeMillis, 10)) : null,
    cancelAtPeriodEnd: data.autoRenewing === false,
  };
}

function getIapProductIdFromPlan(
  plan: string | null | undefined,
  platform: Platform
): string | null {
  if (plan === 'MONTHLY') {
    return platform === 'APPLE_IAP'
      ? 'gijilai_premium_monthly'
      : 'monthly_premium';
  }
  return null;
}

type RefreshableIapSubscription = {
  id: string;
  user_id: string;
  source: Platform;
  plan: string;
  app_transaction_id: string | null;
  app_original_transaction_id: string | null;
  cancelled_at: string | null;
};

export async function refreshIapSubscriptionState(
  subscription: RefreshableIapSubscription
) {
  const productId = getIapProductIdFromPlan(subscription.plan, subscription.source);
  if (!productId) {
    return { ok: false, reason: 'unsupported_plan' as const };
  }

  if (subscription.source === 'GOOGLE_PLAY') {
    const purchaseToken =
      subscription.app_transaction_id || subscription.app_original_transaction_id;

    if (!purchaseToken) {
      return { ok: false, reason: 'missing_purchase_token' as const };
    }

    const verified = await verifyGoogleSubscription(productId, purchaseToken);
    return syncIapSubscription({
      platform: 'GOOGLE_PLAY',
      productId,
      transactionId: verified.transactionId,
      originalTransactionId: verified.originalTransactionId,
      expiresDate: verified.expiresDate,
      userId: subscription.user_id,
      subscriptionStatus: 'ACTIVE',
      paymentStatus: null,
      eventName: 'CLIENT_REFRESH_SUBSCRIPTION',
      cancelAtPeriodEnd:
        verified.cancelAtPeriodEnd ?? Boolean(subscription.cancelled_at),
    });
  }

  return { ok: false, reason: 'unsupported_source' as const };
}

type SyncInput = {
  platform: Platform;
  productId: string;
  transactionId: string;
  originalTransactionId?: string;
  expiresDate?: Date | null;
  userId?: string | null;
  subscriptionStatus: SubscriptionStatus;
  paymentStatus?: PaymentStatus | null;
  eventName: string;
  cancelAtPeriodEnd?: boolean;
};

export async function syncIapSubscription(input: SyncInput) {
  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const config = getIapProductConfig(input.productId);
  const originalTransactionId = input.originalTransactionId || input.transactionId;

  const { data: existingSubscription } = await admin
    .from('subscriptions')
    .select('id, user_id, status, current_period_start, current_period_end, app_transaction_id, app_original_transaction_id, cancelled_at')
    .or(`app_transaction_id.eq.${input.transactionId},app_original_transaction_id.eq.${originalTransactionId}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingSubscription && !input.userId) {
    return { ok: false, reason: 'subscription_not_found' as const };
  }

  const userId = existingSubscription?.user_id || input.userId!;
  const previousPeriodEnd = existingSubscription?.current_period_end
    ? new Date(existingSubscription.current_period_end)
    : new Date();
  const nextPeriodEnd = input.expiresDate || previousPeriodEnd;
  const currentPeriodStart =
    input.transactionId !== existingSubscription?.app_transaction_id && previousPeriodEnd < nextPeriodEnd
      ? previousPeriodEnd.toISOString()
      : existingSubscription?.current_period_start || nowIso;

  const updates = {
    plan: config.plan,
    status: input.subscriptionStatus,
    source: input.platform,
    currency: config.currency,
    amount: config.amount,
    current_period_start: currentPeriodStart,
    current_period_end: nextPeriodEnd.toISOString(),
    app_transaction_id: input.transactionId,
    app_original_transaction_id: originalTransactionId,
    cancelled_at: input.cancelAtPeriodEnd
      ? (existingSubscription?.cancelled_at || nowIso)
      : input.subscriptionStatus === 'ACTIVE'
        ? null
        : existingSubscription?.cancelled_at,
    updated_at: nowIso,
  };

  let subscriptionId = existingSubscription?.id;

  if (existingSubscription) {
    const { error } = await admin
      .from('subscriptions')
      .update(updates)
      .eq('id', existingSubscription.id);
    if (error) throw error;
  } else {
    const { data, error } = await admin
      .from('subscriptions')
      .insert({
        user_id: userId,
        ...updates,
      })
      .select('id')
      .single();
    if (error) throw error;
    subscriptionId = data.id;
  }

  if (input.paymentStatus) {
    const paymentId = `iap_${input.platform.toLowerCase()}_${input.transactionId}`;
    const paymentType: PaymentType =
      existingSubscription && input.transactionId !== existingSubscription.app_transaction_id
        ? 'RENEWAL'
        : 'SUBSCRIPTION';

    const { data: existingPayment } = await admin
      .from('payments')
      .select('id, status')
      .eq('portone_payment_id', paymentId)
      .maybeSingle();

    const paymentPayload = {
      user_id: userId,
      subscription_id: subscriptionId,
      type: paymentType,
      portone_payment_id: paymentId,
      status: input.paymentStatus,
      currency: config.currency,
      amount: config.amount,
      pg_provider: config.pgProvider[input.platform],
      pay_method: config.payMethod[input.platform],
      paid_at: input.paymentStatus === 'PAID' ? nowIso : null,
      failed_reason: input.paymentStatus === 'FAILED' ? input.eventName : null,
      metadata: {
        eventName: input.eventName,
        productId: input.productId,
        platform: input.platform,
      },
    };

    if (existingPayment) {
      const { error } = await admin
        .from('payments')
        .update(paymentPayload)
        .eq('id', existingPayment.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from('payments').insert(paymentPayload);
      if (error) throw error;
    }
  }

  return { ok: true, subscriptionId };
}

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { X509Certificate, createSign, verify as verifyCrypto } from 'crypto';

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

export class AppleJwsVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleJwsVerificationError';
  }
}

export interface VerifiedIapPurchase {
  platform: Platform;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  expiresDate: Date | null;
  cancelAtPeriodEnd?: boolean;
  paymentAmount?: number;
  paymentCurrency?: string;
  introductoryPaymentAmount?: number;
  introductoryPaymentCurrency?: string;
  introductoryPricePeriod?: string;
  introductoryPriceCycles?: number;
}

type AppleServerEnvironment = 'production' | 'sandbox';

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

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function normalizeApplePrivateKey(rawValue: string) {
  const normalized = rawValue.replace(/\\n/g, '\n').trim();

  if (normalized.includes('BEGIN PRIVATE KEY')) {
    return normalized;
  }

  return [
    '-----BEGIN PRIVATE KEY-----',
    normalized,
    '-----END PRIVATE KEY-----',
  ].join('\n');
}

export function createAppleServerApiJwt(nowSeconds = Math.floor(Date.now() / 1000)) {
  const existingToken = process.env.APPLE_IAP_JWT?.trim();
  const issuerId = (
    process.env.APPLE_IAP_ISSUER_ID ||
    process.env.APP_STORE_CONNECT_ISSUER_ID
  )?.trim();
  const keyId = (
    process.env.APPLE_IAP_KEY_ID ||
    process.env.APP_STORE_CONNECT_KEY_ID
  )?.trim();
  const privateKey = (
    process.env.APPLE_IAP_PRIVATE_KEY ||
    process.env.APP_STORE_CONNECT_PRIVATE_KEY
  )?.trim();
  const bundleId = (
    process.env.APPLE_BUNDLE_ID ||
    process.env.APP_STORE_CONNECT_BUNDLE_ID ||
    'com.devho.gijilai'
  ).trim();

  if (!issuerId || !keyId || !privateKey) {
    if (existingToken) return existingToken;
    throw new IapConfigurationError(
      'Apple IAP API key is not configured'
    );
  }

  const header = base64UrlJson({
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  });
  const payload = base64UrlJson({
    iss: issuerId,
    iat: nowSeconds,
    exp: nowSeconds + 50 * 60,
    aud: 'appstoreconnect-v1',
    bid: bundleId,
  });
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign('SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign({
    key: normalizeApplePrivateKey(privateKey),
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');

  return `${unsignedToken}.${signature}`;
}

type JwsHeader = {
  alg?: string;
  x5c?: string[];
};

function parseJwsJson<T>(segment: string, label: string): T {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
  } catch {
    throw new AppleJwsVerificationError(`Invalid Apple JWS ${label}`);
  }
}

function getAppleRootCertificates() {
  const rawValue = process.env.APPLE_APP_STORE_ROOT_CERT_PEM
    || process.env.APPLE_ROOT_CA_CERT_PEM;

  if (!rawValue?.trim()) {
    throw new IapConfigurationError(
      'APPLE_APP_STORE_ROOT_CERT_PEM is not configured'
    );
  }

  const normalized = rawValue.replace(/\\n/g, '\n').trim();
  const pemBlocks = normalized.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g
  );

  if (pemBlocks?.length) {
    return pemBlocks.map((pem) => new X509Certificate(pem));
  }

  try {
    return [new X509Certificate(Buffer.from(normalized, 'base64'))];
  } catch {
    throw new IapConfigurationError(
      'APPLE_APP_STORE_ROOT_CERT_PEM must be a PEM or base64 DER certificate'
    );
  }
}

function assertCertificateIsCurrentlyValid(cert: X509Certificate, now: Date) {
  const validFrom = new Date(cert.validFrom);
  const validTo = new Date(cert.validTo);

  if (now < validFrom || now > validTo) {
    throw new AppleJwsVerificationError('Apple JWS certificate is expired or not yet valid');
  }
}

function verifyAppleCertificateChain(certs: X509Certificate[]) {
  if (certs.length === 0) {
    throw new AppleJwsVerificationError('Apple JWS certificate chain is missing');
  }

  const now = new Date();
  certs.forEach((cert) => assertCertificateIsCurrentlyValid(cert, now));

  for (let index = 0; index < certs.length - 1; index++) {
    const cert = certs[index];
    const issuer = certs[index + 1];
    if (cert.issuer !== issuer.subject || !cert.verify(issuer.publicKey)) {
      throw new AppleJwsVerificationError('Apple JWS certificate chain is invalid');
    }
  }

  const trustedRoots = getAppleRootCertificates();
  const chainAnchor = certs[certs.length - 1];
  const trusted = trustedRoots.some((root) => {
    assertCertificateIsCurrentlyValid(root, now);
    if (chainAnchor.fingerprint256 === root.fingerprint256) {
      return true;
    }
    return chainAnchor.issuer === root.subject && chainAnchor.verify(root.publicKey);
  });

  if (!trusted) {
    throw new AppleJwsVerificationError('Apple JWS certificate chain is not trusted');
  }
}

function parseAppleX5cCertificates(x5c: string[]) {
  try {
    return x5c.map((cert) => new X509Certificate(Buffer.from(cert, 'base64')));
  } catch {
    throw new AppleJwsVerificationError('Apple JWS x5c certificate chain is invalid');
  }
}

export function verifyAppleSignedPayload<T = Record<string, unknown>>(token: string): T {
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new AppleJwsVerificationError('Invalid Apple JWS format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = parseJwsJson<JwsHeader>(encodedHeader, 'header');
  if (header.alg !== 'ES256') {
    throw new AppleJwsVerificationError('Unsupported Apple JWS algorithm');
  }

  if (!Array.isArray(header.x5c) || header.x5c.length === 0) {
    throw new AppleJwsVerificationError('Apple JWS x5c certificate chain is missing');
  }

  const certs = parseAppleX5cCertificates(header.x5c);
  verifyAppleCertificateChain(certs);

  const signature = Buffer.from(encodedSignature, 'base64url');
  if (signature.length !== 64) {
    throw new AppleJwsVerificationError('Apple JWS signature has invalid length');
  }

  const isSignatureValid = verifyCrypto(
    'sha256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    { key: certs[0].publicKey, dsaEncoding: 'ieee-p1363' },
    signature
  );

  if (!isSignatureValid) {
    throw new AppleJwsVerificationError('Apple JWS signature is invalid');
  }

  return parseJwsJson<T>(encodedPayload, 'payload');
}

function getAppleStoreKitBaseUrl(environment: AppleServerEnvironment) {
  return environment === 'production'
    ? 'https://api.storekit.itunes.apple.com'
    : 'https://api.storekit-sandbox.itunes.apple.com';
}

export function getAppleTransactionLookupEnvironments(
  configuredEnvironment = process.env.APPLE_IAP_ENVIRONMENT,
  nodeEnv = process.env.NODE_ENV
): AppleServerEnvironment[] {
  const normalized = configuredEnvironment?.trim().toLowerCase();

  if (normalized === 'production') return ['production'];
  if (normalized === 'sandbox') return ['sandbox'];

  return nodeEnv === 'production'
    ? ['production', 'sandbox']
    : ['sandbox', 'production'];
}

class AppleTransactionLookupError extends Error {
  constructor(
    readonly environment: AppleServerEnvironment,
    readonly status: number,
    readonly body: string
  ) {
    super(`Apple ${environment} verification failed (${status}): ${body}`);
    this.name = 'AppleTransactionLookupError';
  }
}

async function fetchAppleTransactionInfo(
  transactionId: string,
  environment: AppleServerEnvironment
) {
  const response = await fetch(
    `${getAppleStoreKitBaseUrl(environment)}/inApps/v1/transactions/${transactionId}`,
    {
      headers: {
        Authorization: `Bearer ${createAppleServerApiJwt()}`,
      },
    }
  );

  if (!response.ok) {
    throw new AppleTransactionLookupError(
      environment,
      response.status,
      await response.text()
    );
  }

  return await response.json() as { signedTransactionInfo?: string };
}

function shouldTryNextAppleEnvironment(error: unknown) {
  return error instanceof AppleTransactionLookupError && error.status === 404;
}

export async function verifyAppleTransaction(transactionId: string): Promise<VerifiedIapPurchase> {
  let data: { signedTransactionInfo?: string } | null = null;
  let lastError: unknown;
  const environments = getAppleTransactionLookupEnvironments();

  for (const environment of environments) {
    try {
      data = await fetchAppleTransactionInfo(transactionId, environment);
      break;
    } catch (error) {
      lastError = error;
      if (!shouldTryNextAppleEnvironment(error)) {
        break;
      }
    }
  }

  if (!data) {
    throw lastError instanceof Error ? lastError : new Error('Apple verification failed');
  }

  if (!data.signedTransactionInfo) {
    throw new Error('Apple verification response did not include signedTransactionInfo');
  }

  const payload = verifyAppleSignedPayload<{
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
    paymentAmount: parseGoogleMicrosAmount(data.priceAmountMicros),
    paymentCurrency: typeof data.priceCurrencyCode === 'string' ? data.priceCurrencyCode : undefined,
    introductoryPaymentAmount: parseGoogleMicrosAmount(
      data.introductoryPriceInfo?.introductoryPriceAmountMicros
    ),
    introductoryPaymentCurrency:
      typeof data.introductoryPriceInfo?.introductoryPriceCurrencyCode === 'string'
        ? data.introductoryPriceInfo.introductoryPriceCurrencyCode
        : undefined,
    introductoryPricePeriod:
      typeof data.introductoryPriceInfo?.introductoryPricePeriod === 'string'
        ? data.introductoryPriceInfo.introductoryPricePeriod
        : undefined,
    introductoryPriceCycles:
      typeof data.introductoryPriceInfo?.introductoryPriceCycles === 'number'
        ? data.introductoryPriceInfo.introductoryPriceCycles
        : undefined,
  };
}

function parseGoogleMicrosAmount(value: unknown): number | undefined {
  const micros = typeof value === 'string'
    ? Number(value)
    : typeof value === 'number'
      ? value
      : undefined;

  if (micros === undefined || !Number.isFinite(micros)) return undefined;
  return Math.round(micros / 1_000_000);
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
      paymentAmount: verified.paymentAmount,
      paymentCurrency: verified.paymentCurrency,
      introductoryPaymentAmount: verified.introductoryPaymentAmount,
      introductoryPaymentCurrency: verified.introductoryPaymentCurrency,
      introductoryPricePeriod: verified.introductoryPricePeriod,
      introductoryPriceCycles: verified.introductoryPriceCycles,
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
  paymentAmount?: number;
  paymentCurrency?: string;
  introductoryPaymentAmount?: number;
  introductoryPaymentCurrency?: string;
  introductoryPricePeriod?: string;
  introductoryPriceCycles?: number;
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
    const paymentAmount =
      paymentType === 'SUBSCRIPTION' && input.introductoryPaymentAmount !== undefined
        ? input.introductoryPaymentAmount
        : input.paymentAmount ?? config.amount;
    const paymentCurrency =
      paymentType === 'SUBSCRIPTION' && input.introductoryPaymentCurrency
        ? input.introductoryPaymentCurrency
        : input.paymentCurrency ?? config.currency;

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
      currency: paymentCurrency,
      amount: paymentAmount,
      pg_provider: config.pgProvider[input.platform],
      pay_method: config.payMethod[input.platform],
      paid_at: input.paymentStatus === 'PAID' ? nowIso : null,
      failed_reason: input.paymentStatus === 'FAILED' ? input.eventName : null,
      metadata: {
        eventName: input.eventName,
        productId: input.productId,
        platform: input.platform,
        storePaymentAmount: input.paymentAmount ?? null,
        storePaymentCurrency: input.paymentCurrency ?? null,
        introductoryPaymentAmount: input.introductoryPaymentAmount ?? null,
        introductoryPaymentCurrency: input.introductoryPaymentCurrency ?? null,
        introductoryPricePeriod: input.introductoryPricePeriod ?? null,
        introductoryPriceCycles: input.introductoryPriceCycles ?? null,
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

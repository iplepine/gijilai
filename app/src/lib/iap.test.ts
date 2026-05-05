import { generateKeyPairSync } from 'crypto';
import {
    AppleJwsVerificationError,
    createAppleServerApiJwt,
    getAppleTransactionLookupEnvironments,
    verifyAppleSignedPayload,
} from './iap';

function base64UrlJson(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('verifyAppleSignedPayload', () => {
    it('rejects malformed Apple JWS payloads before decoding notification data', () => {
        expect(() => verifyAppleSignedPayload('not-a-jws')).toThrow(AppleJwsVerificationError);
    });

    it('rejects unsupported JWS algorithms', () => {
        const token = [
            base64UrlJson({ alg: 'none' }),
            base64UrlJson({ notificationType: 'REFUND' }),
            '',
        ].join('.');

        expect(() => verifyAppleSignedPayload(token)).toThrow(AppleJwsVerificationError);
    });
});

describe('createAppleServerApiJwt', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.APPLE_IAP_JWT;
        delete process.env.APPLE_IAP_ISSUER_ID;
        delete process.env.APPLE_IAP_KEY_ID;
        delete process.env.APPLE_IAP_PRIVATE_KEY;
        delete process.env.APPLE_BUNDLE_ID;
        delete process.env.APP_STORE_CONNECT_ISSUER_ID;
        delete process.env.APP_STORE_CONNECT_KEY_ID;
        delete process.env.APP_STORE_CONNECT_PRIVATE_KEY;
        delete process.env.APP_STORE_CONNECT_BUNDLE_ID;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('uses a precomputed token when API key material is not configured', () => {
        process.env.APPLE_IAP_JWT = 'static.jwt.token';

        expect(createAppleServerApiJwt()).toBe('static.jwt.token');
    });

    it('generates an App Store Server API JWT from key material', () => {
        const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
        process.env.APPLE_IAP_ISSUER_ID = 'issuer-id';
        process.env.APPLE_IAP_KEY_ID = 'KEY1234567';
        process.env.APPLE_IAP_PRIVATE_KEY = privateKey.export({
            format: 'pem',
            type: 'pkcs8',
        }).toString();
        process.env.APPLE_BUNDLE_ID = 'com.devho.gijilai';

        const token = createAppleServerApiJwt(1000);
        const [header, payload, signature] = token.split('.');

        expect(JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))).toEqual({
            alg: 'ES256',
            kid: 'KEY1234567',
            typ: 'JWT',
        });
        expect(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))).toEqual({
            iss: 'issuer-id',
            iat: 1000,
            exp: 4000,
            aud: 'appstoreconnect-v1',
            bid: 'com.devho.gijilai',
        });
        expect(signature).toBeTruthy();
    });
});

describe('getAppleTransactionLookupEnvironments', () => {
    it('falls back from production to sandbox for review purchases', () => {
        expect(getAppleTransactionLookupEnvironments(undefined, 'production')).toEqual([
            'production',
            'sandbox',
        ]);
    });

    it('allows forcing sandbox verification', () => {
        expect(getAppleTransactionLookupEnvironments('sandbox', 'production')).toEqual([
            'sandbox',
        ]);
    });
});

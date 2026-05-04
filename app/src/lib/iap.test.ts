import { AppleJwsVerificationError, verifyAppleSignedPayload } from './iap';

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

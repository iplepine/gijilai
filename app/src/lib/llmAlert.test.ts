import { createQuotaAlertingFetch, isInsufficientQuotaBody, OPENAI_QUOTA_ALERT_MESSAGE, sendOpsAlert } from './llmAlert';

const quotaBody = { error: { message: 'You have no credits remaining.', type: 'insufficient_quota', code: 'insufficient_quota' } };

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('isInsufficientQuotaBody', () => {
    it('detects the OpenAI insufficient_quota error shape', () => {
        expect(isInsufficientQuotaBody(quotaBody)).toBe(true);
        expect(isInsufficientQuotaBody({ error: { code: 'rate_limit_exceeded' } })).toBe(false);
        expect(isInsufficientQuotaBody(null)).toBe(false);
    });
});

describe('createQuotaAlertingFetch', () => {
    it('alerts once per cooldown on insufficient_quota and keeps the response readable', async () => {
        let time = 0;
        const alert = jest.fn().mockResolvedValue(undefined);
        const alertingFetch = createQuotaAlertingFetch(async () => jsonResponse(429, quotaBody), () => time, alert);

        const first = await alertingFetch('https://api.openai.com/v1/chat/completions');
        expect(first.status).toBe(429);
        await expect(first.json()).resolves.toEqual(quotaBody);

        time += 10 * 60 * 1000;
        await alertingFetch('https://api.openai.com/v1/chat/completions');
        expect(alert).toHaveBeenCalledTimes(1);
        expect(alert).toHaveBeenCalledWith(OPENAI_QUOTA_ALERT_MESSAGE);

        time += 30 * 60 * 1000;
        await alertingFetch('https://api.openai.com/v1/chat/completions');
        expect(alert).toHaveBeenCalledTimes(2);
    });

    it('does not alert on ordinary rate limits, non-JSON bodies, or success', async () => {
        const alert = jest.fn().mockResolvedValue(undefined);
        const responses = [
            jsonResponse(429, { error: { code: 'rate_limit_exceeded' } }),
            new Response('busy', { status: 429 }),
            jsonResponse(200, { ok: true }),
        ];
        const alertingFetch = createQuotaAlertingFetch(async () => responses.shift()!, Date.now, alert);

        for (let i = 0; i < 3; i += 1) await alertingFetch('https://api.openai.com/v1/chat/completions');
        expect(alert).not.toHaveBeenCalled();
    });
});

describe('sendOpsAlert', () => {
    const originalUrl = process.env.OPS_ALERT_WEBHOOK_URL;
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
        if (originalUrl === undefined) delete process.env.OPS_ALERT_WEBHOOK_URL;
        else process.env.OPS_ALERT_WEBHOOK_URL = originalUrl;
    });

    it('only logs when no webhook is configured', async () => {
        delete process.env.OPS_ALERT_WEBHOOK_URL;
        const fetchImpl = jest.fn();
        await sendOpsAlert('hello', fetchImpl);
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith('[OPS ALERT] hello');
    });

    it('posts a Slack-compatible payload and swallows delivery failures', async () => {
        process.env.OPS_ALERT_WEBHOOK_URL = 'https://hooks.example.com/alert';
        const fetchImpl = jest.fn().mockRejectedValue(new Error('network down'));
        await expect(sendOpsAlert('hello', fetchImpl)).resolves.toBeUndefined();
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://hooks.example.com/alert',
            expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'hello' }) }),
        );
    });
});

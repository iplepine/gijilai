import {
  CONSULT_LLM_TIMEOUT_MS,
  createConsultRequestController,
  isAbortError,
} from './consultRequest';

// consultRequest 는 클라이언트 전용 모듈이라 window 타이머를 쓴다(코드베이스 관례).
// 테스트 환경은 node 라 최소한의 shim 을 둔다 — 타이머 본체는 jest 가 가짜로 바꾼다.
beforeAll(() => {
  (globalThis as unknown as { window: unknown }).window = globalThis;
});

function abortError() {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}

/** signal 이 abort 되기 전까지 영원히 응답하지 않는 fetch — 통신이 멎은 상황. */
function hangingFetch() {
  return jest.fn((_input: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(abortError()));
    }),
  );
}

describe('isAbortError', () => {
  it('Error 와 DOMException 형태 모두 취소로 인식한다', () => {
    expect(isAbortError(abortError())).toBe(true);
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
  });

  it('일반 오류는 취소로 보지 않는다', () => {
    expect(isAbortError(new Error('network down'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});

describe('createConsultRequestController', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('사용자가 취소하면 AbortError 로 끝나고 사유가 user 로 남는다', async () => {
    globalThis.fetch = hangingFetch() as unknown as typeof fetch;
    const controller = createConsultRequestController();

    const pending = controller.run('/api/consult/prescription', { method: 'POST' });
    controller.cancel();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(controller.reasonRef.current).toBe('user');
  });

  it('타임아웃이 지나면 스스로 끊고 사유가 timeout 으로 남는다', async () => {
    jest.useFakeTimers();
    globalThis.fetch = hangingFetch() as unknown as typeof fetch;
    const controller = createConsultRequestController();

    const pending = controller.run('/api/consult/prescription', { method: 'POST' });
    jest.advanceTimersByTime(CONSULT_LLM_TIMEOUT_MS);

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(controller.reasonRef.current).toBe('timeout');
  });

  it('타임아웃 직전까지는 끊지 않는다 — 정상 응답을 죽이면 안 된다', async () => {
    jest.useFakeTimers();
    globalThis.fetch = hangingFetch() as unknown as typeof fetch;
    const controller = createConsultRequestController();

    const pending = controller.run('/api/consult/prescription', { method: 'POST' });
    const settled = jest.fn();
    void pending.then(settled, settled);

    jest.advanceTimersByTime(CONSULT_LLM_TIMEOUT_MS - 1);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();

    // 뒷정리: 실제로 끊어 프라미스를 매달아두지 않는다.
    controller.cancel();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('응답이 오면 타이머를 정리해 나중에 취소되지 않는다', async () => {
    jest.useFakeTimers();
    const ok = { ok: true } as Response;
    globalThis.fetch = jest.fn(async () => ok) as unknown as typeof fetch;
    const controller = createConsultRequestController();

    await expect(controller.run('/api/consult/questions/initial', { method: 'POST' })).resolves.toBe(ok);

    // 타임아웃 시점을 지나도 사유가 생기지 않아야 한다(타이머가 정리됐다는 뜻).
    jest.advanceTimersByTime(CONSULT_LLM_TIMEOUT_MS * 2);
    expect(controller.reasonRef.current).toBeNull();
  });

  it('진행 중인 요청이 없으면 cancel 은 아무 일도 하지 않는다', () => {
    const controller = createConsultRequestController();
    expect(() => controller.cancel()).not.toThrow();
    expect(controller.reasonRef.current).toBeNull();
  });
});

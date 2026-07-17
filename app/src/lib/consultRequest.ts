'use client';

/**
 * 상담 LLM 호출의 클라이언트 타임아웃.
 *
 * 실천 피드백(practice-feedback)이 쓰는 15초와 일부러 다르게 잡는다 — 그건 사용자가
 * 기다리지 않는 배경 보강 호출이라 짧게 끊어도 되지만, 상담 문진/처방 생성은 사용자가
 * 화면을 보며 직접 기다리는 생성 호출이라 15초로 끊으면 정상 응답을 죽인다.
 * 서버측 OpenAI 클라이언트 타임아웃(lib/openai.ts, 120초)보다는 짧게 둬서,
 * 서버가 끝까지 붙들고 있어도 사용자가 무한정 스피너를 보지 않게 한다.
 */
export const CONSULT_LLM_TIMEOUT_MS = 60_000;

/** 중단 사유 — 사용자가 취소한 것과 타임아웃을 구분해야 안내가 달라진다. */
export type ConsultAbortReason = 'user' | 'timeout';

/**
 * fetch 취소는 브라우저에선 DOMException('AbortError'), 런타임에 따라 Error 로도 온다.
 * instanceof 대신 name 으로 판별해 둘 다 잡는다.
 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

export interface ConsultRequestController {
  /** 취소 가능한 fetch. 진행 중인 요청은 하나만 유지한다. */
  run: (input: string, init: RequestInit) => Promise<Response>;
  /** 사용자가 누른 취소. */
  cancel: () => void;
  /** 마지막 중단이 사용자 취소인지 타임아웃인지. */
  reasonRef: { current: ConsultAbortReason | null };
}

/**
 * AbortController + 타임아웃을 묶어 관리한다.
 * 훅이 아니라 순수 팩토리라, 각 페이지에서 useRef 로 한 번만 만들어 쓰면 된다.
 */
export function createConsultRequestController(): ConsultRequestController {
  const activeRef: { current: AbortController | null } = { current: null };
  const reasonRef: { current: ConsultAbortReason | null } = { current: null };

  const run = async (input: string, init: RequestInit) => {
    const controller = new AbortController();
    activeRef.current = controller;
    reasonRef.current = null;

    const timeoutId = window.setTimeout(() => {
      reasonRef.current = 'timeout';
      controller.abort();
    }, CONSULT_LLM_TIMEOUT_MS);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
      if (activeRef.current === controller) activeRef.current = null;
    }
  };

  const cancel = () => {
    if (!activeRef.current) return;
    reasonRef.current = 'user';
    activeRef.current.abort();
  };

  return { run, cancel, reasonRef };
}

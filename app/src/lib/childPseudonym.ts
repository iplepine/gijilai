/**
 * 아이 실명을 외부 LLM(OpenAI)에 전송하지 않기 위한 가명화 유틸리티.
 *
 * - 프롬프트에는 아이 이름 대신 '○○이' 플레이스홀더를 보낸다.
 * - LLM 응답에서 '○○(이)' + 조사를 실제 이름과 올바른 조사로 복원한다.
 * - '○○'는 자연어 텍스트에 등장하지 않는 문자라 복원 치환이 안전하다
 *   (복원이 누락돼도 사용자에게는 관용적 익명 표기 '○○이'로 보인다).
 *
 * 조사 복원은 koreanUtils의 받침 판별/이름 어간 규칙을 재사용한다.
 * 예) ○○이는 → 재윤이는 / 서아는, ○○야 → 재윤아·서아야
 */
import {
  aYa,
  childNameObject,
  childNamePossessive,
  childNameStem,
  childNameSubject,
  childNameTopic,
  childNameWith,
} from '@/lib/koreanUtils';

const PSEUDONYM_BASE = '○○';

/** 프롬프트의 이름 필드에 넣는 가명. 모델이 "○○이는 ..." 형태로 지칭하게 된다. */
export const CHILD_NAME_PSEUDONYM = `${PSEUDONYM_BASE}이`;

function deepMapStrings<T>(value: T, transform: (text: string) => string): T {
  if (typeof value === 'string') {
    return transform(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepMapStrings(item, transform)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepMapStrings(item, transform)])
    ) as T;
  }

  return value;
}

/**
 * 입력 방향: 자유 텍스트(고민, 답변, 관찰 기록 등)에 들어 있는 아이 이름을 가명으로 치환.
 * 어간형(재윤이)을 먼저, 그다음 원형(재윤)을 치환한다.
 */
export function maskChildNameText(text: string, childName: string | null | undefined): string {
  const name = childName?.trim();
  if (!name || !text || !text.includes(name)) return text;

  const stem = childNameStem(name);
  let masked = text;
  if (stem !== name) {
    masked = masked.split(stem).join(CHILD_NAME_PSEUDONYM);
  }
  masked = masked.split(name).join(CHILD_NAME_PSEUDONYM);
  // 이름이 '이'로 끝나는 경우 등의 이중 '이' 정리
  return masked.split(`${CHILD_NAME_PSEUDONYM}이`).join(CHILD_NAME_PSEUDONYM);
}

/**
 * 출력 방향: LLM 응답 속 '○○(이)' + 조사를 실제 이름과 올바른 조사로 복원.
 * 긴 패턴 → 짧은 패턴 순서로 치환해야 한다.
 */
export function unmaskChildNameText(text: string, childName: string | null | undefined): string {
  const name = childName?.trim();
  if (!name || !text || !text.includes(PSEUDONYM_BASE)) return text;

  const stem = childNameStem(name);
  const replacements: Array<[string, string]> = [
    [`${PSEUDONYM_BASE}이는`, childNameTopic(name)],
    [`${PSEUDONYM_BASE}이가`, childNameSubject(name)],
    [`${PSEUDONYM_BASE}이를`, childNameObject(name)],
    [`${PSEUDONYM_BASE}이와`, childNameWith(name)],
    [`${PSEUDONYM_BASE}이과`, childNameWith(name)],
    [`${PSEUDONYM_BASE}이의`, childNamePossessive(name)],
    [`${PSEUDONYM_BASE}이도`, `${stem}도`],
    [`${PSEUDONYM_BASE}이랑`, `${stem}랑`],
    [`${PSEUDONYM_BASE}이야`, aYa(stem)],
    [`${PSEUDONYM_BASE}이아`, aYa(stem)],
    [`${PSEUDONYM_BASE}이`, stem],
    [`${PSEUDONYM_BASE}은`, childNameTopic(name)],
    [`${PSEUDONYM_BASE}는`, childNameTopic(name)],
    [`${PSEUDONYM_BASE}가`, childNameSubject(name)],
    [`${PSEUDONYM_BASE}을`, childNameObject(name)],
    [`${PSEUDONYM_BASE}를`, childNameObject(name)],
    [`${PSEUDONYM_BASE}와`, childNameWith(name)],
    [`${PSEUDONYM_BASE}과`, childNameWith(name)],
    [`${PSEUDONYM_BASE}의`, childNamePossessive(name)],
    [`${PSEUDONYM_BASE}야`, aYa(stem)],
    [`${PSEUDONYM_BASE}아`, aYa(stem)],
    [PSEUDONYM_BASE, stem],
  ];

  let restored = text;
  for (const [from, to] of replacements) {
    if (restored.includes(from)) {
      restored = restored.split(from).join(to);
    }
  }
  return restored;
}

/** 객체/배열을 깊이 순회하며 모든 문자열에 maskChildNameText 적용 */
export function maskChildNameDeep<T>(value: T, childName: string | null | undefined): T {
  const name = childName?.trim();
  if (!name) return value;
  return deepMapStrings(value, (text) => maskChildNameText(text, name));
}

/** 객체/배열을 깊이 순회하며 모든 문자열에 unmaskChildNameText 적용 */
export function unmaskChildNameDeep<T>(value: T, childName: string | null | undefined): T {
  const name = childName?.trim();
  if (!name) return value;
  return deepMapStrings(value, (text) => unmaskChildNameText(text, name));
}

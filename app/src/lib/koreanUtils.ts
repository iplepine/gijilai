/**
 * 한국어 조사 처리 유틸리티
 * 받침 유무에 따라 올바른 조사를 반환한다.
 */

function hasBatchim(str: string): boolean {
  const lastChar = str.charCodeAt(str.length - 1);
  // 한글 유니코드 범위: 0xAC00 ~ 0xD7A3
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) return false;
  return (lastChar - 0xAC00) % 28 !== 0;
}

/** 은/는 */
export function eunNeun(name: string): string {
  return name + (hasBatchim(name) ? '은' : '는');
}

/** 이/가 */
export function iGa(name: string): string {
  return name + (hasBatchim(name) ? '이' : '가');
}

/** 을/를 */
export function eulReul(name: string): string {
  return name + (hasBatchim(name) ? '을' : '를');
}

/** 과/와 */
export function gwaWa(name: string): string {
  return name + (hasBatchim(name) ? '과' : '와');
}

/** 으로/로 */
export function euroRo(name: string): string {
  return name + (hasBatchim(name) ? '으로' : '로');
}

/** 아/야 (호칭) */
export function aYa(name: string): string {
  return name + (hasBatchim(name) ? '아' : '야');
}

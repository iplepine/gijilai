/**
 * 한국어 조사 처리 유틸리티
 * 받침 유무에 따라 올바른 조사를 반환한다.
 */

export function hasBatchim(str: string): boolean {
  const normalized = str.trim();
  const lastChar = normalized.charCodeAt(normalized.length - 1);
  // 한글 유니코드 범위: 0xAC00 ~ 0xD7A3
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) return false;
  return (lastChar - 0xAC00) % 28 !== 0;
}

function hasRieulBatchim(str: string): boolean {
  const normalized = str.trim();
  const lastChar = normalized.charCodeAt(normalized.length - 1);
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) return false;
  return (lastChar - 0xAC00) % 28 === 8;
}

function isLikelyFullKoreanName(name: string): boolean {
  const compact = name.trim().replace(/\s+/g, '');
  return /^[가-힣]{3,}$/.test(compact);
}

function shouldUseFriendlyChildNameStem(name: string): boolean {
  const normalized = name.trim();
  return !!normalized && hasBatchim(normalized) && !isLikelyFullKoreanName(normalized);
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
  return name + (hasBatchim(name) && !hasRieulBatchim(name) ? '으로' : '로');
}

/** 아/야 (호칭) */
export function aYa(name: string): string {
  return name + (hasBatchim(name) ? '아' : '야');
}

/** 아이 이름을 문장 안에서 자연스럽게 부르는 형태: 재윤이, 서아 */
export function childNameStem(name: string): string {
  const normalized = name.trim();
  if (!normalized) return normalized;
  return shouldUseFriendlyChildNameStem(normalized) ? `${normalized}이` : normalized;
}

/** 아이 이름 + 은/는. 재윤이는, 서아는 */
export function childNameTopic(name: string): string {
  const stem = childNameStem(name);
  if (!stem) return stem;
  return shouldUseFriendlyChildNameStem(name) ? `${stem}는` : eunNeun(stem);
}

/** 아이 이름 + 이/가. 재윤이가, 서아가 */
export function childNameSubject(name: string): string {
  const stem = childNameStem(name);
  if (!stem) return stem;
  return shouldUseFriendlyChildNameStem(name) ? `${stem}가` : iGa(stem);
}

/** 아이 이름 + 을/를. 재윤이를, 서아를 */
export function childNameObject(name: string): string {
  const stem = childNameStem(name);
  if (!stem) return stem;
  return shouldUseFriendlyChildNameStem(name) ? `${stem}를` : eulReul(stem);
}

/** 아이 이름 + 와/과. 재윤이와, 서아와 */
export function childNameWith(name: string): string {
  const stem = childNameStem(name);
  if (!stem) return stem;
  return shouldUseFriendlyChildNameStem(name) ? `${stem}와` : gwaWa(stem);
}

/** 아이 이름 + 의. 재윤이의, 서아의 */
export function childNamePossessive(name: string): string {
  const stem = childNameStem(name);
  return stem ? `${stem}의` : stem;
}

function replaceAllLiteral(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement);
}

export function normalizeChildNameParticles(text: string, childName: string): string {
  const name = childName.trim();
  if (!name || !text.includes(name)) return text;

  let normalized = text;
  normalized = replaceAllLiteral(normalized, `${name}이는`, childNameTopic(name));
  normalized = replaceAllLiteral(normalized, `${name}이가`, childNameSubject(name));
  normalized = replaceAllLiteral(normalized, `${name}이를`, childNameObject(name));
  normalized = replaceAllLiteral(normalized, `${name}이와`, childNameWith(name));
  normalized = replaceAllLiteral(normalized, `${name}이의`, childNamePossessive(name));
  normalized = replaceAllLiteral(normalized, `${name}이도`, `${childNameStem(name)}도`);
  normalized = replaceAllLiteral(normalized, `${name}은`, childNameTopic(name));
  normalized = replaceAllLiteral(normalized, `${name}는`, childNameTopic(name));
  normalized = replaceAllLiteral(normalized, `${name}가`, childNameSubject(name));
  normalized = replaceAllLiteral(normalized, `${name}을`, childNameObject(name));
  normalized = replaceAllLiteral(normalized, `${name}를`, childNameObject(name));
  normalized = replaceAllLiteral(normalized, `${name}과`, childNameWith(name));
  normalized = replaceAllLiteral(normalized, `${name}와`, childNameWith(name));
  return normalized;
}

export function normalizeChildNameParticlesInValue<T>(value: T, childName: string): T {
  if (typeof value === 'string') {
    return normalizeChildNameParticles(value, childName) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeChildNameParticlesInValue(item, childName)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeChildNameParticlesInValue(item, childName)])
    ) as T;
  }

  return value;
}

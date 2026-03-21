/**
 * 날짜 관련 유틸리티 함수
 */

/**
 * 두 날짜 사이의 일수 차이를 계산합니다.
 */
export function getDaysDifference(date1: Date | string, date2: Date | string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 두 날짜 사이의 시간 차이를 계산합니다.
 */
export function getHoursDifference(date1: Date | string, date2: Date | string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60));
}

/**
 * 재검사 쿨다운 상태를 확인합니다.
 * @returns { isAvailable: boolean, remainingDays?: number, remainingHours?: number }
 */
export function checkCooldown(lastCheckedAt: string | null, isPaid: boolean) {
  if (!lastCheckedAt) return { isAvailable: true };

  const now = new Date();
  const lastDate = new Date(lastCheckedAt);
  
  if (isPaid) {
    // 유료 사용자는 24시간 제한
    const hoursDiff = getHoursDifference(lastDate, now);
    const isAvailable = hoursDiff >= 24;
    return {
      isAvailable,
      remainingHours: isAvailable ? 0 : 24 - hoursDiff
    };
  } else {
    // 무료 사용자는 7일 제한
    const daysDiff = getDaysDifference(lastDate, now);
    const isAvailable = daysDiff >= 7;
    return {
      isAvailable,
      remainingDays: isAvailable ? 0 : 7 - daysDiff
    };
  }
}

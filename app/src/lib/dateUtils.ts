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

const HOURS_PER_DAY = 24;
export const FREE_RETAKE_COOLDOWN_HOURS = 7 * HOURS_PER_DAY;
export const SUBSCRIBER_RETAKE_COOLDOWN_HOURS = HOURS_PER_DAY;

export type CooldownStatus = {
  isAvailable: boolean;
  cooldownHours: number;
  remainingHours: number;
  remainingDays: number;
  nextAvailableAt: string | null;
};

/**
 * 재검사 쿨다운 상태를 확인합니다.
 * 무료 사용자는 7일, 구독 사용자는 24시간마다 다시 검사할 수 있습니다.
 */
export function checkCooldown(
  lastCheckedAt: string | null,
  options: { hasSubscription?: boolean; now?: Date | string } = {},
): CooldownStatus {
  const cooldownHours = options.hasSubscription
    ? SUBSCRIBER_RETAKE_COOLDOWN_HOURS
    : FREE_RETAKE_COOLDOWN_HOURS;

  if (!lastCheckedAt) {
    return {
      isAvailable: true,
      cooldownHours,
      remainingHours: 0,
      remainingDays: 0,
      nextAvailableAt: null,
    };
  }

  const now = options.now ? new Date(options.now) : new Date();
  const lastDate = new Date(lastCheckedAt);
  const nextAvailableAt = new Date(lastDate.getTime() + cooldownHours * 60 * 60 * 1000);
  const remainingMs = nextAvailableAt.getTime() - now.getTime();
  const isAvailable = remainingMs <= 0;
  const remainingHours = isAvailable ? 0 : Math.ceil(remainingMs / (1000 * 60 * 60));

  return {
    isAvailable,
    cooldownHours,
    remainingHours,
    remainingDays: remainingHours > 0 ? Math.ceil(remainingHours / HOURS_PER_DAY) : 0,
    nextAvailableAt: nextAvailableAt.toISOString(),
  };
}

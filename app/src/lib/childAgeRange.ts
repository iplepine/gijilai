/**
 * 아이 기질 검사(CBQ-VSF)의 기준 연령은 만 3~7세다.
 * 범위 밖이어도 등록과 검사는 막지 않고, 결과를 참고용으로 보라고 안내만 한다.
 */
export const ASSESSMENT_MIN_AGE_MONTHS = 36;
export const ASSESSMENT_MAX_AGE_MONTHS = 95; // 만 7세 11개월

export type AssessmentAgeStatus = 'in_range' | 'too_young' | 'too_old';

export function getAgeInMonths(birthDate: string, today: Date = new Date()): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);

    let months = (today.getFullYear() - year) * 12 + (today.getMonth() + 1 - month);
    if (today.getDate() < day) months -= 1;
    return months;
}

export function getAssessmentAgeStatus(birthDate: string, today: Date = new Date()): AssessmentAgeStatus | null {
    const months = getAgeInMonths(birthDate, today);
    if (months === null) return null;
    if (months < ASSESSMENT_MIN_AGE_MONTHS) return 'too_young';
    if (months > ASSESSMENT_MAX_AGE_MONTHS) return 'too_old';
    return 'in_range';
}

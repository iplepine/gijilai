import { getAgeInMonths, getAssessmentAgeStatus } from './childAgeRange';

const today = new Date(2026, 9, 18); // 2026-10-18

describe('getAgeInMonths', () => {
    it('counts completed months and ignores time-zone shifts of date strings', () => {
        expect(getAgeInMonths('2023-10-18', today)).toBe(36);
        expect(getAgeInMonths('2023-10-19', today)).toBe(35);
        expect(getAgeInMonths('not-a-date', today)).toBeNull();
    });
});

describe('getAssessmentAgeStatus', () => {
    it('treats ages 3 through 7 (36–95 months) as in range', () => {
        expect(getAssessmentAgeStatus('2023-10-18', today)).toBe('in_range');
        expect(getAssessmentAgeStatus('2018-10-19', today)).toBe('in_range');
    });

    it('flags children younger than 3 or 8 and older', () => {
        expect(getAssessmentAgeStatus('2024-01-01', today)).toBe('too_young');
        expect(getAssessmentAgeStatus('2018-10-18', today)).toBe('too_old');
        expect(getAssessmentAgeStatus('1974-03-01', today)).toBe('too_old');
    });

    it('returns null when the birth date is missing', () => {
        expect(getAssessmentAgeStatus('', today)).toBeNull();
    });
});

import { hasLockedHarmonyContent, isUuid, stripLockedHarmonyFields } from './harmonyUnlock';

describe('harmonyUnlock', () => {
    const report = {
        harmonyTitle: '신중한 길잡이와 탐험가',
        compatibilityScore: 61,
        coreGap: { insight: '차이' },
        parentingPrinciples: [{ title: '속도 기다리기' }],
        situationalTips: [{ situation: '높은 놀이기구' }],
        parentingAudit: { currentStyle: '보호형' },
        dailyReminder: '천천히 해도 괜찮아',
    };

    it('keeps the free summary and removes the paid sections', () => {
        const stripped = stripLockedHarmonyFields(report);
        expect(stripped).toEqual({
            harmonyTitle: '신중한 길잡이와 탐험가',
            compatibilityScore: 61,
            coreGap: { insight: '차이' },
        });
        expect(report.parentingPrinciples).toHaveLength(1);
    });

    it('detects whether a report has paid sections', () => {
        expect(hasLockedHarmonyContent(report)).toBe(true);
        expect(hasLockedHarmonyContent(stripLockedHarmonyFields(report))).toBe(false);
        expect(hasLockedHarmonyContent(null)).toBe(false);
    });

    it('validates child ids', () => {
        expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
        expect(isUuid('not-a-child')).toBe(false);
        expect(isUuid(undefined)).toBe(false);
    });
});

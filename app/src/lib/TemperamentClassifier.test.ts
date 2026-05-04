import { TemperamentClassifier } from './TemperamentClassifier';

describe('TemperamentClassifier', () => {
    it('classifies parents by the NS-HA policy axis', () => {
        const result = TemperamentClassifier.analyzeParent({
            NS: 70,
            HA: 40,
            RD: 50,
            P: 50,
        });

        expect(result.label).toBe('에너지가 샘솟는 열정적인 마음');
    });

    it('applies RD and P corrections to parent classification', () => {
        const result = TemperamentClassifier.analyzeParent({
            NS: 40,
            HA: 70,
            RD: 70,
            P: 70,
        });

        expect(result.label).toContain('평온을 지키는 섬세한 마음');
        expect(result.label).toContain('공감형');
        expect(result.label).toContain('지속형');
        expect(result.keywords).toEqual(expect.arrayContaining(['공감형', '지속형']));
    });
});

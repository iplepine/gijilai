import { TemperamentClassifier } from './TemperamentClassifier';

describe('TemperamentClassifier', () => {
    it.each([
        [{ NS: 70, HA: 40, RD: 40, P: 50 }, '주도적인 지휘관', ['목표지향', '독립양육', '추진력']],
        [{ NS: 70, HA: 40, RD: 70, P: 50 }, '활기찬 페이스메이커', ['소통', '에너지', '놀이중심']],
        [{ NS: 70, HA: 70, RD: 40, P: 50 }, '철저한 전략가', ['계획성', '분석력', '성취지향']],
        [{ NS: 70, HA: 70, RD: 70, P: 50 }, '섬세한 공감자', ['공감력', '정서교감', '민감함']],
        [{ NS: 40, HA: 70, RD: 40, P: 50 }, '신중한 관찰자', ['관망', '안전중시', '인내심']],
        [{ NS: 40, HA: 70, RD: 70, P: 50 }, '헌신적인 수호자', ['보호본능', '헌신', '안정감']],
        [{ NS: 40, HA: 40, RD: 40, P: 70 }, '여유로운 조력자', ['평온함', '여유', '큰그림']],
        [{ NS: 40, HA: 40, RD: 70, P: 70 }, '한결같은 동반자', ['성실함', '우직함', '동행']],
    ])('classifies parents by the NS-HA-RD policy axis', (scores, label, keywords) => {
        const result = TemperamentClassifier.analyzeParent(scores);

        expect(result.label).toBe(label);
        expect(result.keywords).toEqual(keywords);
    });
});

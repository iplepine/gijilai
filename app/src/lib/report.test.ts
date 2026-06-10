import {
  asChildAiReport,
  buildParentReportStreamModules,
  normalizeTemperamentDimensions,
  type ParentAiReport,
} from './report';
import type { Json } from '@/types/supabase';

describe('report normalization', () => {
  it('normalizes Korean temperament dimension keys to report score keys', () => {
    expect(normalizeTemperamentDimensions({
      '자극 추구': '새로운 것에 끌리는 정도입니다.',
      '위험 회피': '조심하고 경계하는 정도입니다.',
      '사회적 민감성': '타인 반응에 민감한 정도입니다.',
      '인내력': '꾸준히 해내는 정도입니다.',
    })).toEqual({
      NS: '새로운 것에 끌리는 정도입니다.',
      HA: '조심하고 경계하는 정도입니다.',
      RD: '타인 반응에 민감한 정도입니다.',
      P: '꾸준히 해내는 정도입니다.',
    });
  });

  it('normalizes cached child reports before rendering', () => {
    const report = asChildAiReport({
      intro: '아이의 기질 설명',
      analysis: {
        dimensions: {
          '자극 추구': '새로운 것에 끌리는 정도입니다.',
        },
      },
    } as Json);

    expect(report?.analysis?.dimensions?.NS).toBe('새로운 것에 끌리는 정도입니다.');
  });

  it('breaks a parent report into display modules in render order', () => {
    const modules = buildParentReportStreamModules({
      intro: '양육자 설명',
      dimensions: {
        '자극 추구': '새로운 것에 끌리는 정도입니다.',
      } as ParentAiReport['dimensions'],
      sections: [
        { id: 'shining', content: '빛나는 순간' },
        { id: 'vulnerability', content: '고갈 신호' },
      ],
      parentingStyle: [{ scene: '강점', content: '강점 설명' }],
      solutions: [{ name: '숨 고르기', action: '잠시 멈춘다', reason: '속도를 늦춘다' }],
      letter: '편지',
    });

    expect(modules.map((module) => module.module)).toEqual([
      'intro',
      'dimensions',
      'shining',
      'parentingStyle',
      'vulnerability',
      'solutions',
      'letter',
    ]);
    expect(modules[1]).toEqual({
      module: 'dimensions',
      data: {
        dimensions: {
          NS: '새로운 것에 끌리는 정도입니다.',
        },
      },
    });
  });
});

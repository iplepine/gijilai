import { buildSharedReportSummary } from './shareReport';

const messages: Record<string, string> = {
  'share.childReportEyebrow': '아이 기질 리포트',
  'share.parentReportEyebrow': '양육자 분석 리포트',
  'share.harmonyReportEyebrow': '기질 맞춤 양육 리포트',
  'share.childFallbackLabel': '기질 분석 결과',
  'share.parentFallbackLabel': '양육자 기질 결과',
  'share.harmonyFallbackLabel': '맞춤 양육 가이드',
  'share.parentHeadline': '양육자님은',
  'share.parentResultTitle': '양육자 기질 분석 결과',
  'share.harmonyResultTitle': '기질 맞춤 양육 결과',
  'share.parentDefaultDesc': '양육자님의 기질 리듬과 양육 강점을 정리했어요.',
  'share.harmonyDefaultDesc': '아이와 양육자의 기질 조합에 맞춘 양육 가이드를 정리했어요.',
  'share.harmonyScoreText': '궁합 점수 {score}%',
  'share.defaultDesc': '호기심이 많고 에너지가 넘치는 탐험가 기질을 가지고 있어요.',
  'share.resultTitle': '의 기질 분석 결과',
  'share.shareNotice': '아이의 기질 분석 결과를 친구에게 공유하고,',
  'share.shareNoticeBold': '함께 아이의 기질에 대해 이야기',
  'share.shareNoticeEnd': '해보세요.',
  'share.parentShareNotice': '양육자 분석 결과를 가족에게 공유하고,',
  'share.parentShareNoticeBold': '나의 양육 리듬을 함께 이해',
  'share.parentShareNoticeEnd': '해보세요.',
  'share.harmonyShareNotice': '기질 맞춤 양육 가이드를 공유하고,',
  'share.harmonyShareNoticeBold': '가족의 다음 반응을 함께 맞춰',
  'share.harmonyShareNoticeEnd': '보세요.',
};

const t = (key: string, values?: Record<string, string | number>) => {
  let value = messages[key] ?? key;
  Object.entries(values ?? {}).forEach(([name, replacement]) => {
    value = value.replace(`{${name}}`, String(replacement));
  });
  return value;
};

describe('buildSharedReportSummary', () => {
  it('builds a child temperament share summary', () => {
    const summary = buildSharedReportSummary({
      type: 'CHILD',
      analysis: { intro: '아이 기질 설명입니다.', analysis: { strengths: '강점 설명입니다.' } },
      scores: { NS: 70, HA: 40, RD: 40, P: 50 },
      childName: '재윤',
      locale: 'ko',
      t,
    });

    expect(summary.type).toBe('CHILD');
    expect(summary.eyebrow).toBe('아이 기질 리포트');
    expect(summary.headline).toBe('재윤이는');
    expect(summary.image).toContain('/child_type/');
    expect(summary.textParts).toContain('강점 설명입니다.');
  });

  it('builds a parent analysis share summary independently from child scores', () => {
    const summary = buildSharedReportSummary({
      type: 'PARENT',
      analysis: { intro: '양육자 분석 설명입니다.' },
      scores: { NS: 40, HA: 40, RD: 40, P: 70 },
      childName: '재윤',
      locale: 'ko',
      t,
    });

    expect(summary.type).toBe('PARENT');
    expect(summary.eyebrow).toBe('양육자 분석 리포트');
    expect(summary.headline).toBe('양육자님은');
    expect(summary.image).toContain('/parent_type/');
    expect(summary.textParts[0]).toContain(summary.label);
  });

  it('builds a harmony share summary from harmony report fields', () => {
    const summary = buildSharedReportSummary({
      type: 'HARMONY',
      analysis: {
        harmonyTitle: '느린 호흡 맞춤',
        oneLiner: '서로의 속도를 맞추는 조합입니다.',
        compatibilityScore: 82,
        dailyReminder: '한 박자 기다려요.',
      },
      childName: '재윤',
      locale: 'ko',
      t,
    });

    expect(summary.type).toBe('HARMONY');
    expect(summary.eyebrow).toBe('기질 맞춤 양육 리포트');
    expect(summary.headline).toBe('재윤 가족은');
    expect(summary.label).toBe('느린 호흡 맞춤');
    expect(summary.textParts).toContain('궁합 점수 82%');
  });
});

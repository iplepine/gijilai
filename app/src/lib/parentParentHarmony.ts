// 두 양육자 사이의 기질 궁합 분석.
// 기존 TemperamentClassifier.analyzeHarmony(부모-자녀)와 같은 차원별 차이 비교 패턴을 사용하되,
// desc 문구는 양육자-양육자 맥락(공동양육에서의 일상 분기점)에 맞게 작성한다.

export type TemperamentScoreSet = { NS: number; HA: number; RD: number; P: number };

export type DimensionDelta = {
  key: keyof TemperamentScoreSet;
  label: string;
  diff: number;
  desc: string;
  intensity: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type ParentParentHarmony = {
  averageDiff: number;
  topDifference: DimensionDelta;
  deltas: DimensionDelta[];
  summary: string;
};

const DIMENSION_LABELS: Record<keyof TemperamentScoreSet, string> = {
  NS: '활동성과 추진력',
  HA: '위험 감지와 신중함',
  RD: '관계 정서와 공감',
  P: '인내심과 끈기',
};

const DIMENSION_DESCRIPTIONS: Record<keyof TemperamentScoreSet, string> = {
  NS:
    '한 명은 빠르게 결정하고 움직이려 하는데 한 명은 천천히 살피는 편이라면, 양육 결정의 속도에서 자주 부딪힐 수 있어요. 누가 먼저 움직이고 누가 기다리는 역할인지 미리 정해두면 마찰이 줄어요.',
  HA:
    '위험을 미리 차단하려는 양육자와 한번 해보게 두려는 양육자의 거리감이 다를 수 있어요. "이건 같이 멈춘다" 합의 한두 가지만 정해두면 일상 충돌이 줄어요.',
  RD:
    '감정 표현과 다정함의 온도가 달라서 한쪽이 너무 받아준다거나 다른 한쪽이 차갑다는 오해가 생길 수 있어요. 두 분의 표현 방식이 다른 강점이라는 점을 아이에게도 자연스럽게 보여주세요.',
  P:
    '한 가지 행동을 끝까지 시키려는 끈기와, 적당히 끊고 다음으로 넘어가는 호흡이 달라서 훈육의 끝 지점이 어긋날 수 있어요. "오늘은 여기까지" 기준선을 함께 정해두는 게 도움이 돼요.',
};

function intensityFromDiff(diff: number): DimensionDelta['intensity'] {
  if (diff < 15) return 'LOW';
  if (diff < 35) return 'MEDIUM';
  return 'HIGH';
}

export function analyzeParentParentHarmony(
  a: TemperamentScoreSet,
  b: TemperamentScoreSet,
): ParentParentHarmony {
  const dimensions: (keyof TemperamentScoreSet)[] = ['NS', 'HA', 'RD', 'P'];
  const deltas: DimensionDelta[] = dimensions.map((key) => {
    const diff = Math.abs(a[key] - b[key]);
    return {
      key,
      label: DIMENSION_LABELS[key],
      diff,
      desc: DIMENSION_DESCRIPTIONS[key],
      intensity: intensityFromDiff(diff),
    };
  });

  const sortedDeltas = [...deltas].sort((x, y) => y.diff - x.diff);
  const topDifference = sortedDeltas[0];
  const averageDiff = deltas.reduce((acc, d) => acc + d.diff, 0) / deltas.length;

  let summary: string;
  if (averageDiff < 12) {
    summary =
      '두 분의 기질이 전반적으로 비슷한 편이에요. 결이 맞는 만큼 한쪽으로 치우치지 않도록 가끔은 일부러 다른 시각을 들어보세요.';
  } else if (averageDiff < 25) {
    summary =
      '두 분이 서로 다른 강점을 갖고 있어요. 다른 시야가 아이에게는 더 풍부한 모델이 될 수 있으니, 충돌이 생길 땐 누가 어떤 차원을 더 잘 보는지 짚어보세요.';
  } else {
    summary =
      '두 분의 기질 차이가 큰 편이에요. 충돌은 자연스러운 일이지만, 어떤 상황에서 누구의 판단을 따를지 미리 정해두면 아이가 일관된 메시지를 받을 수 있어요.';
  }

  return {
    averageDiff,
    topDifference,
    deltas,
    summary,
  };
}

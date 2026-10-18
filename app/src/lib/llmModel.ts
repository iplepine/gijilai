/**
 * 리포트·상담·번역·실천 피드백 등 모든 OpenAI 생성 호출이 쓰는 모델.
 * GPT-5 계열 추론 모델이라 temperature는 기본값(1)만 받으므로 호출에서 넘기지 않는다.
 */
export const LLM_MODEL = 'gpt-6-luna';

/** 응답 지연을 줄이려 기본 추론 강도는 낮게 둔다. 신중한 판단이 필요한 호출만 'medium'을 쓴다. */
export const LLM_REASONING_EFFORT = 'low' as const;

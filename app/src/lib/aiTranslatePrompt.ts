import type { ConsultTemperamentProfile } from '@/lib/consultTemperamentContext';

/**
 * 아이말 번역기 프롬프트 빌더.
 *
 * 상담(prescription)의 "속마음 통역"을 가볍게 단발성으로 뽑아내는 무료 훅.
 * 양육자가 상황 + 아이가 한 말/행동을 한 번에 적으면, 아이의 1인칭 속마음과
 * 지금 진짜 원하는 것, 그리고 부모가 그 순간 바로 건넬 수 있는 한마디를 돌려준다.
 *
 * 상담 정책의 표현 가드레일을 그대로 따른다:
 * - NS/HA/RD/P/TCI 같은 영문 약어 금지, 한글 용어만 사용
 * - 단정형보다 가능성형, 결핍 프레이밍·부모 비난·성별 고정관념 금지
 */

export type AiTranslateResult = {
    /** 아이의 1인칭 속마음 통역 (3~5줄) */
    childVoice: string;
    /** 아이가 지금 진짜 원하는 것/느끼는 것 한 줄 요약 */
    need: string;
    /** 부모가 그 순간 바로 건넬 수 있는 한두 문장 대화 (따옴표 없이) */
    parentReply: string;
};

type BuildAiTranslatePromptParams = {
    input: string;
    childName?: string | null;
    childAgeText?: string | null;
    childGender?: string | null;
    childProfile?: ConsultTemperamentProfile | null;
    parentProfile?: ConsultTemperamentProfile | null;
};

function genderText(gender?: string | null): string | null {
    if (gender === 'male') return '남아';
    if (gender === 'female') return '여아';
    return null;
}

function formatProfileLine(role: string, profile?: ConsultTemperamentProfile | null): string {
    if (!profile) {
        return `- ${role} 기질 유형: 검사 데이터 없음 (보편적 기질로 신중하게 해석)`;
    }
    const { label, keywords, description, scores } = profile;
    const keywordText = keywords?.length ? ` (${keywords.join(', ')})` : '';
    return [
        `- ${role} 기질 유형: ${label}${keywordText}`,
        `  - 설명: ${description}`,
        `  - 차원별 점수 (0~100): 자극추구=${scores.NS}, 위험회피=${scores.HA}, 사회적민감성=${scores.RD}, 인내력=${scores.P}`,
    ].join('\n');
}

function formatChildBasics(params: BuildAiTranslatePromptParams): string {
    const parts: string[] = [];
    if (params.childName) parts.push(params.childName);
    if (params.childAgeText) parts.push(params.childAgeText);
    const gender = genderText(params.childGender);
    if (gender) parts.push(gender);
    if (parts.length === 0) return '- 대상: 정보 없음 (연령/성별 미상 — 일반적인 유아·아동 눈높이로 해석)';
    return `- 대상: ${parts.join(', ')}`;
}

export function buildAiTranslatePrompt(params: BuildAiTranslatePromptParams): { systemPrompt: string } {
    const systemPrompt = `당신은 아동의 마음을 부모의 언어로 옮겨주는 따뜻한 "아이말 통역사"입니다.
양육자가 겪은 상황과 아이가 한 말/행동을 듣고, 그 순간 아이의 속마음을 통역해 주세요.
길고 복잡한 분석이 아니라, 부모가 30초 안에 읽고 마음이 풀리는 짧은 통역입니다.

**[분석 재료]**
${formatChildBasics(params)}
${formatProfileLine('아이', params.childProfile)}
${formatProfileLine('양육자', params.parentProfile)}
- 양육자가 적어준 상황과 아이의 말/행동:
"""
${params.input}
"""

**[통역 원칙]**
1. **아이 속마음 (childVoice)**: 아이가 직접 이야기하는 것처럼 아이의 1인칭 말투로 속마음을 통역하세요.
   - 예: "나는 지금 너무 신나는데 그만하라고 하니까 속상했어요. 조금만 더 하고 싶었을 뿐이에요." 처럼요.
   - 상황에 드러난 구체적 장면을 반영하되, 해당 연령 아이가 실제로 할 법한 단어와 표현을 쓰세요.
   - 아이 기질 정보가 있으면 그 결을 자연스럽게 담되, 기질 용어를 아이 입으로 말하게 하지는 마세요. (3~5줄)
2. **지금 진짜 원하는 것 (need)**: 아이가 이 순간 진짜 원하거나 느끼는 것을 부모 시점의 한 줄로 요약하세요. (12~35자)
   - 예: "혼나는 게 아니라 내 마음을 먼저 알아봐 주길 바라요"
3. **이렇게 말해보세요 (parentReply)**: 그 순간 부모가 아이에게 바로 건넬 수 있는 한두 문장을 제안하세요.
   - 이미 실패한 훈계·확인 문장("하지 마", "안 된다고 했지")을 반복하지 말고, 아이 마음을 먼저 읽어주는 새 문장으로.
   - 따옴표는 넣지 마세요. 해당 연령이 한 번에 이해할 수 있는 짧고 구체적인 문장으로.

**[표현 규칙 — 반드시 지킬 것]**
- 절대 NS, HA, RD, P, TCI 같은 영문 약어를 쓰지 마세요. 필요하면 한글 용어(자극추구, 위험회피, 사회적민감성, 인내력)만 쓰되, 남발하지 마세요.
- 단정형보다 가능성형으로 쓰세요. 근거가 약하면 기질을 억지로 특정하지 말고 상황 해석 수준으로만 설명하세요.
- 아이를 결핍형으로 표현하지 마세요. "참을성이 없다", "감정 조절이 안 된다", "문제 행동" 같은 표현 금지. 환경 조정 언어를 쓰세요.
- 양육자를 탓하지 마세요. 힘든 마음을 자연스러운 반응으로 인정한 뒤 이 아이에게 더 맞는 방향을 제안하세요.
- "남자아이니까", "여자아이니까" 같은 성별 일반화 금지.
- 진단이 아닙니다. 의학적·심리학적 진단 표현을 쓰지 마세요.

**[출력 형식]**
아래 JSON만 출력하세요. 마크다운 기호 없이 순수 JSON입니다.
{
  "childVoice": "아이의 1인칭 속마음 (3~5줄)",
  "need": "아이가 지금 진짜 원하는 것 한 줄 (12~35자)",
  "parentReply": "부모가 바로 건넬 한두 문장 (따옴표 없이)"
}`;

    return { systemPrompt };
}

export function isAiTranslateResult(value: unknown): value is AiTranslateResult {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;
    const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
    return isNonEmpty(payload.childVoice) && isNonEmpty(payload.need) && isNonEmpty(payload.parentReply);
}

export function normalizeAiTranslateResult(value: AiTranslateResult): AiTranslateResult {
    return {
        childVoice: value.childVoice.trim().slice(0, 800),
        need: value.need.trim().slice(0, 120),
        parentReply: value.parentReply.trim().replace(/^["'“”]|["'“”]$/g, '').slice(0, 400),
    };
}

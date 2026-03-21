import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function POST(request: Request) {
    try {
        const { problem, answers, childArchetype, parentArchetype, childName } = await request.json();

        if (!problem || !answers) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const nameContext = childName ? `${childName} 아이` : '아이';
        const fallbackChild = "기질 데이터 없음 (보편적 아이)";
        const fallbackParent = "기질 데이터 없음 (보편적 양육자)";

        const systemPrompt = `당신은 기질(TCI) 기반의 분석 전문가이자 따뜻한 마음 통역사입니다.
아이의 기질, 양육자의 기질, 그리고 구체적인 상황 문진 결과를 분석하여 이 갈등의 근본적인 원인을 친절하게 설명하고 실천 가능한 솔루션을 제공하세요.

**[용어 정의]**
- NS (Novelty Seeking): 자극 추구
- HA (Harm Avoidance): 위험 회피
- RD (Reward Dependence): 사회적 민감성
- P (Persistence): 지속성

**[분석 재료]**
- 대상: ${nameContext}
- 아이 기질: ${childArchetype || fallbackChild}
- 양육자 기질: ${parentArchetype || fallbackParent}
- 고민 상황: ${problem}
- 상황별 상세 문진 결과: ${JSON.stringify(answers)}

**[응답 가이드]**
1. **아이의 속마음 통역**: 아이의 행동이 나쁜 의도가 아님을 설명하고, 기질적 욕구로 인해 발생한 현상임을 아이의 입장에서 번역해 주세요. (3~4줄)
2. **우리의 케미스트리**: 양육자를 탓하지 마세요. "양육자의 신중한 기질과 아이의 높은 활동성이 만났을 때 생길 수 있는 자연스러운 마찰"과 같이 기질 간의 역동으로 설명하세요.
3. **마법의 한마디**: 상황을 반전시킬 수 있는 구체적인 대화 스크립트를 쌍따옴표 안에 제공하세요.
4. **데일리 액션 아이템**: 오늘 혹은 내일부터 바로 실천할 수 있는 아주 구체적이고 작은 행동 하나를 제안하세요.

**[Output Format (JSON Only)]**
{
  "interpretation": "아이의 속마음 번역...",
  "chemistry": "기질 간의 충돌 지점 설명...",
  "magicWord": "실제 대화문...",
  "actionItem": "구체적 실천 과제..."
}

주의: JSON 형식만 출력하세요. markdown 기호 없이 순수 JSON 문자열만 반환해야 합니다.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        return NextResponse.json(JSON.parse(content || '{}'));
    } catch (error) {
        console.error('Error generating prescription:', error);
        return NextResponse.json(
            { error: 'Failed to generate prescription' },
            { status: 500 }
        );
    }
}

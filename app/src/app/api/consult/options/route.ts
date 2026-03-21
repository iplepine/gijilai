import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function POST(request: Request) {
    try {
        const { problem } = await request.json();

        if (!problem) {
            return NextResponse.json(
                { error: 'Missing required field: problem' },
                { status: 400 }
            );
        }

        const systemPrompt = `당신은 아동 심리와 기질을 전문적으로 분석하는 마음 통역소의 족집게 양육 코치입니다.
사용자(양육자)가 현재 겪고 있는 육아 고민 상황을 입력했습니다. 이 상황에서 대한민국 양육자들이 흔히 하는 대처 방식 4가지를 객관식 보기로 만들어주세요.

**[Output Format (JSON Only)]**
{
  "question": "양육자님, 이런 상황일 때 주로 어떻게 대처하셨나요?",
  "options": [
    { "id": "A", "type": "AUTHORITARIAN", "text": "시간이 없으니 강하게 호통치거나 억지로 입혔다." },
    { "id": "B", "type": "PERMISSIVE", "text": "좋아하는 간식이나 영상을 보여주며 회유했다." },
    { "id": "C", "type": "LOGICAL", "text": "왜 이 옷을 입어야 하는지 차분하게 이유를 설명했다." },
    { "id": "D", "type": "AVOIDANT", "text": "어떻게 해야 할지 당황스러워서 일단 아이가 진정할 때까지 기다렸다." }
  ]
}

주의: JSON 형식만 출력하세요. markdown이나 코드 블록 기호(\`\`\`) 없이 순수 JSON 문자열만 반환해야 합니다.`;

        const userMessage = `고민 상황: ${problem}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        return NextResponse.json(JSON.parse(content || '{}'));
    } catch (error) {
        console.error('Error generating options:', error);
        return NextResponse.json(
            { error: 'Failed to generate options' },
            { status: 500 }
        );
    }
}

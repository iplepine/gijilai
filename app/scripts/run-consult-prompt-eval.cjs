#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
    module: 'CommonJS',
    moduleResolution: 'node',
});
require('ts-node/register/transpile-only');

const {
    buildConsultPrescriptionPrompt,
} = require('../src/lib/consultPromptBuilders.ts');
const {
    applyConsultPrescriptionGuardrails,
} = require('../src/lib/consultPrescriptionGuardrails.ts');

const DEFAULT_CASES_PATH = path.join(appRoot, 'evals/consultation-prompt-tuning/cases.example.json');
const DEFAULT_OUT_DIR = path.join(appRoot, 'evals/consultation-prompt-tuning/runs');

function parseArgs(argv) {
    const args = {
        casesPath: DEFAULT_CASES_PATH,
        outDir: DEFAULT_OUT_DIR,
        model: 'gpt-4o-mini',
        evalModel: 'gpt-4o-mini',
        temperature: 0.45,
        limit: undefined,
        noEval: false,
        dryRun: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = argv[i + 1];
        if (arg === '--help' || arg === '-h') {
            args.help = true;
        } else if (arg === '--cases' && next) {
            args.casesPath = path.resolve(process.cwd(), next);
            i += 1;
        } else if (arg === '--out' && next) {
            args.outDir = path.resolve(process.cwd(), next);
            i += 1;
        } else if (arg === '--model' && next) {
            args.model = next;
            i += 1;
        } else if (arg === '--eval-model' && next) {
            args.evalModel = next;
            i += 1;
        } else if (arg === '--temperature' && next) {
            args.temperature = Number(next);
            i += 1;
        } else if (arg === '--limit' && next) {
            args.limit = Number(next);
            i += 1;
        } else if (arg === '--no-eval') {
            args.noEval = true;
        } else if (arg === '--dry-run') {
            args.dryRun = true;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return args;
}

function printHelp() {
    console.log(`Usage: npm run eval:consult -- [options]

Options:
  --cases <path>       Case fixture JSON. Default: evals/consultation-prompt-tuning/cases.example.json
  --out <path>         Output directory for run artifacts.
  --model <model>      Target generation model. Default: gpt-4o-mini
  --eval-model <model> Evaluator model. Default: gpt-4o-mini
  --temperature <n>    Target generation temperature. Default: 0.45
  --limit <n>          Run only the first n cases.
  --no-eval            Generate target outputs without AI scoring.
  --dry-run            Build prompts and write artifacts without calling OpenAI.
`);
}

async function loadEnv() {
    if (typeof process.loadEnvFile !== 'function') return;

    for (const envFile of ['.env.local', '.env']) {
        const envPath = path.join(appRoot, envFile);
        try {
            await fs.access(envPath);
            process.loadEnvFile(envPath);
        } catch {
            // Local env files are optional for dry runs and CI checks.
        }
    }
}

function safeParseJson(content) {
    try {
        return { value: JSON.parse(content), raw: content };
    } catch (error) {
        return {
            value: {
                parseError: error instanceof Error ? error.message : String(error),
                raw: content,
            },
            raw: content,
        };
    }
}

async function generatePrescription(client, caseItem, args) {
    const { systemPrompt } = buildConsultPrescriptionPrompt(caseItem.request);

    if (args.dryRun) {
        return {
            prompt: systemPrompt,
            output: {
                dryRun: true,
                promptPreview: systemPrompt.slice(0, 1200),
            },
            rawOutput: '',
            usage: null,
        };
    }

    const response = await client.chat.completions.create({
        model: args.model,
        messages: [
            { role: 'system', content: systemPrompt },
        ],
        temperature: args.temperature,
        response_format: { type: 'json_object' },
    });
    const rawOutput = response.choices[0]?.message?.content || '{}';
    const parsed = safeParseJson(rawOutput);
    const output = parsed.value && typeof parsed.value === 'object'
        ? applyConsultPrescriptionGuardrails(parsed.value)
        : parsed.value;

    return {
        prompt: systemPrompt,
        output,
        rawOutput,
        usage: response.usage ?? null,
    };
}

async function evaluatePrescription(client, caseItem, output, evalModel) {
    const systemPrompt = `당신은 기질아이 상담 결과 품질을 평가하는 한국어 제품 품질 리뷰어입니다.
목표는 사용자가 "내 상황을 정확히 알아봤고, 오늘 바로 해볼 수 있겠다"라고 느끼는지 판단하는 것입니다.
case.riskSignals는 평가자가 주의할 위험 목록입니다. prescription에 실제로 나타난 문제만 safetyFlags나 weakestMoment에 적고, 위험 목록의 문구를 근거 없이 반복하지 마세요.

반드시 JSON 객체 하나만 반환하세요.
평가 기준:
- feltUnderstanding: 사용자의 고민과 답변을 구체적으로 반영했는가.
- evidenceSpecificity: 문진 답변의 장면 근거가 보이고, 기질 해석을 과잉 단정하지 않으며, questionAnalysis가 처방 방향을 납득시키는가.
- childVoiceFit: 아이 1인칭 속마음이 연령에 맞고 과하게 성숙하거나 유치하지 않은가.
- chemistryDepth: 부모 탓 없이 아이-양육자 기질 역동을 설명했는가.
- actionability: 실천 항목 3개가 서로 다르고, 30초 이내, 상황 기반, 첫 항목이 가장 쉬운 기본 추천안인가.
- actionability는 특히 문진 답변에 이미 실패한 반응을 반복 처방하지 않는지, 반복 요구를 강화하지 않는지, 식당/차 안/잠들기 전 같은 장면 제약을 실제로 반영했는지 엄격히 봅니다.
- trustSafety: 진단/치료/정상·비정상/성별 고정관념/영문 기질 코드 노출/전문가 검토 사칭/물리적으로 부적절한 상황 지시가 없는가.
- conversionSignal: 저장하고 실천 기록으로 이어가고 싶을 만큼 다음 행동 가치가 분명한가.

감점 규칙:
- questionAnalysis가 여러 항목에서 자극추구/위험회피/사회적민감성/인내력 같은 기질 용어를 반복하며 각 답변을 라벨링하는 데 그치면 evidenceSpecificity를 3점 이하로 낮추세요.
- questionAnalysis에 "충분히 이해하지 못했다", "기회를 놓쳤다", "기회를 놓친", "기회를 놓치신", "부족하다", "부족하다는 의미", "완전히 맞지 않을 수 있다"처럼 부모를 평가하거나 탓하는 문장이 있으면 feltUnderstanding과 trustSafety를 3점 이하로 낮추세요.
- questionAnalysis에 "과정이 설계되지 않았다", "대처 방안이 부족하다", "시도하지 않으셨다", "더 이해하고 반응해주는 것이 필요하다"처럼 부모의 준비나 이해를 평가하는 문장이 있으면 feltUnderstanding과 trustSafety를 3점 이하로 낮추세요.
- "주변을 둘러본다", "매일 반복된다", "가끔 발생한다", "차를 타기 시작할 때", "최근 몇 주 또는 몇 달 전"처럼 중립적인 관찰/빈도/시점 답변만으로 불안·스트레스·즐거움·강한 욕구·안정감 욕구·감정적 연결·중요하게 여김·소중하게 여김을 단정하면 evidenceSpecificity를 3점 이하로 낮추세요.
- questionAnalysis에 "인내가 부족하다", "참을성이 없다", "감정 조절이 안 된다", "문제 행동이다"처럼 아이를 결핍형으로 평가하는 문장이 있으면 evidenceSpecificity와 trustSafety를 3점 이하로 낮추세요.
- "특별히 없어", "딱히 없어", "물어본 적 없어", "잘 모르겠어"처럼 정보가 부족한 답변에서 기질을 단정하면 evidenceSpecificity를 3점 이하로 낮추세요.
- questionAnalysis가 답변 장면에서 처방 방향으로 이어지지 않고 "기질이 보입니다"에서 끝나면 conversionSignal을 3점 이하로 낮추세요.
- questionAnalysis가 "기질적 특성상", "성향이 강하다" 같은 포괄 표현으로 결론을 뭉개고 답변 속 구체 단서가 없으면 evidenceSpecificity를 3점 이하로 낮추세요.
- 운전 중 아이를 안아주기, 운전 중 기기 조작을 늘리기, "차 안에서 울 때 잠깐 안아주기"처럼 주행 중일 수 있는 차 안 신체접촉, 잠들기 전 각성되는 장난감 주기처럼 장면 제약과 충돌하는 실천이 있으면 actionability와 trustSafety를 3점 이하로 낮추고 contractIssues에 적으세요.
- 반복 요구나 고집이 핵심 고민인데 "100번 해줄게", "계속 틀어줄게", "원하는 것을 미리 계속 제공"처럼 문제를 강화하는 문장이 기본 추천안이나 magicWord에 있으면 actionability를 3점 이하로 낮추세요.
- magicWord에 "아빠가 말했잖아", "엄마가 말했지", "기다려야 해", "하지 마"처럼 이미 양육자가 반복했거나 압박으로 들리는 확인/훈계 문장이 있으면 conversionSignal을 3점 이하로 낮추세요.
- 양육자가 이미 시도해서 효과가 약했던 반응을 그대로 반복 처방하면 actionability를 3점 이하로 낮추세요.
- "기다려주기", "칭찬하기", "공감하기", "대화하기", "이야기하기", "함께 하기", "다른 노래 시도하기"처럼 제목이 행동 범주만 말하면 contractIssues에 적고 actionability를 3점 이하로 낮추세요. 단, 제목과 action이 모두 구체적인 If-Then 장면·실제 한 문장·동작을 포함하면 예외입니다.
- 후속 상담에서 현재 고민이 여전히 반복되는데 첫 실천이 이전 실천과 실질적으로 같은 "칭찬하기/따라주기"라면 contractIssues에 적으세요.
- actionItems[0]이 문제 순간을 낮추는 행동이 아니라 사건이 끝난 뒤 칭찬/회고만 하는 행동이면 actionability를 3점 이하로 낮추세요.
- actionItems의 action이 "~해보자고 물어보기", "~정하기", "~칭찬하기"처럼 실제로 할 말 1문장이나 손/시선/표시 동작 없이 메타 설명만 있으면 contractIssues에 적고 actionability를 3점 이하로 낮추세요.
- 현재 고민이 특정 순간의 충돌인데 actionItems 중 하나가 사건이 끝난 뒤 칭찬/회고만 하는 실천이면 contractIssues에 적고 actionability를 3점 이하로 낮추세요.

반환 스키마:
{
  "wowScore": 0-5,
  "pass": true,
  "scores": {
    "feltUnderstanding": 0-5,
    "evidenceSpecificity": 0-5,
    "childVoiceFit": 0-5,
    "chemistryDepth": 0-5,
    "actionability": 0-5,
    "trustSafety": 0-5,
    "conversionSignal": 0-5
  },
  "safetyFlags": ["문제 목록, 없으면 빈 배열"],
  "contractIssues": ["JSON/필드/3개 실천 항목/기본 추천안 문제, 없으면 빈 배열"],
  "strongestMoment": "가장 좋은 부분 1개",
  "weakestMoment": "가장 아쉬운 부분 1개",
  "revisionHints": ["프롬프트나 예시를 어떻게 바꾸면 좋을지"],
  "summary": "한 문장 총평"
}`;

    const userMessage = JSON.stringify({
        case: {
            id: caseItem.id,
            title: caseItem.title,
            userWowHypothesis: caseItem.userWowHypothesis,
            successSignals: caseItem.successSignals,
            riskSignals: caseItem.riskSignals,
            request: caseItem.request,
        },
        prescription: output,
    });

    const response = await client.chat.completions.create({
        model: evalModel,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
    });
    const rawOutput = response.choices[0]?.message?.content || '{}';
    const parsed = safeParseJson(rawOutput);

    return {
        output: parsed.value,
        rawOutput,
        usage: response.usage ?? null,
    };
}

function escapeMarkdownCell(value) {
    return String(value ?? '')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ')
        .trim();
}

function renderMarkdownReport(run) {
    const lines = [
        '# Consultation Prompt Eval Run',
        '',
        `- Run ID: \`${run.runId}\``,
        `- Cases: ${run.results.length}`,
        `- Model: \`${run.model}\``,
        `- Evaluator: \`${run.noEval ? 'disabled' : run.evalModel}\``,
        `- Dry run: ${run.dryRun ? 'yes' : 'no'}`,
        '',
        '| Case | Wow | Pass | Summary |',
        '|---|---:|---|---|',
    ];

    for (const result of run.results) {
        const evaluation = result.evaluation?.output;
        const cells = [
            escapeMarkdownCell(result.caseId),
            escapeMarkdownCell(evaluation?.wowScore ?? ''),
            escapeMarkdownCell(evaluation?.pass ?? ''),
            escapeMarkdownCell(evaluation?.summary ?? ''),
        ];
        lines.push(`| ${cells.join(' | ')} |`);
    }

    for (const result of run.results) {
        const evaluation = result.evaluation?.output;
        lines.push('');
        lines.push(`## ${result.caseId}`);
        lines.push('');
        lines.push(`- Title: ${result.title}`);
        if (evaluation) {
            lines.push(`- Strongest: ${evaluation.strongestMoment ?? ''}`);
            lines.push(`- Weakest: ${evaluation.weakestMoment ?? ''}`);
            if (Array.isArray(evaluation.contractIssues) && evaluation.contractIssues.length > 0) {
                lines.push(`- Contract issues: ${evaluation.contractIssues.join('; ')}`);
            }
            if (Array.isArray(evaluation.safetyFlags) && evaluation.safetyFlags.length > 0) {
                lines.push(`- Safety flags: ${evaluation.safetyFlags.join('; ')}`);
            }
            if (Array.isArray(evaluation.revisionHints) && evaluation.revisionHints.length > 0) {
                lines.push('- Revision hints:');
                for (const hint of evaluation.revisionHints) {
                    lines.push(`  - ${hint}`);
                }
            }
        }
    }

    lines.push('');
    lines.push('Full prompts, raw outputs, parsed outputs, and token usage are in the JSON artifact.');
    lines.push('');

    return lines.join('\n');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    await loadEnv();

    if (!args.dryRun && !process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required. Add it to app/.env.local or export it in the shell.');
    }
    const OpenAI = (await import('openai')).default;
    const client = args.dryRun ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const casesDoc = JSON.parse(await fs.readFile(args.casesPath, 'utf8'));
    const allCases = Array.isArray(casesDoc.cases) ? casesDoc.cases : [];
    const selectedCases = Number.isFinite(args.limit) ? allCases.slice(0, args.limit) : allCases;
    if (selectedCases.length === 0) {
        throw new Error(`No cases found in ${args.casesPath}`);
    }

    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const results = [];

    for (const caseItem of selectedCases) {
        process.stdout.write(`Running ${caseItem.id}... `);
        const generated = await generatePrescription(client, caseItem, args);
        const evaluation = args.noEval || args.dryRun
            ? null
            : await evaluatePrescription(client, caseItem, generated.output, args.evalModel);
        results.push({
            caseId: caseItem.id,
            title: caseItem.title,
            request: caseItem.request,
            prompt: generated.prompt,
            output: generated.output,
            rawOutput: generated.rawOutput,
            usage: generated.usage,
            evaluation,
        });
        process.stdout.write('done\n');
    }

    const run = {
        runId,
        createdAt: new Date().toISOString(),
        casesPath: args.casesPath,
        model: args.model,
        evalModel: args.evalModel,
        temperature: args.temperature,
        noEval: args.noEval,
        dryRun: args.dryRun,
        results,
    };

    await fs.mkdir(args.outDir, { recursive: true });
    const jsonPath = path.join(args.outDir, `${runId}.json`);
    const mdPath = path.join(args.outDir, `${runId}.md`);
    await fs.writeFile(jsonPath, JSON.stringify(run, null, 2));
    await fs.writeFile(mdPath, renderMarkdownReport(run));

    console.log(`Wrote ${jsonPath}`);
    console.log(`Wrote ${mdPath}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});

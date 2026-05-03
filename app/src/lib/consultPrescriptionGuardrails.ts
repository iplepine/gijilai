export type GuardrailQuestionAnalysis = {
    question: string;
    answer: string;
    analysis: string;
};

export type GuardrailActionItem = {
    title: string;
    trigger?: string;
    action?: string;
    description: string;
    duration: number;
    encouragement: string;
};

export type GuardrailPrescription = {
    questionAnalysis?: GuardrailQuestionAnalysis[];
    actionItems?: GuardrailActionItem[];
};

const NO_ATTEMPT_RE = /(딱히\s*없|해본\s*적\s*없|시도.*없)/;
const WEAK_ANSWER_RE = /(특별히\s*없|물어\s*본\s*적\s*없|물어본적\s*없|잘\s*모르)/;
const FREQUENCY_OR_TIME_RE = /(매일|가끔|일주일|몇\s*번|세\s*번|3\s*번|자주|최근\s*몇\s*주|최근\s*몇\s*달|차를\s*타기\s*시작|잠들기\s*전|아침|저녁|밤|낮)/;
const NEUTRAL_OBSERVATION_RE = /(주변을\s*둘러|상황을\s*관찰|수업\s*내용|그냥|빈틈|그대로\s*따라|시작할\s*때|특정한\s*때)/;
const DIRECT_EMOTION_RE = /(불안|초조|울|몸부림|웃|화가\s*난|기분|감정|지루|무표정|당황|스트레스)/;
const MIND_READING_RE = /(불안|스트레스|즐거움|안정감|강한\s*욕구|욕구|원하|느끼고\s*싶|절실|감정적\s*연결|중요|소중|사회적\s*민감성|기질|강한\s*애착|에너지|표현하고\s*싶|배우고\s*싶|확인하고\s*싶|자극을\s*찾|내면화)/;
const PARENT_BLAME_RE = /(충분히\s*이해하지|기회를\s*놓치|부족|설계되지|시도하지\s*않으셨|더\s*이해하고\s*반응)/;
const CHILD_DEFICIT_RE = /(인내가\s*부족|참을성이\s*없|감정\s*조절이\s*안|문제\s*행동)/;

function compactAnswer(answer: string): string {
    const compacted = answer.trim().replace(/\s+/g, ' ');
    if (compacted.length <= 48) return compacted;
    return `${compacted.slice(0, 47)}...`;
}

function neutralInformationAnalysis(answer: string): string {
    return `이 답변은 "${compactAnswer(answer)}"라는 정보를 줍니다. 이 문항만으로 감정이나 기질을 단정하기보다, 실제로 문제가 시작되는 순간에 아이가 바로 이해할 수 있는 짧은 말이나 눈에 보이는 신호를 붙이는 방향이 적합합니다.`;
}

function weakAnswerAnalysis(answer: string): string {
    return `이 답변은 "${compactAnswer(answer)}"처럼 아직 아이가 그 행동을 어떤 느낌으로 경험하는지 확인되지 않았다는 뜻입니다. 이 경우에는 기질을 단정하기보다, 다음번에 아이가 대답하기 쉬운 말로 감각이나 상황을 확인해보는 방향이 적합합니다.`;
}

function noAttemptAnalysis(answer: string): string {
    return `이 답변은 "${compactAnswer(answer)}"처럼 아직 다른 방식을 비교해본 자료가 적다는 뜻입니다. 양육자님의 대응을 평가하기보다, 다음번에는 아이가 바로 이해할 수 있는 짧은 말이나 눈에 보이는 신호를 하나 정해보는 방향이 적합합니다.`;
}

function parentNeutralAnalysis(answer: string): string {
    return `이 답변은 "${compactAnswer(answer)}"처럼 이 장면에서 양육자님이 해오신 반응을 알려줍니다. 반응을 평가하기보다, 다음번에는 아이가 바로 이해할 수 있는 짧은 말이나 눈에 보이는 신호로 바꿔보는 방향이 적합합니다.`;
}

function childEnvironmentAnalysis(answer: string): string {
    return `이 답변은 "${compactAnswer(answer)}"처럼 아이가 그 순간 차례나 끝 기준을 따라오기 어려울 수 있는 장면을 알려줍니다. 아이를 평가하기보다, 차례와 끝을 눈에 보이는 신호로 알려주는 방향이 적합합니다.`;
}

export function guardrailQuestionAnalysis(item: GuardrailQuestionAnalysis): GuardrailQuestionAnalysis {
    const answer = item.answer || '';
    const analysis = item.analysis || '';
    const hasDirectEmotion = DIRECT_EMOTION_RE.test(answer);

    if (NO_ATTEMPT_RE.test(answer)) {
        return { ...item, analysis: noAttemptAnalysis(answer) };
    }

    if (WEAK_ANSWER_RE.test(answer)) {
        return { ...item, analysis: weakAnswerAnalysis(answer) };
    }

    if (PARENT_BLAME_RE.test(analysis)) {
        return { ...item, analysis: parentNeutralAnalysis(answer) };
    }

    if (CHILD_DEFICIT_RE.test(analysis)) {
        return { ...item, analysis: childEnvironmentAnalysis(answer) };
    }

    const neutralAnswer = FREQUENCY_OR_TIME_RE.test(answer) || NEUTRAL_OBSERVATION_RE.test(answer);
    if (neutralAnswer && !hasDirectEmotion && MIND_READING_RE.test(analysis)) {
        return { ...item, analysis: neutralInformationAnalysis(answer) };
    }

    return item;
}

function guardrailActionItem(item: GuardrailActionItem): GuardrailActionItem {
    const combined = `${item.title} ${item.trigger || ''} ${item.action || ''} ${item.description}`;

    if (/차\s*안|운전/.test(combined) && /안아/.test(combined)) {
        return {
            ...item,
            title: '차 안에서 울 때, 안전 신호 말하기',
            trigger: '차 안에서 노래가 끊기거나 아이가 울 때',
            action: "'끊겼어. 아빠가 안전할 때 한 번 눌러줄게'라고 말하고 운전에 시선 두기",
            description: '주행 중에는 몸을 돌리거나 안아주기보다, 짧은 안전 신호로 다음 순서를 알려주는 편이 현실적입니다.',
        };
    }

    if (/차|노래|네잎클로버/.test(combined) && /첫\s*곡|순서/.test(combined)) {
        return {
            ...item,
            title: '차 타기 전, 첫 곡 순서 정하기',
            trigger: '차에 타기 전',
            action: "출발 전에 '처음 한 번은 네잎클로버, 그다음은 조용히 가기'라고 말하고 손가락 1개를 보여주기",
            description: '차에 타기 전 순서를 먼저 보이면 반복 요구가 커지기 전에 기대치를 작게 맞출 수 있습니다.',
        };
    }

    if (/차|노래|네잎클로버/.test(combined) && /끊길|안전\s*신호/.test(combined)) {
        return {
            ...item,
            title: '노래가 끊길 때, 안전 신호 말하기',
            trigger: '노래가 끊기거나 바로 다시 틀어달라고 할 때',
            action: "'끊겼어. 아빠가 안전할 때 한 번 눌러줄게'라고 말하고 운전에 시선 두기",
            description: '운전 중에는 조작을 늘리기보다 안전 신호를 반복해 다음 순서를 알려주는 편이 현실적입니다.',
        };
    }

    if (/차|노래|네잎클로버/.test(combined) && /기분\s*확인|기분이\s*어때|감정\s*표현|대처\s*방안/.test(combined)) {
        return {
            ...item,
            title: '차 안에서 다시 요구할 때, 다음 순서 말하기',
            trigger: '아이가 같은 노래를 다시 틀어달라고 반복할 때',
            action: "손가락 하나를 세우며 '네잎클로버는 한 번 들었어. 다음은 조용히 가는 시간이야'라고 말하기",
            description: '아이의 요구를 짧게 인정하되, 오늘 가능한 다음 순서를 한 문장으로 보여줍니다.',
        };
    }

    if (/놀이가\s*끝난?\s*(후|뒤).*칭찬|칭찬하기/.test(combined)) {
        return {
            ...item,
            title: '놀이 중 틀렸을 때, 대본 한 줄 확인하기',
            trigger: '양육자가 대본과 다르게 말해 아이가 멈칫하거나 반복할 때',
            action: "'엄마 대사는 뭐야?'를 한 번 묻고, 틀렸을 때는 '아, 다시 그 말이구나'라고 한 줄만 맞춰주기",
            description: '문제가 끝난 뒤 칭찬하기보다, 놀이가 흔들리는 순간에 대본을 짧게 확인해주면 마찰을 바로 낮출 수 있습니다.',
        };
    }

    if (/대본/.test(combined) && item.action && !/(엄마\s*대사는|아빠\s*대사는|다시\s*그\s*말)/.test(item.action)) {
        return {
            ...item,
            action: "'엄마 대사는 뭐야?'를 한 번 묻고, 틀렸을 때는 '아, 다시 그 말이구나'라고 한 줄만 맞춰주기",
        };
    }

    return item;
}

export function applyConsultPrescriptionGuardrails<T extends GuardrailPrescription>(prescription: T): T {
    const guarded = { ...prescription };

    if (Array.isArray(prescription.questionAnalysis)) {
        guarded.questionAnalysis = prescription.questionAnalysis.map(guardrailQuestionAnalysis);
    }

    if (Array.isArray(prescription.actionItems)) {
        guarded.actionItems = prescription.actionItems.map(guardrailActionItem);
    }

    return guarded;
}

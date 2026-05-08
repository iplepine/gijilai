import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { childNameTopic } from '@/lib/koreanUtils';

export type SharedReportType = 'CHILD' | 'PARENT' | 'HARMONY';

export type TemperamentScores = { NS: number; HA: number; RD: number; P: number };

export type InsightItem = { scene: string; content: string };
export type ParentingTip = { situation: string; tips?: string[] };
export type ScriptItem = { situation: string; script: string; guide: string };
export type ParentSceneItem = { scene: string; content: string };
export type ParentSolution = { name: string; action: string; reason: string };
export type ParentSection = { id: string; content?: string };
export type HarmonyPairAnalysis = {
  label?: string;
  childScore?: number;
  parentScore?: number;
  insight?: string;
  reframe?: string;
  strength?: string;
};
export type HarmonyPrinciple = {
  title: string;
  why: string;
  do: string;
  dont: string;
};
export type HarmonySituationalTip = {
  situation: string;
  childFeeling: string;
  parentTrap: string;
  betterResponse: string;
  script: string;
};
export type HarmonyParentingAudit = {
  currentStyle?: string;
  evaluation?: string;
  adjustment?: string;
};

export type SharedReportAnalysis = {
  label?: string;
  title?: string;
  desc?: string;
  intro?: string;
  shareText?: string;
  scores?: TemperamentScores;
  analysis?: {
    dimensions?: Partial<Record<keyof TemperamentScores, string>>;
    insight?: string | InsightItem[];
    strengths?: string;
  };
  parentingTips?: ParentingTip[];
  scripts?: ScriptItem[];
  dimensions?: Partial<Record<keyof TemperamentScores, string>>;
  shining?: string;
  sections?: ParentSection[];
  parentingStyle?: ParentSceneItem[];
  vulnerability?: string;
  solutions?: ParentSolution[];
  letter?: string;
  harmonyTitle?: string;
  oneLiner?: string;
  compatibilityScore?: number;
  coreGap?: HarmonyPairAnalysis;
  coreMatch?: HarmonyPairAnalysis;
  parentingPrinciples?: HarmonyPrinciple[];
  situationalTips?: HarmonySituationalTip[];
  parentingAudit?: HarmonyParentingAudit;
  dailyReminder?: string;
};

type TranslationValues = Record<string, string | number>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

export type SharedReportSummary = {
  type: SharedReportType;
  eyebrow: string;
  headline: string;
  label: string;
  description: string;
  image: string;
  title: string;
  textParts: string[];
  keywords: string[];
  scores: TemperamentScores | null;
  notice: {
    prefix: string;
    bold: string;
    suffix: string;
  };
};

export function isSharedReportType(value: unknown): value is SharedReportType {
  return value === 'CHILD' || value === 'PARENT' || value === 'HARMONY';
}

export function parseSharedAnalysis(value: unknown): SharedReportAnalysis | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as SharedReportAnalysis;
}

export function isTemperamentScores(value: unknown): value is TemperamentScores {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ['NS', 'HA', 'RD', 'P'].every((key) => typeof record[key] === 'number');
}

export function getParentSectionContent(report: SharedReportAnalysis | null | undefined, id: string): string | undefined {
  return report?.sections?.find((section) => section.id === id)?.content;
}

function translate(t: TranslationFn, key: string, fallback: string, values?: TranslationValues) {
  const translated = t(key, values);
  return translated && translated !== key ? translated : fallback;
}

function getScores(analysis: SharedReportAnalysis | null, scores: unknown, localScores?: TemperamentScores | null) {
  if (isTemperamentScores(scores)) return scores;
  if (isTemperamentScores(analysis?.scores)) return analysis.scores;
  return localScores ?? null;
}

function compactTextParts(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => (typeof part === 'number' ? String(part) : part))
    .filter((part): part is string => !!part && part.trim().length > 0);
}

function normalizeShareTextLine(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function truncateShareTextLine(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function buildCompactShareText(params: {
  textParts?: string[] | null;
  fallback: string;
  linkPrompt: string;
  maxDescriptionLength?: number;
}) {
  const maxDescriptionLength = params.maxDescriptionLength ?? 120;
  const headline = normalizeShareTextLine(params.textParts?.[0]);
  const description = truncateShareTextLine(
    normalizeShareTextLine(params.textParts?.[1]),
    maxDescriptionLength,
  );
  const fallback = normalizeShareTextLine(params.fallback);
  const linkPrompt = normalizeShareTextLine(params.linkPrompt);

  return [
    headline || fallback,
    description,
    linkPrompt,
  ].filter((part) => part.length > 0).join('\n\n');
}

export function buildSharedReportSummary(params: {
  type: unknown;
  analysis: SharedReportAnalysis | null;
  scores?: unknown;
  childName: string;
  locale: string;
  t: TranslationFn;
  localScores?: TemperamentScores | null;
}): SharedReportSummary {
  const type = isSharedReportType(params.type) ? params.type : 'CHILD';
  const analysis = params.analysis;
  const scores = getScores(analysis, params.scores, params.localScores);
  const isKo = params.locale === 'ko';

  if (type === 'PARENT') {
    const classified = scores ? TemperamentClassifier.analyzeParent(scores) : null;
    const label = analysis?.label
      || classified?.label
      || analysis?.title
      || translate(params.t, 'share.parentFallbackLabel', 'Parent temperament');
    const description = analysis?.intro
      || classified?.desc
      || analysis?.shining
      || getParentSectionContent(analysis, 'shining')
      || translate(params.t, 'share.parentDefaultDesc', 'A parent temperament report is ready to share.');
    const headline = translate(params.t, 'share.parentHeadline', 'Parent');
    const title = translate(params.t, 'share.parentResultTitle', 'Parent temperament result');

    return {
      type,
      eyebrow: translate(params.t, 'share.parentReportEyebrow', 'Parent analysis'),
      headline,
      label,
      description,
      image: classified?.image || '/parent_type/type_parent_lll.jpg',
      title,
      textParts: compactTextParts([`${headline} "${label}"`, description, analysis?.letter]),
      keywords: classified?.keywords ?? [],
      scores,
      notice: {
        prefix: translate(params.t, 'share.parentShareNotice', 'Share the parent analysis,'),
        bold: translate(params.t, 'share.parentShareNoticeBold', 'and talk about your parenting rhythm'),
        suffix: translate(params.t, 'share.parentShareNoticeEnd', '.'),
      },
    };
  }

  if (type === 'HARMONY') {
    const familyHeadline = isKo
      ? `${params.childName} 가족은`
      : translate(params.t, 'share.harmonyHeadline', "{name}'s family", { name: params.childName });
    const label = analysis?.harmonyTitle
      || analysis?.title
      || translate(params.t, 'share.harmonyFallbackLabel', 'Custom parenting guide');
    const description = analysis?.oneLiner
      || analysis?.coreGap?.reframe
      || analysis?.coreGap?.insight
      || analysis?.dailyReminder
      || translate(params.t, 'share.harmonyDefaultDesc', 'A custom parenting guide for this child and parent is ready.');
    const scoreText = typeof analysis?.compatibilityScore === 'number'
      ? translate(params.t, 'share.harmonyScoreText', 'Compatibility {score}%', { score: analysis.compatibilityScore })
      : null;
    const title = translate(params.t, 'share.harmonyResultTitle', 'Custom parenting result');

    return {
      type,
      eyebrow: translate(params.t, 'share.harmonyReportEyebrow', 'Custom parenting'),
      headline: familyHeadline,
      label,
      description,
      image: '/gijilai_icon_kakao.png',
      title,
      textParts: compactTextParts([`${familyHeadline} "${label}"`, description, scoreText, analysis?.dailyReminder]),
      keywords: [],
      scores: null,
      notice: {
        prefix: translate(params.t, 'share.harmonyShareNotice', 'Share the custom parenting guide,'),
        bold: translate(params.t, 'share.harmonyShareNoticeBold', 'and align on the next parenting response'),
        suffix: translate(params.t, 'share.harmonyShareNoticeEnd', '.'),
      },
    };
  }

  const classified = scores ? TemperamentClassifier.analyzeChild(scores) : null;
  const label = analysis?.label
    || classified?.label
    || analysis?.title
    || translate(params.t, 'share.childFallbackLabel', 'Temperament result');
  const description = analysis?.desc
    || classified?.desc
    || analysis?.shareText
    || analysis?.intro
    || translate(params.t, 'share.defaultDesc', 'Has a curious and energetic explorer temperament.');
  const headline = isKo ? childNameTopic(params.childName) : params.childName;

  return {
    type,
    eyebrow: translate(params.t, 'share.childReportEyebrow', 'Child temperament'),
    headline,
    label,
    description,
    image: classified?.image || '/child_type/type_lhl.jpg',
    title: `${params.childName}${translate(params.t, 'share.resultTitle', "'s temperament results")}`,
    textParts: compactTextParts([
      `${headline} "${label}"`,
      description,
      analysis?.intro,
      analysis?.analysis?.strengths,
    ]),
    keywords: classified?.keywords ?? [],
    scores,
    notice: {
      prefix: translate(params.t, 'share.shareNotice', "Share your child's temperament results with friends,"),
      bold: translate(params.t, 'share.shareNoticeBold', "and talk about your child's temperament together"),
      suffix: translate(params.t, 'share.shareNoticeEnd', '.'),
    },
  };
}

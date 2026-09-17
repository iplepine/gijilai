import { POST } from './route';
import { createClient } from '@/lib/supabaseServer';
import { consumeLlmQuota } from '@/lib/llm-quota';
import { generateReport, openai } from '@/lib/openai';
import { createReportInputFingerprint, withReportInputFingerprint } from '@/lib/reportInputFingerprint';
import type { Json } from '@/types/supabase';

jest.mock('@/lib/supabaseServer', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/llm-quota', () => ({ consumeLlmQuota: jest.fn(), LLM_QUOTA_EXCEEDED_CODE: 'QUOTA_EXCEEDED' }));
jest.mock('@/lib/prompts', () => ({ CHILD_REPORT_STREAM_PROMPT: 'child-prompt', PARENT_REPORT_STREAM_PROMPT: 'parent-prompt' }));
jest.mock('@/lib/openai', () => ({
  formatSurveyAnswersForPrompt: jest.fn(() => 'answers'),
  generateReport: jest.fn(),
  openai: { chat: { completions: { create: jest.fn() } } },
}));
jest.mock('@/lib/perf', () => ({
  buildServerTimingHeader: jest.fn(() => ''),
  createPerfTracker: jest.fn(() => ({ mark: jest.fn(), fail: jest.fn(), getSegments: jest.fn(() => []) })),
}));

const scores = { NS: 60, HA: 40, RD: 80, P: 60 };
const answers = [{ questionId: '1', score: 3 }, { questionId: '3', score: 4 }];
const child = { name: '아이', gender: 'female', birth_date: '2021-06-13' };
const validReport = {
  intro: '소개',
  analysis: { dimensions: { NS: '자극', HA: '회피', RD: '관계', P: '인내' }, insight: '이해', strengths: '강점' },
  parentingTips: [{ situation: '상황', tips: ['팁'] }],
  scripts: [{ situation: '상황', script: '대화', guide: '안내' }],
};

function fingerprint(items = answers) {
  return createReportInputFingerprint({
    type: 'CHILD', model: 'gpt-4o-mini', prompt: 'child-prompt', language: 'ko', answers: items,
    context: {
      userName: '아이', scores,
      childInfo: { name: child.name, gender: child.gender, birthDate: child.birth_date, age: '5세 (63개월)' },
    },
  });
}

function mockClient(initialReport: Json) {
  let cachedReport = initialReport;
  const insertedReports: Array<Record<string, unknown>> = [];
  const deletedReports = jest.fn();
  const from = jest.fn((table: string) => {
    let operation = 'read';
    const query: Record<string, unknown> = {};
    const result = () => ({
      error: null,
      data: table === 'children' ? child
        : table === 'surveys' ? { id: 'survey-new' }
          : operation === 'insert' ? { id: 'report-new' }
            : [{ id: 'report-existing', analysis_json: cachedReport, created_at: '2026-09-17T00:00:00Z' }],
    });
    for (const method of ['select', 'eq', 'neq', 'order']) query[method] = jest.fn(() => query);
    query.insert = jest.fn((value: Record<string, unknown>) => {
      operation = 'insert';
      if (table === 'reports') {
        insertedReports.push(value);
        cachedReport = value.analysis_json as Json;
      }
      return query;
    });
    query.delete = jest.fn(() => {
      operation = 'delete';
      if (table === 'reports') deletedReports();
      return query;
    });
    for (const method of ['maybeSingle', 'single', 'limit']) query[method] = jest.fn(async () => result());
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return query;
  });
  (createClient as jest.Mock).mockResolvedValue({
    auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'user-1' } } } })) },
    from,
  });
  return { from, insertedReports, deletedReports };
}

async function requestReport(refresh: boolean, items = answers, assessmentPhase?: number) {
  const response = await POST(new Request('http://localhost/api/llm/report', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'CHILD', userName: '아이', scores, answers: items, childId: 'child-1', stream: true, refresh, assessmentPhase }),
  }));
  return response.text();
}

describe('explicit child assessment result refresh cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-17T03:00:00Z'));
    (consumeLlmQuota as jest.Mock).mockResolvedValue({ allowed: true });
    (openai.chat.completions.create as jest.Mock).mockImplementation(async function* () {
      const modules = [
        { module: 'intro', data: { intro: validReport.intro } },
        { module: 'dimensions', data: { dimensions: validReport.analysis.dimensions } },
        { module: 'insight', data: { insight: validReport.analysis.insight } },
        { module: 'strengths', data: { strengths: validReport.analysis.strengths } },
        { module: 'parentingTips', data: { parentingTips: validReport.parentingTips } },
        { module: 'scripts', data: { scripts: validReport.scripts } },
      ];
      yield { choices: [{ delta: { content: modules.map((module) => JSON.stringify(module)).join('\n') } }] };
    });
  });

  afterEach(() => jest.useRealTimers());

  it('reuses an identical result even on explicit refresh, before consuming quota', async () => {
    const db = mockClient(withReportInputFingerprint(validReport, fingerprint()));
    const response = await requestReport(true, [...answers].reverse());
    expect(response).toContain('"cached":true');
    expect(consumeLlmQuota).not.toHaveBeenCalled();
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
    expect(db.insertedReports).toHaveLength(0);
  });

  it('generates after additional phase answers and caches the new inputs for the next visit', async () => {
    const db = mockClient(withReportInputFingerprint(validReport, fingerprint()));
    const nextAnswers = [...answers, { questionId: '101', score: 5 }];
    expect(await requestReport(true, nextAnswers, 2)).toContain('"cached":false');
    expect(db.insertedReports).toHaveLength(1);
    expect(db.insertedReports[0].analysis_json).toMatchObject({ _generationCache: { inputHash: fingerprint(nextAnswers) } });
    expect(await requestReport(true, nextAnswers, 2)).toContain('"cached":true');
    expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(consumeLlmQuota).toHaveBeenCalledTimes(1);
    expect(db.deletedReports).not.toHaveBeenCalled();
  });

  it('keeps ordinary legacy report reads cached without fingerprint metadata', async () => {
    const db = mockClient(validReport);
    expect(await requestReport(false)).toContain('"cached":true');
    expect(consumeLlmQuota).not.toHaveBeenCalled();
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it('refreshes an unversioned old report once after an explicit result action', async () => {
    const db = mockClient(validReport);
    expect(await requestReport(true, answers, 1)).toContain('"cached":false');
    expect(await requestReport(true, answers, 1)).toContain('"cached":true');
    expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(db.deletedReports).not.toHaveBeenCalled();
  });

  it('preserves ordinary legacy refresh cleanup when no assessment phase is supplied', async () => {
    const db = mockClient(validReport);
    expect(await requestReport(true)).toContain('"cached":false');
    expect(db.deletedReports).toHaveBeenCalledTimes(1);
  });

  it('preserves prior reports when phased generation uses the JSON fallback', async () => {
    const db = mockClient(validReport);
    (openai.chat.completions.create as jest.Mock).mockRejectedValueOnce(new Error('stream unavailable'));
    (generateReport as jest.Mock).mockResolvedValueOnce(validReport);
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warningLog = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(await requestReport(true, answers, 1)).toContain('"fallback":true');
      expect(db.insertedReports).toHaveLength(1);
      expect(db.deletedReports).not.toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
      warningLog.mockRestore();
    }
  });

  it('rejects an invalid phase before any database write', async () => {
    const db = mockClient(validReport);
    expect(await requestReport(true, answers, 4)).toContain('Invalid child assessment phase');
    expect(db.insertedReports).toHaveLength(0);
    expect(db.deletedReports).not.toHaveBeenCalled();
    expect(consumeLlmQuota).not.toHaveBeenCalled();
  });
});

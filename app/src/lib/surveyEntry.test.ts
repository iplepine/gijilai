import { isSurveyRestoreExcludedPath, loadSurveyEntry, resolveSurveyEntry, resolveSurveyResponses } from './surveyEntry';
import type { ChildProfile, SurveyData } from './db';

const childA: Pick<ChildProfile, 'id' | 'name' | 'birth_date' | 'gender'> = {
  id: 'child-a', name: 'A', birth_date: '2021-01-01', gender: 'male',
};
const childB = { ...childA, id: 'child-b', name: 'B', birth_date: '2022-02-02', gender: 'female' as const };

function survey(overrides: Partial<SurveyData> = {}): SurveyData {
  return {
    id: 'survey-1', user_id: 'current-parent', child_id: 'child-a', type: 'CHILD',
    answers: { '1': 3 }, scores: null, step: 1, status: 'IN_PROGRESS',
    created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', ...overrides,
  };
}

describe('resolveSurveyEntry', () => {
  it('restores the selected child instead of another child with more local or DB answers', () => {
    const entry = resolveSurveyEntry({
      userId: 'current-parent', selectedChildId: 'child-b', children: [childA, childB],
      surveys: [
        survey({ answers: { '1': 1, '2': 1, '3': 1 } }),
        survey({ child_id: 'child-b', answers: { '101': 4 } }),
        survey({ child_id: 'child-b', type: 'PARENTING_STYLE', answers: { '41': 2 } }),
        survey({ child_id: 'child-a', type: 'PARENTING_STYLE', answers: { '41': 5 } }),
        survey({ child_id: null, type: 'PARENT', answers: { '21': 3 } }),
        survey({ child_id: null, type: 'PARENT', user_id: 'other-parent', answers: { '21': 5 } }),
      ],
    });
    expect(entry).toEqual({
      kind: 'survey', childId: 'child-b',
      intake: { childName: 'B', birthDate: '2022-02-02', gender: 'female' },
      responses: { cbqResponses: { '101': 4 }, atqResponses: { '21': 3 }, parentingResponses: { '41': 2 } },
    });
  });

  it('uses the newest matching snapshot even if an older one has more answers', () => {
    const responses = resolveSurveyResponses([
      survey({ answers: { '1': 1, '2': 2 }, updated_at: '2026-09-01T00:00:00Z' }),
      survey({ answers: { '1': 5 }, updated_at: '2026-09-02T00:00:00Z' }),
    ], 'current-parent', 'child-a');
    expect(responses.cbqResponses).toEqual({ '1': 5 });
  });

  it('supplies empty maps when the selected child has no survey, preventing local merges', () => {
    const entry = resolveSurveyEntry({
      userId: 'current-parent', selectedChildId: 'child-b', children: [childA, childB],
      surveys: [survey()],
    });
    expect(entry.kind).toBe('survey');
    if (entry.kind === 'survey') {
      expect(entry.responses).toEqual({ cbqResponses: {}, atqResponses: {}, parentingResponses: {} });
    }
  });

  it('does not restore another parent’s style or an unscoped child/style survey', () => {
    const responses = resolveSurveyResponses([
      survey({ child_id: null }),
      survey({ child_id: null, type: 'PARENTING_STYLE' }),
      survey({ type: 'PARENTING_STYLE', user_id: 'other-parent' }),
    ], 'current-parent', 'child-a');
    expect(responses).toEqual({ cbqResponses: {}, atqResponses: {}, parentingResponses: {} });
  });

  it('allows the accessible co-parent child snapshot but keeps adult answers scoped', () => {
    const responses = resolveSurveyResponses([
      survey({ user_id: 'co-parent' }),
      survey({ user_id: 'co-parent', type: 'PARENT', child_id: null }),
    ], 'current-parent', 'child-a');
    expect(responses).toEqual({ cbqResponses: { '1': 3 }, atqResponses: {}, parentingResponses: {} });
  });

  it('selects the first accessible child only when there is no explicit selection', () => {
    expect(resolveSurveyEntry({
      userId: 'current-parent', selectedChildId: null, children: [childB, childA], surveys: [],
    })).toMatchObject({ kind: 'survey', childId: 'child-b' });
  });

  it('blocks a stale or inaccessible selection rather than silently changing the child', () => {
    expect(resolveSurveyEntry({
      userId: 'current-parent', selectedChildId: 'inaccessible-child', children: [childA], surveys: [],
    })).toEqual({ kind: 'selection_unavailable' });
  });

  it('routes to intake when no accessible child exists', () => {
    expect(resolveSurveyEntry({
      userId: 'current-parent', selectedChildId: 'old-child', children: [], surveys: [survey()],
    })).toEqual({ kind: 'intake' });
  });

  it('restores only valid numeric answers and never keeps arbitrary stored text', () => {
    expect(resolveSurveyResponses([survey({
      answers: { '1': 3, '2': 'private-text', '3': 9, '4': 1.5, name: 4 },
    })], 'current-parent', 'child-a').cbqResponses).toEqual({ '1': 3 });
  });

  it('does not pick a child implicitly for background restoration', () => {
    expect(resolveSurveyResponses([survey()], 'current-parent', null).cbqResponses).toEqual({});
  });
});

describe('loadSurveyEntry', () => {
  it.each(['children', 'surveys'])('blocks entry if the %s read fails', async (failedRead) => {
    const source = {
      getChildren: jest.fn(async () => {
        if (failedRead === 'children') throw new Error('read failed');
        return [childA];
      }),
      getSurveys: jest.fn(async () => {
        if (failedRead === 'surveys') throw new Error('read failed');
        return [survey()];
      }),
    };
    expect(await loadSurveyEntry('current-parent', 'child-a', source)).toEqual({ kind: 'read_failed' });
  });

  it('reads both datasets under the current authenticated user', async () => {
    const source = {
      getChildren: jest.fn(async () => [childA]),
      getSurveys: jest.fn(async () => [survey()]),
    };
    expect(await loadSurveyEntry('current-parent', 'child-a', source)).toMatchObject({ kind: 'survey' });
    expect(source.getChildren).toHaveBeenCalledWith('current-parent');
    expect(source.getSurveys).toHaveBeenCalledWith('current-parent');
  });
});

describe('background restore boundaries', () => {
  it.each(['/survey', '/survey/intro', '/survey/parent', '/intake', '/report'])(
    'does not overwrite active entry or pending survey saves on %s', (pathname) => {
      expect(isSurveyRestoreExcludedPath(pathname)).toBe(true);
    },
  );

  it.each(['/', '/settings/profile', '/consult'])(
    'allows scoped background restoration on %s', (pathname) => {
      expect(isSurveyRestoreExcludedPath(pathname)).toBe(false);
    },
  );
});

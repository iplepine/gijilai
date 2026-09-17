import type { ChildProfile, SurveyData } from './db';
import type { IntakeFormData } from '@/types';

type SurveySnapshot = Pick<SurveyData, 'type' | 'user_id' | 'child_id' | 'answers' | 'updated_at' | 'created_at'>;
type ChildSnapshot = Pick<ChildProfile, 'id' | 'name' | 'birth_date' | 'gender'>;

/** These flows own their restoration or have fresh answers still being saved. */
export function isSurveyRestoreExcludedPath(pathname: string) {
  return pathname === '/intake' || pathname === '/survey' || pathname.startsWith('/survey/')
    || pathname === '/report' || pathname.startsWith('/report/');
}

function readAnswers(answers: SurveyData['answers']): Record<string, number> {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return {};
  return Object.fromEntries(Object.entries(answers).filter(([id, score]) => (
    /^\d+$/.test(id) && typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5
  ))) as Record<string, number>;
}

function latestAnswers(surveys: SurveySnapshot[], matches: (survey: SurveySnapshot) => boolean) {
  const newest = surveys.filter(matches).sort((a, b) => (
    (Date.parse(b.updated_at || b.created_at) || 0) - (Date.parse(a.updated_at || a.created_at) || 0)
    || (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)
  ))[0];
  return readAnswers(newest?.answers ?? null);
}

/** Every map is supplied, including empty maps: never merge another child's local answers. */
export function resolveSurveyResponses(surveys: SurveySnapshot[], userId: string, childId: string | null) {
  return {
    cbqResponses: childId ? latestAnswers(surveys, (survey) => (
      survey.type === 'CHILD' && survey.child_id === childId
    )) : {},
    atqResponses: latestAnswers(surveys, (survey) => (
      survey.type === 'PARENT' && survey.user_id === userId
    )),
    parentingResponses: childId ? latestAnswers(surveys, (survey) => (
      survey.type === 'PARENTING_STYLE' && survey.child_id === childId && survey.user_id === userId
    )) : {},
  };
}

type EntryInput = {
  userId: string;
  selectedChildId: string | null;
  children: ChildSnapshot[];
  surveys: SurveySnapshot[];
};

export function resolveSurveyEntry({ userId, selectedChildId, children, surveys }: EntryInput) {
  if (children.length === 0) return { kind: 'intake' } as const;
  // A stale or inaccessible explicit selection must not silently select another child.
  const child = selectedChildId ? children.find((item) => item.id === selectedChildId) : children[0];
  if (!child) return { kind: 'selection_unavailable' } as const;

  const intake: Pick<IntakeFormData, 'childName' | 'birthDate' | 'gender'> = {
    childName: child.name,
    birthDate: child.birth_date,
    gender: child.gender.toLowerCase() === 'female' ? 'female' : 'male',
  };
  return {
    kind: 'survey',
    childId: child.id,
    intake,
    responses: resolveSurveyResponses(surveys, userId, child.id),
  } as const;
}

/** Read failures remain failures; they must never look like an empty child list. */
export async function loadSurveyEntry(
  userId: string,
  selectedChildId: string | null,
  source: {
    getChildren: (userId: string) => Promise<ChildSnapshot[]>;
    getSurveys: (userId: string) => Promise<SurveySnapshot[]>;
  },
) {
  try {
    const [children, surveys] = await Promise.all([source.getChildren(userId), source.getSurveys(userId)]);
    return resolveSurveyEntry({ userId, selectedChildId, children, surveys });
  } catch {
    return { kind: 'read_failed' } as const;
  }
}

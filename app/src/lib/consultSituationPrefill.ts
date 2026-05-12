export const HOME_SOS_SITUATION_KEYS = [
  "morning_transition",
  "meltdown",
  "sleep",
  "parent_regret",
] as const;

export type HomeSosSituationKey = (typeof HOME_SOS_SITUATION_KEYS)[number];

type Translate = (key: string, params?: Record<string, string | number>) => string;

const HOME_SOS_PREFILL_TRANSLATION_KEYS: Record<HomeSosSituationKey, string> = {
  morning_transition: "consult.sosSituationMorning",
  meltdown: "consult.sosSituationMeltdown",
  sleep: "consult.sosSituationSleep",
  parent_regret: "consult.sosSituationParentRegret",
};

export function isHomeSosSituationKey(value: string | null): value is HomeSosSituationKey {
  return HOME_SOS_SITUATION_KEYS.includes(value as HomeSosSituationKey);
}

export function getHomeSosSituationPrefill(
  value: string | null,
  t: Translate,
): string | null {
  if (!isHomeSosSituationKey(value)) return null;
  return t(HOME_SOS_PREFILL_TRANSLATION_KEYS[value]);
}

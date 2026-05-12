import {
  getHomeSosSituationPrefill,
  isHomeSosSituationKey,
} from "./consultSituationPrefill";

const messages: Record<string, string> = {
  "consult.sosSituationMorning": "morning prefill",
  "consult.sosSituationMeltdown": "meltdown prefill",
  "consult.sosSituationSleep": "sleep prefill",
  "consult.sosSituationParentRegret": "parent regret prefill",
};

const t = (key: string) => messages[key] ?? key;

describe("consultSituationPrefill", () => {
  it("accepts only supported home SOS situation keys", () => {
    expect(isHomeSosSituationKey("morning_transition")).toBe(true);
    expect(isHomeSosSituationKey("meltdown")).toBe(true);
    expect(isHomeSosSituationKey("unknown")).toBe(false);
    expect(isHomeSosSituationKey(null)).toBe(false);
  });

  it("maps supported situation keys to localized prefill text", () => {
    expect(getHomeSosSituationPrefill("morning_transition", t)).toBe(
      "morning prefill",
    );
    expect(getHomeSosSituationPrefill("parent_regret", t)).toBe(
      "parent regret prefill",
    );
  });

  it("returns null for unsupported situation keys", () => {
    expect(getHomeSosSituationPrefill("unknown", t)).toBeNull();
    expect(getHomeSosSituationPrefill(null, t)).toBeNull();
  });
});

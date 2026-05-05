import {
  buildPracticeReminderPayload,
  buildPracticeReminderPlan,
  formatPracticeReminderTime,
  normalizePracticeReminderTime,
} from "./practiceReminder";

describe("formatPracticeReminderTime", () => {
  it("formats Korean reminder times deterministically", () => {
    expect(formatPracticeReminderTime("08:05", "ko")).toBe("오전 8:05");
    expect(formatPracticeReminderTime("20:30", "ko")).toBe("오후 8:30");
  });

  it("formats English reminder times deterministically", () => {
    expect(formatPracticeReminderTime("08:05", "en")).toBe("8:05 AM");
    expect(formatPracticeReminderTime("20:30", "en")).toBe("8:30 PM");
  });

  it("falls back to 8:00 PM for malformed times", () => {
    expect(formatPracticeReminderTime("bad-input", "en")).toBe("8:00 PM");
    expect(formatPracticeReminderTime("24:99", "ko")).toBe("오후 8:00");
  });
});

describe("normalizePracticeReminderTime", () => {
  it("normalizes valid times and falls back for invalid values", () => {
    expect(normalizePracticeReminderTime("8:5")).toBe("08:05");
    expect(normalizePracticeReminderTime("20:30")).toBe("20:30");
    expect(normalizePracticeReminderTime("24:30")).toBe("20:30");
    expect(normalizePracticeReminderTime("12:99")).toBe("12:00");
  });
});

describe("buildPracticeReminderPlan", () => {
  const preferences = {
    pushEnabled: true,
    practiceReminderEnabled: true,
    practiceReminderTime: "08:05",
  };

  it("preserves the user's reminder preference alongside active practice counts", () => {
    expect(
      buildPracticeReminderPlan({
        preferences,
        activePracticeCount: 2,
        pendingPracticeCount: 1,
      }),
    ).toEqual(
      expect.objectContaining({
        mode: "daily_practice_checkin",
        enabled: true,
        time: "08:05",
        activePracticeCount: 2,
        pendingPracticeCount: 1,
      }),
    );

    expect(
      buildPracticeReminderPlan({
        preferences,
        activePracticeCount: 0,
      }).enabled,
    ).toBe(true);
  });

  it("disables the plan when app notifications or practice reminders are off", () => {
    expect(
      buildPracticeReminderPlan({
        preferences: { ...preferences, pushEnabled: false },
        activePracticeCount: 2,
      }).enabled,
    ).toBe(false);

    expect(
      buildPracticeReminderPlan({
        preferences: { ...preferences, practiceReminderEnabled: false },
        activePracticeCount: 2,
      }).enabled,
    ).toBe(false);
  });

  it("builds a deep-link payload for the focused practice", () => {
    expect(buildPracticeReminderPayload("practice-1")).toBe(
      "/practices?source=practice_reminder&focusPracticeId=practice-1",
    );
  });
});

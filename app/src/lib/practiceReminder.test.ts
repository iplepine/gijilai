import { formatPracticeReminderTime } from "./practiceReminder";

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

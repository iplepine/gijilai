import {
  getPracticeQuickCheckInKey,
  normalizePracticeQuickCheckInPayload,
} from "./practiceQuickCheckIn";

describe("practiceQuickCheckIn", () => {
  it("normalizes a notification action payload", () => {
    expect(
      normalizePracticeQuickCheckInPayload({
        practiceId: " practice-1 ",
        done: true,
        memo: "  아이가 웃었어요  ",
        source: "notification_action",
        actionId: "practice_reminder_done",
        receivedAt: "2026-05-05T12:00:00.000Z",
      }),
    ).toEqual({
      practiceId: "practice-1",
      done: true,
      memo: "아이가 웃었어요",
      source: "notification_action",
      actionId: "practice_reminder_done",
      receivedAt: "2026-05-05T12:00:00.000Z",
    });
  });

  it("rejects incomplete payloads", () => {
    expect(normalizePracticeQuickCheckInPayload(null)).toBeNull();
    expect(normalizePracticeQuickCheckInPayload({ done: true })).toBeNull();
    expect(
      normalizePracticeQuickCheckInPayload({
        practiceId: "practice-1",
        done: "true",
      }),
    ).toBeNull();
  });

  it("builds stable duplicate detection keys", () => {
    expect(
      getPracticeQuickCheckInKey({
        practiceId: "practice-1",
        done: false,
        memo: "깜빡했어요",
        actionId: "practice_reminder_skip",
        receivedAt: "2026-05-05T12:00:00.000Z",
      }),
    ).toBe(
      "2026-05-05T12:00:00.000Z:practice_reminder_skip:practice-1:skipped:깜빡했어요",
    );
  });
});

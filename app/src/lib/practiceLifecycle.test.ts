import { getPracticeLifecycle } from "./practiceLifecycle";

const basePractice = {
  id: "practice-1",
  created_at: "2026-05-01T09:00:00.000Z",
  duration: 7,
};

describe("practiceLifecycle", () => {
  it("keeps an item active before the duration ends", () => {
    const lifecycle = getPracticeLifecycle(
      basePractice,
      [{ practice_id: "practice-1", date: "2026-05-03", done: true }],
      "2026-05-04",
    );

    expect(lifecycle.status).toBe("ACTIVE");
    expect(lifecycle.elapsedDays).toBe(4);
    expect(lifecycle.inactiveDays).toBe(1);
  });

  it("marks an item as needing reconnect after 3 inactive days", () => {
    const lifecycle = getPracticeLifecycle(
      basePractice,
      [{ practice_id: "practice-1", date: "2026-05-02", done: false }],
      "2026-05-05",
    );

    expect(lifecycle.status).toBe("NEEDS_RECONNECT");
    expect(lifecycle.inactiveDays).toBe(3);
  });

  it("marks an item due for review after the calendar duration", () => {
    const lifecycle = getPracticeLifecycle(
      basePractice,
      [{ practice_id: "practice-1", date: "2026-05-08", done: true }],
      "2026-05-08",
    );

    expect(lifecycle.status).toBe("DUE_FOR_REVIEW");
    expect(lifecycle.daysPastDuration).toBe(1);
    expect(lifecycle.canExtend).toBe(true);
  });

  it("marks an overdue item stale when there has also been no recent action", () => {
    const lifecycle = getPracticeLifecycle(
      basePractice,
      [{ practice_id: "practice-1", date: "2026-05-04", done: true }],
      "2026-05-08",
    );

    expect(lifecycle.status).toBe("STALE");
    expect(lifecycle.inactiveDays).toBe(4);
  });
});

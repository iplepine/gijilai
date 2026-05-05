import {
  checkCooldown,
  FREE_RETAKE_COOLDOWN_HOURS,
  SUBSCRIBER_RETAKE_COOLDOWN_HOURS,
} from './dateUtils';

describe('checkCooldown', () => {
  const now = '2026-05-05T12:00:00.000Z';

  it('allows retake when there is no previous report', () => {
    expect(checkCooldown(null, { now }).isAvailable).toBe(true);
  });

  it('blocks free users until 7 days have passed', () => {
    const status = checkCooldown('2026-04-28T13:00:00.000Z', { now });

    expect(status.isAvailable).toBe(false);
    expect(status.cooldownHours).toBe(FREE_RETAKE_COOLDOWN_HOURS);
    expect(status.remainingHours).toBe(1);
    expect(status.remainingDays).toBe(1);
  });

  it('allows free users after 7 days', () => {
    const status = checkCooldown('2026-04-28T12:00:00.000Z', { now });

    expect(status.isAvailable).toBe(true);
    expect(status.remainingHours).toBe(0);
  });

  it('blocks subscribers until 24 hours have passed', () => {
    const status = checkCooldown('2026-05-04T13:00:00.000Z', {
      hasSubscription: true,
      now,
    });

    expect(status.isAvailable).toBe(false);
    expect(status.cooldownHours).toBe(SUBSCRIBER_RETAKE_COOLDOWN_HOURS);
    expect(status.remainingHours).toBe(1);
  });

  it('allows subscribers after 24 hours', () => {
    const status = checkCooldown('2026-05-04T12:00:00.000Z', {
      hasSubscription: true,
      now,
    });

    expect(status.isAvailable).toBe(true);
  });
});

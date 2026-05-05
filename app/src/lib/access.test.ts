import {
  FREE_CHILD_PROFILE_LIMIT,
  getChildProfileAccess,
} from './access';

describe('getChildProfileAccess', () => {
  it('allows a free user to create the first lifetime child slot', () => {
    const access = getChildProfileAccess({
      hasSubscription: false,
      userCreatedAt: '2000-01-01T00:00:00.000Z',
      childCount: 0,
      lifetimeChildSlots: 0,
    });

    expect(access.freeChildProfileLimit).toBe(FREE_CHILD_PROFILE_LIMIT);
    expect(access.hasFullChildProfileAccess).toBe(false);
    expect(access.canCreateChild).toBe(true);
    expect(access.canDeleteChild).toBe(false);
  });

  it('blocks a free user after the lifetime child slot is used', () => {
    const access = getChildProfileAccess({
      hasSubscription: false,
      userCreatedAt: '2000-01-01T00:00:00.000Z',
      childCount: 0,
      lifetimeChildSlots: 1,
    });

    expect(access.canCreateChild).toBe(false);
  });

  it('blocks deletion when a free user only has one child left', () => {
    const access = getChildProfileAccess({
      hasSubscription: false,
      userCreatedAt: '2000-01-01T00:00:00.000Z',
      childCount: 1,
      lifetimeChildSlots: 1,
    });

    expect(access.canDeleteChild).toBe(false);
    expect(access.canDeleteLastChild).toBe(false);
  });

  it('allows a free user to delete extra children down to one', () => {
    const access = getChildProfileAccess({
      hasSubscription: false,
      userCreatedAt: '2000-01-01T00:00:00.000Z',
      childCount: 2,
      lifetimeChildSlots: 2,
    });

    expect(access.canDeleteChild).toBe(true);
    expect(access.canDeleteLastChild).toBe(false);
    expect(access.canCreateChild).toBe(false);
  });

  it('allows subscribers to create and delete multiple children', () => {
    const access = getChildProfileAccess({
      hasSubscription: true,
      userCreatedAt: '2000-01-01T00:00:00.000Z',
      childCount: 1,
      lifetimeChildSlots: 3,
    });

    expect(access.hasFullChildProfileAccess).toBe(true);
    expect(access.canCreateChild).toBe(true);
    expect(access.canDeleteChild).toBe(true);
    expect(access.canDeleteLastChild).toBe(true);
  });
});

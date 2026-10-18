import { getHarmonyAccess, recordHarmonyPurchase } from './harmonyAccess';

type Filters = Record<string, unknown>;
type Resolver = (table: string, filters: Filters) => unknown;

const CHILD_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = 'owner-user';
const CO_PARENT_ID = 'co-parent-user';

function createAdmin(resolve: Resolver) {
    const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
    const admin = {
        from(table: string) {
            const filters: Filters = {};
            const chain = {
                select: () => chain,
                eq: (column: string, value: unknown) => { filters[column] = value; return chain; },
                in: (column: string, value: unknown) => { filters[column] = value; return chain; },
                gte: () => chain,
                order: () => chain,
                limit: () => chain,
                contains: (column: string, value: unknown) => { filters[`${column}@>`] = value; return chain; },
                maybeSingle: async () => ({ data: resolve(table, filters) ?? null, error: null }),
                insert: async (row: Record<string, unknown>) => { inserts.push({ table, row }); return { error: null }; },
            };
            return chain;
        },
    };
    return { admin, inserts };
}

function world(options: {
    ownerSubscribed?: boolean;
    coParentAccepted?: boolean;
    purchased?: boolean;
    childExists?: boolean;
}): Resolver {
    return (table, filters) => {
        if (table === 'children') return options.childExists === false ? null : { parent_id: OWNER_ID };
        if (table === 'child_co_parents') {
            return options.coParentAccepted && filters.co_parent_id === CO_PARENT_ID ? { id: 'membership' } : null;
        }
        if (table === 'subscriptions') return options.ownerSubscribed && filters.user_id === OWNER_ID ? { id: 'sub' } : null;
        if (table === 'payments') {
            const match = filters['metadata@>'] as { childId?: string } | undefined;
            return options.purchased && match?.childId === CHILD_ID ? { id: 'payment' } : null;
        }
        return null;
    };
}

describe('getHarmonyAccess', () => {
    it('returns null when the child is missing or the user is not a caregiver', async () => {
        const missing = createAdmin(world({ childExists: false }));
        await expect(getHarmonyAccess(missing.admin, { userId: OWNER_ID, childId: CHILD_ID })).resolves.toBeNull();

        const stranger = createAdmin(world({}));
        await expect(getHarmonyAccess(stranger.admin, { userId: 'stranger', childId: CHILD_ID })).resolves.toBeNull();
    });

    it('stays locked for a caregiver with no subscription or purchase', async () => {
        const { admin } = createAdmin(world({}));
        await expect(getHarmonyAccess(admin, { userId: OWNER_ID, childId: CHILD_ID }))
            .resolves.toEqual({ unlocked: false, reason: null });
    });

    it("unlocks through the owner's subscription, also for an accepted co-parent", async () => {
        const { admin } = createAdmin(world({ ownerSubscribed: true, coParentAccepted: true }));
        await expect(getHarmonyAccess(admin, { userId: OWNER_ID, childId: CHILD_ID }))
            .resolves.toEqual({ unlocked: true, reason: 'subscription' });
        await expect(getHarmonyAccess(admin, { userId: CO_PARENT_ID, childId: CHILD_ID }))
            .resolves.toEqual({ unlocked: true, reason: 'subscription' });
    });

    it('unlocks for any caregiver once the child has a paid purchase', async () => {
        const { admin } = createAdmin(world({ purchased: true, coParentAccepted: true }));
        await expect(getHarmonyAccess(admin, { userId: CO_PARENT_ID, childId: CHILD_ID }))
            .resolves.toEqual({ unlocked: true, reason: 'purchase' });
    });
});

describe('recordHarmonyPurchase', () => {
    const purchase = {
        userId: OWNER_ID,
        childId: CHILD_ID,
        platform: 'APPLE_IAP' as const,
        transactionId: '2000000123',
        amount: 3900,
        currency: 'KRW',
    };

    it('records a one-time paid payment tagged with the child', async () => {
        const { admin, inserts } = createAdmin(() => null);
        await recordHarmonyPurchase(admin, purchase);
        expect(inserts).toHaveLength(1);
        expect(inserts[0].row).toMatchObject({
            user_id: OWNER_ID,
            type: 'ONE_TIME',
            status: 'PAID',
            portone_payment_id: 'iap_apple_iap_2000000123',
            amount: 3900,
            pg_provider: 'apple',
            metadata: { product: 'harmony_report', childId: CHILD_ID },
        });
    });

    it('does not record the same store transaction twice', async () => {
        const { admin, inserts } = createAdmin((table) => (table === 'payments' ? { id: 'existing' } : null));
        await recordHarmonyPurchase(admin, purchase);
        expect(inserts).toHaveLength(0);
    });
});

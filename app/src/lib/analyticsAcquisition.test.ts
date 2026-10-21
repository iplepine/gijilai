import { getAcquisitionSource, rememberAcquisitionSource } from './analytics';

describe('acquisition source', () => {
    afterEach(() => {
        Reflect.deleteProperty(globalThis, 'window');
    });

    it('remembers the entry source for the session', () => {
        const store = new Map<string, string>();
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {
                sessionStorage: {
                    getItem: (key: string) => store.get(key) ?? null,
                    setItem: (key: string, value: string) => { store.set(key, value); },
                },
            },
        });

        expect(getAcquisitionSource()).toBeUndefined();
        rememberAcquisitionSource('shared_report');
        expect(getAcquisitionSource()).toBe('shared_report');
    });

    it('fails quietly when storage is unavailable', () => {
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {
                get sessionStorage() { throw new Error('blocked'); },
            },
        });

        expect(() => rememberAcquisitionSource('co_parent_invite')).not.toThrow();
        expect(getAcquisitionSource()).toBeUndefined();
    });
});

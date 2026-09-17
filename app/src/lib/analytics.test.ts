type Analytics = typeof import('./analytics');

const originalMeasurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

function setBrowser(path = '/') {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: new URL(path, 'https://gijilai.com') },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      title: 'A private child name in a shared report',
      referrer: 'https://search.example/private-person?query=private-concern',
    },
  });
}

function commands() {
  return (window.dataLayer ?? []).map((command) => Array.from(command as IArguments));
}

describe('analytics', () => {
  let analytics: Analytics;

  beforeEach(async () => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = 'G-TEST';
    setBrowser();
    analytics = await import('./analytics');
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'document');
  });

  afterAll(() => {
    if (originalMeasurementId === undefined) {
      delete process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
    } else {
      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = originalMeasurementId;
    }
  });

  it('preserves the first page view and CTA before the remote Google script is ready', () => {
    analytics.setAnalyticsContext({ platform: 'web', auth_state: 'guest' });
    analytics.trackPageView('/');
    analytics.trackEvent('landing_cta_clicked', { placement: 'hero', target: 'preview' });

    expect(commands().filter(([command]) => command === 'config')).toEqual([
      ['config', 'G-TEST', expect.objectContaining({ send_page_view: false })],
    ]);
    expect(commands().filter(([command]) => command === 'event')).toEqual([
      ['event', 'page_view', expect.objectContaining({
        platform: 'web', auth_state: 'guest', page_path: '/',
      })],
      ['event', 'landing_cta_clicked', expect.objectContaining({
        placement: 'hero', target: 'preview', auth_state: 'guest',
      })],
    ]);
  });

  it('configures once, uses set for auth changes, and explicitly clears user ID on logout', () => {
    analytics.setAnalyticsUser(null);
    analytics.setAnalyticsUser('account-id');
    analytics.setAnalyticsUser(null);
    analytics.trackPageView('/');

    expect(commands().filter(([command]) => command === 'config')).toHaveLength(1);
    expect(commands().filter(([command]) => command === 'js')).toHaveLength(1);
    expect(commands().filter(([command, value]) => command === 'set' && 'user_id' in value)).toEqual([
      ['set', { user_id: null }],
      ['set', { user_id: 'account-id' }],
      ['set', { user_id: null }],
    ]);
    expect(commands().filter(([command, name]) => command === 'event' && name === 'page_view')).toHaveLength(1);
  });

  it('preserves an existing gtag function instead of replacing its command handling', () => {
    const tag = jest.fn();
    window.gtag = tag;
    analytics.trackEvent('preview_viewed', { scenario: 'transition' });
    analytics.trackEvent('preview_signup_clicked', { scenario: 'transition' });

    expect(window.gtag).toBe(tag);
    expect(tag.mock.calls.filter(([command]) => command === 'config')).toHaveLength(1);
    expect(tag.mock.calls.filter(([command]) => command === 'event')).toHaveLength(2);
  });

  it('keeps queued user properties and purchase revenue while removing undefined values', () => {
    analytics.setAnalyticsUserProperties({ plan: 'FREE', child_count: 1, signup_cohort: undefined });
    analytics.trackPurchase({ value: 12000, transactionId: 'transaction-1', source: 'pricing', unused: undefined });

    expect(commands()).toContainEqual(['set', 'user_properties', { plan: 'FREE', child_count: 1 }]);
    expect(commands()).toContainEqual(['event', 'purchase', expect.objectContaining({
      value: 12000, currency: 'KRW', transaction_id: 'transaction-1', source: 'pricing',
    })]);
    expect(commands().find(([, name]) => name === 'purchase')?.[2]).not.toHaveProperty('unused');
  });

  it('redacts private route tokens, query text, fragments, page titles and referrer details', () => {
    setBrowser('/shared/secret-share-token?prefill=private-concern&ref=private-ref#private-fragment');
    analytics.trackPageView(window.location.href);
    analytics.trackEvent('share_action_completed', { page_location: 'private-location-override' });

    const serialized = JSON.stringify(commands());
    for (const privateValue of ['secret-share-token', 'private-concern', 'private-ref',
      'private-fragment', 'private-person', 'private child name', 'private-location-override']) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(commands()).toContainEqual(['event', 'page_view', expect.objectContaining({
      page_path: '/shared/[token]',
      page_location: 'https://gijilai.com/shared/[token]',
      page_title: '기질아이',
      page_referrer: 'https://search.example',
    })]);
  });

  it.each([
    ['/invite/private-token?email=private-email', '/invite/[token]'],
    ['/consultations/private-id', '/consultations/[id]'],
    ['/settings/child/private-id', '/settings/child/[id]'],
    ['/settings/child/new', '/settings/child/new'],
    ['/unknown/private-person?name=private-name', '/other'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(analytics.sanitizeAnalyticsPath(input)).toBe(expected);
  });

  it('keeps only bounded acquisition and preview parameters', () => {
    expect(analytics.sanitizeAnalyticsPath(
      '/preview?scenario=tantrum&source=landing&utm_source=kakao&utm_medium=share&utm_campaign=private-text&ref=secret',
    )).toBe('/preview?source=landing&scenario=tantrum&utm_source=kakao&utm_medium=share');
    expect(analytics.sanitizeAnalyticsPath(
      '/preview?scenario=private-text&source=private-text&utm_source=private-text',
    )).toBe('/preview');
  });

  it('updates sanitized page defaults for navigation without configuring again', () => {
    analytics.trackPageView('/');
    analytics.trackPageView('/preview?scenario=transition&prefill=private-text');
    expect(commands().filter(([command]) => command === 'config')).toHaveLength(1);
    expect(commands()).toContainEqual(['set', expect.objectContaining({
      page_path: '/preview?scenario=transition',
      page_location: 'https://gijilai.com/preview?scenario=transition',
    })]);
  });

  it('does nothing without a measurement ID', async () => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
    const disabled = await import('./analytics');
    disabled.trackPageView('/');
    disabled.trackEvent('landing_cta_clicked');
    disabled.setAnalyticsUser('account-id');
    disabled.setAnalyticsUserProperties({ plan: 'FREE' });
    expect(disabled.isAnalyticsEnabled()).toBe(false);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });

  it('does nothing during server rendering', () => {
    Reflect.deleteProperty(globalThis, 'window');
    expect(() => {
      analytics.trackPageView('/');
      analytics.trackEvent('preview_viewed');
      analytics.setAnalyticsUser(null);
      analytics.setAnalyticsUserProperties({ plan: 'FREE' });
    }).not.toThrow();
  });
});

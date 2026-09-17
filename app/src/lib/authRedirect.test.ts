import { getAuthCallbackUrl, getSafeAuthRedirect } from './authRedirect';

describe('authentication return destinations', () => {
  it.each([
    '/survey?flow=quick',
    '/consult?source=preview&topic=tantrum',
    '/co-parent/invite/example#accept',
    '/report?tab=child&child_only=true',
  ])('preserves the intended app destination %s', (destination) => {
    expect(getSafeAuthRedirect(destination)).toBe(destination);
    const callback = new URL(getAuthCallbackUrl('https://gijilai.com', destination));
    expect(callback.origin + callback.pathname).toBe('https://gijilai.com/auth/callback');
    expect(callback.searchParams.get('next')).toBe(destination);
  });

  it.each([
    null,
    undefined,
    '',
    'https://example.com',
    'javascript:alert(1)',
    '//example.com',
    '/\\example.com',
    '/%5cexample.com',
    '/%2fexample.com',
    '/%252fexample.com',
    '/survey\n',
    '/%0d%0asurvey',
    '/bad%encoding',
    '/login',
    '/login?redirect=/survey',
    '/auth/callback?next=/survey',
    '/auth/auth-code-error',
    '/%61uth/callback',
    '/survey/../login',
    '/survey/%2e%2e/auth/callback',
    '/survey/%252e%252e/login',
  ])('falls back to home for unsafe or looping destination %s', (destination) => {
    expect(getSafeAuthRedirect(destination)).toBe('/');
  });

  it('allows similarly named non-authentication pages', () => {
    expect(getSafeAuthRedirect('/author')).toBe('/author');
    expect(getSafeAuthRedirect('/login-help')).toBe('/login-help');
  });

  it('normalizes dot segments before returning an internal path', () => {
    expect(getSafeAuthRedirect('/survey/../consult?source=preview')).toBe('/consult?source=preview');
  });

  it('keeps the existing native callback scheme', () => {
    expect(getAuthCallbackUrl('https://gijilai.com', '/survey?flow=quick', true))
      .toBe('gijilai://auth/callback');
  });

  it('keeps preview/local origins for web callbacks', () => {
    expect(getAuthCallbackUrl('http://localhost:3000', '/survey'))
      .toBe('http://localhost:3000/auth/callback?next=%2Fsurvey');
  });
});

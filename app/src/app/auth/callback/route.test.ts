import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { getAuthCallbackUrl } from '@/lib/authRedirect';
import { GET } from './route';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));

const mockCreateServerClient = createServerClient as jest.Mock;
const exchangeCodeForSession = jest.fn();
const getSession = jest.fn();

function callbackRequest(destination: string | null, code: string | null = 'test-code') {
  const url = new URL(getAuthCallbackUrl('https://gijilai.com', destination));
  if (code) url.searchParams.set('code', code);
  return new NextRequest(url);
}

describe('authentication callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://gijilai.com';
    exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null });
    getSession.mockResolvedValue({ data: { session: null } });
    mockCreateServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        exchangeCodeForSession: async (code: string) => {
          const result = await exchangeCodeForSession(code);
          if (result.data?.session) {
            options.cookies.setAll([{ name: 'test-session', value: 'synthetic-cookie', options: { httpOnly: true } }]);
          }
          return result;
        },
        getSession,
      },
    }));
  });

  it('returns OAuth users to their original destination with the session cookie', async () => {
    const response = await GET(callbackRequest('/consult?source=preview&topic=tantrum'));
    expect(response.headers.get('location')).toBe('https://gijilai.com/consult?source=preview&topic=tantrum');
    expect(response.cookies.get('test-session')?.value).toBe('synthetic-cookie');
    expect(exchangeCodeForSession).toHaveBeenCalledWith('test-code');
  });

  it('also accepts verification callback codes with the same destination contract', async () => {
    const response = await GET(callbackRequest('/survey?flow=quick', 'verification-code'));
    expect(response.headers.get('location')).toBe('https://gijilai.com/survey?flow=quick');
    expect(exchangeCodeForSession).toHaveBeenCalledWith('verification-code');
  });

  it.each(['https://example.com', '//example.com', '/\\example.com', '/login?redirect=/survey', '/auth/callback'])
    ('validates direct callback next=%s independently of the login page', async (destination) => {
      const url = new URL('https://gijilai.com/auth/callback?code=test-code');
      url.searchParams.set('next', destination);
      const response = await GET(new NextRequest(url));
      expect(response.headers.get('location')).toBe('https://gijilai.com/');
    });

  it('preserves the destination when an existing session handles a repeated callback', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } });
    const response = await GET(callbackRequest('/report?child_only=true', null));
    expect(response.headers.get('location')).toBe('https://gijilai.com/report?child_only=true');
  });

  it('encodes provider error details without injecting extra query parameters', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const url = new URL('https://gijilai.com/auth/callback');
      url.searchParams.set('error', 'access_denied');
      url.searchParams.set('error_description', 'Cancelled & retry=1');
      const response = await GET(new NextRequest(url));
      const destination = new URL(response.headers.get('location')!);
      expect(destination.pathname).toBe('/auth/auth-code-error');
      expect(destination.searchParams.get('description')).toBe('Cancelled & retry=1');
      expect(destination.searchParams.has('retry')).toBe(false);
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});

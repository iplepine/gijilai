import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

type NativeSessionBody = {
  provider?: 'kakao' | 'google' | 'apple';
  idToken?: string;
  accessToken?: string;
  nonce?: string;
};

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  let body: NativeSessionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.provider || !body.idToken) {
    return NextResponse.json({ error: 'Missing native auth token' }, { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: body.provider,
    token: body.idToken,
    access_token: body.accessToken,
    nonce: body.nonce,
  });

  if (error || !data.session) {
    console.warn('[auth/native-session] signInWithIdToken failed', {
      provider: body.provider,
      error: error?.message ?? 'Native auth returned no session',
      code: error && 'code' in error ? error.code : undefined,
      status: error && 'status' in error ? error.status : undefined,
    });

    return NextResponse.json(
      { error: error?.message ?? 'Native auth failed' },
      { status: 401 },
    );
  }

  return response;
}

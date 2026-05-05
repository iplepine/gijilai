import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

type NativeEmailSessionBody = {
  mode?: 'login' | 'signup';
  email?: string;
  password?: string;
};

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizePassword(value: unknown) {
  return typeof value === 'string' ? value : '';
}

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

  let body: NativeEmailSessionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const mode = body.mode === 'signup' ? 'signup' : 'login';
  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Missing email or password' },
      { status: 400 },
    );
  }

  if (mode === 'signup') {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.session) {
      return NextResponse.json(
        { error: '이메일 확인 후 로그인해 주세요.' },
        { status: 409 },
      );
    }

    return response;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message ?? 'Email login failed' },
      { status: 401 },
    );
  }

  return response;
}

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

type NativeEmailBody = {
  mode?: 'login' | 'signup';
  email?: string;
  password?: string;
};

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function buildResponse(body: Record<string, unknown>, cookiesToSet: CookieToSet[]) {
  const response = NextResponse.json(body);
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

export async function POST(request: NextRequest) {
  const cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(nextCookies) {
          cookiesToSet.push(...nextCookies);
          nextCookies.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
        },
      },
    },
  );

  let body: NativeEmailBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const mode = body.mode === 'signup' ? 'signup' : 'login';
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email credentials' }, { status: 400 });
  }

  if (mode === 'signup') {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 400 });
    }

    return buildResponse(
      {
        success: true,
        sessionCreated: Boolean(data.session),
      },
      cookiesToSet,
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message ?? 'Email sign in failed' },
      { status: error?.status ?? 401 },
    );
  }

  return buildResponse(
    {
      success: true,
      sessionCreated: true,
    },
    cookiesToSet,
  );
}

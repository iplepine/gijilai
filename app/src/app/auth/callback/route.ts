import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // request.url의 origin은 서버리스 환경에서 localhost로 잡힐 수 있으므로
    // 요청 헤더의 실제 호스트 정보를 사용
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
    const host = forwardedHost ?? request.headers.get('host') ?? 'localhost:3000'
    const origin = `${forwardedProto}://${host}`

    if (errorParam) {
        console.error('Auth callback error parameter:', errorParam, errorDescription)
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${errorParam}&description=${errorDescription}`)
    }

    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value },
                set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
                remove(name: string, options: CookieOptions) { cookieStore.delete({ name, ...options }) },
            },
        }
    )

    if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.session) {
            return NextResponse.redirect(`${origin}${next}`)
        }

        if (error) {
            console.error('Supabase exchange error:', error.message, error.status)
            // Fallback: If code exchange failed but session already exists, just redirect
            const { data: { session } } = await supabase.auth.getSession()
            if (session) return NextResponse.redirect(`${origin}${next}`)

            return NextResponse.redirect(`${origin}/auth/auth-code-error?error=exchange_error&message=${encodeURIComponent(error.message)}`)
        }
    } else {
        // No code found - check if we are already logged in before erroring
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            return NextResponse.redirect(`${origin}${next}`)
        }
        console.warn('No code or session found in auth callback')
    }

    // Still no session after exchange or no code, go to error page
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_code`)
}

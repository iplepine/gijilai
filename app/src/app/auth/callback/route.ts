import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (errorParam) {
        console.error('Auth callback error parameter:', errorParam, errorDescription)
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${errorParam}&description=${errorDescription}`)
    }

    let response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.session) {
            return response
        }

        if (error) {
            console.error('Supabase exchange error:', error.message, error.status)
            // Fallback: If code exchange failed but session already exists, just redirect
            const { data: { session } } = await supabase.auth.getSession()
            if (session) return response

            return NextResponse.redirect(`${origin}/auth/auth-code-error?error=exchange_error&message=${encodeURIComponent(error.message)}`)
        }
    } else {
        // No code found - check if we are already logged in before erroring
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            return response
        }
        console.warn('No code or session found in auth callback')
    }

    // Still no session after exchange or no code, go to error page
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_code`)
}

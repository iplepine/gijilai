import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, parseJsonBody } from '@/lib/api';
import { createClient } from '@/lib/supabaseServer';

type MarketingPreferenceRequest = {
  marketing_opt_in?: unknown;
};

type MarketingPreferenceRow = {
  marketing_opt_in: boolean | null;
};

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function marketingPreferenceResponse(marketingOptIn: boolean | null | undefined) {
  return NextResponse.json({ marketing_opt_in: marketingOptIn ?? false });
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('profiles')
      .select('marketing_opt_in')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load marketing preference:', error.message);
      return NextResponse.json(
        { error: 'MARKETING_PREFERENCE_LOAD_FAILED' },
        { status: 500 },
      );
    }

    return marketingPreferenceResponse(
      (data as MarketingPreferenceRow | null)?.marketing_opt_in,
    );
  } catch (error) {
    console.error('Marketing preference load error:', error);
    return NextResponse.json(
      { error: 'MARKETING_PREFERENCE_LOAD_FAILED' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseJsonBody<MarketingPreferenceRequest>(request);
    if (typeof body.marketing_opt_in !== 'boolean') {
      return NextResponse.json(
        { error: 'INVALID_MARKETING_PREFERENCE' },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          marketing_opt_in: body.marketing_opt_in,
        },
        { onConflict: 'id' },
      )
      .select('marketing_opt_in')
      .single();

    if (error) {
      console.error('Failed to update marketing preference:', error.message);
      return NextResponse.json(
        { error: 'MARKETING_PREFERENCE_UPDATE_FAILED' },
        { status: 500 },
      );
    }

    return marketingPreferenceResponse(
      (data as MarketingPreferenceRow).marketing_opt_in,
    );
  } catch (error) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    console.error('Marketing preference update error:', error);
    return NextResponse.json(
      { error: 'MARKETING_PREFERENCE_UPDATE_FAILED' },
      { status: 500 },
    );
  }
}

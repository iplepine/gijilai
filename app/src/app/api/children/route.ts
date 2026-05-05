import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, isNonEmptyString, parseJsonBody } from '@/lib/api';
import {
  CHILD_PROFILE_LIMIT_REACHED_CODE,
  getServerChildProfileAccess,
  type ChildProfileAccess,
} from '@/lib/access';
import { createClient } from '@/lib/supabaseServer';

type ChildCreateRequest = {
  name?: unknown;
  gender?: unknown;
  birthDate?: unknown;
  birthTime?: unknown;
  imageUrl?: unknown;
};

type ChildCreatePayload = {
  name: string;
  gender: 'male' | 'female';
  birthDate: string;
  birthTime: string | null;
  imageUrl: string | null;
};

function toChildCreatePayload(body: ChildCreateRequest): ChildCreatePayload | null {
  const name = isNonEmptyString(body.name) ? body.name.trim() : null;
  const rawGender = isNonEmptyString(body.gender) ? body.gender.trim().toLowerCase() : null;
  const gender = rawGender === 'male' || rawGender === 'female' ? rawGender : null;
  const birthDate = isNonEmptyString(body.birthDate) ? body.birthDate.trim() : null;
  const birthTime = isNonEmptyString(body.birthTime) ? body.birthTime.trim() : null;
  const imageUrl = isNonEmptyString(body.imageUrl) ? body.imageUrl.trim() : null;

  if (!name || !gender || !birthDate) return null;

  return {
    name,
    gender,
    birthDate,
    birthTime,
    imageUrl,
  };
}

function childAccessResponse(access: ChildProfileAccess) {
  return {
    access: {
      hasSubscription: access.hasSubscription,
      hasFullChildProfileAccess: access.hasFullChildProfileAccess,
      freeChildProfileLimit: access.freeChildProfileLimit,
      childCount: access.childCount,
      lifetimeChildSlots: access.lifetimeChildSlots,
      canCreateChild: access.canCreateChild,
      canDeleteChild: access.canDeleteChild,
      canDeleteLastChild: access.canDeleteLastChild,
    },
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await getServerChildProfileAccess(supabase, {
      userId: user.id,
      userCreatedAt: user.created_at,
    });

    return NextResponse.json(childAccessResponse(access));
  } catch (error) {
    console.error('[Children API] Access lookup error:', error);
    return NextResponse.json({ error: 'Failed to load child profile access' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseJsonBody<ChildCreateRequest>(request);
    const payload = toChildCreatePayload(body);

    if (!payload) {
      return NextResponse.json({ error: 'INVALID_CHILD_PAYLOAD' }, { status: 400 });
    }

    const access = await getServerChildProfileAccess(supabase, {
      userId: user.id,
      userCreatedAt: user.created_at,
    });

    if (!access.canCreateChild) {
      return NextResponse.json(
        {
          code: CHILD_PROFILE_LIMIT_REACHED_CODE,
          error: CHILD_PROFILE_LIMIT_REACHED_CODE,
        },
        { status: 403 }
      );
    }

    const { data: child, error } = await supabase
      .from('children')
      .insert({
        parent_id: user.id,
        name: payload.name,
        gender: payload.gender,
        birth_date: payload.birthDate,
        birth_time: payload.birthTime,
        image_url: payload.imageUrl,
      })
      .select('id, parent_id, name, gender, birth_date, birth_time, image_url, created_at')
      .single();

    if (error) {
      console.error('[Children API] Child insert error:', error);
      if (error.message?.includes(CHILD_PROFILE_LIMIT_REACHED_CODE)) {
        return NextResponse.json(
          {
            code: CHILD_PROFILE_LIMIT_REACHED_CODE,
            error: CHILD_PROFILE_LIMIT_REACHED_CODE,
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'CHILD_CREATE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ child });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    console.error('[Children API] Create error:', error);
    return NextResponse.json({ error: 'CHILD_CREATE_FAILED' }, { status: 500 });
  }
}

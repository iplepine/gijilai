import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabaseServer';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE() {
  try {
    // 현재 로그인한 사용자 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const userId = user.id;

    // CASCADE가 설정되지 않은 테이블 데이터를 먼저 삭제 (service_role로 RLS 우회)
    // observations 테이블은 마이그레이션에 ON DELETE CASCADE가 누락되어 수동 삭제 필요
    const { error: obsError } = await admin
      .from('observations')
      .delete()
      .eq('user_id', userId);

    if (obsError) {
      console.error('Failed to delete observations:', obsError.message);
      return NextResponse.json({ error: '회원 탈퇴 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    // service_role로 auth.users 삭제 → CASCADE로 profiles 및 모든 하위 데이터 자동 삭제
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError.message);
      return NextResponse.json({ error: '회원 탈퇴 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

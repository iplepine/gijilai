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

    // observations는 마이그레이션 008에서 ON DELETE CASCADE가 추가됐지만,
    // 008 미적용 환경에서도 탈퇴가 완전하도록 방어적으로 먼저 삭제한다 (service_role로 RLS 우회).
    // 삭제 실패 시 auth 유저 삭제로 진행하지 않고 500으로 중단해 데이터 잔존을 막는다.
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

import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient(request);
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 사용자의 즐겨찾기 목록 조회
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select(`
        id,
        store_id,
        created_at,
        stores (
          id,
          name,
          address,
          naver_rating,
          kakao_rating,
          image_urls,
          position_lat,
          position_lng
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('즐겨찾기 DB 조회 오류:', error);
      return NextResponse.json(
        { error: '즐겨찾기 목록을 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: favorites
    });

  } catch (error) {
    console.error('즐겨찾기 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient(request);
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { store_id } = await request.json();

    if (!store_id) {
      return NextResponse.json(
        { error: '가게 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 이미 즐겨찾기에 있는지 확인
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('store_id', store_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: '이미 즐겨찾기에 추가된 가게입니다.' },
        { status: 409 }
      );
    }

    // 즐겨찾기 추가
    const { data, error } = await supabase
      .from('favorites')
      .insert([
        {
          user_id: user.id,
          store_id: store_id
        }
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: '즐겨찾기 추가에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('즐겨찾기 추가 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient(request);
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const store_id = searchParams.get('store_id');

    if (!store_id) {
      return NextResponse.json(
        { error: '가게 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 즐겨찾기 제거
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('store_id', parseInt(store_id));

    if (error) {
      return NextResponse.json(
        { error: '즐겨찾기 제거에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '즐겨찾기에서 제거되었습니다.'
    });

  } catch (error) {
    console.error('즐겨찾기 제거 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
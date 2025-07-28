import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reviewId = parseInt(id);

  if (isNaN(reviewId)) {
    return NextResponse.json(
      { error: "올바르지 않은 리뷰 ID입니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = createRouteHandlerSupabaseClient(request);

    // 현재 로그인한 사용자 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const userId = user.id;

    // 리뷰 존재 확인
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("id")
      .eq("id", reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: "리뷰를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // 이미 좋아요를 눌렀는지 확인
    const { data: existingLike, error: checkError } = await supabase
      .from("review_likes")
      .select("id")
      .eq("user_id", userId)
      .eq("review_id", reviewId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existingLike) {
      // 좋아요 취소
      const { error: deleteError } = await supabase
        .from("review_likes")
        .delete()
        .eq("id", existingLike.id);

      if (deleteError) {
        throw deleteError;
      }

      return NextResponse.json({ message: "좋아요가 취소되었습니다.", liked: false });
    } else {
      // 좋아요 추가
      const { error: insertError } = await supabase
        .from("review_likes")
        .insert({
          user_id: userId,
          review_id: reviewId,
        });

      if (insertError) {
        throw insertError;
      }

      return NextResponse.json({ message: "좋아요가 추가되었습니다.", liked: true });
    }
  } catch (error) {
    console.error("리뷰 좋아요 오류:", error);
    return NextResponse.json(
      { error: "좋아요 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reviewId = parseInt(id);

  if (isNaN(reviewId)) {
    return NextResponse.json(
      { error: "올바르지 않은 리뷰 ID입니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = createRouteHandlerSupabaseClient(request);

    // 좋아요 수 조회
    const { count, error } = await supabase
      .from("review_likes")
      .select("*", { count: "exact", head: true })
      .eq("review_id", reviewId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ likeCount: count || 0 });
  } catch (error) {
    console.error("좋아요 수 조회 오류:", error);
    return NextResponse.json(
      { error: "좋아요 수 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
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
    const { reason, description } = await request.json();

    // 신고 사유 유효성 검사
    const validReasons = [
      "spam", 
      "inappropriate", 
      "harassment", 
      "fake", 
      "offensive", 
      "other",
    ];

    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json(
        { error: "올바른 신고 사유를 선택해주세요." },
        { status: 400 },
      );
    }

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

    // 이미 신고했는지 확인
    const { data: existingReport, error: checkError } = await supabase
      .from("review_reports")
      .select("id")
      .eq("user_id", userId)
      .eq("review_id", reviewId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existingReport) {
      return NextResponse.json(
        { error: "이미 신고한 리뷰입니다." },
        { status: 409 },
      );
    }

    // 신고 추가
    const { error: insertError } = await supabase
      .from("review_reports")
      .insert({
        user_id: userId,
        review_id: reviewId,
        reason,
        description: description || null,
      });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ 
      message: "신고가 접수되었습니다. 검토 후 조치하겠습니다.", 
    });
  } catch (error) {
    console.error("리뷰 신고 오류:", error);
    return NextResponse.json(
      { error: "신고 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
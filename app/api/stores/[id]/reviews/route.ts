import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const storeId = parseInt(params.id);

  if (isNaN(storeId)) {
    return NextResponse.json(
      { error: "올바르지 않은 가게 ID입니다." },
      { status: 400 }
    );
  }

  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // 현재 로그인한 사용자 확인
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 가게 존재 확인
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: "해당 가게를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { rating, content } = await request.json();

    // 유효성 검사
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "평점은 1에서 5 사이의 값이어야 합니다." },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "리뷰 내용을 입력해주세요." },
        { status: 400 }
      );
    }

    // 이미 리뷰를 작성했는지 확인
    const { data: existingReview, error: checkError } = await supabase
      .from("reviews")
      .select("id")
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    let reviewResponse;

    if (existingReview) {
      // 기존 리뷰 업데이트
      const { data, error } = await supabase
        .from("reviews")
        .update({
          rating,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingReview.id)
        .select(
          `
          *,
          profiles:profiles(username)
        `
        )
        .single();

      if (error) {
        throw error;
      }

      reviewResponse = {
        message: "리뷰가 업데이트되었습니다.",
        review: {
          id: data.id,
          rating: data.rating,
          content: data.content,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          user: {
            id: data.user_id,
            username: data.profiles.username,
          },
        },
      };
    } else {
      // 새 리뷰 생성
      const { data, error } = await supabase
        .from("reviews")
        .insert({
          user_id: userId,
          store_id: storeId,
          rating,
          content,
        })
        .select(
          `
          *,
          profiles:profiles(username)
        `
        )
        .single();

      if (error) {
        throw error;
      }

      reviewResponse = {
        message: "리뷰가 등록되었습니다.",
        review: {
          id: data.id,
          rating: data.rating,
          content: data.content,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          user: {
            id: data.user_id,
            username: data.profiles.username,
          },
        },
      };
    }

    return NextResponse.json(reviewResponse);
  } catch (error) {
    console.error("리뷰 작성 오류:", error);
    return NextResponse.json(
      { error: "리뷰 등록 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const storeId = parseInt(params.id);
  const reviewId = parseInt(request.nextUrl.searchParams.get("reviewId") || "");

  if (isNaN(storeId) || isNaN(reviewId)) {
    return NextResponse.json(
      { error: "올바르지 않은 요청입니다." },
      { status: 400 }
    );
  }

  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    // 본인 리뷰인지 확인
    const { data: review, error } = await supabase
      .from("reviews")
      .select("user_id")
      .eq("id", reviewId)
      .eq("store_id", storeId)
      .single();
    if (error || !review) {
      return NextResponse.json(
        { error: "리뷰를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    if (review.user_id !== userId) {
      return NextResponse.json(
        { error: "본인 리뷰만 삭제할 수 있습니다." },
        { status: 403 }
      );
    }

    // 삭제
    const { error: deleteError } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId)
      .eq("user_id", userId)
      .eq("store_id", storeId);
    if (deleteError) {
      throw deleteError;
    }
    return NextResponse.json({ message: "리뷰가 삭제되었습니다." });
  } catch (error) {
    console.error("리뷰 삭제 오류:", error);
    return NextResponse.json(
      { error: "리뷰 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

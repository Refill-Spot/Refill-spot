import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

    // URL 파라미터 추출
    const url = new URL(request.url);
    const sortBy = url.searchParams.get("sortBy") || "created_at"; // created_at, rating
    const sortOrder = url.searchParams.get("sortOrder") || "desc"; // asc, desc
    const ratingFilter = url.searchParams.get("rating"); // 1-5
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // 기본 쿼리 구성
    let query = supabase
      .from("reviews")
      .select(
        `
        *,
        stores:stores!inner(
          id,
          name,
          address,
          image_urls
        )
      `,
      )
      .eq("user_id", userId);

    // 평점 필터 적용
    if (ratingFilter && !isNaN(parseInt(ratingFilter))) {
      query = query.eq("rating", parseInt(ratingFilter));
    }

    // 정렬 적용
    const validSortColumns = ["created_at", "updated_at", "rating"];
    const validSortOrders = ["asc", "desc"];
    
    if (validSortColumns.includes(sortBy) && validSortOrders.includes(sortOrder)) {
      query = query.order(sortBy, { ascending: sortOrder === "asc" });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    // 페이지네이션 적용
    query = query.range(offset, offset + limit - 1);

    const { data: reviews, error } = await query;

    if (error) {
      throw error;
    }

    // 사용자 리뷰 통계 계산
    const { data: allReviews, error: statsError } = await supabase
      .from("reviews")
      .select("rating")
      .eq("user_id", userId);

    if (statsError) {
      throw statsError;
    }

    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0 
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    // 평점별 분포 계산
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    allReviews.forEach(review => {
      const rating = Math.floor(review.rating);
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating as keyof typeof ratingDistribution]++;
      }
    });

    // 응답 데이터 포맷팅
    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      content: review.content,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      store: {
        id: review.stores.id,
        name: review.stores.name,
        address: review.stores.address,
        imageUrl: review.stores.image_urls?.[0] || null,
      },
    }));

    return NextResponse.json({
      reviews: formattedReviews,
      pagination: {
        total: totalReviews,
        limit,
        offset,
        hasMore: reviews.length === limit,
      },
      statistics: {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
      },
    });
  } catch (error) {
    console.error("내 리뷰 조회 오류:", error);
    return NextResponse.json(
      { error: "리뷰 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
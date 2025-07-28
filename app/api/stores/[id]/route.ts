import { errorResponse, successResponse } from "@/lib/api-response";
import { mapStoreFromDb } from "@/lib/stores";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ReviewFromDb, Store } from "@/types/store";
import { NextRequest } from "next/server";

interface FormattedStore extends Store {
  reviews: Array<{
    id: number;
    rating: number;
    content: string;
    createdAt: string;
    user: {
      id: string;
      username: string;
    };
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = parseInt(id);

  if (isNaN(storeId)) {
    return errorResponse(
      {
        code: "invalid_id",
        message: "올바르지 않은 가게 ID입니다.",
      },
      400,
    );
  }

  try {
    const supabase = await createServerSupabaseClient();

    // 가게 정보 조회
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select(
        `
        *,
        categories:store_categories(
          category:categories(name)
        )
      `,
      )
      .eq("id", storeId)
      .single();

    if (storeError) {
      if (storeError.code === "PGRST116") {
        return errorResponse(
          {
            code: "store_not_found",
            message: "가게를 찾을 수 없습니다.",
          },
          404,
        );
      }
      throw storeError;
    }

    // 리뷰 조회 (profiles 테이블 조인으로 실제 사용자명 가져오기)
    const { data: reviews, error: reviewsError } = await supabase
      .from("reviews")
      .select(
        `
        *,
        profiles:profiles!inner(username)
      `,
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (reviewsError) {
      console.error("리뷰 조회 오류:", reviewsError);
      // 리뷰 조회 실패해도 가게 정보는 반환
    }

    // 공통 매핑 함수 사용하여 기본 Store 정보 생성
    const baseStore = mapStoreFromDb(store);

    // 리뷰 정보 추가하여 FormattedStore 생성
    const formattedStore: FormattedStore = {
      ...baseStore,
      reviews: (reviews || []).map((review: any) => ({
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.created_at,
        user: {
          id: review.user_id,
          username: review.profiles?.username || "사용자", // 실제 사용자명 사용
        },
      })),
    };

    return successResponse(formattedStore);
  } catch (error: any) {
    console.error("가게 상세 정보 조회 오류:", error);
    return errorResponse(
      {
        code: "database_error",
        message: "가게 정보를 불러오는 중 오류가 발생했습니다.",
        details: error,
      },
      500,
    );
  }
}

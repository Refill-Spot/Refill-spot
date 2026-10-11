import { errorResponse } from "@/lib/api-response";
import { summarizeReviews } from "@/lib/review-summary";
import { mapStoreFromDb } from "@/lib/stores";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { storeQuerySchema } from "@/lib/validations";
import { StoreFromDb } from "@/types/store";
import { NextRequest, NextResponse } from "next/server";

interface DbStore extends StoreFromDb {
  distance_km: number;
}

interface ReviewData {
  store_id: number;
  rating: number;
}

function getCategoryNames(categories: unknown): string[] {
  if (typeof categories === "string") {
    try {
      categories = JSON.parse(categories);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(categories)) {
    return [];
  }
  return categories.flatMap((item) => {
    if (typeof item === "string") {
      return [item];
    }
    return typeof item?.category?.name === "string" ? [item.category.name] : [];
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryParameters: Record<string, string | string[]> =
    Object.create(null);
  searchParams.forEach((_value, key) => {
    const values = searchParams.getAll(key);
    queryParameters[key] = values.length === 1 ? values[0] : values;
  });
  const parsedQuery = storeQuerySchema.safeParse(queryParameters);
  if (!parsedQuery.success) {
    return errorResponse(
      {
        code: "validation_error",
        message: "요청 데이터가 유효하지 않습니다.",
        details: parsedQuery.error.errors,
      },
      400,
    );
  }

  const { lat, lng, radius, minRating, categories, query, sort, page, limit } =
    parsedQuery.data;
  if (minRating > 0 || sort === "rating") {
    return errorResponse(
      {
        code: "EXTERNAL_RATINGS_UNAVAILABLE",
        message: "외부 평점 검증 전에는 평점 필터와 정렬을 사용할 수 없습니다.",
      },
      503,
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const hasLocation = lat !== undefined && lng !== undefined;
    const { data: stores, error: storeError } = hasLocation
      ? await supabase.rpc("get_stores_within_radius", {
          user_lat: lat,
          user_lng: lng,
          radius_km: radius,
        })
      : await supabase.rpc("get_default_recommended_stores");

    if (storeError || !Array.isArray(stores)) {
      throw storeError || new Error("Store query did not return an array");
    }

    const searchQuery = query?.toLowerCase();
    const filteredStores = (stores as DbStore[]).filter((store) => {
      if (categories && categories.length > 0) {
        const storeCategories = getCategoryNames(store.categories);
        if (
          !categories.some((category) => storeCategories.includes(category))
        ) {
          return false;
        }
      }
      return (
        !searchQuery ||
        store.name?.toLowerCase().includes(searchQuery) ||
        store.address?.toLowerCase().includes(searchQuery)
      );
    });

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedStores = filteredStores.slice(startIndex, endIndex);
    const groupedReviews = new Map<number, ReviewData[]>();
    let reviewStats: unknown = [];
    let reviewStatsError: unknown = null;

    // 현재 페이지에 포함된 가게의 자체 리뷰만 조회합니다.
    if (paginatedStores.length > 0) {
      const result = await supabase
        .from("reviews")
        .select("store_id, rating")
        .in(
          "store_id",
          paginatedStores.map((store) => store.id),
        );
      reviewStats = result.data;
      reviewStatsError = result.error;
      if (reviewStatsError) {
        console.error("리뷰 통계 조회 오류:", reviewStatsError);
      }
      if (Array.isArray(reviewStats)) {
        for (const review of reviewStats as ReviewData[]) {
          if (!review || typeof review.store_id !== "number") {
            continue;
          }
          const reviews = groupedReviews.get(review.store_id) || [];
          reviews.push(review);
          groupedReviews.set(review.store_id, reviews);
        }
      }
    }

    const formattedStores = paginatedStores.map((store) => ({
      ...mapStoreFromDb(
        store,
        Number.isFinite(store.distance_km) ? String(store.distance_km) : null,
      ),
      ...summarizeReviews(
        Array.isArray(reviewStats) ? groupedReviews.get(store.id) || [] : null,
        reviewStatsError,
      ),
    }));

    return NextResponse.json(
      {
        success: true,
        data: formattedStores,
        pagination: {
          page,
          limit,
          total: filteredStores.length,
          hasMore: endIndex < filteredStores.length,
          totalPages: Math.ceil(filteredStores.length / limit),
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error: unknown) {
    console.error("가게 정보 조회 API 오류:", error);
    return errorResponse(
      {
        code: "database_error",
        message: "가게 정보를 불러오는 중 오류가 발생했습니다.",
      },
      500,
    );
  }
}

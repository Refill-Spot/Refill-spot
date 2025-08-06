import { errorResponse } from "@/lib/api-response";
import { mapStoreFromDb } from "@/lib/stores";
import { StoreFromDb } from "@/types/store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// 데이터베이스에서 반환되는 store 타입 정의
interface DbStore {
  id: number;
  name: string;
  address: string;
  position_lat: number;
  position_lng: number;
  position_x: number;
  position_y: number;
  naver_rating: number | null;
  kakao_rating: number | null;
  categories: Array<{ category: { name: string } }> | string[];
  refill_items: any[] | null;
  open_hours: string | null;
  phone_number: string | null;
  break_time: string | null;
  image_urls?: string[] | null;
  created_at: string;
  updated_at: string;
  distance_km: number;
}

// 리뷰 데이터 타입 정의
interface ReviewData {
  store_id: number;
  rating: number;
}

// 리뷰 통계 타입 정의
interface ReviewStats {
  avgRating: number;
  reviewCount: number;
}

// 그룹핑된 리뷰 데이터 타입 정의
interface GroupedReviews {
  [storeId: string]: number[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitudeStr = searchParams.get("lat");
  const longitudeStr = searchParams.get("lng");
  const radiusStr = searchParams.get("radius");
  const minRatingStr = searchParams.get("minRating");
  const categoriesStr = searchParams.get("categories");
  const queryStr = searchParams.get("query");

  try {
    const supabase = await createServerSupabaseClient();

    if (latitudeStr && longitudeStr) {
      // 위치 기반 검색
      const latitude = parseFloat(latitudeStr);
      const longitude = parseFloat(longitudeStr);
      const radiusKm = radiusStr ? parseFloat(radiusStr) : 5;
      const minRating = minRatingStr ? parseFloat(minRatingStr) : 0;
      const selectedCategories = categoriesStr ? categoriesStr.split(",") : [];

      // PostGIS 공간 쿼리로 거리 기반 필터링 및 정렬 (이미 거리순 정렬됨)
      const { data: stores, error: storeError } = await supabase.rpc(
        "get_stores_within_radius",
        {
          user_lat: latitude,
          user_lng: longitude,
          radius_km: radiusKm,
        },
      );

      if (storeError) {
throw storeError;
}

      console.log(
        `PostGIS 공간 쿼리: 중심점 (${latitude}, ${longitude}), 반경 ${radiusKm}km, 총 ${stores.length}개 가게 발견`,
      );

      // 각 가게의 리뷰 통계 계산
      const storeIds = stores.map((store: DbStore) => store.id);
      const { data: reviewStats, error: reviewStatsError } = await supabase
        .from("reviews")
        .select("store_id, rating")
        .in("store_id", storeIds);

      if (reviewStatsError) {
        console.error("리뷰 통계 조회 오류:", reviewStatsError);
      }

      // 가게별 리뷰 통계 계산
      const storeReviewStats = new Map<number, ReviewStats>();
      if (reviewStats) {
        const statsGrouped = reviewStats.reduce((acc: GroupedReviews, review: ReviewData) => {
          if (!acc[review.store_id]) {
            acc[review.store_id] = [];
          }
          acc[review.store_id].push(review.rating);
          return acc;
        }, {});

        Object.entries(statsGrouped).forEach(([storeId, ratings]: [string, number[]]) => {
          const avgRating = ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length;
          storeReviewStats.set(parseInt(storeId), {
            avgRating: Math.round(avgRating * 10) / 10, // 소수점 첫째 자리까지 반올림
            reviewCount: ratings.length,
          });
        });
      }

      // PostGIS에서 이미 거리 계산과 정렬이 완료되었으므로 추가 필터링만 수행
      const filteredStores = stores
        .filter((store: DbStore) => {
          // 평점 필터링 (네이버 또는 카카오 평점 중 하나라도 조건 만족)
          const naverRating = store.naver_rating || 0;
          const kakaoRating = store.kakao_rating || 0;
          const maxRating = Math.max(naverRating, kakaoRating);

          if (minRating > 0 && maxRating < minRating) {
            return false;
          }

          // 카테고리 필터링 (PostGIS 함수에서 categories가 JSON으로 반환됨)
          if (selectedCategories.length > 0) {
            let storeCategories: string[] = [];
            
            // categories가 JSON인지 배열인지 확인하고 처리
            if (store.categories) {
              if (typeof store.categories === "string") {
                try {
                  storeCategories = JSON.parse(store.categories);
                } catch (e) {
                  storeCategories = [];
                }
              } else if (Array.isArray(store.categories)) {
                // 문자열 배열인지 객체 배열인지 확인
                if (store.categories.length > 0 && typeof store.categories[0] === "string") {
                  storeCategories = store.categories as string[];
                } else if (store.categories.length > 0 && typeof store.categories[0] === "object") {
                  // 객체 배열인 경우 이름만 추출
                  storeCategories = (store.categories as Array<{ category: { name: string } }>)
                    .map(item => item.category.name);
                } else {
                  storeCategories = [];
                }
              } else if (typeof store.categories === "object") {
                // JSON 객체인 경우 (PostGIS에서 반환된 경우)
                if (Array.isArray(store.categories)) {
                  storeCategories = (store.categories as Array<{ category: { name: string } }>)
                    .map(item => item.category.name);
                } else {
                  storeCategories = [];
                }
              }
            }
            
            const hasMatchingCategory = selectedCategories.some((category) =>
              Array.isArray(storeCategories) && storeCategories.includes(category),
            );
            
            if (!hasMatchingCategory) {
              return false;
            }
          }

          // 검색어 필터링
          if (queryStr?.trim()) {
            const query = queryStr.trim().toLowerCase();
            const storeName = store.name?.toLowerCase() || "";
            const storeAddress = store.address?.toLowerCase() || "";
            if (!storeName.includes(query) && !storeAddress.includes(query)) {
              return false;
            }
          }

          return true;
        })
        .map((store: DbStore) => {
          // PostGIS에서 계산된 distance_km 사용
          const reviewStat = storeReviewStats.get(store.id);
          return mapStoreFromDb(
            store as StoreFromDb, 
            store.distance_km.toString(),
            reviewStat?.avgRating || null,
            reviewStat?.reviewCount || null,
          );
        });

      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "20");
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const paginatedStores = filteredStores.slice(startIndex, endIndex);
      const hasMore = endIndex < filteredStores.length;

      return NextResponse.json(
        {
          success: true,
          data: paginatedStores,
          pagination: {
            page,
            limit,
            total: filteredStores.length,
            hasMore,
            totalPages: Math.ceil(filteredStores.length / limit),
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300", // 캐시 시간 단축
          },
        },
      );
    } else {
      // 위치 정보가 없는 경우: PostGIS 기본 추천 함수 사용
      console.log("위치 정보 없음 - PostGIS 기본 추천 가게 제공 (강남구 중심)");

      const { data: stores, error: storeError } = await supabase.rpc(
        "get_default_recommended_stores",
      );

      if (storeError) {
throw storeError;
}

      // 기본 추천 가게들의 리뷰 통계 계산
      const defaultStoreIds = stores.map((store: DbStore) => store.id);
      const { data: defaultReviewStats, error: defaultReviewStatsError } = await supabase
        .from("reviews")
        .select("store_id, rating")
        .in("store_id", defaultStoreIds);

      if (defaultReviewStatsError) {
        console.error("기본 추천 가게 리뷰 통계 조회 오류:", defaultReviewStatsError);
      }

      // 기본 추천 가게별 리뷰 통계 계산
      const defaultStoreReviewStats = new Map<number, ReviewStats>();
      if (defaultReviewStats) {
        const statsGrouped = defaultReviewStats.reduce((acc: GroupedReviews, review: ReviewData) => {
          if (!acc[review.store_id]) {
            acc[review.store_id] = [];
          }
          acc[review.store_id].push(review.rating);
          return acc;
        }, {});

        Object.entries(statsGrouped).forEach(([storeId, ratings]: [string, number[]]) => {
          const avgRating = ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length;
          defaultStoreReviewStats.set(parseInt(storeId), {
            avgRating: Math.round(avgRating * 10) / 10, // 소수점 첫째 자리까지 반올림
            reviewCount: ratings.length,
          });
        });
      }

      // PostGIS에서 이미 거리 계산과 정렬이 완료된 데이터 매핑
      const formattedStores = stores
        .slice(0, 30) // 최종 30개 선택
        .map((store: DbStore) => {
          const reviewStat = defaultStoreReviewStats.get(store.id);
          return mapStoreFromDb(
            store, 
            store.distance_km.toString(),
            reviewStat?.avgRating || null,
            reviewStat?.reviewCount || null,
          );
        });

      return NextResponse.json(
        { success: true, data: formattedStores },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        },
      );
    }
  } catch (error: unknown) {
    console.error("가게 정보 조회 API 오류:", error);
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

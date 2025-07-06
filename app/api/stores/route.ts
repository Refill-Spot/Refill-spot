import { errorResponse } from "@/lib/api-response";
import { mapStoreFromDb } from "@/lib/stores";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitudeStr = searchParams.get("lat");
  const longitudeStr = searchParams.get("lng");
  const radiusStr = searchParams.get("radius");
  const minRatingStr = searchParams.get("minRating");
  const categoriesStr = searchParams.get("categories");

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
      const { data: stores, error: storeError } = await supabase
        .rpc('get_stores_within_radius', {
          user_lat: latitude,
          user_lng: longitude,
          radius_km: radiusKm
        });

      if (storeError) throw storeError;

      console.log(`PostGIS 공간 쿼리: 중심점 (${latitude}, ${longitude}), 반경 ${radiusKm}km, 총 ${stores.length}개 가게 발견`);

      // PostGIS에서 이미 거리 계산과 정렬이 완료되었으므로 추가 필터링만 수행
      const filteredStores = stores
        .filter((store) => {
          // 평점 필터링 (네이버 또는 카카오 평점 중 하나라도 조건 만족)
          const naverRating = store.naver_rating || 0;
          const kakaoRating = store.kakao_rating || 0;
          const maxRating = Math.max(naverRating, kakaoRating);

          if (minRating > 0 && maxRating < minRating) return false;

          // 카테고리 필터링 (PostGIS 함수에서 categories가 JSON 배열로 반환됨)
          if (selectedCategories.length > 0) {
            const categories = store.categories || [];
            const hasMatchingCategory = selectedCategories.some((category) =>
              categories.includes(category)
            );
            if (!hasMatchingCategory) return false;
          }

          return true;
        })
        .map((store) => {
          // PostGIS에서 계산된 distance_km 사용
          return mapStoreFromDb(store, store.distance_km.toString());
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
        }
      );
    } else {
      // 위치 정보가 없는 경우: PostGIS 기본 추천 함수 사용
      console.log("위치 정보 없음 - PostGIS 기본 추천 가게 제공 (강남구 중심)");

      const { data: stores, error: storeError } = await supabase
        .rpc('get_default_recommended_stores');

      if (storeError) throw storeError;

      // PostGIS에서 이미 거리 계산과 정렬이 완료된 데이터 매핑
      const formattedStores = stores
        .slice(0, 30) // 최종 30개 선택
        .map((store) => mapStoreFromDb(store, store.distance_km.toString()));

      return NextResponse.json(
        { success: true, data: formattedStores },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }
  } catch (error: any) {
    console.error("가게 정보 조회 API 오류:", error);
    return errorResponse(
      {
        code: "database_error",
        message: "가게 정보를 불러오는 중 오류가 발생했습니다.",
        details: error,
      },
      500
    );
  }
}

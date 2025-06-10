import { errorResponse } from "@/lib/api-response";
import { calculateDistance } from "@/lib/distance";
import { mapStoreFromDb } from "@/lib/stores";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StoreFromDb } from "@/types/store";
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

      // 최적화된 쿼리: 필요한 컬럼만 선택하고 제한 추가
      const { data: stores, error: storeError } = await supabase
        .from("stores")
        .select(
          `
          *,
          categories:store_categories(
            category:categories(name)
          )
        `
        )
        .not("position_lat", "is", null)
        .not("position_lng", "is", null)
        .limit(100); // 성능을 위해 제한

      if (storeError) throw storeError;

      // 클라이언트 사이드에서 빠른 거리 계산 및 필터링
      const storesWithDistance = stores
        .map((store) => {
          // 간단한 거리 계산 (정확도보다 속도 우선)
          const latDiff = Math.abs(store.position_lat - latitude);
          const lngDiff = Math.abs(store.position_lng - longitude);
          const roughDistance =
            Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // 대략적인 km 변환

          // 대략적인 필터링으로 먼저 제외
          if (roughDistance > radiusKm * 1.5) return null;

          // 정확한 거리 계산 (미터 단위로 반환되므로 km로 변환)
          const distanceInMeters = calculateDistance(
            latitude,
            longitude,
            store.position_lat,
            store.position_lng
          );
          const distance = distanceInMeters / 1000; // km로 변환

          if (distance > radiusKm) return null;

          // 카테고리 정보 추출
          const categories =
            store.categories?.map(
              (item: { category: { name: string } }) => item.category.name
            ) || [];

          // 평점 필터링 (네이버 또는 카카오 평점 중 하나라도 조건 만족)
          const naverRating = store.naver_rating || 0;
          const kakaoRating = store.kakao_rating || 0;
          const maxRating = Math.max(naverRating, kakaoRating);

          if (minRating > 0 && maxRating < minRating) return null;

          // 카테고리 필터링
          if (selectedCategories.length > 0) {
            const hasMatchingCategory = selectedCategories.some((category) =>
              categories.includes(category)
            );
            if (!hasMatchingCategory) return null;
          }

          // 공통 매핑 함수 사용
          return mapStoreFromDb(store, distance.toFixed(2));
        })
        .filter((store): store is NonNullable<typeof store> => store !== null)
        .sort((a, b) => parseFloat(a.distance!) - parseFloat(b.distance!))
        .slice(0, 20); // 최대 20개만 반환

      return NextResponse.json(
        { success: true, data: storesWithDistance },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300", // 캐시 시간 단축
          },
        }
      );
    } else {
      // 전체 가게 목록 - 더 간단한 쿼리
      const { data: stores, error } = await supabase
        .from("stores")
        .select(
          `
          *,
          categories:store_categories(
            category:categories(name)
          )
        `
        )
        .limit(30) // 더 적은 수로 제한
        .order("id", { ascending: true });

      if (error) throw error;

      // 공통 매핑 함수 사용
      const formattedStores = stores.map((store: StoreFromDb) =>
        mapStoreFromDb(store)
      );

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

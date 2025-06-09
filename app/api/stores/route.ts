import { NextRequest, NextResponse } from "next/server";
import { StoreFromDb, FormattedStore } from "@/types/store";
import { successResponse, errorResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// 거리 계산 함수 (Haversine formula)
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // 지구 반지름 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 가게 데이터 포맷팅 함수
function formatStoreData(store: StoreFromDb): FormattedStore {
  const categories =
    store.categories?.map(
      (item: { category: { name: string } }) => item.category.name
    ) || [];

  return {
    id: store.id,
    name: store.name,
    address: store.address,
    distance: null,
    categories,
    rating: {
      naver: store.naver_rating || 0,
      kakao: store.kakao_rating || 0,
    },
    position: {
      lat: store.position_lat,
      lng: store.position_lng,
      x: store.position_x,
      y: store.position_y,
    },
    refillItems: store.refill_items || [],
    description: store.description,
    openHours: store.open_hours,
    price: store.price,
    imageUrls: store.image_urls || [],
  };
}

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
          id,
          name,
          address,
          position_lat,
          position_lng,
          position_x,
          position_y,
          naver_rating,
          kakao_rating,
          refill_items,
          description,
          open_hours,
          price,
          image_urls,
          store_categories!inner(
            categories!inner(name)
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

          // 정확한 거리 계산
          const distance = calculateDistance(
            latitude,
            longitude,
            store.position_lat,
            store.position_lng
          );

          if (distance > radiusKm) return null;

          // 카테고리 정보 추출
          const categories =
            store.store_categories
              ?.map((sc: any) => sc.categories?.name)
              .filter(Boolean) || [];

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

          return {
            id: store.id,
            name: store.name,
            address: store.address,
            distance: distance.toFixed(2),
            categories,
            rating: {
              naver: store.naver_rating || 0,
              kakao: store.kakao_rating || 0,
            },
            position: {
              lat: store.position_lat,
              lng: store.position_lng,
              x: store.position_x,
              y: store.position_y,
            },
            refillItems: store.refill_items || [],
            description: store.description,
            openHours: store.open_hours,
            price: store.price,
            imageUrls: store.image_urls || [],
          };
        })
        .filter((store): store is NonNullable<typeof store> => store !== null)
        .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
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
          id,
          name,
          address,
          position_lat,
          position_lng,
          position_x,
          position_y,
          naver_rating,
          kakao_rating,
          refill_items,
          description,
          open_hours,
          price,
          image_urls
        `
        )
        .limit(30) // 더 적은 수로 제한
        .order("id", { ascending: true });

      if (error) throw error;

      // 카테고리 정보를 별도로 조회 (병렬 처리)
      const storeIds = stores.map((store) => store.id);
      const { data: categoriesData } = await supabase
        .from("store_categories")
        .select(
          `
          store_id,
          categories!inner(name)
        `
        )
        .in("store_id", storeIds);

      // 카테고리 정보 매핑
      const categoryMap = new Map<number, string[]>();
      categoriesData?.forEach((item) => {
        if (!categoryMap.has(item.store_id)) {
          categoryMap.set(item.store_id, []);
        }
        categoryMap.get(item.store_id)!.push((item.categories as any).name);
      });

      const formattedStores = stores.map((store) => ({
        id: store.id,
        name: store.name,
        address: store.address,
        distance: null,
        categories: categoryMap.get(store.id) || [],
        rating: {
          naver: store.naver_rating || 0,
          kakao: store.kakao_rating || 0,
        },
        position: {
          lat: store.position_lat,
          lng: store.position_lng,
          x: store.position_x,
          y: store.position_y,
        },
        refillItems: store.refill_items || [],
        description: store.description,
        openHours: store.open_hours,
        price: store.price,
        imageUrls: store.image_urls || [],
      }));

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

import { errorResponse, successResponse } from "@/lib/api-response";
import { calculateDistance } from "@/lib/distance";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { storeFilterSchema } from "@/lib/validations";
import { FormattedStore, StoreFromDb } from "@/types/store";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json().catch(() => ({}));

    if (!requestBody || Object.keys(requestBody).length === 0) {
      return errorResponse(
        {
          code: "invalid_request",
          message: "유효한 필터 조건이 제공되지 않았습니다.",
        },
        400
      );
    }

    const supabase = await createServerSupabaseClient();

    // Zod 스키마로 요청 데이터 검증
    try {
      const { categories, maxDistance, minRating, latitude, longitude, query } =
        storeFilterSchema.parse(requestBody);
      // sort는 별도로 추출
      const sort = requestBody.sort || "default";

      // 모든 가게 데이터 가져오기
      const { data: allStores, error: storesError } = await supabase.from(
        "stores"
      ).select(`
          *,
          categories:store_categories(
            category:categories(name)
          )
        `);

      if (storesError) {
        return errorResponse(
          {
            code: "database_error",
            message: "가게 정보를 조회하는 중 오류가 발생했습니다.",
            details: storesError,
          },
          500
        );
      }

      if (!allStores) {
        return successResponse([]);
      }

      // 로컬에서 필터링 처리
      let filteredStores = [...allStores];

      // 1. 위치 기반 필터링
      if (latitude && longitude && maxDistance) {
        const maxDistanceMeters = maxDistance * 1000; // km -> m 변환
        filteredStores = filteredStores.filter((store) => {
          if (!store.position_lat || !store.position_lng) return false;

          const distance = calculateDistance(
            latitude,
            longitude,
            store.position_lat,
            store.position_lng
          );

          // 거리 정보 추가
          (store as any).distance = distance;

          return distance <= maxDistanceMeters;
        });
      }

      // 2. 카테고리 필터링
      if (categories && categories.length > 0) {
        filteredStores = filteredStores.filter((store) => {
          const storeCategories = store.categories.map(
            (item: { category: { name: string } }) => item.category.name
          );

          return categories.some((category) =>
            storeCategories.includes(category)
          );
        });
      }

      // 3. 평점 필터링
      if (minRating && minRating > 0) {
        filteredStores = filteredStores.filter((store) => {
          const avgRating =
            ((store.naver_rating || 0) + (store.kakao_rating || 0)) / 2;
          return avgRating >= minRating;
        });
      }

      // 4. 검색어 필터링
      if (query && query.trim()) {
        const searchTerm = query.trim().toLowerCase();
        filteredStores = filteredStores.filter((store) => {
          return (
            (store.name && store.name.toLowerCase().includes(searchTerm)) ||
            (store.address && store.address.toLowerCase().includes(searchTerm))
          );
        });
      }

      // 5. 정렬
      if (sort === "rating") {
        filteredStores.sort((a, b) => {
          const avgA = ((a.naver_rating || 0) + (a.kakao_rating || 0)) / 2;
          const avgB = ((b.naver_rating || 0) + (b.kakao_rating || 0)) / 2;
          return avgB - avgA;
        });
      } else if (sort === "distance" && latitude && longitude) {
        filteredStores.sort((a, b) => {
          const distanceA = (a as any).distance || Number.MAX_VALUE;
          const distanceB = (b as any).distance || Number.MAX_VALUE;
          return distanceA - distanceB;
        });
      }

      // 응답 데이터 가공
      const formattedStores: FormattedStore[] = filteredStores.map(
        (store: StoreFromDb) => {
          // 카테고리 배열 추출
          const storeCategories = store.categories.map(
            (item: { category: { name: string } }) => item.category.name
          );

          return {
            id: store.id,
            name: store.name,
            address: store.address,
            distance: (store as any).distance
              ? Math.round((store as any).distance) + ""
              : null,
            categories: storeCategories,
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
      );

      return successResponse(formattedStores);
    } catch (validationError: any) {
      return errorResponse(
        {
          code: "validation_error",
          message: "요청 데이터가 유효하지 않습니다.",
          details: validationError.errors || validationError,
        },
        400
      );
    }
  } catch (error: any) {
    console.error("가게 필터링 오류:", error);

    return errorResponse(
      {
        code: "server_error",
        message: "서버 오류가 발생했습니다.",
        details: error.message || error,
      },
      500
    );
  }
}

import { NextRequest } from "next/server";
import { StoreFromDb, FormattedStore } from "@/types/store";
import { successResponse, errorResponse } from "@/lib/api-response";
import { storeFilterSchema } from "@/lib/validations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calculateDistance } from "@/lib/geo";

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

      const sort = requestBody.sort || "default";

      // 기본 쿼리 빌더
      let queryBuilder = supabase.from("stores").select(`
        *,
        categories:store_categories(
          category:categories(name)
        )
      `);

      // 평점 필터링
      if (minRating && minRating > 0) {
        queryBuilder = queryBuilder.gte("naver_rating", minRating);
      }

      // 검색어 필터링
      if (query && typeof query === "string" && query.trim()) {
        queryBuilder = queryBuilder.or(
          `name.ilike.%${query}%,address.ilike.%${query}%`
        );
      }

      // 쿼리 실행
      const { data: stores, error } = await queryBuilder;

      if (error) {
        return errorResponse(
          {
            code: "database_error",
            message: "가게 정보를 조회하는 중 오류가 발생했습니다.",
            details: error,
          },
          500
        );
      }

      let filteredStores = stores || [];

      // 카테고리 필터링 (클라이언트 사이드)
      if (categories && categories.length > 0) {
        filteredStores = filteredStores.filter((store: StoreFromDb) => {
          const storeCategories = store.categories.map(
            (item: { category: { name: string } }) => item.category.name
          );
          return categories.some((cat) => storeCategories.includes(cat));
        });
      }

      // 위치 기반 필터링 (클라이언트 사이드)
      if (latitude && longitude) {
        const maxDistanceKm = maxDistance || 5; // 기본값 5km

        filteredStores = filteredStores.filter((store: StoreFromDb) => {
          // 거리 계산 (미터 단위로 반환되므로 km로 변환)
          const distanceInMeters = calculateDistance(
            latitude,
            longitude,
            store.position_lat,
            store.position_lng
          );
          const distance = distanceInMeters / 1000; // km로 변환

          // 거리 정보를 store 객체에 추가
          (store as any).distance = distance;

          return distance <= maxDistanceKm;
        });
      }

      // 정렬
      if (sort === "rating") {
        filteredStores.sort((a, b) => {
          const avgA = ((a.naver_rating || 0) + (a.kakao_rating || 0)) / 2;
          const avgB = ((b.naver_rating || 0) + (b.kakao_rating || 0)) / 2;
          return avgB - avgA;
        });
      } else if (sort === "distance" && latitude && longitude) {
        filteredStores.sort((a, b) => {
          const distA = (a as any).distance || 0;
          const distB = (b as any).distance || 0;
          return distA - distB;
        });
      }

      // 응답 데이터 가공
      const formattedStores: FormattedStore[] = filteredStores.map(
        (store: StoreFromDb) => {
          const storeCategories = store.categories.map(
            (item: { category: { name: string } }) => item.category.name
          );

          return {
            id: store.id,
            name: store.name,
            address: store.address,
            distance: (store as any).distance
              ? Math.round((store as any).distance * 100) / 100 + ""
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
        code: error.code || "server_error",
        message: error.message || "가게 필터링 중 오류가 발생했습니다.",
        details: error,
      },
      500
    );
  }
}

import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { StoreFromDb, FormattedStore } from "@/types/store";
import { Database } from "@/types/supabase";
import { successResponse, errorResponse } from "@/lib/api-response";
import { storeFilterSchema } from "@/lib/validations";

// 요청 처리 타임아웃 설정 (ms)
const REQUEST_TIMEOUT = 15000;

export async function POST(request: NextRequest) {
  // 타임아웃 설정
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject({
        code: "timeout_error",
        message: "요청 처리 시간이 초과되었습니다.",
      });
    }, REQUEST_TIMEOUT);
  });

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

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => cookieStore,
    });

    const queryPromise = (async () => {
      // Zod 스키마로 요청 데이터 검증
      try {
        const {
          categories,
          maxDistance,
          minRating,
          latitude,
          longitude,
          query,
        } = storeFilterSchema.parse(requestBody);

        // 위치 기반 필터링 (거리)
        if (latitude && longitude && maxDistance) {
          // Supabase RPC 함수 사용
          const { data: stores, error } = await supabase.rpc<
            any,
            StoreFromDb[]
          >("stores_filter", {
            lat: latitude,
            lng: longitude,
            max_distance: maxDistance * 1000,
            min_rating: minRating || 0,
            categories_filter:
              categories && categories.length > 0 ? categories : null,
          }).select(`
            *,
            categories:store_categories(
              category:categories(name)
            )
          `);

          if (error) {
            return errorResponse(
              {
                code: "database_error",
                message:
                  "필터링된 가게 정보를 조회하는 중 오류가 발생했습니다.",
                details: error,
              },
              500
            );
          }

          // 응답 데이터 가공
          const formattedStores: FormattedStore[] = (stores || []).map(
            (store: StoreFromDb) => {
              // 카테고리 배열 추출
              const storeCategories = store.categories.map(
                (item: { category: { name: string } }) => item.category.name
              );

              return {
                id: store.id,
                name: store.name,
                address: store.address,
                distance: store.distance
                  ? Math.round(store.distance) + ""
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
              };
            }
          );

          return successResponse(formattedStores);
        } else {
          // 일반 필터링 (위치 정보 없는 경우)
          let queryBuilder = supabase.from("stores").select(`
            *,
            categories:store_categories(
              category:categories(name)
            )
          `);

          // 카테고리 필터링
          if (categories && categories.length > 0) {
            // 여기서는 stores_by_categories라는 RPC 함수를 호출
            const { data: stores, error } = await supabase.rpc<
              any,
              StoreFromDb[]
            >("stores_by_categories", {
              category_names: categories,
            });

            if (error) {
              return errorResponse(
                {
                  code: "category_filter_error",
                  message: "카테고리 필터링 중 오류가 발생했습니다.",
                  details: error,
                },
                500
              );
            }

            // 평점 필터
            if (minRating && minRating > 0) {
              queryBuilder = queryBuilder.gte("naver_rating", minRating);
            }
          } else if (minRating && minRating > 0) {
            // 카테고리 필터 없이 평점 필터만 있는 경우
            queryBuilder = queryBuilder.gte("naver_rating", minRating);
          }

          // 검색어 필터링
          if (query && typeof query === "string" && query.trim()) {
            // 검색어로 이름과 주소 검색 (ilike는 대소문자 구분 없이 검색)
            queryBuilder = queryBuilder.or(
              `name.ilike.%${query}%,address.ilike.%${query}%`
            );
          }

          const { data: stores, error } = await queryBuilder;

          if (error) {
            return errorResponse(
              {
                code: "database_error",
                message: "가게 정보 필터링 중 오류가 발생했습니다.",
                details: error,
              },
              500
            );
          }

          // 응답 데이터 가공
          const formattedStores = (stores || []).map((store: StoreFromDb) => {
            const storeCategories = store.categories.map(
              (item: { category: { name: string } }) => item.category.name
            );

            return {
              id: store.id,
              name: store.name,
              address: store.address,
              distance: null, // 위치 기반 필터링이 아니므로 distance는 null
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
            };
          });

          return successResponse(formattedStores);
        }
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
    })();

    // 타임아웃과 함께 실행
    return await Promise.race([queryPromise, timeoutPromise]);
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

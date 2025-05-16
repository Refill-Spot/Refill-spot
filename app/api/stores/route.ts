import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { StoreFromDb, FormattedStore } from "@/types/store";
import { successResponse, errorResponse } from "@/lib/api-response";

// 요청 처리 타임아웃 설정 (ms)
const REQUEST_TIMEOUT = 15000;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latitudeStr = searchParams.get("lat");
  const longitudeStr = searchParams.get("lng");
  const radiusStr = searchParams.get("radius") || "5000"; // 기본 반경 5km

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
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    let storesFromQuery: StoreFromDb[] = [];
    let queryError: any = null;

    const queryPromise = (async () => {
      if (latitudeStr && longitudeStr) {
        const latitude = parseFloat(latitudeStr);
        const longitude = parseFloat(longitudeStr);
        const radiusInMeters = parseInt(radiusStr, 10);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusInMeters)) {
          return errorResponse(
            {
              code: "invalid_parameters",
              message: "위도, 경도, 반경은 유효한 숫자여야 합니다.",
              details: { latitude, longitude, radius: radiusInMeters },
            },
            400
          );
        }

        // 타입 단언 사용
        const { data, error } = await (supabase as any).rpc(
          "stores_within_radius",
          {
            lat: latitude,
            lng: longitude,
            radius_meters: radiusInMeters,
          }
        ).select(`
            *,
            categories:store_categories(
              category:categories(name)
            )
          `);

        if (error) {
          return errorResponse(
            {
              code: "database_error",
              message: "주변 가게 정보를 조회하는 중 오류가 발생했습니다.",
              details: error,
            },
            500
          );
        }

        storesFromQuery = data || [];
      } else {
        // 일반 검색 (모든 가게)
        const { data, error } = await supabase
          .from("stores")
          .select(
            `
            *,
            categories:store_categories(
              category:categories(name)
            )
          `
          )
          .order("name");

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

        storesFromQuery = data || [];
      }

      // 응답 데이터 가공
      const formattedStores: FormattedStore[] = storesFromQuery.map(
        (store: StoreFromDb): FormattedStore => {
          // 카테고리 배열 추출
          const categories = store.categories.map(
            (item: { category: { name: string } }): string => item.category.name
          );

          return {
            id: store.id,
            name: store.name,
            address: store.address,
            distance: store.distance ? String(store.distance) : null,
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
          };
        }
      );

      return successResponse(formattedStores);
    })();

    // 타임아웃과 함께 실행
    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (error: any) {
    console.error("가게 정보 조회 API 전체 오류:", error);

    return errorResponse(
      {
        code: error.code || "server_error",
        message:
          error.message || "가게 정보를 불러오는 중 오류가 발생했습니다.",
        details: error,
      },
      500
    );
  }
}

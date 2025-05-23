import { NextRequest, NextResponse } from "next/server";
import { StoreFromDb, FormattedStore } from "@/types/store";
import { successResponse, errorResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latitudeStr = searchParams.get("lat");
  const longitudeStr = searchParams.get("lng");
  const radiusStr = searchParams.get("radius") || "5"; // 기본 반경 5km

  try {
    const supabase = await createServerSupabaseClient();

    // 기본 쿼리 - 모든 가게 조회
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

    let filteredStores = stores || [];

    // 위치 기반 필터링 (클라이언트 사이드)
    if (latitudeStr && longitudeStr) {
      const latitude = parseFloat(latitudeStr);
      const longitude = parseFloat(longitudeStr);
      const radiusKm = parseFloat(radiusStr);

      if (!isNaN(latitude) && !isNaN(longitude) && !isNaN(radiusKm)) {
        filteredStores = filteredStores.filter((store: StoreFromDb) => {
          // 간단한 거리 계산 (Haversine formula)
          const R = 6371; // 지구 반지름 (km)
          const dLat = ((store.position_lat - latitude) * Math.PI) / 180;
          const dLon = ((store.position_lng - longitude) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((latitude * Math.PI) / 180) *
              Math.cos((store.position_lat * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          // 거리 정보를 store 객체에 추가
          (store as any).distance = distance;

          return distance <= radiusKm;
        });

        // 거리순 정렬
        filteredStores.sort((a, b) => {
          const distA = (a as any).distance || 0;
          const distB = (b as any).distance || 0;
          return distA - distB;
        });
      }
    }

    // 응답 데이터 가공
    const formattedStores: FormattedStore[] = filteredStores.map(
      (store: StoreFromDb): FormattedStore => {
        // 카테고리 배열 추출
        const categories = store.categories.map(
          (item: { category: { name: string } }): string => item.category.name
        );

        return {
          id: store.id,
          name: store.name,
          address: store.address,
          distance: (store as any).distance
            ? Math.round((store as any).distance * 100) / 100 + ""
            : null,
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
    );

    return successResponse(formattedStores);
  } catch (error: any) {
    console.error("가게 정보 조회 API 오류:", error);

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

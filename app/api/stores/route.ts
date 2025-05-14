import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { StoreFromDb, FormattedStore } from "@/types/store"; // 타입 import

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latitudeStr = searchParams.get("lat");
  const longitudeStr = searchParams.get("lng");
  const radiusStr = searchParams.get("radius") || "5000"; // 기본 반경 5km

  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    let storesFromQuery: StoreFromDb[] = [];
    let queryError: any = null;

    if (latitudeStr && longitudeStr) {
      const latitude = parseFloat(latitudeStr);
      const longitude = parseFloat(longitudeStr);
      const radiusInMeters = parseInt(radiusStr, 10);

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
        queryError = error;
      } else {
        storesFromQuery = data || [];
      }
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
        queryError = error;
      } else {
        storesFromQuery = data || [];
      }
    }

    if (queryError) {
      console.error("데이터 조회 중 오류 발생:", queryError);
      throw queryError;
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
          distance: store.distance ? String(store.distance) : null, // number를 string으로 변환
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

    return NextResponse.json(formattedStores);
  } catch (error: any) {
    console.error("가게 정보 조회 API 전체 오류:", error);
    const errorMessage =
      error?.message || "가게 정보를 불러오는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

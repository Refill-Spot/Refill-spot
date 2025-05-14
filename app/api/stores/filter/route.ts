import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { StoreFromDb, FormattedStore } from "@/types/store";
import { Database } from "@/types/supabase"; // 추가: Database 타입 가져오기

export async function POST(request: NextRequest) {
  try {
    const { categories, maxDistance, minRating, latitude, longitude } =
      await request.json();

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => cookieStore,
    });

    // 위치 기반 필터링 (거리)
    if (latitude && longitude && maxDistance) {
      // Supabase RPC 함수 사용 - 여기서 제네릭 타입을 명확히 지정
      const { data: stores, error } = await supabase.rpc<any, StoreFromDb[]>(
        "stores_filter",
        {
          lat: Number(latitude),
          lng: Number(longitude),
          max_distance: Number(maxDistance) * 1000,
          min_rating: minRating || 0,
          categories_filter:
            categories && categories.length > 0 ? categories : null,
        }
      ).select(`
        *,
        categories:store_categories(
          category:categories(name)
        )
      `);

      if (error) {
        throw error;
      }

      // 응답 데이터 가공
      const formattedStores: FormattedStore[] = (stores || []).map(
        (store: StoreFromDb) => {
          // 카테고리 배열 추출 - 명시적 타입 지정
          const storeCategories = store.categories.map(
            (item: { category: { name: string } }) => item.category.name
          );

          return {
            id: store.id,
            name: store.name,
            address: store.address,
            distance: store.distance ? Math.round(store.distance) + "" : null,
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

      return NextResponse.json(formattedStores);
    } else {
      // 일반 필터링 (위치 정보 없는 경우)
      let query = supabase.from("stores").select(`
        *,
        categories:store_categories(
          category:categories(name)
        )
      `);

      // 카테고리 필터링
      if (categories && categories.length > 0) {
        // 여기서는 stores_by_categories라는 RPC 함수를 호출
        const { data: stores, error } = await supabase.rpc<any, StoreFromDb[]>(
          "stores_by_categories",
          {
            category_names: categories,
          }
        );

        if (error) {
          throw error;
        }

        // 평점 필터
        if (minRating && minRating > 0) {
          query = query.gte("naver_rating", minRating);
        }
      } else if (minRating && minRating > 0) {
        // 카테고리 필터 없이 평점 필터만 있는 경우
        query = query.gte("naver_rating", minRating);
      }

      const { data: stores, error } = await query;

      if (error) {
        throw error;
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

      return NextResponse.json(formattedStores);
    }
  } catch (error) {
    console.error("가게 필터링 오류:", error);
    return NextResponse.json(
      { error: "가게 필터링 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

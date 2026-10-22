import { supabaseBrowser } from "@/lib/supabase/client";
import { Store, StoreFromDb } from "@/types/store";

import { mapStoredExternalRatings } from "@/lib/external-ratings";
import { z } from "zod";

const menuItemsSchema = z.array(
  z.object({
    name: z.string(),
    // 공백을 제외한 정확한 소문자 내부 출처 값만 숨기고 실제 메뉴 유형은 보존합니다.
    type: z
      .string()
      .transform((type) => (type.trim() === "browser_verified" ? "" : type)),
    order: z.number().finite(),
    price: z.string(),
    price_numeric: z.number().finite(),
    is_recommended: z.boolean(),
  }),
);

// 공통 매핑 함수 - StoreFromDb를 Store로 변환
export function mapStoreFromDb(
  store: StoreFromDb,
  distance?: number | string | null,
  avgRating?: number | null,
  reviewCount?: number | null,
): Store {
  // PostGIS 함수에서 반환하는 categories는 JSON 배열 형태이고,
  // 기존 쿼리에서 반환하는 categories는 중첩된 객체 구조
  let categories: string[] = [];

  if (store.categories) {
    if (Array.isArray(store.categories) && store.categories.length > 0) {
      if (typeof store.categories[0] === "string") {
        // PostGIS 함수에서 반환하는 경우: ["카테고리1", "카테고리2"]
        categories = store.categories as string[];
      } else if (
        typeof store.categories[0] === "object" &&
        store.categories[0] !== null &&
        "category" in store.categories[0]
      ) {
        // 기존 쿼리에서 반환하는 경우: [{category: {name: "카테고리1"}}]
        categories = (
          store.categories as Array<{ category: { name: string } }>
        ).map((item) => item.category.name);
      }
    }
  }

  const mappedStore = {
    id: store.id,
    name: store.name,
    address: store.address,
    distance:
      distance === null || distance === undefined ? null : String(distance),
    categories,
    rating: mapStoredExternalRatings(store),
    avgRating: avgRating || undefined,
    reviewCount: reviewCount || undefined,
    position: {
      lat: store.position_lat,
      lng: store.position_lng,
      x: store.position_x,
      y: store.position_y,
    },
    refillItems: (() => {
      if (!store.refill_items) {
        return null;
      }

      try {
        const value =
          typeof store.refill_items === "string"
            ? JSON.parse(store.refill_items)
            : store.refill_items;
        const result = menuItemsSchema.safeParse(value);
        if (result.success) {
          return result.data;
        }
        console.error("refill_items 데이터 형식이 올바르지 않습니다.");
      } catch {
        console.error("refill_items JSON 파싱 오류");
      }
      return null;
    })(),
    openHours: store.open_hours,
    phoneNumber: store.phone_number,
    imageUrls: store.image_urls || [],
  };

  return mappedStore;
}

// 가게 상세 정보 조회
export async function getStoreById(id: number): Promise<Store | null> {
  const { data, error } = await supabaseBrowser
    .from("stores")
    .select(
      `
      *,
      categories:store_categories(
        category:categories(name)
      )
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("가게 상세 정보 조회 오류:", error);
    return null;
  }

  // 공통 매핑 함수 사용 (리뷰 통계는 여기서는 제공하지 않음)
  return mapStoreFromDb(data);
}

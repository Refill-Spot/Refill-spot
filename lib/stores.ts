import { supabaseBrowser } from "@/lib/supabase/client";
import { Store, StoreFromDb } from "@/types/store";

// 카테고리 아이템 타입 정의
interface CategoryItem {
  category: {
    name: string;
  };
}

// 공통 매핑 함수 - StoreFromDb를 Store로 변환
export function mapStoreFromDb(
  store: StoreFromDb,
  distance?: number | string | null
): Store {
  const categories =
    store.categories?.map((item: CategoryItem) => item.category.name) || [];

  return {
    id: store.id,
    name: store.name,
    address: store.address,
    distance: distance ? String(distance) : null,
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

// 가게 목록 조회
export async function getStores(): Promise<Store[]> {
  const { data, error } = await supabaseBrowser
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
    console.error("가게 목록 조회 오류:", error);
    return [];
  }

  // 공통 매핑 함수 사용
  return data.map((store: StoreFromDb) => mapStoreFromDb(store));
}

// 현재 위치 기반 가게 조회
export async function getNearbyStores(
  lat: number,
  lng: number,
  radius: number = 5000
): Promise<Store[]> {
  // Supabase RPC 함수를 호출하여 반경 내 가게 검색
  const { data, error } = await supabaseBrowser.rpc("stores_within_radius", {
    lat,
    lng,
    radius_meters: radius,
  }).select(`
      *,
      categories:store_categories(
        category:categories(name)
      )
    `);

  if (error) {
    console.error("주변 가게 조회 오류:", error);
    return [];
  }

  // 공통 매핑 함수 사용
  return data.map((store: StoreFromDb) =>
    mapStoreFromDb(store, store.distance)
  );
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
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("가게 상세 정보 조회 오류:", error);
    return null;
  }

  // 공통 매핑 함수 사용
  return mapStoreFromDb(data);
}

import { supabaseBrowser } from "@/lib/supabase/client";
import { Store, StoreFromDb } from "@/types/store";
import { MenuItem } from "@/types/menu";

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

  // PostGIS 함수에서 반환하는 categories는 JSON 배열 형태이고,
  // 기존 쿼리에서 반환하는 categories는 중첩된 객체 구조
  let categories: string[] = [];
  
  if (store.categories) {
    if (Array.isArray(store.categories) && store.categories.length > 0) {
      if (typeof store.categories[0] === 'string') {
        // PostGIS 함수에서 반환하는 경우: ["카테고리1", "카테고리2"]
        categories = store.categories as string[];
      } else if (typeof store.categories[0] === 'object' && store.categories[0] !== null && 'category' in store.categories[0]) {
        // 기존 쿼리에서 반환하는 경우: [{category: {name: "카테고리1"}}]
        categories = (store.categories as Array<{ category: { name: string } }>).map((item) => item.category.name);
      }
    }
  }

  const mappedStore = {
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
    refillItems: (() => {
      if (!store.refill_items) return null;
      
      // PostGIS 함수에서 오는 경우 이미 파싱된 배열
      if (Array.isArray(store.refill_items)) {
        return store.refill_items as MenuItem[];
      }
      
      // 직접 DB에서 오는 경우 JSON 문자열일 수 있음
      if (typeof store.refill_items === 'string') {
        try {
          return JSON.parse(store.refill_items) as MenuItem[];
        } catch (e) {
          console.error('refill_items JSON 파싱 오류:', e);
          return null;
        }
      }
      
      return store.refill_items as MenuItem[];
    })(),
    openHours: store.open_hours,
    phoneNumber: store.phone_number,
    imageUrls: store.image_urls || [],
  };

  return mappedStore;
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

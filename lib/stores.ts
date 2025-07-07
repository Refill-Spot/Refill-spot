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
  console.log('🔍 [stores.ts] mapStoreFromDb called', { 
    storeId: store.id, 
    storeName: store.name,
    open_hours: store.open_hours,
    hasOpenHours: !!store.open_hours,
    openHoursType: typeof store.open_hours,
    openHoursLength: store.open_hours?.length
  });

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

  console.log('🔍 [stores.ts] mapStoreFromDb result', { 
    storeId: mappedStore.id, 
    storeName: mappedStore.name,
    openHours: mappedStore.openHours,
    hasOpenHours: !!mappedStore.openHours,
    openHoursType: typeof mappedStore.openHours,
    openHoursLength: mappedStore.openHours?.length
  });

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
  console.log('🔍 [stores.ts] getStoreById called', { id });
  
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

  console.log('🔍 [stores.ts] Supabase query result', { 
    id, 
    error, 
    data: data ? {
      id: data.id,
      name: data.name,
      open_hours: data.open_hours,
      hasOpenHours: !!data.open_hours,
      openHoursType: typeof data.open_hours,
      openHoursLength: data.open_hours?.length,
      categories: data.categories
    } : null 
  });

  if (error) {
    console.error("가게 상세 정보 조회 오류:", error);
    return null;
  }

  // 공통 매핑 함수 사용
  const mappedStore = mapStoreFromDb(data);
  console.log('🔍 [stores.ts] mapStoreFromDb result', { 
    id, 
    mappedStore: mappedStore ? {
      id: mappedStore.id,
      name: mappedStore.name,
      openHours: mappedStore.openHours,
      hasOpenHours: !!mappedStore.openHours,
      openHoursType: typeof mappedStore.openHours,
      openHoursLength: mappedStore.openHours?.length
    } : null 
  });
  
  return mappedStore;
}

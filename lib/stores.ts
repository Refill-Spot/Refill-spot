import { supabaseBrowser } from "@/lib/supabase/client";
import { Database } from "@/types/supabase";

// --- API 또는 서비스 레이어에서 사용할 최종 가게 데이터 타입 ---
// (이 타입은 @/types/store.ts 로 옮겨서 다른 곳에서도 재사용 가능)
export type Store = {
  id: number;
  name: string;
  address: string;
  distance?: string | null; // 문자열 형태의 거리 (예: "1.2km") 또는 null
  categories: string[];
  rating: {
    naver: number;
    kakao: number;
  };
  position: {
    lat: number;
    lng: number;
    x: number;
    y: number;
  };
  refillItems?: string[] | null; // null 가능성 명시
  description?: string | null; // null 가능성 명시
  openHours?: string | null; // null 가능성 명시
  price?: string | null; // null 가능성 명시
};

// 카테고리 아이템 타입 정의
interface CategoryItem {
  category: {
    name: string;
  };
}

// 데이터베이스에서 가져온 가게 데이터 타입
interface DbStore {
  id: number;
  name: string;
  address: string;
  distance?: string | null;
  naver_rating: number | null;
  kakao_rating: number | null;
  position_lat: number;
  position_lng: number;
  position_x: number;
  position_y: number;
  refill_items: string[] | null;
  description: string | null;
  open_hours: string | null;
  price: string | null;
  categories: CategoryItem[];
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

  // 응답 데이터 가공
  return data.map((store: DbStore) => {
    // item 파라미터의 타입을 명시적으로 지정
    const categories = store.categories.map(
      (item: CategoryItem) => item.category.name
    );

    return {
      id: store.id,
      name: store.name,
      address: store.address,
      distance: store.distance,
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
  });
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

  // 응답 데이터 가공
  return data.map((store: DbStore) => {
    // item 파라미터의 타입을 명시적으로 지정
    const categories = store.categories.map(
      (item: CategoryItem) => item.category.name
    );

    return {
      id: store.id,
      name: store.name,
      address: store.address,
      distance: store.distance,
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
  });
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

  // 카테고리 배열 추출
  const categories = data.categories.map(
    (item: CategoryItem) => item.category.name
  );

  // 응답 데이터 가공
  return {
    id: data.id,
    name: data.name,
    address: data.address,
    description: data.description,
    position: {
      lat: data.position_lat,
      lng: data.position_lng,
      x: data.position_x,
      y: data.position_y,
    },
    categories,
    rating: {
      naver: data.naver_rating || 0,
      kakao: data.kakao_rating || 0,
    },
    refillItems: data.refill_items || [],
    openHours: data.open_hours,
    price: data.price,
  };
}

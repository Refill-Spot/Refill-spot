import { supabaseBrowser } from "@/lib/supabase/client";
import { Store, StoreFromDb } from "@/types/store";

// 카테고리 아이템 타입 정의
interface CategoryItem {
  category: {
    name: string;
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

  // 응답 데이터 가공
  return data.map((store: StoreFromDb) => {
    // item 파라미터의 타입을 명시적으로 지정
    const categories = store.categories.map(
      (item: CategoryItem) => item.category.name
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
      imageUrls: store.image_urls || [],
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
  return data.map((store: StoreFromDb) => {
    // item 파라미터의 타입을 명시적으로 지정
    const categories = store.categories.map(
      (item: CategoryItem) => item.category.name
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
      imageUrls: store.image_urls || [],
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
    imageUrls: data.image_urls || [],
  };
}

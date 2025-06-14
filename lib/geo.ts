"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { FormattedStore } from "@/types/store";

/**
 * @deprecated 이 함수는 더 이상 사용되지 않습니다.
 * 대신 hooks/use-geolocation.ts의 useGeolocation 훅을 사용하세요.
 *
 * 현재 위치 가져오기
 */
export const getCurrentPosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      });
    } else {
      reject(new Error("Geolocation is not supported by this browser."));
    }
  });
};

// 거리 계산 함수를 공통 유틸리티에서 가져옴
export { calculateDistance } from "@/lib/distance";

// 주변 가게 찾기
export const findNearbyStores = async (
  latitude: number,
  longitude: number,
  radius: number = 5000, // 기본 5km
  filters?: {
    categories?: string[];
    minRating?: number;
  }
): Promise<FormattedStore[]> => {
  const supabase = supabaseBrowser;

  try {
    // PostGIS RPC 함수를 사용하여 반경 내 가게 검색
    let query = supabase.rpc("stores_filter", {
      lat: latitude,
      lng: longitude,
      max_distance: radius,
      min_rating: filters?.minRating || 0,
      categories_filter: filters?.categories || null,
    }).select(`
      *,
      categories:store_categories(
        category:categories(name)
      )
    `);

    const { data, error } = await query;

    if (error) {
      console.error("PostGIS 검색 오류:", error);
      throw error;
    }

    // 응답 데이터 가공
    return data.map((store: any) => {
      const categories = store.categories.map(
        (item: any) => item.category.name
      );

      return {
        id: store.id,
        name: store.name,
        address: store.address,
        distance: store.distance ? `${Math.round(store.distance)}` : null,
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
  } catch (error) {
    console.error("PostGIS 검색 오류:", error);
    throw error;
  }
};

// 지오코딩 (주소 → 좌표)
export const geocodeAddress = async (
  address: string
): Promise<{ lat: number; lng: number } | null> => {
  try {
    // 네이버 지오코딩 API 사용
    const response = await fetch(
      `/api/geocode?address=${encodeURIComponent(address)}`
    );
    const data = await response.json();

    if (data.error || !data.lat || !data.lng) {
      return null;
    }

    return {
      lat: data.lat,
      lng: data.lng,
    };
  } catch (error) {
    console.error("지오코딩 오류:", error);
    return null;
  }
};

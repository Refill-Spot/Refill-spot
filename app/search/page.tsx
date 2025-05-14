"use client";

import { useState, useEffect } from "react";
import NaverMap from "@/components/naver-map";
import StoreList from "@/components/store-list";
import Sidebar from "@/components/sidebar";
import MobileBottomSheet from "@/components/mobile-bottom-sheet";
import Header from "@/components/header";
import ViewToggle from "@/components/view-toggle";
import { getStores, getNearbyStores, Store } from "@/lib/stores";

// 필터 타입 정의
interface FilterOptions {
  categories?: string[];
  maxDistance?: number;
  minRating?: number;
  latitude?: number;
  longitude?: number;
}

export default function SearchPage() {
  const [view, setView] = useState<"map" | "list">("map");
  // 명시적으로 Store[] 타입을 지정
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // 초기 가게 데이터 로드
  useEffect(() => {
    const loadStores = async () => {
      setLoading(true);
      try {
        // 사용자 위치 가져오기
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });

            // 주변 가게 가져오기
            const nearbyStores = await getNearbyStores(
              latitude,
              longitude,
              5000
            );
            setStores(nearbyStores);
          },
          async (error) => {
            console.error("Geolocation error:", error);
            // 위치를 가져올 수 없는 경우 모든 가게 가져오기
            const allStores = await getStores();
            setStores(allStores);
          }
        );
      } catch (error) {
        console.error("가게 데이터 로드 오류:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStores();
  }, []);

  // 필터 적용
  const handleApplyFilters = async (filters: FilterOptions) => {
    setLoading(true);
    try {
      let filteredStores: Store[] = [];

      if (userLocation && (filters.latitude || filters.longitude)) {
        // 위치 기반 필터링
        const lat = filters.latitude || userLocation.lat;
        const lng = filters.longitude || userLocation.lng;
        filteredStores = await getNearbyStores(
          lat,
          lng,
          filters.maxDistance ? filters.maxDistance * 1000 : 5000
        );
      } else if (userLocation) {
        // 사용자 위치 기반 필터링
        filteredStores = await getNearbyStores(
          userLocation.lat,
          userLocation.lng,
          filters.maxDistance ? filters.maxDistance * 1000 : 5000
        );
      } else {
        // 일반 필터링
        filteredStores = await getStores();
      }

      // 카테고리 필터
      if (filters.categories && filters.categories.length > 0) {
        filteredStores = filteredStores.filter((store) =>
          store.categories.some((cat) => filters.categories?.includes(cat))
        );
      }

      // 평점 필터
      if (filters.minRating && filters.minRating > 0) {
        filteredStores = filteredStores.filter(
          (store) => store.rating.naver >= (filters.minRating || 0)
        );
      }

      setStores(filteredStores);
    } catch (error) {
      console.error("필터링 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-[#F5F5F5]">
      <Header />
      <ViewToggle view={view} setView={setView} />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:block w-80 border-r border-gray-200 overflow-y-auto">
          <Sidebar onApplyFilters={handleApplyFilters} />
        </div>
        <div className="flex-1 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722]"></div>
            </div>
          ) : view === "map" ? (
            <>
              <NaverMap stores={stores} userLocation={userLocation} />
              <div className="md:hidden">
                <MobileBottomSheet stores={stores} />
              </div>
            </>
          ) : (
            <StoreList stores={stores} />
          )}
        </div>
      </div>
    </main>
  );
}

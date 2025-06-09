"use client";

import StoreList from "@/components/store-list";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useMapView } from "@/hooks/use-map-view";
import { useState, useCallback } from "react";
import { Store } from "@/types/store";

export default function ClientSearchPage() {
  const {
    stores,
    loading,
    error,
    userLocation,
    setFilters,
    handleSearch,
    getCurrentLocation,
    setCustomLocation,
  } = useMapView();

  const [sort, setSort] = useState<"default" | "rating" | "distance">(
    "default"
  );

  // 주소/지역명 검색 핸들러
  const handleSearchWithGeocode = async (query: string) => {
    if (!query || !query.trim()) return;

    try {
      // 1. geocode API 호출하여 주소를 좌표로 변환
      const res = await fetch(
        `/api/geocode?address=${encodeURIComponent(query)}`
      );
      const data = await res.json();

      if (res.ok && data.lat && data.lng) {
        // 주소가 인식되면 해당 위치 주변 가게 검색
        setCustomLocation(data.lat, data.lng);
      } else {
        // 주소가 아니면 기존 가게명 검색
        handleSearch(query);
      }
    } catch (err) {
      // 오류 시 기존 가게명 검색
      handleSearch(query);
    }
  };

  // 네이버 지도로 보기
  const handleViewInNaverMap = useCallback((store: Store) => {
    const naverMapUrl = `nmap://place?lat=${store.position.lat}&lng=${
      store.position.lng
    }&name=${encodeURIComponent(store.name)}&appname=com.refillspot.app`;

    const webMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(
      store.name
    )}?c=${store.position.lng},${store.position.lat},15,0,0,0,dh`;

    if (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    ) {
      window.location.href = naverMapUrl;
      setTimeout(() => {
        window.open(webMapUrl, "_blank");
      }, 1000);
    } else {
      window.open(webMapUrl, "_blank");
    }
  }, []);

  return (
    <main className="flex flex-col h-screen bg-[#F5F5F5]">
      <Header
        onSearch={handleSearchWithGeocode}
        onLocationRequest={getCurrentLocation}
        onCustomLocationSet={setCustomLocation}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 - 데스크톱에서만 표시 */}
        <aside className="hidden lg:block w-80 border-r border-gray-200 overflow-y-auto bg-white">
          <Sidebar onApplyFilters={setFilters} userLocation={userLocation} />
        </aside>

        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 relative">
          {/* 상단 정렬 옵션 */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* 모바일 필터 버튼 */}
                <button className="lg:hidden px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium">
                  필터 ▼
                </button>

                {/* 결과 개수 */}
                {stores.length > 0 && (
                  <span className="text-sm text-gray-600">
                    총{" "}
                    <span className="font-semibold text-[#FF5722]">
                      {stores.length}
                    </span>
                    개의 가게
                  </span>
                )}
              </div>

              {/* 정렬 옵션 */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">정렬:</label>
                <select
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm bg-white"
                  value={sort}
                  onChange={(e) => {
                    const value = e.target.value as
                      | "default"
                      | "rating"
                      | "distance";
                    setSort(value);
                    setFilters({ sort: value });
                  }}
                >
                  <option value="default">기본순</option>
                  <option value="distance">거리순</option>
                  <option value="rating">평점순</option>
                </select>
              </div>
            </div>
          </div>

          {/* 콘텐츠 영역 */}
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722] mx-auto mb-4"></div>
                <p className="text-gray-600">검색 중...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-[#FF5722] text-white rounded-md hover:bg-[#E64A19]"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full">
              <StoreList stores={stores} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

"use client";

import Header from "@/components/header";
import KakaoMap from "@/components/kakao-map";
import SearchFilters from "@/components/search-filters";
import StoreList from "@/components/store-list";
import { useMapView } from "@/hooks/use-map-view";
import { Store } from "@/types/store";
import { useCallback, useState } from "react";

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
    "default",
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // URL 파라미터 처리는 use-map-view.ts에서 담당하므로 여기서는 제거

  // 주소/지역명 검색 핸들러
  const handleSearchWithGeocode = async (query: string) => {
    if (!query?.trim()) {
      return;
    }

    try {
      // 1. geocode API 호출하여 주소를 좌표로 변환
      const res = await fetch(
        `/api/geocode?address=${encodeURIComponent(query)}`,
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
      store.name,
    )}?c=${store.position.lng},${store.position.lat},15,0,0,0,dh`;

    if (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
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
        {/* 왼쪽 사이드바 - 가게 목록 */}
        <aside className="hidden lg:block w-[28rem] border-r border-gray-200 overflow-y-auto bg-white">
          <div className="h-full flex flex-col">
            {/* 가게 목록 헤더 */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">가게 목록</h3>
              {stores.length > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  총{" "}
                  <span className="font-semibold text-[#FF5722]">
                    {stores.length}
                  </span>
                  개의 가게
                </p>
              )}
            </div>

            {/* 가게 목록 */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722] mx-auto mb-4"></div>
                    <p className="text-gray-600">검색 중...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full p-4">
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
                <StoreList stores={stores} />
              )}
            </div>
          </div>
        </aside>

        {/* 필터 패널 (모바일용) */}
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
            <div className="lg:w-96 w-80 h-full bg-white overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">필터</h2>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <SearchFilters
                userLocation={userLocation}
                onApplyFilters={(filters) => {
                  setFilters(filters);
                  setIsFilterOpen(false);
                }}
              />
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 영역 - 지도 */}
        <div className="flex-1 relative">
          {/* 상단 필터 버튼 */}
          <div className="absolute top-4 left-4 z-10">
            <button
              className="lg:hidden px-4 py-2 bg-white border-2 border-[#FF5722] text-[#FF5722] rounded-md text-sm font-medium hover:bg-[#FF5722] hover:text-white transition-colors duration-200 flex items-center gap-2 shadow-sm"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
                  clipRule="evenodd"
                />
              </svg>
              필터
            </button>
          </div>

          {/* 결과 요약 */}
          {stores.length > 0 && (
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border z-10">
              <p className="text-sm text-gray-700">
                총{" "}
                <span className="font-semibold text-[#FF5722]">
                  {stores.length}
                </span>
                개의 가게 표시
              </p>
            </div>
          )}

          {/* 지도 영역 */}
          {loading ? (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722] mx-auto mb-4"></div>
                <p className="text-gray-600">지도 로딩 중...</p>
              </div>
            </div>
          ) : error ? (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-500 mb-4">지도를 불러올 수 없습니다</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-[#FF5722] text-white rounded-md hover:bg-[#E64A19] transition-colors"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : (
            <KakaoMap
              stores={stores}
              userLocation={null} // userLocation 대신 center 사용
              center={userLocation} // 검색 위치로 지도 중심 설정
              enableClustering={true}
              selectedStore={selectedStore}
              onStoreSelect={setSelectedStore}
              onLocationChange={() => {}} // 위치 변경 시 아무 작업 안함 (자동 검색 비활성화)
              onManualSearch={setCustomLocation} // 수동 검색 시 위치 업데이트 및 데이터 로드
              isVisible={true}
            />
          )}
        </div>
      </div>
    </main>
  );
}

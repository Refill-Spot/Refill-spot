"use client";

import NaverMap from "@/components/naver-map";
import StoreList from "@/components/store-list";
import Sidebar from "@/components/sidebar";
import MobileBottomSheet from "@/components/mobile-bottom-sheet";
import Header from "@/components/header";
import ViewToggle from "@/components/view-toggle";
import { useMapView } from "@/hooks/use-map-view";
import { useState } from "react";

export default function ClientSearchPage() {
  const {
    view,
    setView,
    stores,
    loading,
    error,
    userLocation,
    setFilters,
    handleSearch,
    getCurrentLocation,
  } = useMapView("map");

  const [sort, setSort] = useState<"default" | "rating">("default");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    null
  );

  // 주소/지역명 검색 핸들러
  const handleSearchWithGeocode = async (query: string) => {
    // 기존 가게명 검색도 함께 지원
    if (!query || !query.trim()) return;
    try {
      // 1. geocode API 호출
      const res = await fetch(
        `/api/geocode?address=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (res.ok && data.lat && data.lng) {
        setCenter({ lat: data.lat, lng: data.lng });
        setFilters({ latitude: data.lat, longitude: data.lng });
      } else {
        // 주소가 아니면 기존 가게명 검색
        setFilters({ query });
      }
    } catch (err) {
      setFilters({ query });
    }
  };

  return (
    <main className="flex flex-col h-screen bg-[#F5F5F5]">
      <Header
        onSearch={handleSearchWithGeocode}
        onLocationRequest={getCurrentLocation}
      />
      <ViewToggle view={view} setView={setView} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:block w-80 border-r border-gray-200 overflow-y-auto">
          <Sidebar onApplyFilters={setFilters} />
        </aside>
        <div className="flex-1 relative">
          {view === "list" && (
            <div className="flex justify-end items-center p-2">
              <label className="mr-2 text-sm text-gray-600">정렬:</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={sort}
                onChange={(e) => {
                  const value = e.target.value as "default" | "rating";
                  setSort(value);
                  setFilters({ sort: value });
                }}
              >
                <option value="default">기본순</option>
                <option value="rating">평점순</option>
              </select>
            </div>
          )}
          {loading ? (
            <div
              className="flex items-center justify-center h-full"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722]"></div>
              <span className="sr-only">로딩 중...</span>
            </div>
          ) : error ? (
            <div
              className="flex items-center justify-center h-full text-red-500"
              role="alert"
            >
              {error}
            </div>
          ) : view === "map" ? (
            <>
              <NaverMap
                stores={stores}
                userLocation={userLocation}
                center={center}
              />
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

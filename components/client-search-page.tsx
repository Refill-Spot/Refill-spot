"use client";

import NaverMap from "@/components/naver-map";
import StoreList from "@/components/store-list";
import Sidebar from "@/components/sidebar";
import MobileBottomSheet from "@/components/mobile-bottom-sheet";
import Header from "@/components/header";
import ViewToggle from "@/components/view-toggle";
import { useMapView } from "@/hooks/use-map-view";

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

  return (
    <main className="flex flex-col h-screen bg-[#F5F5F5]">
      <Header onSearch={handleSearch} onLocationRequest={getCurrentLocation} />
      <ViewToggle view={view} setView={setView} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:block w-80 border-r border-gray-200 overflow-y-auto">
          <Sidebar onApplyFilters={setFilters} />
        </aside>
        <div className="flex-1 relative">
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

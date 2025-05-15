"use client";

import { useState, useEffect } from "react";
import NaverMap from "@/components/naver-map";
import StoreList from "@/components/store-list";
import Sidebar from "@/components/sidebar";
import MobileBottomSheet from "@/components/mobile-bottom-sheet";
import Header from "@/components/header";
import ViewToggle from "@/components/view-toggle";
import { ErrorBoundary } from "@/components/error-boundary";
import { useFetchStores } from "@/hooks/use-stores";

export default function Home() {
  const [view, setView] = useState<"map" | "list">("map");
  const { stores, loading, error, setFilters } = useFetchStores();

  return (
    <ErrorBoundary fallback={<div className="p-4">오류가 발생했습니다.</div>}>
      <main className="flex flex-col h-screen bg-[#F5F5F5]">
        <Header />
        <ViewToggle view={view} setView={setView} />
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden md:block w-80 border-r border-gray-200 overflow-y-auto">
            <Sidebar onApplyFilters={setFilters} />
          </div>
          <div className="flex-1 relative">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722]"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-500">
                {error}
              </div>
            ) : view === "map" ? (
              <>
                <NaverMap stores={stores} />
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
    </ErrorBoundary>
  );
}

"use client";

import { useState, useEffect } from "react";
import NaverMap from "@/components/naver-map"; // 추가된 네이버 맵 컴포넌트
import StoreList from "@/components/store-list";
import Sidebar from "@/components/sidebar";
import MobileBottomSheet from "@/components/mobile-bottom-sheet";
import Header from "@/components/header";
import ViewToggle from "@/components/view-toggle";
import { AuthProvider } from "@/contexts/AuthContext"; // 인증 컨텍스트 추가

export default function Home() {
  const [view, setView] = useState<"map" | "list">("map");
  const [filteredStores, setFilteredStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // 가게 데이터 가져오기
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await fetch("/api/stores");
        if (!response.ok) {
          throw new Error("가게 정보를 불러오는데 실패했습니다.");
        }

        const data = await response.json();
        setFilteredStores(data);
      } catch (error) {
        console.error("가게 데이터 로드 오류:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, []);

  return (
    <AuthProvider>
      <main className="flex flex-col h-screen bg-[#F5F5F5]">
        <Header />
        <ViewToggle view={view} setView={setView} />
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden md:block w-80 border-r border-gray-200 overflow-y-auto">
            <Sidebar
              onApplyFilters={(filters) => {
                // 필터링 로직 - API 호출로 대체 가능
                fetch("/api/stores/filter", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(filters),
                })
                  .then((res) => res.json())
                  .then((data) => setFilteredStores(data))
                  .catch((err) => console.error("필터링 오류:", err));
              }}
            />
          </div>
          <div className="flex-1 relative">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722]"></div>
              </div>
            ) : view === "map" ? (
              <>
                <NaverMap stores={filteredStores} />
                <div className="md:hidden">
                  <MobileBottomSheet stores={filteredStores} />
                </div>
              </>
            ) : (
              <StoreList stores={filteredStores} />
            )}
          </div>
        </div>
      </main>
    </AuthProvider>
  );
}

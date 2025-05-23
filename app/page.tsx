"use client";

import { useCallback, useEffect, useState, memo } from "react";
import StoreList from "@/components/store-list";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { ErrorBoundary } from "@/components/error-boundary";
import { useToast } from "@/hooks/use-toast";
import { Store } from "@/types/store";

// 메모이제이션된 StoreList 컴포넌트
const MemoizedStoreList = memo(StoreList);

export default function Home() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const { toast } = useToast();

  // 가게 목록 가져오기 (실제 API 사용)
  const fetchStores = useCallback(
    async (lat?: number, lng?: number, radius?: number) => {
      setLoading(true);
      setError(null);

      try {
        let url = "/api/stores";
        if (lat && lng) {
          url += `?lat=${lat}&lng=${lng}&radius=${radius || 5}`;
        }

        console.log("API 호출:", url);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("API 응답:", data);

        if (data.error) {
          throw new Error(
            data.error.message || "가게 정보를 불러오는 중 오류가 발생했습니다."
          );
        }

        const storeData = data.data || [];
        console.log("가게 데이터:", storeData.length, "개");
        setStores(storeData);

        if (storeData.length === 0) {
          toast({
            title: "알림",
            description: "해당 지역에 등록된 가게가 없습니다.",
          });
        }
      } catch (err) {
        console.error("가게 목록 조회 오류:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "알 수 없는 오류가 발생했습니다.";
        setError(errorMessage);
        toast({
          title: "오류",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // 초기 로드
  useEffect(() => {
    // 기본 주소 (서울 강남역) 주변 가게 표시
    const defaultLocation = {
      lat: 37.498095,
      lng: 127.02761,
    };

    setUserLocation(defaultLocation);
    fetchStores(defaultLocation.lat, defaultLocation.lng, 5);

    toast({
      title: "기본 위치 적용",
      description:
        "서울 강남역 주변의 가게를 표시합니다. 위치 버튼을 눌러 현재 위치로 변경할 수 있습니다.",
    });
  }, [fetchStores, toast]);

  // 현재 위치 가져오기 요청
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "위치 정보 오류",
        description: "이 브라우저에서는 위치 정보를 지원하지 않습니다.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "위치 정보",
      description: "현재 위치를 확인 중입니다...",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        fetchStores(latitude, longitude, 5);

        toast({
          title: "위치 확인 완료",
          description: "현재 위치 주변의 가게를 표시합니다.",
        });
      },
      (error) => {
        console.error("위치 정보를 가져올 수 없습니다:", error);
        toast({
          title: "위치 정보 확인 불가",
          description:
            "기본 지역의 가게를 표시합니다. 검색을 통해 지역을 변경할 수 있습니다.",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // 사용자 지정 위치 설정
  const setCustomLocation = useCallback(
    (lat: number, lng: number, radius: number = 5) => {
      setUserLocation({ lat, lng });
      fetchStores(lat, lng, radius);

      toast({
        title: "위치 설정 완료",
        description: "설정한 위치 주변의 가게를 표시합니다.",
      });
    },
    [fetchStores, toast]
  );

  // 검색 처리
  const handleSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        // 검색어가 없으면 기본 위치로 다시 로드
        fetchStores(userLocation?.lat, userLocation?.lng, 5);
        return;
      }

      // 검색어가 있으면 현재 가게 목록에서 필터링
      const filteredStores = stores.filter(
        (store) =>
          store.name.toLowerCase().includes(query.toLowerCase()) ||
          store.address.toLowerCase().includes(query.toLowerCase())
      );

      setStores(filteredStores);

      if (filteredStores.length === 0) {
        toast({
          title: "검색 결과 없음",
          description: "검색 조건에 맞는 가게가 없습니다.",
        });
      }
    },
    [stores, fetchStores, userLocation, toast]
  );

  // 사이드바 필터 적용 (간단한 버전)
  const handleApplyFilters = useCallback(
    (filters: any) => {
      // 현재는 기본 목록 다시 로드
      fetchStores(userLocation?.lat, userLocation?.lng, 5);
    },
    [fetchStores, userLocation]
  );

  const handleViewInNaverMap = useCallback((store: Store) => {
    // 네이버 지도 앱으로 열기 시도
    const naverMapUrl = `nmap://place?lat=${store.position.lat}&lng=${
      store.position.lng
    }&name=${encodeURIComponent(store.name)}&appname=com.refillspot.app`;

    // 앱이 설치되어 있지 않으면 웹으로 리다이렉트
    const webMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(
      store.name
    )}?c=${store.position.lng},${store.position.lat},15,0,0,0,dh`;

    // 모바일에서는 앱 링크 시도, 데스크톱에서는 바로 웹으로
    if (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    ) {
      window.location.href = naverMapUrl;
      // 1초 후 앱이 열리지 않으면 웹으로 이동
      setTimeout(() => {
        window.open(webMapUrl, "_blank");
      }, 1000);
    } else {
      window.open(webMapUrl, "_blank");
    }
  }, []);

  return (
    <ErrorBoundary fallback={<div className="p-4">오류가 발생했습니다.</div>}>
      <main className="flex flex-col h-screen bg-[#F5F5F5]">
        <Header
          onSearch={handleSearch}
          onLocationRequest={handleGetCurrentLocation}
          onCustomLocationSet={setCustomLocation}
        />
        <div className="flex flex-1 overflow-hidden">
          {/* 사이드바 - 데스크톱에서만 표시 */}
          <div className="hidden lg:block w-80 border-r border-gray-200 overflow-y-auto bg-white">
            <Sidebar onApplyFilters={handleApplyFilters} />
          </div>

          {/* 메인 콘텐츠 영역 - 가게 목록만 표시 */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722] mx-auto mb-4"></div>
                  <p className="text-gray-600">가게 정보를 불러오는 중...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-red-500 mb-4">{error}</p>
                  <button
                    onClick={() =>
                      fetchStores(userLocation?.lat, userLocation?.lng, 5)
                    }
                    className="px-4 py-2 bg-[#FF5722] text-white rounded-md hover:bg-[#E64A19]"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full">
                {/* 모바일 필터 버튼 */}
                <div className="lg:hidden bg-white border-b border-gray-200 p-4">
                  <button className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium">
                    필터 및 정렬 ▼
                  </button>
                </div>

                {/* 가게 목록 */}
                <div className="h-full">
                  <MemoizedStoreList
                    stores={stores}
                    onViewMap={handleViewInNaverMap}
                  />
                </div>

                {/* 결과 요약 */}
                {stores.length > 0 && (
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border">
                    <p className="text-sm text-gray-700">
                      총{" "}
                      <span className="font-semibold text-[#FF5722]">
                        {stores.length}
                      </span>
                      개의 가게
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
}

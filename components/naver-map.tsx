"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Script from "next/script";
import { Store } from "@/lib/stores";
import Link from "next/link";

declare global {
  interface Window {
    naver: any;
  }
}

interface NaverMapProps {
  stores: Store[];
  userLocation?: { lat: number; lng: number } | null;
}

export default function NaverMap({ stores = [], userLocation }: NaverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [naverMapLoaded, setNaverMapLoaded] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // 네이버 지도 API 로드 완료 핸들러
  const handleNaverMapLoaded = () => {
    setNaverMapLoaded(true);
  };

  // 지도 초기화
  useEffect(() => {
    if (!naverMapLoaded || !mapRef.current) return;

    // 초기 좌표 설정 (사용자 위치 또는 기본값)
    const initialLat = userLocation?.lat || 37.5665;
    const initialLng = userLocation?.lng || 126.978;

    // 지도 옵션
    const mapOptions = {
      center: new window.naver.maps.LatLng(initialLat, initialLng),
      zoom: 14,
      zoomControl: true,
      zoomControlOptions: {
        position: window.naver.maps.Position.TOP_RIGHT,
      },
    };

    // 지도 생성
    const newMap = new window.naver.maps.Map(mapRef.current, mapOptions);
    setMap(newMap);

    // 현재 위치 마커 추가 (사용자 위치가 있는 경우)
    if (userLocation) {
      new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(
          userLocation.lat,
          userLocation.lng
        ),
        map: newMap,
        icon: {
          content: `
            <div class="current-location-marker">
              <div class="pulse"></div>
            </div>
          `,
          anchor: new window.naver.maps.Point(15, 15),
        },
      });
    }

    // 지도 클릭 이벤트 - 선택된 가게 초기화
    window.naver.maps.Event.addListener(newMap, "click", () => {
      setSelectedStore(null);
    });

    return () => {
      // 이벤트 리스너 제거 로직
    };
  }, [naverMapLoaded, userLocation]);

  // 가게 마커 추가
  useEffect(() => {
    if (!map || !stores.length) return;

    // 기존 마커 제거
    markers.forEach((marker) => marker.setMap(null));

    // 새 마커 추가
    const newMarkers = stores.map((store) => {
      const markerPosition = new window.naver.maps.LatLng(
        store.position.lat,
        store.position.lng
      );

      const marker = new window.naver.maps.Marker({
        position: markerPosition,
        map: map,
        icon: {
          content: `
            <div class="store-marker" data-store-id="${store.id}">
              <div class="marker-inner bg-[#FF5722] text-white rounded-full p-2 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div class="marker-name opacity-0 absolute left-1/2 -translate-x-1/2 -bottom-1 bg-white px-2 py-0.5 rounded shadow-md text-xs whitespace-nowrap transition-opacity">
                ${store.name}
              </div>
            </div>
          `,
          anchor: new window.naver.maps.Point(15, 30),
        },
        zIndex: 100,
      });

      // 마커 클릭 이벤트
      window.naver.maps.Event.addListener(marker, "click", () => {
        setSelectedStore(store);

        // 지도 중심 이동
        map.panTo(markerPosition);
      });

      return marker;
    });

    setMarkers(newMarkers);

    // 마커 호버 이벤트를 위한 전역 이벤트 리스너
    const handleMarkerHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const markerEl = target.closest(".store-marker") as HTMLElement;

      if (markerEl) {
        // 가장 가까운 marker-name 요소 찾기
        const nameEl = markerEl.querySelector(".marker-name") as HTMLElement;
        if (nameEl) {
          nameEl.classList.remove("opacity-0");
          nameEl.classList.add("opacity-100");
        }
      }
    };

    const handleMarkerLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const markerEl = target.closest(".store-marker") as HTMLElement;

      if (markerEl) {
        // 가장 가까운 marker-name 요소 찾기
        const nameEl = markerEl.querySelector(".marker-name") as HTMLElement;
        if (nameEl) {
          nameEl.classList.add("opacity-0");
          nameEl.classList.remove("opacity-100");
        }
      }
    };

    // 마커 클릭 이벤트
    const handleMarkerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const markerEl = target.closest(".store-marker") as HTMLElement;

      if (markerEl) {
        const storeId = Number(markerEl.dataset.storeId);
        const store = stores.find((s) => s.id === storeId);
        if (store) {
          setSelectedStore(store);
        }
      }
    };

    document.addEventListener("mouseover", handleMarkerHover);
    document.addEventListener("mouseout", handleMarkerLeave);
    document.addEventListener("click", handleMarkerClick);

    // 모든 마커가 보이도록 지도 범위 조정
    if (stores.length > 1) {
      const bounds = new window.naver.maps.LatLngBounds();

      // 사용자 위치가 있으면 포함
      if (userLocation) {
        bounds.extend(
          new window.naver.maps.LatLng(userLocation.lat, userLocation.lng)
        );
      }

      // 모든 가게 위치 포함
      stores.forEach((store) => {
        bounds.extend(
          new window.naver.maps.LatLng(store.position.lat, store.position.lng)
        );
      });

      // 지도 범위 설정
      map.fitBounds(bounds);
    }

    return () => {
      document.removeEventListener("mouseover", handleMarkerHover);
      document.removeEventListener("mouseout", handleMarkerLeave);
      document.removeEventListener("click", handleMarkerClick);
    };
  }, [map, stores, userLocation]);

  return (
    <div className="w-full h-full bg-gray-100 relative">
      {/* 네이버 지도 스크립트 */}
      <Script
        strategy="beforeInteractive"
        src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${
          process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || ""
        }`}
        onLoad={handleNaverMapLoaded}
      />

      {/* 스타일 추가 */}
      <style jsx global>{`
        .current-location-marker {
          position: relative;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pulse {
          width: 16px;
          height: 16px;
          background-color: #2196f3;
          border-radius: 50%;
          box-shadow: 0 0 0 rgba(33, 150, 243, 0.4);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4);
          }
          70% {
            box-shadow: 0 0 0 15px rgba(33, 150, 243, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
          }
        }

        .store-marker {
          position: relative;
          cursor: pointer;
        }

        .marker-inner {
          transition: transform 0.2s;
        }

        .store-marker:hover .marker-inner {
          transform: scale(1.2);
        }
      `}</style>

      {/* 지도 컨테이너 */}
      <div ref={mapRef} className="w-full h-full"></div>

      {/* 선택된 가게 정보 팝업 */}
      {selectedStore && (
        <Card className="absolute bottom-24 left-1/2 transform -translate-x-1/2 md:left-auto md:right-4 md:bottom-4 md:transform-none w-80 shadow-lg">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div
                className="w-20 h-20 rounded-md bg-gray-200 flex-shrink-0"
                style={{
                  backgroundImage: `url('/placeholder.svg?height=80&width=80')`,
                  backgroundSize: "cover",
                }}
              ></div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-[#333333]">
                    {selectedStore.name}
                  </h3>
                  <button
                    className="text-gray-400 hover:text-gray-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStore(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-[#FFA726] text-[#FFA726]" />
                  <span>{selectedStore.rating.naver}</span>
                  <span className="text-gray-400">(Naver)</span>
                  <span className="mx-1">|</span>
                  <Star className="h-4 w-4 fill-[#FFA726] text-[#FFA726]" />
                  <span>{selectedStore.rating.kakao}</span>
                  <span className="text-gray-400">(Kakao)</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  <span>
                    {selectedStore.distance
                      ? `${selectedStore.distance}m`
                      : "거리 정보 없음"}
                  </span>
                  <span>|</span>
                  {selectedStore.categories.map((category, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="px-2 py-0 text-xs"
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
              {selectedStore.description}
            </p>
            <Link href={`/store/${selectedStore.id}`}>
              <Button className="w-full mt-3 bg-[#FF5722] hover:bg-[#E64A19]">
                상세 보기
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* 지도 컨트롤 */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="bg-white shadow-md h-8 w-8"
          onClick={() => map && map.setZoom(map.getZoom() + 1)}
        >
          <span className="text-lg font-bold">+</span>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="bg-white shadow-md h-8 w-8"
          onClick={() => map && map.setZoom(map.getZoom() - 1)}
        >
          <span className="text-lg font-bold">-</span>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="bg-white shadow-md h-8 w-8"
          onClick={() => {
            if (!userLocation) {
              // 위치 정보가 없는 경우 현재 위치 요청
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const { latitude, longitude } = position.coords;
                  map &&
                    map.setCenter(
                      new window.naver.maps.LatLng(latitude, longitude)
                    );
                },
                (error) => {
                  console.error("Geolocation error:", error);
                }
              );
            } else {
              // 저장된 위치로 이동
              map &&
                map.setCenter(
                  new window.naver.maps.LatLng(
                    userLocation.lat,
                    userLocation.lng
                  )
                );
            }
          }}
        >
          <MapPin className="h-4 w-4 text-[#2196F3]" />
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Script from "next/script";
import { Store } from "@/types/store";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";

declare global {
  interface Window {
    naver: any;
  }
}

interface NaverMapProps {
  stores: Store[];
  userLocation?: { lat: number; lng: number } | null;
  enableClustering?: boolean;
  center?: { lat: number; lng: number } | null;
}

export default function NaverMap({
  stores = [],
  userLocation,
  enableClustering = true,
  center,
}: NaverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [naverMapLoaded, setNaverMapLoaded] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [markerClusters, setMarkerClusters] = useState<any>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  // 네이버 지도 API 로드 완료 핸들러
  const handleNaverMapLoaded = () => {
    setNaverMapLoaded(true);
  };

  // 사용자 위치 가져오기
  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (map) {
            map.setCenter(new window.naver.maps.LatLng(latitude, longitude));
            // 현재 위치 마커 추가
            new window.naver.maps.Marker({
              position: new window.naver.maps.LatLng(latitude, longitude),
              map: map,
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
        },
        (error) => {
          console.error("위치 정보 오류:", error);
          toast({
            title: t("location_error"),
            description: t("location_error_description"),
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: t("location_not_supported"),
        description: t("location_not_supported_description"),
        variant: "destructive",
      });
    }
  }, [map, toast, t]);

  // 지도 초기화
  useEffect(() => {
    if (!naverMapLoaded || !mapRef.current) return;

    try {
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
        if (newMap) {
          window.naver.maps.Event.clearListeners(newMap, "click");
        }
      };
    } catch (error) {
      console.error("지도 초기화 오류:", error);
      toast({
        title: t("map_initialization_error"),
        description: t("map_initialization_error_description"),
        variant: "destructive",
      });
    }
  }, [naverMapLoaded, userLocation, toast, t]);

  // center props로 지도 중심 이동
  useEffect(() => {
    if (map && center) {
      map.setCenter(new window.naver.maps.LatLng(center.lat, center.lng));
    }
  }, [center, map]);

  // 마커 클러스터링 설정
  const setupMarkerClustering = useCallback(
    (map: any, markers: any[]) => {
      if (
        !enableClustering ||
        !window.naver ||
        !window.naver.maps ||
        !window.naver.maps.MarkerClustering
      ) {
        return null;
      }

      // 기존 클러스터가 있으면 제거
      if (markerClusters) {
        markerClusters.destroy();
      }

      // 클러스터 스타일 정의
      const htmlMarker = {
        content: `
          <div style="cursor:pointer;width:40px;height:40px;line-height:42px;font-size:10px;color:white;text-align:center;
          font-weight:bold;background:rgba(255,87,34,0.9);border-radius:20px;"></div>
        `,
        size: new window.naver.maps.Size(40, 40),
        anchor: new window.naver.maps.Point(20, 20),
      };

      const htmlMarker2 = {
        content: `
          <div style="cursor:pointer;width:50px;height:50px;line-height:52px;font-size:12px;color:white;text-align:center;
          font-weight:bold;background:rgba(255,87,34,0.9);border-radius:25px;"></div>
        `,
        size: new window.naver.maps.Size(50, 50),
        anchor: new window.naver.maps.Point(25, 25),
      };

      const htmlMarker3 = {
        content: `
          <div style="cursor:pointer;width:60px;height:60px;line-height:62px;font-size:14px;color:white;text-align:center;
          font-weight:bold;background:rgba(255,87,34,0.9);border-radius:30px;"></div>
        `,
        size: new window.naver.maps.Size(60, 60),
        anchor: new window.naver.maps.Point(30, 30),
      };

      // 클러스터 생성
      const cluster = new window.naver.maps.MarkerClustering({
        minClusterSize: 2,
        maxZoom: 16,
        map: map,
        markers: markers,
        disableClickZoom: false,
        gridSize: 120,
        icons: [htmlMarker, htmlMarker2, htmlMarker3],
        indexGenerator: [10, 30, 100],
        stylingFunction: (clusterMarker: any, count: number) => {
          clusterMarker.getElement().querySelector("div").textContent = count;
        },
      });

      return cluster;
    },
    [enableClustering, markerClusters]
  );

  // 가게 마커 추가
  useEffect(() => {
    if (!map || !stores.length) return;

    try {
      // 기존 마커 제거
      markers.forEach((marker) => marker.setMap(null));

      // 새 마커 배열
      const newMarkers = [];

      // 각 가게별 마커 생성
      for (const store of stores) {
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
          title: store.name,
        });

        // 마커에 store 데이터 저장
        marker.set("data", store);

        // 마커 클릭 이벤트
        window.naver.maps.Event.addListener(marker, "click", () => {
          setSelectedStore(store);
          map.panTo(markerPosition);
        });

        newMarkers.push(marker);
      }

      setMarkers(newMarkers);

      // 클러스터링 적용
      const cluster = setupMarkerClustering(map, newMarkers);
      setMarkerClusters(cluster);

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

        // 지도 범위 설정 (약간의 여백 추가)
        map.fitBounds(bounds, {
          top: 50,
          right: 50,
          bottom: 50,
          left: 50,
        });
      }

      return () => {
        document.removeEventListener("mouseover", handleMarkerHover);
        document.removeEventListener("mouseout", handleMarkerLeave);
        document.removeEventListener("click", handleMarkerClick);
      };
    } catch (error) {
      console.error("마커 생성 오류:", error);
      toast({
        title: t("marker_error"),
        description: t("marker_error_description"),
        variant: "destructive",
      });
    }
  }, [map, stores, userLocation, setupMarkerClustering, toast, t]);

  return (
    <div className="w-full h-full bg-gray-100 relative">
      {/* 네이버 지도 스크립트 */}
      <Script
        strategy="beforeInteractive"
        src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${
          process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || ""
        }&submodules=geocoder,marker,drawing,visualization,panorama,clustering`}
        onLoad={handleNaverMapLoaded}
        onError={() => {
          toast({
            title: t("map_load_error"),
            description: t("map_load_error_description"),
            variant: "destructive",
          });
        }}
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
      <div
        ref={mapRef}
        className="w-full h-full"
        aria-label={t("map_aria_label")}
      ></div>

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
                role="img"
                aria-label={t("store_image_aria", { name: selectedStore.name })}
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
                    aria-label={t("close")}
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-[#FFA726] text-[#FFA726]" />
                  <span>{selectedStore.rating.naver}</span>
                  <span className="text-gray-400">{t("naver")}</span>
                  <span className="mx-1">|</span>
                  <Star className="h-4 w-4 fill-[#FFA726] text-[#FFA726]" />
                  <span>{selectedStore.rating.kakao}</span>
                  <span className="text-gray-400">{t("kakao")}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  <span>
                    {selectedStore.distance
                      ? `${selectedStore.distance}m`
                      : t("no_distance_info")}
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
              {selectedStore.description || t("no_description")}
            </p>
            <Link href={`/store/${selectedStore.id}`}>
              <Button className="w-full mt-3 bg-[#FF5722] hover:bg-[#E64A19]">
                {t("view_details")}
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
          aria-label={t("zoom_in")}
        >
          <span className="text-lg font-bold">+</span>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="bg-white shadow-md h-8 w-8"
          onClick={() => map && map.setZoom(map.getZoom() - 1)}
          aria-label={t("zoom_out")}
        >
          <span className="text-lg font-bold">-</span>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="bg-white shadow-md h-8 w-8"
          onClick={getCurrentLocation}
          aria-label={t("current_location")}
        >
          <MapPin className="h-4 w-4 text-[#2196F3]" />
        </Button>
      </div>
    </div>
  );
}

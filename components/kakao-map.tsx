"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Store } from "@/types/store";
import { MapPin, Star, X } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    kakao: any;
  }
}

interface KakaoMapProps {
  stores: Store[];
  userLocation?: { lat: number; lng: number } | null;
  enableClustering?: boolean;
  center?: { lat: number; lng: number } | null;
  selectedStore?: Store | null;
  onStoreSelect?: (store: Store | null) => void;
}

export default function KakaoMap({
  stores = [],
  userLocation,
  enableClustering = true,
  center,
  selectedStore: propSelectedStore,
  onStoreSelect,
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [kakaoMapLoaded, setKakaoMapLoaded] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [markerClusters, setMarkerClusters] = useState<any>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const { toast } = useToast();
  const [locationError, setLocationError] = useState<string | null>(null);

  // props로 전달된 selectedStore가 변경되면 내부 상태 업데이트
  useEffect(() => {
    if (propSelectedStore) {
      setSelectedStore(propSelectedStore);
    }
  }, [propSelectedStore]);

  // 카카오 지도 API 로드 완료 핸들러
  const handleKakaoMapLoaded = () => {
    setKakaoMapLoaded(true);
  };

  // 사용자 위치 가져오기
  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (map) {
            map.setCenter(new window.kakao.maps.LatLng(latitude, longitude));
            // 현재 위치 마커 추가
            new window.kakao.maps.Marker({
              position: new window.kakao.maps.LatLng(latitude, longitude),
              map: map,
              image: new window.kakao.maps.MarkerImage(
                "data:image/svg+xml;utf8," +
                  encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
                    <circle cx="15" cy="15" r="8" fill="#2196F3" stroke="white" stroke-width="3"/>
                    <circle cx="15" cy="15" r="4" fill="white"/>
                  </svg>
                `),
                new window.kakao.maps.Size(30, 30),
                { offset: new window.kakao.maps.Point(15, 15) }
              ),
            });
          }
          setLocationError(null);
        },
        (error) => {
          console.error("위치 정보 오류:", error);
          toast({
            title: "위치 오류",
            description: "위치 정보를 가져올 수 없습니다.",
            variant: "destructive",
          });
          setLocationError("위치 정보를 가져올 수 없습니다.");
        }
      );
    } else {
      toast({
        title: "위치 지원 안함",
        description: "이 브라우저는 위치 서비스를 지원하지 않습니다.",
        variant: "destructive",
      });
      setLocationError("이 브라우저는 위치 서비스를 지원하지 않습니다.");
    }
  }, [map, toast]);

  // 지도 초기화
  useEffect(() => {
    if (!kakaoMapLoaded || !mapRef.current) return;

    try {
      // window.kakao가 정의되어 있는지 확인
      if (!window.kakao || !window.kakao.maps) {
        console.error("카카오 지도 API가 로드되지 않았습니다.");
        setLocationError(
          "지도 API를 로드하는데 실패했습니다. 페이지를 새로고침해 주세요."
        );
        return;
      }

      // 초기 좌표 설정 (사용자 위치 또는 기본값)
      const initialLat = userLocation?.lat || center?.lat || 37.5665;
      const initialLng = userLocation?.lng || center?.lng || 126.978;

      // 지도 옵션
      const mapOptions = {
        center: new window.kakao.maps.LatLng(initialLat, initialLng),
        level: 5, // 확대 레벨 (1~14)
      };

      // 지도 생성
      const newMap = new window.kakao.maps.Map(mapRef.current, mapOptions);
      setMap(newMap);

      // 현재 위치 마커 추가 (사용자 위치가 있는 경우)
      if (userLocation) {
        new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(
            userLocation.lat,
            userLocation.lng
          ),
          map: newMap,
          image: new window.kakao.maps.MarkerImage(
            "data:image/svg+xml;utf8," +
              encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
                <circle cx="15" cy="15" r="8" fill="#2196F3" stroke="white" stroke-width="3"/>
                <circle cx="15" cy="15" r="4" fill="white"/>
              </svg>
            `),
            new window.kakao.maps.Size(30, 30),
            { offset: new window.kakao.maps.Point(15, 15) }
          ),
        });
      }

      // 지도 클릭 이벤트 - 선택된 가게 초기화
      window.kakao.maps.event.addListener(newMap, "click", () => {
        setSelectedStore(null);
        onStoreSelect?.(null);
      });

      return () => {
        // 이벤트 리스너 제거 로직
        if (newMap) {
          window.kakao.maps.event.removeListener(newMap, "click");
        }
      };
    } catch (error) {
      console.error("지도 초기화 오류:", error);
      setLocationError(
        "지도를 초기화하는데 실패했습니다. 페이지를 새로고침해 주세요."
      );
      toast({
        title: "지도 초기화 오류",
        description: "지도를 초기화하는데 실패했습니다.",
        variant: "destructive",
      });
    }
  }, [kakaoMapLoaded, userLocation, center, toast, onStoreSelect]);

  // center props로 지도 중심 이동
  useEffect(() => {
    if (map && center) {
      map.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
    }
  }, [center, map]);

  // 마커 클러스터링 설정
  const setupMarkerClustering = useCallback(
    (map: any, markers: any[]) => {
      if (
        !enableClustering ||
        !window.kakao ||
        !window.kakao.maps ||
        !window.kakao.maps.MarkerClusterer
      ) {
        return null;
      }

      // 기존 클러스터가 있으면 제거
      if (markerClusters) {
        markerClusters.clear();
      }

      // 클러스터 생성
      const cluster = new window.kakao.maps.MarkerClusterer({
        map: map,
        averageCenter: true,
        minLevel: 5,
        disableClickZoom: false,
        styles: [
          {
            width: "40px",
            height: "40px",
            background: "rgba(255,87,34,0.9)",
            borderRadius: "20px",
            color: "#fff",
            textAlign: "center",
            fontWeight: "bold",
            lineHeight: "40px",
            fontSize: "12px",
          },
          {
            width: "50px",
            height: "50px",
            background: "rgba(255,87,34,0.9)",
            borderRadius: "25px",
            color: "#fff",
            textAlign: "center",
            fontWeight: "bold",
            lineHeight: "50px",
            fontSize: "14px",
          },
          {
            width: "60px",
            height: "60px",
            background: "rgba(255,87,34,0.9)",
            borderRadius: "30px",
            color: "#fff",
            textAlign: "center",
            fontWeight: "bold",
            lineHeight: "60px",
            fontSize: "16px",
          },
        ],
      });

      // 마커 추가
      cluster.addMarkers(markers);

      return cluster;
    },
    [enableClustering, markerClusters]
  );

  // 가게 마커 추가
  useEffect(() => {
    if (!map || !stores.length || !window.kakao || !window.kakao.maps) return;

    try {
      // 기존 마커 제거
      markers.forEach((marker) => marker.setMap(null));

      // 새 마커 배열
      const newMarkers = [];

      // 각 가게별 마커 생성
      for (const store of stores) {
        if (
          !store ||
          !store.position ||
          !store.position.lat ||
          !store.position.lng
        ) {
          console.warn("유효하지 않은 가게 데이터:", store);
          continue;
        }

        const markerPosition = new window.kakao.maps.LatLng(
          store.position.lat,
          store.position.lng
        );

        // 커스텀 마커 이미지 생성
        const markerImage = new window.kakao.maps.MarkerImage(
          "data:image/svg+xml;utf8," +
            encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="#FF5722" stroke="white" stroke-width="3"/>
              <path d="M20 8c-4.4 0-8 3.6-8 8 0 5.3 8 16 8 16s8-10.7 8-16c0-4.4-3.6-8-8-8zm0 11c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z" fill="white"/>
            </svg>
          `),
          new window.kakao.maps.Size(40, 40),
          { offset: new window.kakao.maps.Point(20, 40) }
        );

        const marker = new window.kakao.maps.Marker({
          position: markerPosition,
          map: map,
          image: markerImage,
          title: store.name,
        });

        // 마커에 store 데이터 저장
        marker.store = store;

        // 마커 클릭 이벤트
        window.kakao.maps.event.addListener(marker, "click", () => {
          setSelectedStore(store);
          onStoreSelect?.(store);
          map.panTo(markerPosition);
        });

        newMarkers.push(marker);
      }

      setMarkers(newMarkers);

      // 클러스터링 적용
      if (newMarkers.length > 0 && enableClustering) {
        const cluster = setupMarkerClustering(map, newMarkers);
        setMarkerClusters(cluster);
      }

      // 모든 마커가 보이도록 지도 범위 조정
      if (stores.length > 1) {
        const bounds = new window.kakao.maps.LatLngBounds();

        // 사용자 위치가 있으면 포함
        if (userLocation) {
          bounds.extend(
            new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
          );
        }

        // 모든 가게 위치 포함
        stores.forEach((store) => {
          bounds.extend(
            new window.kakao.maps.LatLng(store.position.lat, store.position.lng)
          );
        });

        // 지도 범위 설정
        map.setBounds(bounds);
      }
    } catch (error) {
      console.error("마커 생성 오류:", error);
      toast({
        title: "마커 오류",
        description: "지도 마커를 생성하는데 실패했습니다.",
        variant: "destructive",
      });
    }
  }, [
    map,
    stores,
    userLocation,
    setupMarkerClustering,
    enableClustering,
    toast,
    onStoreSelect,
  ]);

  return (
    <div className="w-full h-full bg-gray-100 relative">
      {/* 위치 에러 안내 메시지 */}
      {locationError && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-red-300 rounded shadow-lg p-4 flex flex-col items-center max-w-xs w-full">
          <div className="text-red-500 font-bold mb-2">위치 정보 오류</div>
          <div className="text-sm text-gray-700 mb-3 text-center">
            {locationError}
          </div>
          <div className="text-xs text-gray-500 mb-2">
            수동으로 지역/주소를 검색해보세요.
          </div>
        </div>
      )}

      {/* 카카오 지도 스크립트 */}
      <Script
        strategy="afterInteractive"
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${
          process.env.NEXT_PUBLIC_KAKAO_API_KEY || ""
        }&libraries=services,clusterer&autoload=false`}
        onLoad={() => {
          window.kakao.maps.load(() => {
            handleKakaoMapLoaded();
          });
        }}
        onError={(e) => {
          console.error("카카오 지도 스크립트 로딩 오류:", e);
          toast({
            title: "지도 로드 오류",
            description: "지도를 로드하는데 실패했습니다.",
            variant: "destructive",
          });
        }}
      />

      {/* 지도 컨테이너 */}
      <div
        ref={mapRef}
        className="w-full h-full"
        aria-label="카카오 지도"
      ></div>

      {/* 선택된 가게 정보 팝업 */}
      {selectedStore && (
        <Card className="absolute bottom-24 left-1/2 transform -translate-x-1/2 md:left-auto md:right-4 md:bottom-4 md:transform-none w-80 shadow-lg z-20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div
                className="w-20 h-20 rounded-md bg-gray-200 flex-shrink-0 bg-cover bg-center"
                style={{
                  backgroundImage: selectedStore.imageUrls?.[0]
                    ? `url(${selectedStore.imageUrls[0]})`
                    : "url('/placeholder.svg?height=80&width=80')",
                }}
                role="img"
                aria-label={`${selectedStore.name} 이미지`}
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
                      onStoreSelect?.(null);
                    }}
                    aria-label="닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-[#FFA726] text-[#FFA726]" />
                  <span>{selectedStore.rating.naver}</span>
                  <span className="text-gray-400">네이버</span>
                  <span className="mx-1">|</span>
                  <Star className="h-4 w-4 fill-[#FFA726] text-[#FFA726]" />
                  <span>{selectedStore.rating.kakao}</span>
                  <span className="text-gray-400">카카오</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  <span>
                    {selectedStore.distance
                      ? `${selectedStore.distance}km`
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
              {selectedStore.description || "설명이 없습니다."}
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
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <Button
          variant="secondary"
          size="icon"
          className="bg-white shadow-md h-8 w-8"
          onClick={() => map && map.setLevel(map.getLevel() - 1)}
          aria-label="확대"
        >
          <span className="text-lg font-bold">+</span>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="bg-white shadow-md h-8 w-8"
          onClick={() => map && map.setLevel(map.getLevel() + 1)}
          aria-label="축소"
        >
          <span className="text-lg font-bold">-</span>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="bg-white shadow-md h-8 w-8"
          onClick={getCurrentLocation}
          aria-label="현재 위치"
        >
          <MapPin className="h-4 w-4 text-[#2196F3]" />
        </Button>
      </div>
    </div>
  );
}

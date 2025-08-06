"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useGeolocation } from "@/hooks/use-geolocation";
import { mapLogger } from "@/lib/logger";
import { Store } from "@/types/store";
import { MapPin, Star, X, ExternalLink, Phone } from "lucide-react";
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
  onLocationChange?: (lat: number, lng: number) => void;
  onManualSearch?: (lat: number, lng: number) => void;
  isVisible?: boolean;
}

export default function KakaoMap({
  stores = [],
  userLocation,
  enableClustering = true,
  center,
  selectedStore: propSelectedStore,
  onStoreSelect,
  onLocationChange,
  onManualSearch,
  isVisible = true,
}: KakaoMapProps) {
  mapLogger.debug("KakaoMap component rendering", {
    storeCount: stores.length,
    userLocation,
    isVisible,
    enableClustering,
  });

  const mapRef = useRef<HTMLDivElement>(null);
  const [kakaoMapLoaded, setKakaoMapLoaded] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [markerClusters, setMarkerClusters] = useState<any>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(
    propSelectedStore || null,
  );
  const { toast } = useToast();
  const geolocation = useGeolocation();
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocationMarker, setUserLocationMarker] = useState<any>(null);
  const [isMapDragging, setIsMapDragging] = useState(false);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualSearchRef = useRef(false);
  const savedZoomLevelRef = useRef<number | null>(null);

  // API 키 확인
  const kakaoApiKey = process.env.NEXT_PUBLIC_KAKAO_API_KEY;

  useEffect(() => {
    if (!kakaoApiKey || kakaoApiKey === "demo") {
      console.warn("카카오 지도 API 키가 설정되지 않았습니다.");
      setLocationError(
        "카카오 지도 API 키가 필요합니다. .env.local 파일에 NEXT_PUBLIC_KAKAO_API_KEY를 설정해주세요.",
      );
    }
  }, [kakaoApiKey]);

  // 컴포넌트 마운트 시 카카오 API 상태 확인
  useEffect(() => {
    if (window.kakao?.maps) {
      console.log("카카오 API가 이미 로드되어 있음 - 즉시 사용 가능");
      setKakaoMapLoaded(true);
    }
  }, []); // 마운트 시에만 실행

  // props로 전달된 selectedStore가 변경되면 내부 상태 업데이트
  useEffect(() => {
    if (propSelectedStore) {
      setSelectedStore(propSelectedStore);
    }
  }, [propSelectedStore]);

  // stores props 변경 감지
  useEffect(() => {
    console.log("📦 stores props 변경됨:", {
      storeCount: stores.length,
      stores: stores.slice(0, 2), // 처음 2개만 로그로 출력
    });
  }, [stores]);

  // 카카오 지도 API 로드 완료 핸들러
  const handleKakaoMapLoaded = () => {
    console.log("카카오 지도 스크립트 로드 완료");
    if (window.kakao?.maps) {
      console.log("카카오 지도 API 사용 가능");
      setKakaoMapLoaded(true);
    } else {
      console.error("카카오 지도 API가 로드되지 않았습니다.");
      setLocationError("카카오 지도 API 로드 실패");
    }
  };

  // 지도 이동 시 검색 버튼 표시 (자동 검색 비활성화)
  const handleMapMove = useCallback(
    (lat: number, lng: number) => {
      console.log("📍 지도 이동 감지 - 전달받은 좌표:", { 
        lat: lat.toFixed(8), 
        lng: lng.toFixed(8),
        rawLat: lat,
        rawLng: lng,
      });
      setShowSearchButton(true);
      // 위치 변경은 저장하지만 자동 검색은 하지 않음
      if (onLocationChange) {
        onLocationChange(lat, lng);
      }
    },
    [onLocationChange],
  );

  // 수동 검색 실행
  const handleManualSearch = useCallback(() => {
    if (map && onManualSearch) {
      // 현재 줌 레벨 저장
      const currentLevel = map.getLevel();
      savedZoomLevelRef.current = currentLevel;
      
      // 줌 레벨 제한 정보 확인
      console.log("🔍 지도 줌 레벨 정보:", {
        현재레벨: currentLevel,
        최소레벨: map.getMinLevel ? map.getMinLevel() : "확인불가",
        최대레벨: map.getMaxLevel ? map.getMaxLevel() : "확인불가",
      });
      
      // 수동 검색 모드 활성화 (ref 사용으로 re-render 방지)
      isManualSearchRef.current = true;
      console.log("🔴 수동 검색 모드 활성화:", isManualSearchRef.current);
      console.log("💾 현재 줌 레벨 저장:", currentLevel);
      
      // 지도가 완전히 안정화될 때까지 잠시 대기
      setTimeout(() => {
        if (map && onManualSearch) {
          const center = map.getCenter();
          const lat = center.getLat();
          const lng = center.getLng();
          console.log("🎯 수동 검색 실행 - 최종 지도 중심점:", { 
            lat: lat.toFixed(8), 
            lng: lng.toFixed(8),
            rawLat: lat,
            rawLng: lng,
            currentLevel: map.getLevel(),
            savedLevel: savedZoomLevelRef.current,
            isManualSearch: isManualSearchRef.current,
            timestamp: new Date().toISOString(),
          });
          console.log("🗺️ 최종 지도 상태:", {
            center: center,
            level: map.getLevel(),
            bounds: map.getBounds(),
          });
          onManualSearch(lat, lng);
          setShowSearchButton(false);
        }
      }, 100); // 100ms 대기
    }
  }, [map, onManualSearch]);

  // 사용자 위치 가져오기
  const getCurrentLocation = useCallback(async () => {
    try {
      const coordinates = await geolocation.getCurrentPosition({
        showToast: true,
        customSuccessMessage: "현재 위치로 지도를 이동합니다.",
      });

      if (map) {
        map.setCenter(
          new window.kakao.maps.LatLng(coordinates.lat, coordinates.lng),
        );
        // 현재 위치 마커 추가
        new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(
            coordinates.lat,
            coordinates.lng,
          ),
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
            { offset: new window.kakao.maps.Point(15, 15) },
          ),
        });
      }
      setLocationError(null);
    } catch (error) {
      console.error("위치 정보 오류:", error);
      setLocationError("위치 정보를 가져올 수 없습니다.");
    }
  }, [map, geolocation]);

  // 지도 초기화 (한 번만 실행)
  useEffect(() => {
    // 카카오 API가 로드되어 있는지 먼저 확인
    if (!window.kakao?.maps) {
      console.log("카카오 API가 아직 로드되지 않음");
      // 카카오 API가 로드되어 있다면 강제로 로드 완료 처리
      if (window.kakao) {
        window.kakao.maps.load(() => {
          console.log("카카오 지도 API 수동 초기화 완료");
          setKakaoMapLoaded(true);
        });
      }
      return;
    }

    if (!mapRef.current || map) {
return;
}

    // 컨테이너가 보이는 상태에서만 초기화
    if (!isVisible) {
      console.log("지도 컨테이너가 보이지 않아 초기화 지연");
      return;
    }

    // kakaoMapLoaded 상태와 상관없이 API가 준비되면 초기화
    setKakaoMapLoaded(true);

    try {
      // window.kakao가 정의되어 있는지 확인
      if (!window.kakao?.maps) {
        console.error("카카오 지도 API가 로드되지 않았습니다.");
        setLocationError(
          "지도 API를 로드하는데 실패했습니다. 페이지를 새로고침해 주세요.",
        );
        return;
      }

      console.log("지도 초기화 시작", { isVisible });

      // 초기 좌표 설정 (서울 중심)
      const initialLat = 37.5665;
      const initialLng = 126.978;

      // 지도 옵션
      const mapOptions = {
        center: new window.kakao.maps.LatLng(initialLat, initialLng),
        level: 5, // 확대 레벨 (1~14)
      };

      // 지도 생성
      const newMap = new window.kakao.maps.Map(mapRef.current, mapOptions);
      setMap(newMap);

      console.log("지도 초기화 완료:", newMap);

      // center prop이 있으면 초기화 직후 중심점 설정
      if (center) {
        console.log("🎯 초기화 직후 지도 중심 설정:", center);
        const centerLatLng = new window.kakao.maps.LatLng(center.lat, center.lng);
        newMap.setCenter(centerLatLng);
        if (newMap.getLevel() > 5) {
          newMap.setLevel(5);
        }
      }

      // 지도 클릭 이벤트 - 선택된 가게 초기화
      window.kakao.maps.event.addListener(newMap, "click", () => {
        setSelectedStore(null);
        onStoreSelect?.(null);
      });

      // 지도 드래그 시작 이벤트
      window.kakao.maps.event.addListener(newMap, "dragstart", () => {
        setIsMapDragging(true);
      });

      // 지도 드래그 종료 이벤트 - 검색 버튼 표시
      window.kakao.maps.event.addListener(newMap, "dragend", () => {
        setIsMapDragging(false);
        const center = newMap.getCenter();
        const lat = center.getLat();
        const lng = center.getLng();
        handleMapMove(lat, lng);
      });

      // 지도 줌 변경 이벤트 - 검색 버튼 표시
      window.kakao.maps.event.addListener(newMap, "zoom_changed", () => {
        if (!isMapDragging) {
          // 드래그 중이 아닐 때만 위치 변경 처리 (줌만 변경된 경우)
          const center = newMap.getCenter();
          const lat = center.getLat();
          const lng = center.getLng();
          handleMapMove(lat, lng);
        }
      });

      // 지도 초기화 완료를 알리는 상태 설정
      setIsMapInitialized(true);

      // 지도 초기화 완료 후 약간의 지연을 두고 기존 stores 데이터 확인
      setTimeout(() => {
        if (stores.length > 0) {
          console.log(
            "🔄 지도 초기화 완료 후 기존 가게 데이터 확인:",
            stores.length,
            "개",
          );
          // stores useEffect가 다시 실행되어 마커가 추가됨
        }
      }, 100);

      return () => {
        // 이벤트 리스너 제거 로직
        if (newMap) {
          window.kakao.maps.event.removeListener(newMap, "click");
          window.kakao.maps.event.removeListener(newMap, "dragstart");
          window.kakao.maps.event.removeListener(newMap, "dragend");
          window.kakao.maps.event.removeListener(newMap, "zoom_changed");
        }
        // 디바운스 타이머 정리
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
      };
    } catch (error) {
      console.error("지도 초기화 오류:", error);
      setLocationError(
        "지도를 초기화하는데 실패했습니다. 페이지를 새로고침해 주세요.",
      );
      toast({
        title: "지도 초기화 오류",
        description: "지도를 초기화하는데 실패했습니다.",
        variant: "destructive",
      });
    }
  }, [
    kakaoMapLoaded,
    toast,
    onStoreSelect,
    isVisible,
    map,
    handleMapMove,
    isMapDragging,
  ]); // 새로운 의존성 추가

  // center props로 지도 중심 이동 (지도 초기화 완료 후)
  useEffect(() => {
    if (!map || !center || !window.kakao?.maps || !isVisible) {
      return;
    }

    console.log("center props로 지도 중심 이동:", center);
    
    // 지도가 완전히 초기화될 때까지 잠시 대기
    const timer = setTimeout(() => {
      try {
        const centerLatLng = new window.kakao.maps.LatLng(center.lat, center.lng);
        map.setCenter(centerLatLng);
        
        // 약간의 줌 레벨 조정
        if (map.getLevel() > 5) {
          map.setLevel(5);
        }
        
        // 지도 리사이즈 (레이아웃 재계산)
        setTimeout(() => {
          map.relayout();
        }, 100);
        
        console.log("✅ 지도 중심 이동 완료:", center);
      } catch (error) {
        console.error("지도 중심 이동 중 오류:", error);
      }
    }, 300); // 300ms 대기

    return () => clearTimeout(timer);
  }, [center, map, isVisible]);

  // userLocation 변경 시 지도 중심 업데이트 및 마커 추가 (center prop이 없을 때만)
  useEffect(() => {
    if (!map || !userLocation || !window.kakao?.maps || !isVisible || center) {
      // center prop이 있으면 userLocation으로 지도 중심 이동하지 않음
      return;
    }

    console.log("사용자 위치로 지도 중심 설정:", userLocation);
    console.log("수동 검색 모드 체크:", isManualSearchRef.current);

    // 지도 중심을 사용자 위치로 설정
    const userLatLng = new window.kakao.maps.LatLng(
      userLocation.lat,
      userLocation.lng,
    );

    // 수동 검색 중이 아닐 때만 지도 중심 이동
    if (!isManualSearchRef.current) {
      map.setCenter(userLatLng);
      console.log("✅ 지도 중심을 사용자 위치로 이동");
    } else {
      console.log("🔒 수동 검색 중 - 지도 중심 이동 건너뜀");
    }

    // 새로운 사용자 위치 마커 생성
    const newUserMarker = new window.kakao.maps.Marker({
      position: userLatLng,
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
        { offset: new window.kakao.maps.Point(15, 15) },
      ),
    });

    setUserLocationMarker(newUserMarker);
    console.log("사용자 위치 마커 생성 완료");
  }, [map, userLocation, isVisible, center]); // center 의존성 추가

  // 지도 가시성 변경 시 리사이즈 처리
  useEffect(() => {
    if (!map || !isVisible) {
      return;
    }

    // 지도가 보이게 될 때 리사이즈 실행
    const timeoutId = setTimeout(() => {
      try {
        console.log("지도 리사이즈 실행");
        map.relayout();
      } catch (error) {
        console.error("지도 리사이즈 오류:", error);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [map, isVisible]);

  // 마커 클러스터링 설정
  const setupMarkerClustering = useCallback(
    (map: any, markers: any[]) => {
      if (
        !enableClustering ||
        !window.kakao?.maps?.MarkerClusterer
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
    [enableClustering, markerClusters],
  );

  // 가게 마커 추가
  useEffect(() => {
    console.log("🔍 마커 추가 useEffect 실행됨:", {
      hasMap: !!map,
      storeCount: stores.length,
      hasKakao: !!window.kakao,
      hasKakaoMaps: !!(window.kakao?.maps),
      stores: stores.slice(0, 1), // 첫 번째 가게 데이터만 확인
    });

    if (
      !map ||
      !stores.length ||
      !window.kakao?.maps ||
      !isVisible ||
      !isMapInitialized
    ) {
      if (!map && stores.length > 0) {
        console.log("⏳ 지도가 아직 초기화되지 않음. 지도 초기화 대기 중...");
      } else if (!isMapInitialized && stores.length > 0) {
        console.log("🔄 지도 초기화 진행 중. 마커 추가 대기...");
      } else if (!isVisible) {
        console.log("👁️ 지도가 보이지 않음. 마커 추가 지연");
      } else {
        console.log("🏪 마커 추가 조건 미충족:", {
          hasMap: !!map,
          storeCount: stores.length,
          hasKakao: !!window.kakao,
          hasKakaoMaps: !!(window.kakao?.maps),
          isVisible,
          isMapInitialized,
          mapObject: map,
          storesArray: stores,
        });
      }
      return;
    }

    // 지도가 준비될 때까지 약간의 지연
    const timeoutId = setTimeout(() => {
      // 지도가 여전히 유효한지 다시 확인
      if (!map || !window.kakao?.maps) {
        console.log("⚠️ 지도 상태가 변경됨. 마커 추가 중단");
        return;
      }

      console.log("🏪 가게 마커 추가 시작:", stores.length, "개 가게");

      try {
        // 기존 마커 제거
        markers.forEach((marker) => marker.setMap(null));

        // 새 마커 배열
        const newMarkers = [];

        // 각 가게별 마커 생성
        for (const store of stores) {
          if (
            !store?.position?.lat ||
            !store.position.lng
          ) {
            console.warn("❌ 유효하지 않은 가게 데이터:", store);
            continue;
          }

          try {
            const markerPosition = new window.kakao.maps.LatLng(
              store.position.lat,
              store.position.lng,
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
              { offset: new window.kakao.maps.Point(20, 40) },
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
            window.kakao.maps.event.addListener(marker, "click", (e: any) => {
              if (e && typeof e.stopPropagation === "function") {
                e.stopPropagation();
              }
              console.log("📍 마커 클릭됨:", store.name);
              setSelectedStore(store);
              onStoreSelect?.(store);
              map.panTo(markerPosition);
            });

            newMarkers.push(marker);
            console.log("✅ 마커 생성 완료:", store.name);
          } catch (markerError) {
            console.error("❌ 마커 생성 오류:", store.name, markerError);
            // 마커 생성 실패해도 계속 진행
          }
        }

        console.log("🎯 총", newMarkers.length, "개 마커 생성됨");

        setMarkers(newMarkers);

        // 클러스터링 적용
        if (newMarkers.length > 0 && enableClustering) {
          const cluster = setupMarkerClustering(map, newMarkers);
          setMarkerClusters(cluster);
          console.log("🔗 마커 클러스터링 설정 완료");
        }

        // 수동 검색이 아닐 때만 지도 범위 자동 조정
        console.log("🔍 범위 조정 체크:", {
          storeCount: stores.length,
          isManualSearch: isManualSearchRef.current,
        });
        
        if (stores.length > 0 && !isManualSearchRef.current) {
          const bounds = new window.kakao.maps.LatLngBounds();

          // 사용자 위치가 있으면 포함
          if (userLocation) {
            bounds.extend(
              new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng),
            );
          }

          // 모든 가게 위치 포함
          stores.forEach((store) => {
            bounds.extend(
              new window.kakao.maps.LatLng(
                store.position.lat,
                store.position.lng,
              ),
            );
          });

          // 지도 범위 설정
          map.setBounds(bounds);
          console.log("🗺️ 지도 범위 조정 완료 - 자동 핏");
        } else if (isManualSearchRef.current) {
          console.log("🔒 수동 검색 모드 - 현재 줌 레벨 유지, 범위 조정 건너뜀");
          console.log("🔍 현재 줌 레벨:", map.getLevel());
          
          // 저장된 줌 레벨로 복원 (다른 모든 작업 완료 후)
          if (savedZoomLevelRef.current !== null) {
            const beforeLevel = map.getLevel();
            console.log("🔄 줌 레벨 복원 시작:", {
              저장된레벨: savedZoomLevelRef.current,
              현재레벨: beforeLevel,
              차이: savedZoomLevelRef.current - beforeLevel,
            });
            
            const savedLevel = savedZoomLevelRef.current;
            savedZoomLevelRef.current = null;
            
            // 모든 지도 작업이 완료된 후 줌 레벨 복원
            setTimeout(() => {
              console.log("⏰ 지연된 줌 레벨 복원 실행");
              const beforeRestoreLevel = map.getLevel();
              
              // 줌 레벨 유효성 검사 (카카오 맵은 1~14 레벨)
              const validLevel = Math.max(1, Math.min(14, savedLevel));
              if (validLevel !== savedLevel) {
                console.log("⚠️ 줌 레벨 범위 조정:", {
                  원본: savedLevel,
                  조정됨: validLevel,
                });
              }
              
              map.setLevel(validLevel);
              
              // 복원 후 재확인
              setTimeout(() => {
                const afterLevel = map.getLevel();
                console.log("✅ 최종 줌 레벨 복원 완료:", {
                  복원전레벨: beforeRestoreLevel,
                  요청한레벨: validLevel,
                  실제레벨: afterLevel,
                  성공여부: afterLevel === validLevel,
                });
                
                // 만약 복원이 실패했다면 한 번 더 시도
                if (afterLevel !== validLevel) {
                  console.log("⚠️ 줌 레벨 복원 실패, 재시도");
                  map.setLevel(validLevel);
                  
                  // 최종 확인
                  setTimeout(() => {
                    const finalLevel = map.getLevel();
                    console.log("🔄 재시도 후 최종 레벨:", finalLevel);
                  }, 50);
                }
              }, 100);
            }, 200); // 200ms 지연으로 다른 모든 작업 완료 대기
          }
          
          // 수동 검색 모드 해제
          isManualSearchRef.current = false;
          console.log("🟢 수동 검색 모드 해제:", isManualSearchRef.current);
        }
      } catch (error) {
        console.error("❌ 마커 생성 전체 오류:", error);
        toast({
          title: "마커 오류",
          description: "지도 마커를 생성하는데 실패했습니다.",
          variant: "destructive",
        });
      }
    }, 100); // 100ms 지연

    return () => clearTimeout(timeoutId);
  }, [
    map,
    stores,
    userLocation,
    enableClustering,
    isVisible,
    isMapInitialized,
  ]);

  // API 키가 없으면 에러 화면 표시
  if (!kakaoApiKey || kakaoApiKey === "demo") {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-red-500 text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            지도 설정 필요
          </h3>
          <p className="text-gray-600 mb-4">
            카카오 지도를 사용하려면 API 키가 필요합니다.
          </p>
          <div className="text-left bg-gray-50 p-4 rounded text-sm">
            <p className="font-semibold mb-2">설정 방법:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>
                <a
                  href="https://developers.kakao.com/console/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  카카오 개발자 콘솔
                </a>
                에서 API 키 발급
              </li>
              <li>프로젝트 루트에 .env.local 파일 생성</li>
              <li>NEXT_PUBLIC_KAKAO_API_KEY=발급받은키 추가</li>
              <li>개발 서버 재시작</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-100 relative">
      {/* 위치 에러 안내 메시지 */}
      {locationError && !locationError.includes("API 키") && (
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
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoApiKey}&libraries=services,clusterer&autoload=false`}
        onLoad={() => {
          console.log("카카오 지도 스크립트 로드됨");
          if (window.kakao?.maps) {
            window.kakao.maps.load(() => {
              console.log("카카오 지도 API 초기화 완료");
              handleKakaoMapLoaded();
            });
          } else {
            console.error("window.kakao.maps가 정의되지 않음");
            setLocationError("카카오 지도 API 초기화 실패");
          }
        }}
        onError={(e) => {
          console.error("카카오 지도 스크립트 로딩 오류:", e);
          setLocationError("카카오 지도 스크립트 로드 실패");
          toast({
            title: "지도 로드 오류",
            description:
              "지도를 로드하는데 실패했습니다. API 키를 확인해주세요.",
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

      {/* 선택된 가게 정보 팝업 - 크기 및 디자인 개선 */}
      {selectedStore && (
        <Card className="absolute bottom-4 left-1/2 transform -translate-x-1/2 md:left-auto md:right-4 md:bottom-4 md:transform-none w-96 max-w-[calc(100vw-2rem)] shadow-xl border-2 border-[#FF5722]/20 z-20 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-6">
            {/* 헤더 - 닫기 버튼과 제목 */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#FF5722] rounded-full"></div>
                <span className="text-sm font-medium text-[#FF5722]">가게 정보</span>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStore(null);
                  onStoreSelect?.(null);
                }}
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 메인 컨텐츠 */}
            <div className="flex gap-4">
              <div
                className="w-24 h-24 rounded-lg bg-gray-200 flex-shrink-0 bg-cover bg-center shadow-sm"
                style={{
                  backgroundImage: selectedStore.imageUrls?.[0]
                    ? `url(${selectedStore.imageUrls[0]})`
                    : "url('/placeholder.svg?height=96&width=96')",
                }}
                role="img"
                aria-label={`${selectedStore.name} 이미지`}
              ></div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-[#333333] mb-2 line-clamp-1">
                  {selectedStore.name}
                </h3>
                
                {/* 평점 및 리뷰 */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-[#FFA726] text-[#FFA726]" />
                    <span className="font-medium text-[#FFA726]">
                      {selectedStore.avgRating ? selectedStore.avgRating.toFixed(1) : "평점 없음"}
                    </span>
                  </div>
                  <span className="text-gray-500 text-sm">
                    리뷰 {selectedStore.reviewCount || 0}개
                  </span>
                </div>

                {/* 거리 정보 */}
                <div className="flex items-center gap-1 mb-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {selectedStore.distance ? `${selectedStore.distance}km` : "거리 정보 없음"}
                  </span>
                </div>

                {/* 카테고리 태그 */}
                {selectedStore.categories && selectedStore.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {selectedStore.categories.slice(0, 2).map((category, index) => (
                      <Badge key={index} variant="secondary" className="text-xs bg-[#FF5722]/10 text-[#FF5722] border-[#FF5722]/20">
                        {category}
                      </Badge>
                    ))}
                    {selectedStore.refillItems && Array.isArray(selectedStore.refillItems) && selectedStore.refillItems.length > 0 && (
                      <Badge className="text-xs bg-[#FF5722] text-white">무한리필</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2 mt-4">
              <Button 
                className="flex-1 bg-[#FF5722] hover:bg-[#E64A19] text-white font-medium shadow-sm"
                onClick={() => {
                  window.open(`/store/${selectedStore.id}`, "_blank");
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                상세 보기
              </Button>
              {selectedStore.phoneNumber && (
                <Button
                  variant="outline"
                  className="border-[#FF5722] text-[#FF5722] hover:bg-[#FF5722] hover:text-white"
                  onClick={() => {
                    window.open(`tel:${selectedStore.phoneNumber}`, "_self");
                  }}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 수동 검색 버튼 */}
      {showSearchButton && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
          <Button
            onClick={handleManualSearch}
            className="bg-[#FF5722] hover:bg-[#E64A19] text-white shadow-lg px-6 py-2 text-sm font-medium"
          >
            이 지역에서 검색
          </Button>
        </div>
      )}

      {/* 지도 컨트롤 */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
        <Button
          variant="secondary"
          size="icon"
          className="bg-white shadow-md h-8 w-8"
          onClick={() => map?.setLevel(map.getLevel() - 1)}
          aria-label="확대"
        >
          <span className="text-lg font-bold">+</span>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="bg-white shadow-md h-8 w-8"
          onClick={() => map?.setLevel(map.getLevel() + 1)}
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

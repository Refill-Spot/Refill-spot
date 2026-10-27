"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useGeolocation } from "@/hooks/use-geolocation";
import { loadKakaoMaps } from "@/lib/kakao-sdk";
import { mapLogger } from "@/lib/logger";
import { reconcileSelectedStore } from "@/lib/map-selection";
import { getMapPreviewPosition } from "@/lib/map-preview-position";
import {
  formatStoreDistance,
  getRepresentativeMenu,
} from "@/lib/store-presentation";
import { Store } from "@/types/store";
import { MapPin, X, ExternalLink, Navigation, Phone } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, Ref } from "react";
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
  previewTitleRef?: Ref<HTMLHeadingElement>;
  onLocationChange?: (lat: number, lng: number) => void;
  onManualSearch?: (lat: number, lng: number) => void;
  isVisible?: boolean;
}

function createStoreMarkerImage(selected: boolean) {
  const width = selected ? 32 : 24;
  const height = selected ? 42 : 32;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 32 42">
      <path d="M16 2C8.3 2 2 8.3 2 16c0 10 14 24 14 24s14-14 14-24C30 8.3 23.7 2 16 2Z" fill="#D65A2E" stroke="${selected ? "#292524" : "#FFFFFF"}" stroke-width="${selected ? 3 : 2}"/>
      ${selected ? '<path d="m10 16 4 4 8-8" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' : '<circle cx="16" cy="15" r="4" fill="#FFFFFF"/>'}
    </svg>
  `;

  return new window.kakao.maps.MarkerImage(
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    new window.kakao.maps.Size(width, height),
    { offset: new window.kakao.maps.Point(width / 2, height) },
  );
}

export default function KakaoMap({
  stores = [],
  userLocation,
  enableClustering = true,
  center,
  selectedStore: propSelectedStore,
  onStoreSelect,
  previewTitleRef,
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
  const previewRef = useRef<HTMLElement>(null);
  const [previewPosition, setPreviewPosition] = useState({ left: 12, top: 12 });
  const [kakaoMapLoaded, setKakaoMapLoaded] = useState(false);
  const [map, setMap] = useState<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapCleanupRef = useRef<(() => void) | null>(null);
  const markersRef = useRef<any[]>([]);
  const markerClustersRef = useRef<any>(null);
  const markerImagesRef = useRef<{ normal: any; selected: any } | null>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [internalSelectedStore, setInternalSelectedStore] =
    useState<Store | null>(null);
  const selectedStore =
    propSelectedStore === undefined ? internalSelectedStore : propSelectedStore;
  const selectedStoreRef = useRef(selectedStore);
  const storesRef = useRef(stores);
  const isControlledRef = useRef(propSelectedStore !== undefined);
  const onStoreSelectRef = useRef(onStoreSelect);
  const onLocationChangeRef = useRef(onLocationChange);
  const lastPannedSelectionRef = useRef<{ map: any; key: string } | null>(null);
  const lastMapSizeRef = useRef<{
    map: any;
    width: number;
    height: number;
  } | null>(null);
  selectedStoreRef.current = selectedStore;
  storesRef.current = stores;
  isControlledRef.current = propSelectedStore !== undefined;
  onStoreSelectRef.current = onStoreSelect;
  onLocationChangeRef.current = onLocationChange;
  const { toast } = useToast();
  const geolocation = useGeolocation();
  const [locationError, setLocationError] = useState<string | null>(null);
  const userLocationMarkerRef = useRef<any>(null);
  const isMapDraggingRef = useRef(false);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const isManualSearchRef = useRef(false);
  const savedZoomLevelRef = useRef<number | null>(null);

  const selectStore = useCallback((store: Store | null) => {
    const currentStore = reconcileSelectedStore(store, storesRef.current);
    if (!isControlledRef.current) {
      setInternalSelectedStore(currentStore);
    }
    onStoreSelectRef.current?.(currentStore);
  }, []);

  const updateMarkerSelection = useCallback(() => {
    if (!window.kakao?.maps || !mapInstanceRef.current) {
      return;
    }

    const images = (markerImagesRef.current ??= {
      normal: createStoreMarkerImage(false),
      selected: createStoreMarkerImage(true),
    });
    const selectedId = selectedStoreRef.current?.id;
    const cluster = markerClustersRef.current;
    cluster?.clear();
    markersRef.current.forEach((marker) => {
      const selected = marker.store.id === selectedId;
      marker.setImage(selected ? images.selected : images.normal);
      marker.setZIndex(selected ? 10 : 0);
      marker.setMap(selected || !cluster ? mapInstanceRef.current : null);
    });
    cluster?.addMarkers(
      markersRef.current.filter((marker) => marker.store.id !== selectedId),
    );
  }, []);

  const relayoutMap = useCallback(() => {
    const currentMap = mapInstanceRef.current;
    const container = mapRef.current;
    if (!currentMap || !container?.clientWidth || !container.clientHeight) {
      return;
    }
    const width = container.clientWidth;
    const height = container.clientHeight;
    const previousSize = lastMapSizeRef.current;
    if (
      previousSize !== null &&
      previousSize.map === currentMap &&
      previousSize.width === width &&
      previousSize.height === height
    ) {
      return;
    }

    const currentCenter = currentMap.getCenter();
    currentMap.relayout();
    currentMap.setCenter(currentCenter);
    lastMapSizeRef.current = { map: currentMap, width, height };
  }, []);

  // API 키 확인
  const kakaoApiKey = process.env.NEXT_PUBLIC_KAKAO_API_KEY?.trim();

  useEffect(() => {
    let active = true;
    void loadKakaoMaps().then(
      () => {
        if (active) {
          setKakaoMapLoaded(true);
        }
      },
      (error: unknown) => {
        if (active) {
          setLocationError(
            error instanceof Error
              ? error.message
              : "카카오 지도 SDK 로드 실패",
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // stores props 변경 감지
  useEffect(() => {
    console.log("📦 stores props 변경됨:", {
      storeCount: stores.length,
      stores: stores.slice(0, 2), // 처음 2개만 로그로 출력
    });
  }, [stores]);

  // 지도 이동 시 검색 버튼 표시 (자동 검색 비활성화)
  const handleMapMove = useCallback((lat: number, lng: number) => {
    console.log("📍 지도 이동 감지 - 전달받은 좌표:", {
      lat: lat.toFixed(8),
      lng: lng.toFixed(8),
      rawLat: lat,
      rawLng: lng,
    });
    setShowSearchButton(true);
    // 위치 변경은 저장하지만 자동 검색은 하지 않음
    onLocationChangeRef.current?.(lat, lng);
  }, []);

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
        userLocationMarkerRef.current?.setMap(null);
        userLocationMarkerRef.current = new window.kakao.maps.Marker({
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
    if (!kakaoMapLoaded || !window.kakao?.maps?.Map) {
      return;
    }

    if (!mapRef.current || mapInstanceRef.current) {
      return;
    }

    // 컨테이너가 보이는 상태에서만 초기화
    if (!isVisible) {
      console.log("지도 컨테이너가 보이지 않아 초기화 지연");
      return;
    }

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
      mapInstanceRef.current = newMap;
      setMap(newMap);

      console.log("지도 초기화 완료:", newMap);

      // center prop이 있으면 초기화 직후 중심점 설정
      if (center) {
        console.log("🎯 초기화 직후 지도 중심 설정:", center);
        const centerLatLng = new window.kakao.maps.LatLng(
          center.lat,
          center.lng,
        );
        newMap.setCenter(centerLatLng);
        if (newMap.getLevel() > 5) {
          newMap.setLevel(5);
        }
      }

      // 지도 클릭 이벤트 - 선택된 가게 초기화
      const handleMapClick = () => selectStore(null);
      window.kakao.maps.event.addListener(newMap, "click", handleMapClick);

      // 지도 드래그 시작 이벤트
      const handleDragStart = () => {
        isMapDraggingRef.current = true;
      };
      window.kakao.maps.event.addListener(newMap, "dragstart", handleDragStart);

      // 지도 드래그 종료 이벤트 - 검색 버튼 표시
      const handleDragEnd = () => {
        isMapDraggingRef.current = false;
        const center = newMap.getCenter();
        const lat = center.getLat();
        const lng = center.getLng();
        handleMapMove(lat, lng);
      };
      window.kakao.maps.event.addListener(newMap, "dragend", handleDragEnd);

      // 지도 줌 변경 이벤트 - 검색 버튼 표시
      const handleZoomChange = () => {
        if (!isMapDraggingRef.current) {
          // 드래그 중이 아닐 때만 위치 변경 처리 (줌만 변경된 경우)
          const center = newMap.getCenter();
          const lat = center.getLat();
          const lng = center.getLng();
          handleMapMove(lat, lng);
        }
      };
      window.kakao.maps.event.addListener(
        newMap,
        "zoom_changed",
        handleZoomChange,
      );

      mapCleanupRef.current = () => {
        window.kakao.maps.event.removeListener(newMap, "click", handleMapClick);
        window.kakao.maps.event.removeListener(
          newMap,
          "dragstart",
          handleDragStart,
        );
        window.kakao.maps.event.removeListener(
          newMap,
          "dragend",
          handleDragEnd,
        );
        window.kakao.maps.event.removeListener(
          newMap,
          "zoom_changed",
          handleZoomChange,
        );
      };

      // 지도 초기화 완료를 알리는 상태 설정
      setIsMapInitialized(true);
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
  }, [kakaoMapLoaded, toast, isVisible, handleMapMove, selectStore, center]);

  useEffect(
    () => () => {
      mapCleanupRef.current?.();
      mapCleanupRef.current = null;
      markerClustersRef.current?.clear();
      markerClustersRef.current = null;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      userLocationMarkerRef.current?.setMap(null);
      userLocationMarkerRef.current = null;
      mapInstanceRef.current = null;
      lastMapSizeRef.current = null;
    },
    [],
  );

  // center props로 지도 중심 이동 (지도 초기화 완료 후)
  useEffect(() => {
    if (!map || !center || !window.kakao?.maps || !isVisible) {
      return;
    }

    console.log("center props로 지도 중심 이동:", center);

    // 지도가 완전히 초기화될 때까지 잠시 대기
    const timer = setTimeout(() => {
      try {
        if (selectedStoreRef.current) {
          return;
        }
        const centerLatLng = new window.kakao.maps.LatLng(
          center.lat,
          center.lng,
        );
        map.setCenter(centerLatLng);

        // 약간의 줌 레벨 조정
        if (map.getLevel() > 5) {
          map.setLevel(5);
        }

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
    if (!isManualSearchRef.current && !selectedStoreRef.current) {
      map.setCenter(userLatLng);
      console.log("✅ 지도 중심을 사용자 위치로 이동");
    } else {
      console.log("🔒 수동 검색 중 - 지도 중심 이동 건너뜀");
    }

    // 새로운 사용자 위치 마커 생성
    userLocationMarkerRef.current?.setMap(null);
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

    userLocationMarkerRef.current = newUserMarker;
    console.log("사용자 위치 마커 생성 완료");
    return () => {
      newUserMarker.setMap(null);
      if (userLocationMarkerRef.current === newUserMarker) {
        userLocationMarkerRef.current = null;
      }
    };
  }, [map, userLocation, isVisible, center]); // center 의존성 추가

  // 패널 높이와 지도 가시성 변경에도 중심점을 유지하며 크기 재계산
  useEffect(() => {
    if (!map || !mapRef.current || !isVisible) {
      return;
    }

    const container = mapRef.current;
    let frame: number | null = null;
    const relayout = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(relayoutMap);
    };
    const observer = new ResizeObserver(relayout);
    observer.observe(container);
    relayout();

    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [map, isVisible, relayoutMap]);

  const selectedId = selectedStore?.id;
  const selectedLat = selectedStore?.position.lat;
  const selectedLng = selectedStore?.position.lng;

  useEffect(() => {
    const container = mapRef.current;
    const preview = previewRef.current;
    if (
      !map ||
      !container ||
      !preview ||
      typeof selectedLat !== "number" ||
      typeof selectedLng !== "number"
    ) {
      return;
    }
    const updatePosition = () => {
      const point = map
        .getProjection()
        .containerPointFromCoords(
          new window.kakao.maps.LatLng(selectedLat, selectedLng),
        );
      const position = getMapPreviewPosition(
        point,
        { width: container.clientWidth, height: container.clientHeight },
        { width: preview.offsetWidth, height: preview.offsetHeight },
      );
      setPreviewPosition((previous) =>
        previous.left === position.left && previous.top === position.top
          ? previous
          : position,
      );
    };
    updatePosition();
    window.kakao.maps.event.addListener(map, "bounds_changed", updatePosition);
    const observer = new ResizeObserver(updatePosition);
    observer.observe(container);
    observer.observe(preview);
    return () => {
      observer.disconnect();
      window.kakao.maps.event.removeListener(
        map,
        "bounds_changed",
        updatePosition,
      );
    };
  }, [map, selectedId, selectedLat, selectedLng]);

  useEffect(() => {
    updateMarkerSelection();
  }, [map, selectedId, updateMarkerSelection]);

  // 외부 목록 선택과 마커 선택 모두 같은 경로로 한 번만 이동
  useEffect(() => {
    if (selectedId === undefined) {
      lastPannedSelectionRef.current = null;
      return;
    }
    if (
      !map ||
      !isVisible ||
      !window.kakao?.maps ||
      typeof selectedLat !== "number" ||
      typeof selectedLng !== "number" ||
      !Number.isFinite(selectedLat) ||
      !Number.isFinite(selectedLng)
    ) {
      return;
    }

    const key = `${selectedId}:${selectedLat}:${selectedLng}`;
    if (
      lastPannedSelectionRef.current !== null &&
      lastPannedSelectionRef.current.map === map &&
      lastPannedSelectionRef.current.key === key
    ) {
      return;
    }
    // 패널 크기를 먼저 반영해 관찰자의 중복 재계산이 이동을 중단하지 않도록 함
    relayoutMap();
    lastPannedSelectionRef.current = { map, key };
    map.panTo(new window.kakao.maps.LatLng(selectedLat, selectedLng));
  }, [map, isVisible, selectedId, selectedLat, selectedLng, relayoutMap]);

  // 마커 클러스터링 설정
  const setupMarkerClustering = useCallback(
    (map: any) => {
      if (!enableClustering || !window.kakao?.maps?.MarkerClusterer) {
        return null;
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

      return cluster;
    },
    [enableClustering],
  );

  // 가게 마커 추가
  useEffect(() => {
    console.log("🔍 마커 추가 useEffect 실행됨:", {
      hasMap: !!map,
      storeCount: stores.length,
      hasKakao: !!window.kakao,
      hasKakaoMaps: !!window.kakao?.maps,
      stores: stores.slice(0, 1), // 첫 번째 가게 데이터만 확인
    });

    if (stores.length === 0) {
      markerClustersRef.current?.clear();
      markerClustersRef.current = null;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      if (!isControlledRef.current) {
        setInternalSelectedStore(null);
      }
      return;
    }

    if (!map || !window.kakao?.maps || !isVisible || !isMapInitialized) {
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
          hasKakaoMaps: !!window.kakao?.maps,
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
        markerClustersRef.current?.clear();
        markerClustersRef.current = null;
        markersRef.current.forEach((marker) => marker.setMap(null));
        const images = (markerImagesRef.current ??= {
          normal: createStoreMarkerImage(false),
          selected: createStoreMarkerImage(true),
        });

        // 새 마커 배열
        const newMarkers = [];

        // 각 가게별 마커 생성
        for (const store of stores) {
          if (
            !Number.isFinite(store?.position?.lat) ||
            !Number.isFinite(store?.position?.lng)
          ) {
            console.warn("❌ 유효하지 않은 가게 데이터:", store);
            continue;
          }

          try {
            const markerPosition = new window.kakao.maps.LatLng(
              store.position.lat,
              store.position.lng,
            );

            const marker = new window.kakao.maps.Marker({
              position: markerPosition,
              map: map,
              image: images.normal,
              title: store.name,
            });

            // 마커에 store 데이터 저장
            marker.store = store;

            // 마커 클릭 이벤트
            window.kakao.maps.event.addListener(marker, "click", () => {
              window.kakao.maps.event.preventMap();
              console.log("📍 마커 클릭됨:", store.name);
              selectStore(store);
            });

            newMarkers.push(marker);
            console.log("✅ 마커 생성 완료:", store.name);
          } catch (markerError) {
            console.error("❌ 마커 생성 오류:", store.name, markerError);
            // 마커 생성 실패해도 계속 진행
          }
        }

        console.log("🎯 총", newMarkers.length, "개 마커 생성됨");

        markersRef.current = newMarkers;

        // 클러스터링 적용
        if (newMarkers.length > 0 && enableClustering) {
          markerClustersRef.current = setupMarkerClustering(map);
          console.log("🔗 마커 클러스터링 설정 완료");
        }
        updateMarkerSelection();

        // 수동 검색이 아닐 때만 지도 범위 자동 조정
        console.log("🔍 범위 조정 체크:", {
          storeCount: stores.length,
          isManualSearch: isManualSearchRef.current,
        });

        if (
          newMarkers.length > 0 &&
          !isManualSearchRef.current &&
          !selectedStoreRef.current
        ) {
          const bounds = new window.kakao.maps.LatLngBounds();

          // 사용자 위치가 있으면 포함
          if (userLocation) {
            bounds.extend(
              new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng),
            );
          }

          // 모든 가게 위치 포함
          newMarkers.forEach((marker) => {
            bounds.extend(marker.getPosition());
          });

          // 지도 범위 설정
          map.setBounds(bounds);
          console.log("🗺️ 지도 범위 조정 완료 - 자동 핏");
        } else if (isManualSearchRef.current) {
          console.log(
            "🔒 수동 검색 모드 - 현재 줌 레벨 유지, 범위 조정 건너뜀",
          );
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
    selectStore,
    setupMarkerClustering,
    updateMarkerSelection,
    toast,
  ]);

  const selectedMenu = selectedStore
    ? getRepresentativeMenu(selectedStore)
    : undefined;
  const distanceLabel = formatStoreDistance(selectedStore?.distance);
  const directionsUrl = selectedStore
    ? `https://map.kakao.com/link/to/${encodeURIComponent(selectedStore.name)},${selectedStore.position.lat},${selectedStore.position.lng}`
    : undefined;

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

      {/* 지도 컨테이너 */}
      <div
        ref={mapRef}
        className="w-full h-full"
        aria-label="카카오 지도"
      ></div>

      {/* 선택된 가게의 간결한 지도 미리보기 */}
      {selectedStore && (
        <section
          ref={previewRef}
          aria-labelledby="map-store-preview-title"
          style={
            {
              "--preview-left": `${previewPosition.left}px`,
              "--preview-top": `${previewPosition.top}px`,
            } as CSSProperties
          }
          className="absolute bottom-3 left-3 right-3 z-20 max-h-[45%] overflow-y-auto rounded-2xl border border-border/60 bg-card p-5 text-card-foreground shadow-[0_8px_30px_-10px_rgba(0,0,0,0.2)] md:bottom-auto md:left-[var(--preview-left)] md:right-auto md:top-[var(--preview-top)] md:max-h-[calc(100%_-_1.5rem)] md:w-80 md:max-w-[calc(100%_-_1.5rem)]"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              selectStore(null);
            }
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <h3
              ref={previewTitleRef}
              id="map-store-preview-title"
              tabIndex={-1}
              className="line-clamp-2 text-base font-semibold leading-6 tracking-tight"
            >
              {selectedStore.name}
            </h3>
            <button
              type="button"
              className="-mr-3 -mt-3 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => selectStore(null)}
              aria-label="가게 미리보기 닫기"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {selectedMenu ? (
            <div className="mt-2 flex items-start justify-between gap-4 text-sm leading-6">
              <p className="min-w-0 break-words text-muted-foreground">
                {selectedMenu.name}
                {selectedMenu.type && (
                  <span className="ml-1 text-muted-foreground">
                    ({selectedMenu.type})
                  </span>
                )}
              </p>
              <strong className="max-w-[45%] flex-shrink-0 break-words text-right font-medium tabular-nums">
                {selectedMenu.price?.trim() || "가격 미등록"}
              </strong>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {selectedStore.categories.slice(0, 2).join(" · ")}
              {selectedStore.categories.length > 0 && " · "}
              메뉴·가격 미등록
            </p>
          )}

          <address
            className="mt-2 line-clamp-2 text-xs not-italic leading-5 text-muted-foreground"
            title={selectedStore.address}
          >
            {selectedStore.address}
            {distanceLabel && <span className="ml-1">· {distanceLabel}</span>}
          </address>

          <nav
            aria-label={`${selectedStore.name} 바로가기`}
            className="mt-4 flex flex-wrap items-center gap-1 border-t border-border/50 pt-3 text-sm font-medium"
          >
            <Link
              href={`/store/${selectedStore.id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${selectedStore.name} 상세 보기 (새 탭)`}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              상세 보기
            </Link>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
              길찾기
              <span className="sr-only"> (카카오맵, 새 창)</span>
            </a>
            {selectedStore.phoneNumber?.trim() && (
              <a
                href={`tel:${selectedStore.phoneNumber}`}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${selectedStore.name} 전화 ${selectedStore.phoneNumber}`}
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                전화
              </a>
            )}
          </nav>
        </section>
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
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 md:top-auto md:bottom-4">
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

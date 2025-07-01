"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FormattedStore } from "@/types/store";
import { setupClustering } from "@/lib/map-integration";
import { useTranslation } from "@/hooks/use-translation";

interface UseMapMarkersOptions {
  map: any | null;
  stores: FormattedStore[];
  provider: "naver" | "kakao";
  enableClustering?: boolean;
  onMarkerClick?: (store: FormattedStore) => void;
  windowObj?: any; // window 객체에 대한 레퍼런스
}

export function useMapMarkers({
  map,
  stores,
  provider,
  enableClustering = true,
  onMarkerClick,
  windowObj,
}: UseMapMarkersOptions) {
  const [markers, setMarkers] = useState<any[]>([]);
  const [markerClusters, setMarkerClusters] = useState<any>(null);
  const markerMap = useRef(new Map<number, any>()); // 스토어 ID와 마커 매핑
  const { t } = useTranslation();

  // window 객체가 제공되지 않은 경우 전역 window 사용
  const win = windowObj || (typeof window !== "undefined" ? window : null);

  // 마커 생성 및 설정
  const createMarkers = useCallback(() => {
    if (!map || !stores.length || !win) return [];

    try {
      // 기존 마커 참조 맵 초기화
      const newMarkerMap = new Map<number, any>();
      const newMarkers: any[] = [];

      // 네이버 지도인 경우
      if (provider === "naver" && win.naver && win.naver.maps) {
        stores.forEach((store) => {
          // 이미 생성된 마커가 있으면 재사용, 없으면 새로 생성
          let marker = markerMap.current.get(store.id);

          if (!marker) {
            const markerPosition = new win.naver.maps.LatLng(
              store.position.lat,
              store.position.lng
            );

            marker = new win.naver.maps.Marker({
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
                anchor: new win.naver.maps.Point(15, 30),
              },
              zIndex: 100,
              title: store.name,
            });

            // 마커 클릭 이벤트
            if (onMarkerClick) {
              win.naver.maps.Event.addListener(marker, "click", () => {
                onMarkerClick(store);
              });
            }
          } else {
            // 기존 마커의 맵 재설정 (지도 변경 시 필요)
            marker.setMap(map);
          }

          // 마커에 store 데이터 저장
          marker.set("data", store);

          // 새 마커 맵에 저장 및 배열에 추가
          newMarkerMap.set(store.id, marker);
          newMarkers.push(marker);
        });
      }
      // 카카오 지도인 경우
      else if (provider === "kakao" && win.kakao && win.kakao.maps) {
        stores.forEach((store) => {
          // 이미 생성된 마커가 있으면 재사용, 없으면 새로 생성
          let marker = markerMap.current.get(store.id);

          if (!marker) {
            const markerPosition = new win.kakao.maps.LatLng(
              store.position.lat,
              store.position.lng
            );

            marker = new win.kakao.maps.Marker({
              position: markerPosition,
              map: map,
              title: store.name,
              // 커스텀 오버레이 사용
              image: new win.kakao.maps.MarkerImage(
                "/images/marker.png",
                new win.kakao.maps.Size(30, 30),
                { offset: new win.kakao.maps.Point(15, 30) }
              ),
            });

            // 마커 클릭 이벤트
            if (onMarkerClick) {
              win.kakao.maps.event.addListener(marker, "click", function () {
                onMarkerClick(store);
              });
            }
          } else {
            // 기존 마커의 맵 재설정 (지도 변경 시 필요)
            marker.setMap(map);
          }

          // 마커에 store 데이터 저장
          marker.store = store;

          // 새 마커 맵에 저장 및 배열에 추가
          newMarkerMap.set(store.id, marker);
          newMarkers.push(marker);
        });
      }

      // 사용하지 않는 마커 제거
      markerMap.current.forEach((marker, storeId) => {
        if (!newMarkerMap.has(storeId)) {
          marker.setMap(null);
        }
      });

      // 마커 맵 업데이트
      markerMap.current = newMarkerMap;
      setMarkers(newMarkers);

      return newMarkers;
    } catch (error) {
      console.error("마커 생성 오류:", error);
      return [];
    }
  }, [map, stores, provider, win, onMarkerClick]);

  // 메모이제이션된 마커 생성
  const memoizedMarkers = useMemo(() => {
    if (!map || !stores.length || !win) return [];
    return createMarkers();
  }, [map, stores, win, provider, onMarkerClick, createMarkers]);

  // 클러스터링 설정
  const setupClusteringEffect = useCallback(() => {
    if (!map || !stores.length || !win || !enableClustering) return;

    try {
      // 메모이제이션된 마커 사용
      const newMarkers = memoizedMarkers;

      // 클러스터가 이미 있으면 파괴 (네이버 지도)
      if (
        markerClusters &&
        provider === "naver" &&
        typeof markerClusters.destroy === "function"
      ) {
        markerClusters.destroy();
      }
      // 클러스터가 이미 있으면 마커 제거 (카카오 지도)
      else if (
        markerClusters &&
        provider === "kakao" &&
        typeof markerClusters.clear === "function"
      ) {
        markerClusters.clear();
      }

      // 클러스터링 옵션
      const clusterOptions = {
        minClusterSize: 2,
        maxZoom: 16,
        gridSize: 120,
        disableClickZoom: false,
        averageCenter: true,
      };

      // 클러스터링 설정
      const cluster = setupClustering(
        provider,
        win,
        map,
        newMarkers,
        clusterOptions
      );
      setMarkerClusters(cluster);
    } catch (error) {
      console.error("클러스터링 설정 오류:", error);
    }
  }, [map, stores, provider, win, enableClustering, memoizedMarkers]);

  // 맵, 스토어 변경시 마커 및 클러스터링 업데이트
  useEffect(() => {
    if (enableClustering) {
      setupClusteringEffect();
    } else {
      // enableClustering이 false일 때는 메모이제이션된 마커 사용
      setMarkers(memoizedMarkers);
    }

    // 컴포넌트 언마운트 시 마커 제거
    return () => {
      markerMap.current.forEach((marker) => {
        marker.setMap(null);
      });

      if (
        markerClusters &&
        provider === "naver" &&
        typeof markerClusters.destroy === "function"
      ) {
        markerClusters.destroy();
      } else if (
        markerClusters &&
        provider === "kakao" &&
        typeof markerClusters.clear === "function"
      ) {
        markerClusters.clear();
      }
    };
  }, [
    map,
    stores,
    provider,
    enableClustering,
    memoizedMarkers,
  ]);

  return {
    markers: memoizedMarkers,
    markerClusters,
    refreshMarkers: createMarkers,
    refreshClustering: setupClusteringEffect,
  };
}

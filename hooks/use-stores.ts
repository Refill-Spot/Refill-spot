"use client";

import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import {
  fetchAllStores,
  fetchFilteredStores,
} from "@/lib/api-utils";
import { Store } from "@/types/store";
import { useCallback, useEffect, useRef, useState } from "react";

// 필터 타입 정의
export interface StoreFilters {
  categories?: string[];
  maxDistance?: number;
  minRating?: number;
  latitude?: number;
  longitude?: number;
  query?: string;
  sort?: "default" | "rating" | "distance";
}

// 반환 타입 정의
export interface UseFetchStoresResult {
  stores: Store[];
  loading: boolean;
  error: string | null;
  setFilters: (filters: StoreFilters) => void;
  resetFilters: () => void;
  refetch: () => void;
}

export function useFetchStores(
  initialFilters?: StoreFilters
): UseFetchStoresResult {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StoreFilters>(initialFilters || {});
  const { toast } = useToast();
  const { t } = useTranslation();
  const isInitialMount = useRef(true);
  const isFetching = useRef(false);
  const retryCount = useRef(0);

  const fetchStores = useCallback(async () => {
    // 이미 fetch 중이면 중복 실행 방지
    if (isFetching.current) return;

    isFetching.current = true;
    setLoading(true);
    setError(null);

    try {
      let storeData: Store[] = [];

      // 필터 조건 유무 확인
      const hasFilters =
        (filters.latitude && filters.longitude) ||
        (filters.categories && filters.categories.length > 0) ||
        filters.minRating ||
        filters.query;

      if (hasFilters) {
        try {
          // 필터링된 가게 목록 가져오기
          storeData = await fetchFilteredStores(filters);
        } catch (filterError) {
          console.error("필터링된 가게 목록 조회 실패:", filterError);

          // 재시도 제한 (최대 1회)
          if (retryCount.current < 1) {
            retryCount.current++;
            console.log(`필터링 재시도 (${retryCount.current}/1)...`);

            try {
              // 검색어만 있는 경우 기본 목록 가져오기
              if (filters.query && !filters.latitude && !filters.longitude) {
                console.log("검색어 기반 필터링 실패, 기본 목록으로 대체");
                storeData = await fetchAllStores();
              } else {
                // 위치 기반 필터링 실패 시 필터 제거하고 재시도
                const simplifiedFilters = { ...filters };
                delete simplifiedFilters.latitude;
                delete simplifiedFilters.longitude;
                delete simplifiedFilters.maxDistance;

                if (Object.keys(simplifiedFilters).length > 0) {
                  console.log("위치 기반 필터링 제외하고 재시도");
                  storeData = await fetchFilteredStores(simplifiedFilters);
                } else {
                  console.log("모든 필터 제거하고 기본 목록으로 대체");
                  storeData = await fetchAllStores();
                }
              }
            } catch (retryError) {
              console.log("재시도도 실패, 기본 목록으로 대체");
              storeData = await fetchAllStores();
            }
          } else {
            console.log("최대 재시도 횟수 초과, 기본 목록으로 대체");
            storeData = await fetchAllStores();
            retryCount.current = 0;
          }
        }
      } else {
        // 필터 없음, 기본 가게 목록 가져오기
        storeData = await fetchAllStores();
        retryCount.current = 0;
      }

      // storeData가 undefined이거나 배열이 아닌 경우 빈 배열로 초기화
      if (!storeData || !Array.isArray(storeData)) {
        console.error("가게 데이터가 올바른 형식이 아닙니다:", storeData);
        storeData = [];
      }


      // 데이터가 비어있는 경우 로그 남기기
      if (storeData.length === 0) {
        console.warn("가게 데이터가 비어있습니다. 필터:", filters);
      }

      // 유효하지 않은 가게 데이터 필터링
      const validStores = storeData.filter((store) => {
        if (!store) {
          console.warn("잘못된 가게 데이터:", store);
          return false;
        }
        return true;
      });

      setStores(validStores);
      setError(null);
    } catch (err) {
      console.error("가게 데이터 로드 오류:", err);

      let errorMessage = "";

      if (err instanceof DOMException && err.name === "AbortError") {
        errorMessage =
          "요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.";
      } else {
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      setError(errorMessage);

      toast({
        title: t("store_load_error"),
        description: errorMessage,
        variant: "destructive",
      });

      // 오류 발생 시 빈 데이터라도 설정하여 UI 렌더링은 가능하게 함
      setStores([]);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [filters, toast, t]);

  // 필터가 변경될 때마다 가게 목록 다시 가져오기
  useEffect(() => {
    // 초기 마운트 시에는 실행하지 않음 (use-map-view에서 처리)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // 필터 변경 시에만 데이터 가져오기
    fetchStores();
  }, [filters]); // fetchStores 대신 filters를 의존성으로 사용

  // 새로운 필터를 설정하는 함수
  const updateFilters = useCallback((newFilters: StoreFilters) => {
    // 이전 필터와 비교하여 실제로 변경이 있는지 확인
    setFilters((prev) => {
      // 필터 변경 사항이 없으면 기존 상태 유지
      const updatedFilters = { ...prev, ...newFilters };

      // 모든 필터가 삭제된 경우
      if (Object.keys(newFilters).length === 0) {
        return {};
      }

      return updatedFilters;
    });
  }, []);

  // 필터 초기화 함수
  const resetFilters = useCallback(() => {
    setFilters({});
    retryCount.current = 0;
  }, []);

  // 수동으로 데이터를 다시 가져오는 함수
  const refetch = useCallback(() => {
    fetchStores();
  }, [fetchStores]);

  return {
    stores,
    loading,
    error,
    setFilters: updateFilters,
    resetFilters,
    refetch,
  };
}

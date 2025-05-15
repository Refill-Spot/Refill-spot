"use client";

import { useState, useEffect, useCallback } from "react";
import { Store } from "@/lib/stores";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";

// 필터 타입 정의
export interface StoreFilters {
  categories?: string[];
  maxDistance?: number;
  minRating?: number;
  latitude?: number;
  longitude?: number;
  query?: string;
}

export function useFetchStores(initialFilters?: StoreFilters) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StoreFilters>(initialFilters || {});
  const { toast } = useToast();
  const { t } = useTranslation();

  const fetchStores = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 사용자 위치와 필터가 있으면 필터링된 가게 목록 가져오기
      if (
        (filters.latitude && filters.longitude) ||
        filters.categories?.length ||
        filters.minRating ||
        filters.query
      ) {
        // POST 요청으로 필터링 API 호출
        const response = await fetch("/api/stores/filter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(filters),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setStores(data);
      } else {
        // 기본 가게 목록 가져오기
        const url = "/api/stores";
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setStores(data);
      }
    } catch (err) {
      console.error("가게 데이터 로드 오류:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);

      toast({
        title: t("store_load_error"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast, t]);

  // 필터가 변경될 때마다 가게 목록 다시 가져오기
  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // 새로운 필터를 설정하는 함수
  const updateFilters = useCallback((newFilters: StoreFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // 필터 초기화 함수
  const resetFilters = useCallback(() => {
    setFilters({});
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

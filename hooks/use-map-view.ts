"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFetchStores, StoreFilters } from "./use-stores";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { extractFiltersFromURL, filtersToURLParams } from "@/lib/api-utils";

export function useMapView(initialView: "map" | "list" = "map") {
  const [view, setView] = useState<"map" | "list">(initialView);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const { stores, loading, error, setFilters, resetFilters, refetch } =
    useFetchStores();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();

  // URL 파라미터에서 필터 설정 가져오기
  useEffect(() => {
    try {
      const filters = extractFiltersFromURL(searchParams);

      if (Object.keys(filters).length > 0) {
        setFilters(filters);

        // 위치 정보가 있으면 상태 업데이트
        if (filters.latitude && filters.longitude) {
          setUserLocation({
            lat: filters.latitude,
            lng: filters.longitude,
          });
        }
      }
    } catch (err) {
      console.error("URL 파라미터 처리 중 오류:", err);
    }
  }, [searchParams, setFilters]);

  // 현재 위치 가져오기
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: t("location_error"),
        description: t("location_not_supported_description"),
        variant: "destructive",
      });
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });

          // 필터에 위치 정보 추가
          setFilters({ latitude, longitude });

          // URL 업데이트
          const filters: StoreFilters = { latitude, longitude };
          const params = filtersToURLParams(filters);
          router.replace(`?${params.toString()}`);

          toast({
            title: t("location_detected"),
            description: t("location_filter_applied"),
          });
        },
        (error) => {
          console.error("Geolocation error:", error);

          let errorMessage = t("location_error_description");
          if (error.code === 1) {
            errorMessage = t("location_permission_denied");
          } else if (error.code === 2) {
            errorMessage = t("location_unavailable");
          } else if (error.code === 3) {
            errorMessage = t("location_timeout");
          }

          toast({
            title: t("location_error"),
            description: errorMessage,
            variant: "destructive",
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } catch (err) {
      console.error("위치 정보 요청 오류:", err);
      toast({
        title: t("location_error"),
        description: t("location_error_unknown"),
        variant: "destructive",
      });
    }
  }, [router, setFilters, toast, t]);

  // 검색 처리
  const handleSearch = useCallback(
    (query: string) => {
      if (!query || !query.trim()) {
        toast({
          title: t("search_error"),
          description: t("search_empty_query"),
          variant: "destructive",
        });
        return;
      }

      try {
        setFilters({ query: query.trim() });

        // URL 업데이트
        const filters: StoreFilters = { query: query.trim() };
        const params = filtersToURLParams(filters);
        router.replace(`?${params.toString()}`);
      } catch (err) {
        console.error("검색 처리 중 오류:", err);
        toast({
          title: t("search_error"),
          description: t("search_error_description"),
          variant: "destructive",
        });
      }
    },
    [router, setFilters, toast, t]
  );

  // 필터 적용
  const applyFilters = useCallback(
    (filters: StoreFilters) => {
      try {
        if (!filters || Object.keys(filters).length === 0) {
          resetFilters();
          router.replace("");
          return;
        }

        setFilters(filters);

        // URL 업데이트
        const params = filtersToURLParams(filters);
        router.replace(`?${params.toString()}`);
      } catch (err) {
        console.error("필터 적용 중 오류:", err);
        toast({
          title: t("filter_error"),
          description: t("filter_error_description"),
          variant: "destructive",
        });
      }
    },
    [router, setFilters, resetFilters, toast, t]
  );

  return {
    view,
    setView,
    stores,
    loading,
    error,
    userLocation,
    setFilters: applyFilters,
    handleSearch,
    getCurrentLocation,
  };
}

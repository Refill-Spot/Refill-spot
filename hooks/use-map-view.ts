"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFetchStores, StoreFilters } from "./use-stores";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";

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
      const categoryParam = searchParams.get("categories");
      const distanceParam = searchParams.get("distance");
      const ratingParam = searchParams.get("rating");
      const queryParam = searchParams.get("q");
      const latParam = searchParams.get("lat");
      const lngParam = searchParams.get("lng");

      if (
        categoryParam ||
        distanceParam ||
        ratingParam ||
        queryParam ||
        (latParam && lngParam)
      ) {
        const filters: StoreFilters = {};

        if (categoryParam) filters.categories = categoryParam.split(",");

        if (distanceParam) {
          const distance = Number(distanceParam);
          if (!isNaN(distance)) {
            filters.maxDistance = distance;
          }
        }

        if (ratingParam) {
          const rating = Number(ratingParam);
          if (!isNaN(rating)) {
            filters.minRating = rating;
          }
        }

        if (queryParam) filters.query = queryParam;

        if (latParam && lngParam) {
          const lat = Number(latParam);
          const lng = Number(lngParam);

          if (!isNaN(lat) && !isNaN(lng)) {
            filters.latitude = lat;
            filters.longitude = lng;
            setUserLocation({ lat, lng });
          }
        }

        if (Object.keys(filters).length > 0) {
          setFilters(filters);
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

          // URL 업데이트 (옵션)
          const params = new URLSearchParams(searchParams.toString());
          params.set("lat", latitude.toString());
          params.set("lng", longitude.toString());
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
  }, [router, searchParams, setFilters, toast, t]);

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
        const params = new URLSearchParams(searchParams.toString());
        params.set("q", query.trim());
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
    [router, searchParams, setFilters, toast, t]
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
        const params = new URLSearchParams();

        if (filters.categories?.length) {
          params.set("categories", filters.categories.join(","));
        }

        if (filters.maxDistance) {
          params.set("distance", filters.maxDistance.toString());
        }

        if (filters.minRating) {
          params.set("rating", filters.minRating.toString());
        }

        if (filters.query) {
          params.set("q", filters.query);
        }

        if (filters.latitude && filters.longitude) {
          params.set("lat", filters.latitude.toString());
          params.set("lng", filters.longitude.toString());
        }

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
    resetFilters,
    refetch,
    handleSearch,
    getCurrentLocation,
  };
}

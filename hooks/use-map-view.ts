"use client";

import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { extractFiltersFromURL } from "@/lib/api-utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StoreFilters, useFetchStores } from "./use-stores";

export function useMapView() {
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
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // URL 파라미터에서 필터 설정 가져오기 (새로고침 시에도 항상 실행)
  useEffect(() => {
    try {
      const filters = extractFiltersFromURL(searchParams);
      console.log("🔍 URL에서 추출한 필터:", filters);

      if (Object.keys(filters).length > 0) {
        console.log("✅ URL 필터를 적용합니다");
        setFilters(filters);

        // 위치 정보가 있으면 상태 업데이트
        if (filters.latitude && filters.longitude) {
          setUserLocation({
            lat: filters.latitude,
            lng: filters.longitude,
          });
        }

        setInitialLoadDone(true);
      } else if (!initialLoadDone) {
        console.log("📝 기본 데이터 로드");
        // 최초 한 번만 초기 데이터 로드
        resetFilters();
        refetch();
        setInitialLoadDone(true);
      }
    } catch (err) {
      console.error("URL 파라미터 처리 중 오류:", err);

      // 오류 발생시 기본 데이터 로드 (최초 한 번만)
      if (!initialLoadDone) {
        resetFilters();
        refetch();
        setInitialLoadDone(true);
      }
    }
  }, [searchParams, setFilters, resetFilters, refetch, initialLoadDone]);

  // 사용자 지정 위치 설정
  const setCustomLocation = useCallback(
    (latitude: number, longitude: number, maxDistance: number = 5) => {
      try {
        if (!latitude || !longitude) {
          toast({
            title: t("location_error"),
            description: t("invalid_location_coordinates"),
            variant: "destructive",
          });
          return;
        }

        setUserLocation({ lat: latitude, lng: longitude });

        // 필터에 위치 정보 추가
        setFilters({
          latitude,
          longitude,
          maxDistance,
        });

        // URL 업데이트
        const params = new URLSearchParams();
        params.set("lat", latitude.toString());
        params.set("lng", longitude.toString());
        params.set("distance", maxDistance.toString());
        router.replace(`/?${params.toString()}`);

        toast({
          title: t("location_updated"),
          description: t("custom_location_applied"),
        });
      } catch (err) {
        console.error("사용자 지정 위치 설정 오류:", err);
        toast({
          title: t("location_error"),
          description: t("location_setting_error"),
          variant: "destructive",
        });
      }
    },
    [router, setFilters, toast, t]
  );

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

          // 필터에 위치 정보 추가 (maxDistance 추가)
          const maxDistance = 5; // 기본값 5km
          setFilters({
            latitude,
            longitude,
            maxDistance,
            // 다른 필터 초기화 (필요한 경우 주석 해제)
            // categories: [],
            // minRating: 0,
            // query: undefined
          });

          // URL 업데이트
          const params = new URLSearchParams();
          params.set("lat", latitude.toString());
          params.set("lng", longitude.toString());
          params.set("distance", maxDistance.toString());
          router.replace(`/?${params.toString()}`);

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

          // 위치 정보를 가져오지 못한 경우 기본 데이터 로드
          resetFilters();
          refetch();
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

      // 오류 발생 시 기본 데이터 로드
      resetFilters();
      refetch();
    }
  }, [router, setFilters, toast, t, resetFilters, refetch]);

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
        // 검색 시 다른 필터는 초기화
        const searchFilters: StoreFilters = {
          query: query.trim(),
          // 위치 정보는 유지하되 다른 필터는 초기화
          latitude: userLocation?.lat,
          longitude: userLocation?.lng,
          maxDistance: userLocation ? 5 : undefined,
        };

        setFilters(searchFilters);

        // URL 업데이트
        const params = new URLSearchParams();
        params.set("q", query.trim());

        if (userLocation) {
          params.set("lat", userLocation.lat.toString());
          params.set("lng", userLocation.lng.toString());
          params.set("distance", "5");
        }

        router.replace(`/?${params.toString()}`);
      } catch (err) {
        console.error("검색 처리 중 오류:", err);
        toast({
          title: t("search_error"),
          description: t("search_error_description"),
          variant: "destructive",
        });

        // 오류 발생 시 기본 데이터 로드
        resetFilters();
        refetch();
      }
    },
    [router, setFilters, toast, t, userLocation, resetFilters, refetch]
  );

  // 필터 적용
  const applyFilters = useCallback(
    (filters: StoreFilters) => {
      try {
        if (!filters || Object.keys(filters).length === 0) {
          resetFilters();
          router.replace("/");
          return;
        }

        // 필터에 위치 정보 추가 (이미 있는 경우 유지)
        const updatedFilters = {
          ...filters,
          latitude: filters.latitude || userLocation?.lat,
          longitude: filters.longitude || userLocation?.lng,
        };

        setFilters(updatedFilters);

        // URL 업데이트
        const params = new URLSearchParams();

        if (updatedFilters.categories?.length) {
          params.set("categories", updatedFilters.categories.join(","));
        }

        if (updatedFilters.maxDistance) {
          params.set("distance", updatedFilters.maxDistance.toString());
        }

        if (updatedFilters.minRating) {
          params.set("rating", updatedFilters.minRating.toString());
        }

        if (updatedFilters.latitude && updatedFilters.longitude) {
          params.set("lat", updatedFilters.latitude.toString());
          params.set("lng", updatedFilters.longitude.toString());
        }

        router.replace(`/?${params.toString()}`);
      } catch (err) {
        console.error("필터 적용 중 오류:", err);
        toast({
          title: t("filter_error"),
          description: t("filter_error_description"),
          variant: "destructive",
        });

        // 오류 발생 시 기본 데이터 로드
        resetFilters();
        refetch();
      }
    },
    [router, setFilters, resetFilters, toast, t, userLocation, refetch]
  );

  // 데이터가 없거나 오류 상태일 때 자동으로 데이터 다시 로드
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (error) {
      // 기존 타이머 제거
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      // 새 타이머 설정
      retryTimeoutRef.current = setTimeout(() => {
        console.log("오류로 인한 데이터 재시도...");
        // 오류 발생 시 필터 초기화하고 기본 데이터 로드
        resetFilters();
        refetch();
        retryTimeoutRef.current = null;
      }, 3000); // 3초 후 재시도
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [error, refetch, resetFilters]);

  return {
    stores,
    loading,
    error,
    userLocation,
    setFilters,
    resetFilters,
    refetch,
    handleSearch,
    getCurrentLocation,
    setCustomLocation,
    applyFilters,
  };
}

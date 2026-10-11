"use client";

import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { extractFiltersFromURL } from "@/lib/api-utils";
import { coordinateSchema } from "@/lib/validations";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

  // URL 파라미터에서 필터 설정 가져오기 (초기 로드 시에만 실행)
  useEffect(() => {
    // 이미 초기 로드가 완료되었다면 실행하지 않음
    if (initialLoadDone) return;

    try {
      const filters = extractFiltersFromURL(searchParams);
      const coordinates = coordinateSchema.safeParse(filters);

      if (Object.keys(filters).length > 0) {
        setFilters({
          ...filters,
          latitude: coordinates.success ? coordinates.data.latitude : undefined,
          longitude: coordinates.success
            ? coordinates.data.longitude
            : undefined,
          maxDistance: coordinates.success ? filters.maxDistance : undefined,
        });

        // 위치 정보가 있으면 상태 업데이트
        if (coordinates.success) {
          setUserLocation({
            lat: coordinates.data.latitude,
            lng: coordinates.data.longitude,
          });
        }
      } else {
        // 기본 데이터 로드
        resetFilters();
        refetch();
      }

      setInitialLoadDone(true);
    } catch (err) {
      console.error("URL 파라미터 처리 중 오류:", err);

      // 오류 발생시 기본 데이터 로드
      resetFilters();
      refetch();
      setInitialLoadDone(true);
    }
  }, []); // 의존성 배열 비우기 - 마운트 시에만 실행

  // URL 파라미터가 변경될 때마다 필터 업데이트 (초기 로드 이후)
  useEffect(() => {
    // 초기 로드가 완료되지 않았으면 실행하지 않음
    if (!initialLoadDone) return;

    try {
      const filters = extractFiltersFromURL(searchParams);
      const coordinates = coordinateSchema.safeParse(filters);

      // 필터 적용
      setFilters(
        Object.keys(filters).length > 0
          ? {
              ...filters,
              latitude: coordinates.success
                ? coordinates.data.latitude
                : undefined,
              longitude: coordinates.success
                ? coordinates.data.longitude
                : undefined,
              maxDistance: coordinates.success
                ? filters.maxDistance
                : undefined,
            }
          : {},
      );

      // 위치 정보가 있으면 상태 업데이트
      if (coordinates.success) {
        const newLocation = {
          lat: coordinates.data.latitude,
          lng: coordinates.data.longitude,
        };
        setUserLocation(newLocation);
      } else {
        setUserLocation(null);
      }
    } catch (err) {
      console.error("URL 파라미터 변경 처리 중 오류:", err);
    }
  }, [searchParams, initialLoadDone]); // searchParams 변경 시 실행

  // 사용자 지정 위치 설정
  const setCustomLocation = useCallback(
    (latitude: number, longitude: number, maxDistance: number = 5) => {
      try {
        if (!coordinateSchema.safeParse({ latitude, longitude }).success) {
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

        // URL 업데이트 (현재 경로 유지)
        const params = new URLSearchParams();
        params.set("lat", latitude.toString());
        params.set("lng", longitude.toString());
        params.set("distance", maxDistance.toString());
        router.replace(`${window.location.pathname}?${params.toString()}`);

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
    [router, setFilters, toast, t],
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

          // URL 업데이트 (현재 경로 유지)
          const params = new URLSearchParams();
          params.set("lat", latitude.toString());
          params.set("lng", longitude.toString());
          params.set("distance", maxDistance.toString());
          router.replace(`${window.location.pathname}?${params.toString()}`);

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
        },
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

        // URL 업데이트 (현재 경로 유지)
        const params = new URLSearchParams();
        params.set("q", query.trim());

        if (userLocation) {
          params.set("lat", userLocation.lat.toString());
          params.set("lng", userLocation.lng.toString());
          params.set("distance", "5");
        }

        router.replace(`${window.location.pathname}?${params.toString()}`);
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
    [router, setFilters, toast, t, userLocation, resetFilters, refetch],
  );

  // 필터 적용
  const applyFilters = useCallback(
    (filters: StoreFilters) => {
      try {
        if (!filters || Object.keys(filters).length === 0) {
          resetFilters();
          setUserLocation(null);
          router.replace(window.location.pathname);
          return;
        }

        // 필터에 위치 정보 추가 (이미 있는 경우 유지)
        const hasLocation = "latitude" in filters || "longitude" in filters;
        const coordinates = coordinateSchema.safeParse(
          hasLocation
            ? filters
            : { latitude: userLocation?.lat, longitude: userLocation?.lng },
        );
        const updatedFilters = {
          ...filters,
          latitude: coordinates.success ? coordinates.data.latitude : undefined,
          longitude: coordinates.success
            ? coordinates.data.longitude
            : undefined,
          maxDistance: coordinates.success ? filters.maxDistance : undefined,
        };

        setFilters(updatedFilters);
        if (hasLocation) {
          setUserLocation(
            coordinates.success
              ? {
                  lat: coordinates.data.latitude,
                  lng: coordinates.data.longitude,
                }
              : null,
          );
        }

        // URL 업데이트 (현재 경로 유지)
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

        if (coordinates.success) {
          params.set("lat", coordinates.data.latitude.toString());
          params.set("lng", coordinates.data.longitude.toString());
        }

        router.replace(`${window.location.pathname}?${params.toString()}`);
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
    [router, setFilters, resetFilters, toast, t, userLocation, refetch],
  );

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

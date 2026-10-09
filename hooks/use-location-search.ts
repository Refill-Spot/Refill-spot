"use client";

import { useToast } from "@/components/ui/use-toast";
import type { PopularLocation } from "@/lib/geocoding";
import { searchLocations, type LocationResult } from "@/lib/location-search";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export interface LocationSearchState {
  selectedPlace: LocationResult | null;
  radiusInput: number;
  isLoading: boolean;
}

export interface LocationSearchHandlers {
  handlePlaceSelect: (place: LocationResult) => void;
  handlePopularLocationSelect: (location: PopularLocation) => Promise<void>;
  setSelectedPlace: (place: LocationResult | null) => void;
  setRadiusInput: (radius: number) => void;
  setIsLoading: (loading: boolean) => void;
}

interface UseLocationSearchProps {
  onCustomLocationSet?: (lat: number, lng: number, radius: number) => void;
  onDialogClose?: () => void;
}

export function useLocationSearch({
  onCustomLocationSet,
  onDialogClose,
}: UseLocationSearchProps = {}) {
  const [selectedPlace, setSelectedPlaceState] =
    useState<LocationResult | null>(null);
  const [radiusInput, setRadiusInputState] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const radiusRef = useRef(5);
  const popularRequestRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const cancelPopularSearch = useCallback(() => {
    popularRequestRef.current?.abort();
    popularRequestRef.current = null;
  }, []);

  useEffect(() => cancelPopularSearch, [cancelPopularSearch]);

  const setSelectedPlace = useCallback(
    (place: LocationResult | null) => {
      cancelPopularSearch();
      setIsLoading(false);
      setSelectedPlaceState(place);
    },
    [cancelPopularSearch],
  );

  const setRadiusInput = useCallback((radius: number) => {
    const nextRadius = Number.isFinite(radius)
      ? Math.min(50, Math.max(1, radius))
      : 5;
    radiusRef.current = nextRadius;
    setRadiusInputState(nextRadius);
  }, []);

  const handlePlaceSelect = useCallback(
    (place: LocationResult) => {
      cancelPopularSearch();
      setIsLoading(false);

      if (
        !place ||
        !Number.isFinite(place.lat) ||
        !Number.isFinite(place.lng) ||
        place.lat < -90 ||
        place.lat > 90 ||
        place.lng < -180 ||
        place.lng > 180
      ) {
        toast({
          title: "오류",
          description: "유효한 위치 정보를 찾을 수 없습니다.",
          variant: "destructive",
        });
        return;
      }

      const radius = radiusRef.current;
      setSelectedPlaceState(place);
      setIsLoading(true);
      try {
        if (onCustomLocationSet) {
          onCustomLocationSet(place.lat, place.lng, radius);
        } else {
          router.push(
            `/map?lat=${place.lat}&lng=${place.lng}&distance=${radius}`,
          );
        }

        toast({
          title: "위치 설정 완료",
          description: `${place.name || place.address} 주변 ${radius}km로 설정되었습니다.`,
        });
        onDialogClose?.();
      } catch (error) {
        console.error("장소 선택 오류:", error);
        toast({
          title: "오류",
          description: "위치를 설정하는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [cancelPopularSearch, onCustomLocationSet, router, toast, onDialogClose],
  );

  const handlePopularLocationSelect = useCallback(
    async (location: PopularLocation) => {
      cancelPopularSearch();
      const controller = new AbortController();
      popularRequestRef.current = controller;
      setSelectedPlaceState(null);
      setIsLoading(true);

      try {
        const results = await searchLocations(location.address, {
          mode: "address",
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          popularRequestRef.current !== controller
        ) {
          return;
        }

        const place = results[0];
        if (!place) {
          toast({
            title: "오류",
            description: "주소를 찾을 수 없습니다.",
            variant: "destructive",
          });
          return;
        }

        handlePlaceSelect({ ...place, name: location.name });
      } catch (error) {
        if (
          controller.signal.aborted ||
          popularRequestRef.current !== controller
        ) {
          return;
        }
        console.error("인기 지역 검색 오류:", error);
        toast({
          title: "오류",
          description: "주소를 검색하는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        if (popularRequestRef.current === controller) {
          popularRequestRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [cancelPopularSearch, handlePlaceSelect, toast],
  );

  return {
    selectedPlace,
    radiusInput,
    isLoading,
    handlePlaceSelect,
    handlePopularLocationSelect,
    setSelectedPlace,
    setRadiusInput,
    setIsLoading,
  };
}

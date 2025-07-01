"use client";

import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { saveUserLocation, type UserLocation } from "@/lib/location-storage";
import { useCallback, useState } from "react";

// Geolocation 상태 타입
export interface GeolocationState {
  isLoading: boolean;
  error: string | null;
  position: GeolocationPosition | null;
  coordinates: { lat: number; lng: number } | null;
}

// Geolocation 옵션 타입
export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  saveToStorage?: boolean;
  source?: UserLocation["source"];
  showToast?: boolean;
  customSuccessMessage?: string;
  customErrorMessage?: string;
}

// 기본 Geolocation 옵션
const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    isLoading: false,
    error: null,
    position: null,
    coordinates: null,
  });

  const { toast } = useToast();
  const { t } = useTranslation();

  // 에러 코드를 사용자 친화적 메시지로 변환
  const getErrorMessage = useCallback(
    (error: GeolocationPositionError): string => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          return (
            t("location_permission_denied") ||
            "위치 접근 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요."
          );
        case error.POSITION_UNAVAILABLE:
          return t("location_unavailable") || "위치 정보를 사용할 수 없습니다.";
        case error.TIMEOUT:
          return (
            t("location_timeout") || "위치 정보 요청 시간이 초과되었습니다."
          );
        default:
          return (
            t("location_error_unknown") ||
            "위치 정보를 가져오는 중 오류가 발생했습니다."
          );
      }
    },
    [t]
  );

  // 브라우저가 Geolocation을 지원하는지 확인
  const isSupported = useCallback((): boolean => {
    return typeof navigator !== "undefined" && !!navigator.geolocation;
  }, []);

  // 현재 위치 가져오기
  const getCurrentPosition = useCallback(
    async (
      options: GeolocationOptions = {}
    ): Promise<{ lat: number; lng: number }> => {
      const {
        enableHighAccuracy = true,
        timeout = 10000,
        maximumAge = 0,
        saveToStorage = false,
        source = "gps",
        showToast = true,
        customSuccessMessage,
        customErrorMessage,
      } = options;

      return new Promise((resolve, reject) => {
        // 브라우저 지원 확인
        if (!isSupported()) {
          const errorMessage =
            customErrorMessage ||
            t("location_not_supported_description") ||
            "이 브라우저에서는 위치 정보를 지원하지 않습니다.";

          setState((prev) => ({ ...prev, error: errorMessage }));

          if (showToast) {
            toast({
              title: t("location_error") || "위치 정보 오류",
              description: errorMessage,
              variant: "destructive",
            });
          }

          reject(new Error(errorMessage));
          return;
        }

        // 로딩 상태 설정
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        // 로딩 토스트 표시 (옵션)
        if (showToast) {
          toast({
            title: "위치 확인 중",
            description: "현재 위치를 확인 중입니다...",
          });
        }

        const positionOptions: PositionOptions = {
          enableHighAccuracy,
          timeout,
          maximumAge,
        };

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const coordinates = { lat: latitude, lng: longitude };

            // 상태 업데이트
            setState({
              isLoading: false,
              error: null,
              position,
              coordinates,
            });

            // 위치 정보 저장 (옵션)
            if (saveToStorage) {
              saveUserLocation({
                lat: latitude,
                lng: longitude,
                source,
              });
            }

            // 성공 토스트 표시 (옵션)
            if (showToast) {
              const successMessage =
                customSuccessMessage ||
                t("location_detected") ||
                "현재 위치를 확인했습니다.";

              toast({
                title: t("location_detected") || "위치 확인 완료",
                description: successMessage,
              });
            }

            resolve(coordinates);
          },
          (error) => {
            const errorMessage = customErrorMessage || getErrorMessage(error);

            setState({
              isLoading: false,
              error: errorMessage,
              position: null,
              coordinates: null,
            });

            if (showToast) {
              toast({
                title: t("location_error") || "위치 정보 오류",
                description: errorMessage,
                variant: "destructive",
              });
            }

            reject(error);
          },
          positionOptions
        );
      });
    },
    [isSupported, getErrorMessage, toast, t]
  );

  // 위치 감시 시작 (실시간 위치 추적)
  const watchPosition = useCallback(
    (
      onSuccess: (coordinates: { lat: number; lng: number }) => void,
      onError?: (error: string) => void,
      options: GeolocationOptions = {}
    ): number | null => {
      if (!isSupported()) {
        const errorMessage =
          t("location_not_supported_description") ||
          "이 브라우저에서는 위치 정보를 지원하지 않습니다.";

        onError?.(errorMessage);
        return null;
      }

      const {
        enableHighAccuracy = true,
        timeout = 10000,
        maximumAge = 0,
      } = options;

      const positionOptions: PositionOptions = {
        enableHighAccuracy,
        timeout,
        maximumAge,
      };

      return navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const coordinates = { lat: latitude, lng: longitude };

          setState((prev) => ({
            ...prev,
            position,
            coordinates,
            error: null,
          }));

          onSuccess(coordinates);
        },
        (error) => {
          const errorMessage = getErrorMessage(error);
          setState((prev) => ({ ...prev, error: errorMessage }));
          onError?.(errorMessage);
        },
        positionOptions
      );
    },
    [isSupported, getErrorMessage, t]
  );

  // 위치 감시 중지
  const clearWatch = useCallback((watchId: number) => {
    if (navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // 상태 초기화
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      position: null,
      coordinates: null,
    });
  }, []);

  // 빠른 위치 가져오기 (간소화된 API)
  const getLocationQuick = useCallback(async (): Promise<{
    lat: number;
    lng: number;
  }> => {
    return getCurrentPosition({
      saveToStorage: true,
      source: "gps",
      showToast: true,
    });
  }, [getCurrentPosition]);

  // 조용한 위치 가져오기 (토스트 없이)
  const getLocationSilent = useCallback(async (): Promise<{
    lat: number;
    lng: number;
  }> => {
    return getCurrentPosition({
      showToast: false,
      timeout: 5000,
    });
  }, [getCurrentPosition]);

  return {
    // 상태
    ...state,
    isSupported: isSupported(),

    // 메서드
    getCurrentPosition,
    watchPosition,
    clearWatch,
    reset,

    // 편의 메서드
    getLocationQuick,
    getLocationSilent,
  };
}

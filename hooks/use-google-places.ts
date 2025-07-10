"use client";

import { useToast } from "@/components/ui/use-toast";
import { useCallback, useEffect, useRef, useState } from "react";

// Google Maps API 타입 선언
declare global {
  interface Window {
    google: any;
  }
}

export interface GooglePlacesState {
  predictions: any[];
  showPredictions: boolean;
  searchText: string;
  isLoading: boolean;
}

export interface GooglePlacesHandlers {
  handleInputChange: (value: string) => void;
  handleSearch: (searchTerm?: string) => void;
  handlePredictionSelect: (prediction: any) => void;
  clearPredictions: () => void;
  setSearchText: (text: string) => void;
  setShowPredictions: (show: boolean) => void;
}

interface UseGooglePlacesProps {
  onPlaceSelect?: (place: any) => void;
  onManualSearch?: (searchText: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function useGooglePlaces({
  onPlaceSelect,
  onManualSearch,
  placeholder = "지역, 주소를 입력하세요",
  debounceMs = 300,
}: UseGooglePlacesProps = {}) {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const autocompleteService = useRef<any>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Google Places API 초기화
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
    }
  }, []);

  // 예측 결과 가져오기
  const fetchPredictions = useCallback((input: string) => {
    if (input.length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    // Google Maps API가 로드되었는지 확인
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.warn('Google Maps API not loaded yet');
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsLoading(true);

    try {
      // 매번 새로운 서비스 인스턴스 생성
      const service = new window.google.maps.places.AutocompleteService();
      
      service.getPlacePredictions(
        {
          input: input,
          types: ['establishment'],
          componentRestrictions: { country: 'kr' },
          bounds: new window.google.maps.LatLngBounds(
            new window.google.maps.LatLng(37.4, 126.8), // 남서쪽 모서리
            new window.google.maps.LatLng(37.7, 127.2)  // 북동쪽 모서리 (서울 대략적 범위)
          ),
        },
        (predictions: any, status: any) => {
          setIsLoading(false);
          
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions && predictions.length > 0) {
            setPredictions(predictions);
            setShowPredictions(true);
          } else {
            setPredictions([]);
            setShowPredictions(false);
          }
        }
      );
    } catch (error) {
      console.error('AutocompleteService error:', error);
      setIsLoading(false);
      setPredictions([]);
      setShowPredictions(false);
    }
  }, []);

  // 입력 변경 핸들러 (디바운스 적용)
  const handleInputChange = useCallback(
    (value: string) => {
      setSearchText(value);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        fetchPredictions(value);
      }, debounceMs);
    },
    [fetchPredictions, debounceMs]
  );

  // 검색 실행
  const handleSearch = useCallback(
    (searchTerm?: string) => {
      const term = searchTerm || searchText;

      if (!term.trim()) {
        toast({
          title: "검색어 입력",
          description: "검색할 지역이나 주소를 입력해주세요.",
          variant: "destructive",
        });
        return;
      }

      setShowPredictions(false);
      onManualSearch?.(term);
    },
    [searchText, onManualSearch, toast]
  );

  // 예측 결과 선택
  const handlePredictionSelect = useCallback(
    (prediction: any) => {
      setSearchText(prediction.description);
      setShowPredictions(false);
      setPredictions([]);
      
      // 예측 결과 클릭 시 바로 검색 실행
      if (prediction.place_id && window.google && window.google.maps && window.google.maps.places) {
        // place_id가 있으면 장소 상세 정보를 가져온 후 onPlaceSelect 호출
        const service = new window.google.maps.places.PlacesService(
          document.createElement("div")
        );
        
        service.getDetails(
          {
            placeId: prediction.place_id,
            fields: ["geometry", "formatted_address", "name"],
          },
          (result: any, status: any) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && result) {
              // geometry 정보가 포함된 완전한 장소 객체로 onPlaceSelect 호출
              onPlaceSelect?.(result);
            } else {
              // PlacesService가 실패하면 수동 검색으로 fallback
              onManualSearch?.(prediction.description);
            }
          }
        );
      } else {
        // place_id가 없거나 API가 로드되지 않았으면 수동 검색
        onManualSearch?.(prediction.description);
      }
    },
    [onPlaceSelect, onManualSearch]
  );

  // 예측 결과 초기화
  const clearPredictions = useCallback(() => {
    setPredictions([]);
    setShowPredictions(false);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    // 상태
    predictions,
    showPredictions,
    searchText,
    isLoading,

    // 핸들러
    handleInputChange,
    handleSearch,
    handlePredictionSelect,
    clearPredictions,
    setSearchText,
    setShowPredictions,
  };
}

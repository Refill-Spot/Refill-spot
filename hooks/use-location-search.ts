"use client";

import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export interface LocationSearchState {
  selectedPlace: any;
  radiusInput: number;
  isLoading: boolean;
}

export interface LocationSearchHandlers {
  handlePlaceSelect: (place: any) => Promise<void>;
  handlePopularLocationSelect: (location: {
    name: string;
    address: string;
  }) => void;
  handleManualSearch: (searchText: string) => Promise<void>;
  setSelectedPlace: (place: any) => void;
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
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [radiusInput, setRadiusInput] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // 장소 선택 핸들러
  const handlePlaceSelect = useCallback(
    async (place: any) => {
      if (!place || !place.place_id) return;
      if (!window.google || !window.google.maps) {
        toast({
          title: "오류",
          description: "Google Maps API가 로드되지 않았습니다.",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);
      try {
        const service = new window.google.maps.places.PlacesService(
          document.createElement("div")
        );

        service.getDetails(
          {
            placeId: place.place_id,
            fields: ["geometry", "formatted_address", "name"],
          },
          (result: any, status: any) => {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              result
            ) {
              const lat = result.geometry?.location?.lat();
              const lng = result.geometry?.location?.lng();

              if (lat && lng) {
                if (onCustomLocationSet) {
                  onCustomLocationSet(lat, lng, radiusInput);
                } else {
                  router.push(
                    `/?lat=${lat}&lng=${lng}&distance=${radiusInput}`
                  );
                }

                toast({
                  title: "위치 설정 완료",
                  description: `${
                    result.name || place.description
                  } 주변 ${radiusInput}km로 설정되었습니다.`,
                });

                onDialogClose?.();
              }
            } else {
              toast({
                title: "오류",
                description: "장소 정보를 가져오는 중 오류가 발생했습니다.",
                variant: "destructive",
              });
            }
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error("장소 선택 오류:", error);
        toast({
          title: "오류",
          description: "장소 정보를 가져오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    },
    [radiusInput, onCustomLocationSet, router, toast, onDialogClose]
  );

  // 인기 지역 선택
  const handlePopularLocationSelect = useCallback(
    (location: { name: string; address: string }) => {
      if (!window.google || !window.google.maps) {
        toast({
          title: "오류",
          description: "Google Maps API가 로드되지 않았습니다.",
          variant: "destructive",
        });
        return;
      }

      setSelectedPlace({
        description: location.address,
        place_id: null,
      });

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        { address: location.address },
        (results: any, status: any) => {
          if (status === window.google.maps.GeocoderStatus.OK && results?.[0]) {
            const lat = results[0].geometry.location.lat();
            const lng = results[0].geometry.location.lng();

            if (onCustomLocationSet) {
              onCustomLocationSet(lat, lng, radiusInput);
            } else {
              router.push(`/?lat=${lat}&lng=${lng}&distance=${radiusInput}`);
            }

            toast({
              title: "위치 설정 완료",
              description: `${location.name} 주변 ${radiusInput}km로 설정되었습니다.`,
            });

            onDialogClose?.();
          } else {
            toast({
              title: "오류",
              description: "주소를 찾을 수 없습니다.",
              variant: "destructive",
            });
          }
        }
      );
    },
    [radiusInput, onCustomLocationSet, router, toast, onDialogClose]
  );

  // 수동 검색 핸들러
  const handleManualSearch = useCallback(
    async (searchText: string) => {
      if (!window.google || !window.google.maps) {
        toast({
          title: "오류",
          description: "Google Maps API가 로드되지 않았습니다.",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);

      try {
        const { suggestions } = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: searchText,
          includedPrimaryTypes: ["establishment"],
          includedRegionCodes: ["kr"],
          locationRestriction: {
            circle: {
              center: { lat: 37.5665, lng: 126.9780 }, // 서울 중심
              radius: 100000, // 100km
            },
          },
        });

        if (suggestions && suggestions.length > 0) {
          const firstSuggestion = suggestions[0];
          const convertedResult = {
            place_id: firstSuggestion.placePrediction?.placeId || firstSuggestion.queryPrediction?.text?.text,
            description: firstSuggestion.placePrediction?.text?.text || firstSuggestion.queryPrediction?.text?.text,
            structured_formatting: {
              main_text: firstSuggestion.placePrediction?.structuredFormat?.mainText?.text || firstSuggestion.queryPrediction?.text?.text,
              secondary_text: firstSuggestion.placePrediction?.structuredFormat?.secondaryText?.text || "",
            },
          };
          setSelectedPlace(convertedResult);
          handlePlaceSelect(convertedResult);
        } else {
          handleDirectGeocoding(searchText);
        }
      } catch (error) {
        console.error("수동 검색 오류:", error);
        toast({
          title: "검색 오류",
          description: "주소 검색 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    },
    [handlePlaceSelect, toast]
  );

  // 직접 지오코딩 처리
  const handleDirectGeocoding = useCallback(
    (searchText: string) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        { address: searchText, componentRestrictions: { country: "KR" } },
        (results: any, status: any) => {
          if (status === window.google.maps.GeocoderStatus.OK && results?.[0]) {
            const lat = results[0].geometry.location.lat();
            const lng = results[0].geometry.location.lng();

            if (onCustomLocationSet) {
              onCustomLocationSet(lat, lng, radiusInput);
            } else {
              router.push(`/?lat=${lat}&lng=${lng}&distance=${radiusInput}`);
            }

            toast({
              title: "위치 설정 완료",
              description: `${searchText} 주변 ${radiusInput}km로 설정되었습니다.`,
            });

            onDialogClose?.();
          } else {
            toast({
              title: "오류",
              description: "주소를 찾을 수 없습니다.",
              variant: "destructive",
            });
          }
          setIsLoading(false);
        }
      );
    },
    [radiusInput, onCustomLocationSet, router, toast, onDialogClose]
  );

  return {
    // 상태
    selectedPlace,
    radiusInput,
    isLoading,

    // 핸들러
    handlePlaceSelect,
    handlePopularLocationSelect,
    handleManualSearch,
    setSelectedPlace,
    setRadiusInput,
    setIsLoading,
  };
}

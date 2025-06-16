// Google Places API를 사용한 주소 자동완성

export interface PlaceResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  geometry?: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  formatted_address?: string;
  name?: string;
}

export interface AutocompleteSuggestion {
  fetchAutocompleteSuggestions: (request: {
    input: string;
    sessionToken?: any;
    includedRegionCodes?: string[];
    includedPrimaryTypes?: string[];
    locationRestriction?: {
      circle: {
        center: { lat: number; lng: number };
        radius: number;
      };
    };
  }) => Promise<{
    suggestions: Array<{
      placePrediction?: {
        placeId: string;
        text: { text: string };
        structuredFormat: {
          mainText: { text: string };
          secondaryText: { text: string };
        };
      };
      queryPrediction?: {
        text: { text: string };
      };
    }>;
  }>;
}

export interface PlacesService {
  getDetails: (
    request: {
      placeId: string;
      fields: string[];
      sessionToken?: any;
    },
    callback: (place: PlaceResult | null, status: string) => void
  ) => void;
}

// Google Maps API 로드 함수
export const loadGoogleMapsAPI = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.google && window.google.maps) {
      resolve(window.google);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&language=ko`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (
        typeof window !== "undefined" &&
        window.google &&
        window.google.maps
      ) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps API failed to load"));
      }
    };

    script.onerror = () => {
      reject(new Error("Failed to load Google Maps API script"));
    };

    document.head.appendChild(script);
  });
};

// 인기 지역 (한국 주요 지역)
export const POPULAR_LOCATIONS = [
  { name: "강남역", address: "서울특별시 강남구 강남대로 지하 396" },
  { name: "홍대입구역", address: "서울특별시 마포구 양화로 지하 188" },
  { name: "명동역", address: "서울특별시 중구 명동2가" },
  { name: "신촌역", address: "서울특별시 서대문구 신촌로" },
  { name: "이태원역", address: "서울특별시 용산구 이태원로" },
  { name: "건대입구역", address: "서울특별시 광진구 능동로" },
  { name: "잠실역", address: "서울특별시 송파구 올림픽로" },
  { name: "여의도역", address: "서울특별시 영등포구 여의공원로" },
];

// Places API 서비스 인스턴스들
let placesService: PlacesService | null = null;
let sessionToken: any = null;

// AutocompleteSuggestion API 사용 가능 여부 확인
export const getAutocompleteSuggestion = async (): Promise<AutocompleteSuggestion> => {
  const google = await loadGoogleMapsAPI();
  
  if (!google.maps.places.AutocompleteSuggestion) {
    throw new Error("AutocompleteSuggestion API is not available");
  }

  return google.maps.places.AutocompleteSuggestion;
};

// PlacesService 초기화
export const getPlacesService = async (): Promise<PlacesService> => {
  if (placesService) {
    return placesService;
  }

  const google = await loadGoogleMapsAPI();
  // PlacesService는 DOM 요소가 필요하므로 임시 div 생성
  const div = document.createElement("div");
  placesService = new google.maps.places.PlacesService(div);

  if (!placesService) {
    throw new Error("Failed to create PlacesService");
  }

  return placesService;
};

// 세션 토큰 생성
export const createSessionToken = async () => {
  const google = await loadGoogleMapsAPI();
  sessionToken = new google.maps.places.AutocompleteSessionToken();
  return sessionToken;
};

// 현재 세션 토큰 가져오기
export const getSessionToken = () => sessionToken;

// 세션 토큰 초기화
export const clearSessionToken = () => {
  sessionToken = null;
};

// 주소 자동완성 검색
export const searchPlaces = async (input: string): Promise<PlaceResult[]> => {
  if (!input || input.trim().length < 2) {
    return [];
  }

  try {
    const autocompleteSuggestion = await getAutocompleteSuggestion();

    const { suggestions } = await autocompleteSuggestion.fetchAutocompleteSuggestions({
      input: input.trim(),
      includedRegionCodes: ["kr"], // 한국으로 제한
      includedPrimaryTypes: ["establishment"], // 시설 타입
      locationRestriction: {
        circle: {
          center: { lat: 37.5665, lng: 126.9780 }, // 서울 중심
          radius: 100000, // 100km
        },
      },
    });

    if (suggestions && suggestions.length > 0) {
      // 새로운 API 형식에서 기존 형식으로 변환
      return suggestions.map((suggestion) => ({
        place_id: suggestion.placePrediction?.placeId || suggestion.queryPrediction?.text?.text || "",
        description: suggestion.placePrediction?.text?.text || suggestion.queryPrediction?.text?.text || "",
        structured_formatting: {
          main_text: suggestion.placePrediction?.structuredFormat?.mainText?.text || suggestion.queryPrediction?.text?.text || "",
          secondary_text: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || "",
        },
      }));
    }

    return [];
  } catch (error) {
    console.error("AutocompleteSuggestion search error:", error);
    throw error;
  }
};

// 장소 상세 정보 가져오기
export const getPlaceDetails = async (
  placeId: string
): Promise<PlaceResult> => {
  try {
    const service = await getPlacesService();
    const currentSessionToken = getSessionToken();

    return new Promise((resolve, reject) => {
      service.getDetails(
        {
          placeId,
          fields: ["place_id", "formatted_address", "geometry", "name"],
          sessionToken: currentSessionToken,
        },
        (place, status) => {
          if (status === "OK" && place) {
            // 세션 토큰 사용 완료 후 초기화
            clearSessionToken();
            resolve(place);
          } else {
            reject(new Error(`Place details error: ${status}`));
          }
        }
      );
    });
  } catch (error) {
    console.error("Place details error:", error);
    throw error;
  }
};

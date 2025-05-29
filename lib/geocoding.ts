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

export interface AutocompleteService {
  getPlacePredictions: (
    request: {
      input: string;
      sessionToken?: any;
      componentRestrictions?: { country: string };
      types?: string[];
    },
    callback: (predictions: PlaceResult[] | null, status: string) => void
  ) => void;
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
let autocompleteService: AutocompleteService | null = null;
let placesService: PlacesService | null = null;
let sessionToken: any = null;

// AutocompleteService 초기화
export const getAutocompleteService =
  async (): Promise<AutocompleteService> => {
    if (autocompleteService) {
      return autocompleteService;
    }

    const google = await loadGoogleMapsAPI();
    autocompleteService = new google.maps.places.AutocompleteService();

    if (!autocompleteService) {
      throw new Error("Failed to create AutocompleteService");
    }

    return autocompleteService;
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
    const service = await getAutocompleteService();

    if (!sessionToken) {
      await createSessionToken();
    }

    return new Promise((resolve, reject) => {
      service.getPlacePredictions(
        {
          input: input.trim(),
          sessionToken,
          componentRestrictions: { country: "kr" }, // 한국으로 제한
          types: ["establishment", "geocode"], // 시설과 주소 모두 포함
        },
        (predictions, status) => {
          if (status === "OK" && predictions) {
            resolve(predictions);
          } else if (status === "ZERO_RESULTS") {
            resolve([]);
          } else {
            reject(new Error(`Places API error: ${status}`));
          }
        }
      );
    });
  } catch (error) {
    console.error("Places search error:", error);
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

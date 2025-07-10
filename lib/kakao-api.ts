import axios from "axios";

// 카카오 지도 API 키
const KAKAO_API_KEY = process.env.NEXT_PUBLIC_KAKAO_API_KEY;

interface KakaoPlaceSearchResult {
  id: string; // 장소 ID
  place_name: string; // 장소명
  category_name: string; // 카테고리
  category_group_code: string; // 카테고리 그룹 코드
  category_group_name: string; // 카테고리 그룹명
  phone: string; // 전화번호
  address_name: string; // 주소
  road_address_name: string; // 도로명 주소
  x: string; // X 좌표 (경도)
  y: string; // Y 좌표 (위도)
  place_url: string; // 장소 URL
  distance: string; // 중심좌표까지의 거리 (단위: 미터)
  rating?: number; // 별점 (API 응답에는 없으며 별도 요청 필요)
}

interface KakaoPlaceDetailResult {
  id: string; // 장소 ID
  name: string; // 장소명
  address: string; // 주소
  roadAddress: string; // 도로명 주소
  phone: string; // 전화번호
  businessHours?: string[]; // 영업시간
  rating?: number; // 별점 (5점 만점)
  reviewCount?: number; // 리뷰 수
  menus?: Array<{
    // 메뉴 정보
    name: string;
    price: string;
  }>;
  tags?: string[]; // 태그 정보
  images?: string[]; // 이미지 URL 목록
}

/**
 * 카카오 장소 검색 API를 호출하는 함수
 * @param query 검색어 (예: "스타벅스 강남점")
 * @param options 검색 옵션 (좌표, 반경 등)
 * @returns 검색 결과 목록
 */
export async function searchKakaoPlaces(
  query: string,
  options?: { x?: number; y?: number; radius?: number },
): Promise<KakaoPlaceSearchResult[]> {
  if (!KAKAO_API_KEY) {
    console.warn("카카오 API 키가 설정되지 않았습니다.");
    return [];
  }

  try {
    const response = await axios.get(
      "https://dapi.kakao.com/v2/local/search/keyword.json",
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_API_KEY}`,
        },
        params: {
          query,
          x: options?.x,
          y: options?.y,
          radius: options?.radius,
          sort: "accuracy", // 정확도 순 정렬
        },
      },
    );

    return response.data.documents;
  } catch (error) {
    console.error("카카오 장소 검색 오류:", error);
    return [];
  }
}

/**
 * 카카오 플레이스 상세 정보 가져오기
 * @param id 장소 ID
 * @returns 장소 상세 정보 (평점 포함)
 */
export async function getKakaoPlaceDetail(
  id: string,
): Promise<KakaoPlaceDetailResult | null> {
  if (!KAKAO_API_KEY) {
    console.warn("카카오 API 키가 설정되지 않았습니다.");
    return null;
  }

  try {
    // 카카오 플레이스 API 호출 - 식당/카페 등의 상세 정보
    // 참고: 이것은 공식 API는 아니며, 실제 구현 시 카카오 API 문서 참조 필요
    const response = await axios.get(
      `https://place.map.kakao.com/main/v/${id}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0", // API 호출 시 유저 에이전트 필요할 수 있음
          Referer: "https://map.kakao.com/",
        },
      },
    );

    // 응답 데이터 구조에 따라 필요한 정보 추출
    const data = response.data?.basicInfo || {};

    return {
      id: data.cid || id,
      name: data.placenamefull || "",
      address: data.addr || "",
      roadAddress: data.road || "",
      phone: data.phone || "",
      businessHours: extractBusinessHours(data),
      rating: extractRating(data),
      reviewCount: data.feedbackCount || 0,
      menus: extractMenus(data),
      tags: data.tags || [],
      images: extractImages(data),
    };
  } catch (error) {
    console.error(`카카오 장소(ID: ${id}) 상세 정보 조회 오류:`, error);
    return null;
  }
}

/**
 * 카카오 API 응답에서 영업시간 추출
 */
function extractBusinessHours(data: any): string[] | undefined {
  if (!data?.openHour) {
return undefined;
}

  // 카카오 API는 영업시간을 다양한 형태로 제공할 수 있음
  // 데이터 구조에 따라 적절히 추출 로직 수정 필요
  const openHour = data.openHour;

  if (Array.isArray(openHour)) {
    return openHour;
  } else if (typeof openHour === "string") {
    return [openHour];
  } else if (openHour.periodList && Array.isArray(openHour.periodList)) {
    return openHour.periodList.map((p: any) => p.timeString || "");
  }

  return undefined;
}

/**
 * 카카오 API 응답에서 메뉴 정보 추출
 */
function extractMenus(
  data: any,
): Array<{ name: string; price: string }> | undefined {
  if (!data?.menuInfo?.menuList) {
return undefined;
}

  return data.menuInfo.menuList.map((menu: any) => ({
    name: menu.menu || "",
    price: menu.price || "",
  }));
}

/**
 * 카카오 API 응답에서 이미지 URL 목록 추출
 */
function extractImages(data: any): string[] | undefined {
  if (!data?.imageList) {
return undefined;
}

  return data.imageList.map((img: any) => img.url || "");
}

/**
 * 카카오 API 응답에서 평점 추출
 */
function extractRating(data: any): number {
  if (!data) {
return 0;
}

  // 카카오 플레이스는 총점 또는 별점 정보를 다양한 필드로 제공할 수 있음
  if (data.feedback && typeof data.feedback.scoresum === "number") {
    const totalScore = data.feedback.scoresum;
    const reviewCount = data.feedback.scorecount || 1;

    // 평균 평점 계산 (5점 만점)
    return Math.min(5, Math.round((totalScore / reviewCount) * 10) / 10);
  }

  // 직접 평점 필드가 있으면 사용
  if (typeof data.rating === "number") {
    return data.rating;
  }

  // 별점(stars) 필드가 있으면 사용
  if (typeof data.stars === "number") {
    return data.stars;
  }

  return 0;
}

/**
 * 카카오 장소 평점 가져오기
 * @param query 검색어 (가게명 + 주소)
 * @returns 평점 (0~5)
 */
export async function getKakaoPlaceRating(query: string): Promise<number> {
  // API 키가 없으면 바로 0 반환
  if (!KAKAO_API_KEY) {
    return 0;
  }

  try {
    // 1. 장소 검색
    const places = await searchKakaoPlaces(query);
    if (!places || places.length === 0) {
return 0;
}

    // 2. 첫 번째 결과의 ID로 상세 정보 조회
    const firstPlace = places[0];
    if (!firstPlace.id) {
return 0;
}

    // 3. 상세 정보에서 평점 추출
    const details = await getKakaoPlaceDetail(firstPlace.id);
    if (!details) {
return 0;
}

    return details.rating || 0;
  } catch (error) {
    console.error("카카오 별점 조회 오류:", error);
    return 0; // 오류 시 기본값 0 반환
  }
}

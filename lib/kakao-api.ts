import axios from "axios";

// 서버의 Local API 호출에는 REST API 키만 사용합니다.
const KAKAO_API_KEY = process.env.KAKAO_API_KEY;

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
    console.warn(
      "카카오 REST API 키가 설정되지 않았습니다. KAKAO_API_KEY 환경 변수를 확인해주세요.",
    );
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
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        console.error(
          "카카오 API 인증 오류: API 키를 확인해주세요. 현재 키:",
          KAKAO_API_KEY ? "설정됨" : "설정되지 않음",
        );
      } else {
        console.error(
          "카카오 장소 검색 오류:",
          error.response?.status,
          error.response?.data,
        );
      }
    } else {
      console.error("카카오 장소 검색 오류:", error);
    }
    return [];
  }
}

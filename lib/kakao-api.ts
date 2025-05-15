import axios from "axios";

// 카카오 지도 API 키
const KAKAO_API_KEY = process.env.KAKAO_API_KEY;

// 카카오 장소 검색 API를 호출하는 함수
export async function searchKakaoPlaces(
  query: string,
  options?: { x?: number; y?: number; radius?: number }
) {
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
        },
      }
    );

    return response.data.documents;
  } catch (error) {
    console.error("카카오 장소 검색 오류:", error);
    throw error;
  }
}

// 카카오 별점 정보 가져오기 (카카오 리뷰 API)
export async function getKakaoPlaceRating(id: string) {
  try {
    // 카카오맵에서는 별도로 별점을 가져오는 API가 제공되지 않음
    // 카카오플레이스 데이터를 활용하거나 웹 크롤링이 필요
    // 아래는 예시 구현 (실제로는 다른 방법 필요)
    const response = await axios.get(
      `https://place.map.kakao.com/api/places/${id}`,
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_API_KEY}`,
        },
      }
    );

    // 카카오맵에서는 별점 정보 추출
    const rating = response.data.place?.rating || 0;
    return rating;
  } catch (error) {
    console.error("카카오 별점 조회 오류:", error);
    return 0; // 오류 시 기본값 0 반환
  }
}

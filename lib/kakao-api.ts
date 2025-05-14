import axios from "axios";

// 카카오 지도 API 키
const KAKAO_API_KEY = process.env.NEXT_PUBLIC_KAKAO_API_KEY;

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

// 장소 상세 정보를 가져오는 함수 (ID로 검색)
export async function getKakaoPlaceDetail(id: string) {
  try {
    const response = await axios.get(
      "https://dapi.kakao.com/v2/local/search/keyword.json",
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_API_KEY}`,
        },
        params: {
          query: id, // ID를 쿼리로 사용
        },
      }
    );

    if (response.data.documents.length > 0) {
      return response.data.documents[0];
    }

    return null;
  } catch (error) {
    console.error("카카오 장소 상세 정보 조회 오류:", error);
    throw error;
  }
}

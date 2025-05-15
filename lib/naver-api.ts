import axios from "axios";

// 네이버 Search API 키
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// 네이버 장소 검색 API를 호출하는 함수
export async function searchNaverPlaces(query: string) {
  try {
    const response = await axios.get(
      "https://openapi.naver.com/v1/search/local.json",
      {
        headers: {
          "X-Naver-Client-Id": NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        },
        params: {
          query,
          display: 5,
        },
      }
    );

    return response.data.items;
  } catch (error) {
    console.error("네이버 장소 검색 오류:", error);
    throw error;
  }
}

// 네이버 별점 정보 가져오기 (네이버 맵 API)
export async function getNaverPlaceRating(id: string) {
  try {
    // 네이버 지도 API에서는 별도로 별점을 가져오는 API가 없어서
    // 웹페이지 크롤링 또는 네이버 비즈니스 API를 사용해야 함
    // 아래는 예시 구현
    const response = await axios.get(
      `https://map.naver.com/v5/api/places/${id}`,
      {
        headers: {
          "X-NCP-APIGW-API-KEY-ID": NAVER_CLIENT_ID,
          "X-NCP-APIGW-API-KEY": NAVER_CLIENT_SECRET,
        },
      }
    );

    // 응답에서 별점 정보 추출
    const rating = response.data.rating || 0;
    return rating;
  } catch (error) {
    console.error("네이버 별점 조회 오류:", error);
    return 0; // 오류 시 기본값 0 반환
  }
}

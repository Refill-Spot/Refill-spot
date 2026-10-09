import axios from "axios";

// 네이버 Search API 키
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

interface NaverPlaceSearchResult {
  title: string; // 업체명
  link: string; // 업체 홈페이지 URL
  category: string; // 업체 분류
  description: string; // 업체 설명
  telephone: string; // 전화번호
  address: string; // 주소
  roadAddress: string; // 도로명 주소
  mapx: string; // X 좌표
  mapy: string; // Y 좌표
}

/**
 * 네이버 장소 검색 API를 호출하는 함수
 * @param query 검색어 (예: "스타벅스 강남점")
 * @returns 검색 결과 목록
 */
export async function searchNaverPlaces(
  query: string,
): Promise<NaverPlaceSearchResult[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn(
      "네이버 API 키가 설정되지 않았습니다. NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET 환경 변수를 확인해주세요.",
    );
    return [];
  }

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
          sort: "random", // 정확도순 검색
        },
      },
    );

    // 검색 결과에서 '<b>' 태그 제거 (네이버 API는 키워드를 강조하기 위해 HTML 태그 포함)
    const items = response.data.items.map((item: any) => ({
      ...item,
      title: item.title.replace(/<\/?b>/g, ""),
      category: item.category.replace(/<\/?b>/g, ""),
      address: item.address.replace(/<\/?b>/g, ""),
      roadAddress: item.roadAddress.replace(/<\/?b>/g, ""),
      description: item.description?.replace(/<\/?b>/g, ""),
    }));

    return items;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        console.error(
          "네이버 API 인증 오류: API 키를 확인해주세요. Client ID:",
          NAVER_CLIENT_ID ? "설정됨" : "설정되지 않음",
          "Client Secret:",
          NAVER_CLIENT_SECRET ? "설정됨" : "설정되지 않음",
        );
      } else {
        console.error(
          "네이버 장소 검색 오류:",
          error.response?.status,
          error.response?.data,
        );
      }
    } else {
      console.error("네이버 장소 검색 오류:", error);
    }
    return [];
  }
}

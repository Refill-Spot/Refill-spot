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
  id?: string; // 장소 ID (검색 결과에서 추출해야 함)
}

interface NaverPlaceDetailResult {
  id: string; // 장소 ID
  name: string; // 장소명
  address: string; // 주소
  roadAddress: string; // 도로명 주소
  tel: string; // 전화번호
  bizhourInfo?: {
    // 영업시간
    hours: string[];
    moreHours: string[];
  };
  images?: {
    // 이미지
    url: string;
    width: number;
    height: number;
  }[];
  totalReviews?: number; // 리뷰 수
  visitorReviewScore?: number; // 방문자 리뷰 평점 (5점 만점)
  blogReviewScore?: number; // 블로그 리뷰 평점 (5점 만점)
  avgRating?: number; // 평균 평점 (5점 만점)
}

/**
 * 네이버 장소 검색 API를 호출하는 함수
 * @param query 검색어 (예: "스타벅스 강남점")
 * @returns 검색 결과 목록
 */
export async function searchNaverPlaces(
  query: string
): Promise<NaverPlaceSearchResult[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn("네이버 API 키가 설정되지 않았습니다.");
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
      }
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

    // 검색 결과에서 장소 ID 추출 (네이버 검색 API에는 ID가 명시적으로 제공되지 않음)
    return items.map((item: any) => {
      // 링크 URL에서 ID 추출 시도
      const idMatch = item.link?.match(/place\/(\d+)/) || [];
      return {
        ...item,
        id: idMatch[1] || undefined,
      };
    });
  } catch (error) {
    console.error("네이버 장소 검색 오류:", error);
    return [];
  }
}

/**
 * 네이버 지도 API에서 장소 상세 정보 가져오기
 * @param id 장소 ID
 * @returns 장소 상세 정보 (평점 포함)
 */
export async function getNaverPlaceDetail(
  id: string
): Promise<NaverPlaceDetailResult | null> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn("네이버 API 키가 설정되지 않았습니다.");
    return null;
  }

  try {
    // 네이버 지도 API 호출 - 장소 상세 정보 (공식 API가 아닐 수 있음)
    const response = await axios.get(
      `https://map.naver.com/v5/api/places/${id}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0", // API 호출 시 유저 에이전트 필요할 수 있음
          Referer: "https://map.naver.com/",
        },
      }
    );

    // 응답에서 필요한 정보 추출
    const data = response.data;

    return {
      id: data.id || id,
      name: data.name,
      address: data.address,
      roadAddress: data.roadAddress,
      tel: data.tel,
      bizhourInfo: data.bizhourInfo,
      images: data.images,
      totalReviews: data.totalReviews,
      visitorReviewScore: data.visitorReviewScore,
      blogReviewScore: data.blogReviewScore,
      avgRating: calculateAverageRating(data),
    };
  } catch (error) {
    console.error(`네이버 장소(ID: ${id}) 상세 정보 조회 오류:`, error);
    return null;
  }
}

/**
 * 네이버 평점 계산 함수
 * 방문자 리뷰와 블로그 리뷰 점수를 가중 평균하여 최종 평점 계산
 */
function calculateAverageRating(data: any): number {
  if (!data) return 0;

  // 방문자 리뷰 평점 (없으면 0)
  const visitorScore = data.visitorReviewScore || 0;
  // 블로그 리뷰 평점 (없으면 0)
  const blogScore = data.blogReviewScore || 0;

  // 둘 다 0이면 평점 없음
  if (visitorScore === 0 && blogScore === 0) return 0;

  // 방문자 리뷰가 있으면 방문자 리뷰 가중치 높게 (0.7)
  if (visitorScore > 0 && blogScore > 0) {
    return visitorScore * 0.7 + blogScore * 0.3;
  }

  // 둘 중 하나만 있으면 해당 점수 사용
  return visitorScore > 0 ? visitorScore : blogScore;
}

/**
 * 네이버 장소 평점 가져오기
 * @param query 검색어 (가게명 + 주소)
 * @returns 평점 (0~5)
 */
export async function getNaverPlaceRating(query: string): Promise<number> {
  try {
    // 1. 장소 검색
    const places = await searchNaverPlaces(query);
    if (!places || places.length === 0) return 0;

    // 2. 첫 번째 결과의 ID로 상세 정보 조회
    const firstPlace = places[0];
    if (!firstPlace.id) return 0;

    // 3. 상세 정보에서 평점 추출
    const details = await getNaverPlaceDetail(firstPlace.id);
    if (!details) return 0;

    return details.avgRating || 0;
  } catch (error) {
    console.error("네이버 별점 조회 오류:", error);
    return 0; // 오류 시 기본값 0 반환
  }
}

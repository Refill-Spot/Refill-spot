import axios from "axios";

// 네이버 Search API 키
const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NEXT_PUBLIC_NAVER_CLIENT_SECRET;

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

// 네이버 블로그 리뷰 검색 API를 호출하는 함수
export async function searchNaverBlogReviews(placeName: string) {
  try {
    const response = await axios.get(
      "https://openapi.naver.com/v1/search/blog.json",
      {
        headers: {
          "X-Naver-Client-Id": NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        },
        params: {
          query: `${placeName} 리뷰`,
          display: 5,
        },
      }
    );

    return response.data.items;
  } catch (error) {
    console.error("네이버 블로그 리뷰 검색 오류:", error);
    throw error;
  }
}

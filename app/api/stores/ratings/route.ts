import { NextRequest, NextResponse } from "next/server";
import { searchNaverPlaces } from "@/lib/naver-api";
import { searchKakaoPlaces } from "@/lib/kakao-api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const storeName = searchParams.get("name");
  const address = searchParams.get("address");

  if (!storeName) {
    return NextResponse.json(
      { error: "가게 이름이 필요합니다." },
      { status: 400 }
    );
  }

  try {
    // 검색어 구성 (가게 이름 + 주소 일부)
    const searchQuery = address
      ? `${storeName} ${address.split(" ").slice(0, 2).join(" ")}`
      : storeName;

    // 네이버 및 카카오 API 동시 호출
    const [naverResults, kakaoResults] = await Promise.all([
      searchNaverPlaces(searchQuery),
      searchKakaoPlaces(searchQuery),
    ]);

    // 결과 가공
    let naverRating = 0;
    let kakaoRating = 0;

    // 네이버 결과에서 별점 추출 (첫 번째 결과 사용)
    if (naverResults && naverResults.length > 0) {
      // 네이버 API 응답 구조에 맞게 추출
      // 참고: 네이버 검색 API 응답 필드는 문서 참고
      const firstResult = naverResults[0];

      // 별점 정보가 있는 필드에 따라 맞게 조정 (예: lastReviews, category4, etc)
      // 여기서는 예시로 'category4'에 별점 정보가 있다고 가정
      if (firstResult.category4) {
        const ratingMatch = firstResult.category4.match(/평점\s*(\d+(\.\d+)?)/);
        if (ratingMatch && ratingMatch[1]) {
          naverRating = parseFloat(ratingMatch[1]);
        }
      }

      // 또는 직접 rating 필드가 있다면
      if (firstResult.rating) {
        naverRating = parseFloat(firstResult.rating);
      }
    }

    // 카카오 결과에서 별점 추출 (첫 번째 결과 사용)
    if (kakaoResults && kakaoResults.length > 0) {
      // 카카오 API 응답 구조에 맞게 추출
      const firstResult = kakaoResults[0];

      // 카카오 로컬 API에는 별점이 없으므로 웹 문서 검색 결과를 활용해야 할 수 있음
      // 별점이 place_rating 또는 rating 필드에 있다고 가정
      if (firstResult.place_rating) {
        kakaoRating = parseFloat(firstResult.place_rating);
      } else if (firstResult.rating) {
        kakaoRating = parseFloat(firstResult.rating);
      }
    }

    return NextResponse.json({
      naverRating,
      kakaoRating,
    });
  } catch (error) {
    console.error("별점 정보 조회 오류:", error);
    return NextResponse.json(
      { error: "별점 정보를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

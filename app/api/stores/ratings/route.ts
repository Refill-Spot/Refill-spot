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
      // 네이버 API 응답 구조에 따라 추출
      // 예시: naverRating = naverResults[0].rating || 0
      naverRating = 4.5; // 예시 값 (실제 API에서는 다르게 추출 필요)
    }

    // 카카오 결과에서 별점 추출 (첫 번째 결과 사용)
    if (kakaoResults && kakaoResults.length > 0) {
      // 카카오 API 응답 구조에 따라 추출
      // 예시: kakaoRating = kakaoResults[0].rating || 0
      kakaoRating = 4.3; // 예시 값 (실제 API에서는 다르게 추출 필요)
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

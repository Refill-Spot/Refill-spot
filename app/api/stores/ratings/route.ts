import { NextRequest, NextResponse } from "next/server";
import { getNaverPlaceRating } from "@/lib/naver-api";
import { getKakaoPlaceRating } from "@/lib/kakao-api";
import { z } from "zod";

// 요청 스키마 정의
const ratingRequestSchema = z.object({
  storeName: z.string().min(1, "가게 이름이 필요합니다."),
  address: z.string().optional(),
});

/**
 * 가게 평점 정보 조회 API
 * GET /api/stores/ratings?name=맛있는집&address=서울시 강남구 역삼동
 */
export async function GET(request: NextRequest) {
  try {
    // URL 파라미터 파싱 및 검증
    const searchParams = request.nextUrl.searchParams;
    const storeName = searchParams.get("name");
    const address = searchParams.get("address");

    // 요청 검증
    const validationResult = ratingRequestSchema.safeParse({
      storeName,
      address,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "유효하지 않은 요청입니다.",
          details: validationResult.error.format(),
        },
        { status: 400 },
      );
    }

    const { storeName: validStoreName, address: validAddress } =
      validationResult.data;

    // 검색어 구성 (가게 이름 + 주소 일부)
    const searchQuery = validAddress
      ? `${validStoreName} ${validAddress.split(" ").slice(0, 2).join(" ")}`
      : validStoreName;

    // 네이버 및 카카오 API 병렬 호출 (에러 안전 처리)
    // TODO: API 키 문제 해결 후 활성화
    // const [naverRating, kakaoRating] = await Promise.allSettled([
    //   getNaverPlaceRating(searchQuery),
    //   getKakaoPlaceRating(searchQuery),
    // ]);
    
    // 임시로 기본값 반환 (API 키 문제 해결 시까지)
    const naverRating = { status: "fulfilled" as const, value: 0 };
    const kakaoRating = { status: "fulfilled" as const, value: 0 };

    // 결과 처리
    const naverScore = naverRating.status === "fulfilled" ? naverRating.value : 0;
    const kakaoScore = kakaoRating.status === "fulfilled" ? kakaoRating.value : 0;

    // 평균 계산 (유효한 평점만 사용)
    const validRatings = [naverScore, kakaoScore].filter(rating => rating > 0);
    const averageRating = validRatings.length > 0 
      ? validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length 
      : 0;

    // 결과 반환
    return NextResponse.json({
      success: true,
      data: {
        naverRating: Number(naverScore.toFixed(1)),
        kakaoRating: Number(kakaoScore.toFixed(1)),
        averageRating: Number(averageRating.toFixed(1)),
      },
    });
  } catch (error) {
    console.error("별점 정보 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "별점 정보를 가져오는 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}

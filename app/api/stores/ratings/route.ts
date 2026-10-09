import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "EXTERNAL_RATINGS_UNAVAILABLE",
        message: "외부 평점 제공 경로가 연결되지 않았습니다.",
      },
      data: {
        naver: { status: "unsupported" },
        kakao: { status: "unsupported" },
      },
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

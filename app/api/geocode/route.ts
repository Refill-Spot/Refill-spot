import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// 네이버 지오코딩 API 키
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "주소가 필요합니다." }, { status: 400 });
  }

  try {
    // 네이버 지오코딩 API 호출
    const response = await axios.get(
      "https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode",
      {
        headers: {
          "X-NCP-APIGW-API-KEY-ID": NAVER_CLIENT_ID,
          "X-NCP-APIGW-API-KEY": NAVER_CLIENT_SECRET,
        },
        params: {
          query: address,
        },
      }
    );

    // 응답 데이터 확인
    const result = response.data;

    if (
      result.status === "OK" &&
      result.addresses &&
      result.addresses.length > 0
    ) {
      const { x, y } = result.addresses[0];
      return NextResponse.json({
        lat: parseFloat(y),
        lng: parseFloat(x),
      });
    }

    return NextResponse.json(
      { error: "주소를 찾을 수 없습니다." },
      { status: 404 }
    );
  } catch (error) {
    console.error("지오코딩 API 오류:", error);
    return NextResponse.json(
      { error: "지오코딩 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

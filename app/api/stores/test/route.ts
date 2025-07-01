import { runStoreHealthCheck } from "@/lib/store-health-check";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const data = await runStoreHealthCheck();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("테스트 API 오류:", error);
    return NextResponse.json({
      success: false,
      error: "테스트 실행 중 오류 발생",
      details: error.message || error,
    });
  }
}

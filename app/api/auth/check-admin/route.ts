import { NextRequest } from "next/server";
import { apiResponse } from "@/lib/api-response";
import { checkAdminAccessForAPI } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await checkAdminAccessForAPI(request);
    
    console.log("관리자 권한 확인 결과:", {
      isAdmin: adminCheck.isAdmin,
      userId: adminCheck.user?.id,
      userEmail: adminCheck.user?.email,
      profile: adminCheck.profile,
      error: adminCheck.error,
    });
    
    return apiResponse.success({
      isAdmin: adminCheck.isAdmin,
      user: adminCheck.user,
      role: adminCheck.profile?.role || null,
      is_admin: adminCheck.profile?.is_admin || false,
      profile: adminCheck.profile,
    });
  } catch (error) {
    console.error("관리자 권한 확인 API 오류:", error);
    return apiResponse.error("권한 확인 중 오류가 발생했습니다.", 500);
  }
}
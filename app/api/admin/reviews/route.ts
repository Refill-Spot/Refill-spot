import { NextRequest } from "next/server";
import { apiResponse } from "@/lib/api-response";
import { checkAdminAccessForAPI } from "@/lib/auth-utils";
import { createRouteHandlerSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

// 관리자용 리뷰 목록 조회 (신고된 리뷰 포함)
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await checkAdminAccessForAPI(request);
    
    if (!adminCheck.isAdmin) {
      return apiResponse.error(adminCheck.error || "관리자 권한이 필요합니다.", adminCheck.status || 403);
    }

    // 관리자 권한이 확인되었으므로 서버 클라이언트 사용 (RLS 바이패스)
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const reportedOnly = searchParams.get("reported_only") === "true";
    const storeId = searchParams.get("store_id");

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("reviews")
      .select(`
        id,
        rating,
        content,
        created_at,
        updated_at,
        image_urls,
        store_id,
        stores (
          id,
          name,
          address
        ),
        profiles (
          id,
          username
        ),
        review_reports (
          id,
          reason,
          status,
          created_at
        )
      `)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (reportedOnly) {
      // 신고된 리뷰만 조회 (review_reports 테이블에 레코드가 있는 경우)
      query = query.not("review_reports", "is", null);
    }

    if (storeId) {
      query = query.eq("store_id", storeId);
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.error("리뷰 목록 조회 오류:", error);
      return apiResponse.error("리뷰 목록을 불러오는데 실패했습니다.", 500);
    }

    // 총 개수 조회
    let countQuery = supabase
      .from("reviews")
      .select("review_reports(*)", { count: "exact", head: true });

    if (reportedOnly) {
      // 신고된 리뷰만 카운트
      countQuery = countQuery.not("review_reports", "is", null);
    }

    if (storeId) {
      countQuery = countQuery.eq("store_id", storeId);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("리뷰 개수 조회 오류:", countError);
      return apiResponse.error("리뷰 개수를 불러오는데 실패했습니다.", 500);
    }

    return apiResponse.success({
      reviews: reviews || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        hasMore: (count || 0) > page * limit,
      },
    });

  } catch (error) {
    console.error("관리자 리뷰 목록 API 오류:", error);
    return apiResponse.error("서버 오류가 발생했습니다.", 500);
  }
}
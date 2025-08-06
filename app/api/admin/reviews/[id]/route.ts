import { NextRequest } from "next/server";
import { apiResponse } from "@/lib/api-response";
import { checkAdminAccessForAPI } from "@/lib/auth-utils";
import { createRouteHandlerSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// 관리자용 리뷰 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    
    const adminCheck = await checkAdminAccessForAPI(request);
    
    if (!adminCheck.isAdmin) {
      return apiResponse.error(adminCheck.error || "관리자 권한이 필요합니다.", adminCheck.status || 403);
    }

    const supabase = createRouteHandlerSupabaseClient(request);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      return apiResponse.error("인증된 사용자가 없습니다.", 401);
    }

    // 리뷰 존재 확인
    const { data: existingReview, error: fetchError } = await supabase
      .from("reviews")
      .select("id, user_id, profiles(username)")
      .eq("id", id)
      .single();

    if (fetchError || !existingReview) {
      return apiResponse.error("리뷰를 찾을 수 없습니다.", 404);
    }

    // 관리자 권한으로 리뷰 삭제 (RLS 바이패스)
    const { error: deleteError } = await supabase.rpc("delete_review_as_admin", {
      review_id: parseInt(id),
      admin_user_id: user.id,
    });

    if (deleteError) {
      return apiResponse.error(`리뷰 삭제에 실패했습니다: ${deleteError.message}`, 500);
    }

    return apiResponse.success({
      message: "리뷰가 성공적으로 삭제되었습니다.",
      deletedReview: {
        id: existingReview.id,
        userId: existingReview.user_id,
        username: Array.isArray(existingReview.profiles) 
          ? (existingReview.profiles[0] as any)?.username 
          : (existingReview.profiles as any)?.username,
      },
    });

  } catch (error) {
    console.error("관리자 리뷰 삭제 API 오류:", error);
    return apiResponse.error("서버 오류가 발생했습니다.", 500);
  }
}

// 관리자용 리뷰 신고 상태 업데이트
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminCheck = await checkAdminAccessForAPI(request);
    
    if (!adminCheck.isAdmin) {
      return apiResponse.error(adminCheck.error || "관리자 권한이 필요합니다.", adminCheck.status || 403);
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // "approve" | "reject"

    if (!["approve", "reject"].includes(action)) {
      return apiResponse.error("잘못된 액션입니다.", 400);
    }

    // 관리자 권한이 확인되었으므로 서비스 역할 클라이언트 사용 (RLS 완전 바이패스)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // 리뷰와 신고 내역 확인
    const { data: existingReview, error: fetchError } = await supabase
      .from("reviews")
      .select(`
        id,
        review_reports (
          id,
          status,
          reason
        )
      `)
      .eq("id", id)
      .single();

    if (fetchError || !existingReview) {
      return apiResponse.error("리뷰를 찾을 수 없습니다.", 404);
    }

    // 신고 내역이 없으면 에러
    if (!existingReview.review_reports || existingReview.review_reports.length === 0) {
      return apiResponse.error("해당 리뷰에 대한 신고 내역이 없습니다.", 400);
    }

    let updateData: any = {};
    let message = "";

    if (action === "approve") {
      // 신고 승인 - 신고 상태를 'reviewed'로 변경
      updateData = { status: "reviewed", reviewed_at: new Date().toISOString(), reviewed_by: adminCheck.user?.id };
      message = "신고가 승인되어 처리되었습니다.";
    } else if (action === "dismiss") {
      // 신고 기각 - 신고 상태를 'dismissed'로 변경
      updateData = { status: "dismissed", reviewed_at: new Date().toISOString(), reviewed_by: adminCheck.user?.id };
      message = "신고가 기각되었습니다.";
    } else {
      return apiResponse.error("잘못된 액션입니다. 'approve' 또는 'dismiss'만 허용됩니다.", 400);
    }

    // review_reports 테이블 업데이트
    const { data: updatedReports, error: updateError } = await supabase
      .from("review_reports")
      .update(updateData)
      .eq("review_id", id)
      .eq("status", "pending")
      .select();

    if (updateError) {
      console.error("신고 상태 업데이트 오류:", updateError);
      return apiResponse.error("신고 상태 업데이트에 실패했습니다.", 500);
    }

    return apiResponse.success({
      message,
      updated_reports: updatedReports,
    });

  } catch (error) {
    console.error("관리자 리뷰 상태 업데이트 API 오류:", error);
    return apiResponse.error("서버 오류가 발생했습니다.", 500);
  }
}
import { NextRequest } from "next/server";
import { apiResponse } from "@/lib/api-response";
import { checkAdminAccessForAPI } from "@/lib/auth-utils";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

function parseReviewId(id: string) {
  if (!id || /[^0-9]/.test(id)) {
    return null;
  }

  const reviewId = Number(id);
  return Number.isSafeInteger(reviewId) && reviewId > 0 ? reviewId : null;
}

// 관리자용 리뷰 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminCheck = await checkAdminAccessForAPI(request);

    if (!adminCheck.isAdmin) {
      return apiResponse.error(
        adminCheck.error || "관리자 권한이 필요합니다.",
        adminCheck.status || 403,
      );
    }

    if (!adminCheck.user) {
      return apiResponse.error("인증된 사용자가 없습니다.", 401);
    }

    const { id } = await params;
    const reviewId = parseReviewId(id);
    if (reviewId === null) {
      return apiResponse.error("잘못된 리뷰 ID입니다.", 400);
    }

    const supabase = createRouteHandlerSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user || user.id !== adminCheck.user.id) {
      return apiResponse.error("인증된 사용자가 없습니다.", 401);
    }

    // 리뷰 존재 확인
    const { data: existingReview, error: fetchError } = await supabase
      .from("reviews")
      .select("id, user_id, profiles(username)")
      .eq("id", reviewId)
      .single();

    if (fetchError || !existingReview) {
      return apiResponse.error("리뷰를 찾을 수 없습니다.", 404);
    }

    const { error: deleteError } = await supabase.rpc(
      "delete_review_as_admin",
      {
        review_id: reviewId,
        admin_user_id: user.id,
      },
    );

    if (deleteError) {
      console.error("관리자 리뷰 삭제 오류:", deleteError);
      return apiResponse.error("리뷰 삭제에 실패했습니다.", 500);
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
      return apiResponse.error(
        adminCheck.error || "관리자 권한이 필요합니다.",
        adminCheck.status || 403,
      );
    }

    if (!adminCheck.user) {
      return apiResponse.error("인증된 사용자가 없습니다.", 401);
    }

    const { id } = await params;
    const reviewId = parseReviewId(id);
    if (reviewId === null) {
      return apiResponse.error("잘못된 리뷰 ID입니다.", 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiResponse.error("잘못된 JSON 요청입니다.", 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !("action" in body) ||
      (body.action !== "approve" && body.action !== "reject")
    ) {
      return apiResponse.error("잘못된 액션입니다.", 400);
    }
    const { action } = body;

    const supabase = createRouteHandlerSupabaseClient(request);

    // 리뷰와 신고 내역 확인
    const { data: existingReview, error: fetchError } = await supabase
      .from("reviews")
      .select(
        `
        id,
        review_reports (
          id,
          status,
          reason
        )
      `,
      )
      .eq("id", reviewId)
      .single();

    if (fetchError || !existingReview) {
      return apiResponse.error("리뷰를 찾을 수 없습니다.", 404);
    }

    // 신고 내역이 없으면 에러
    if (
      !existingReview.review_reports ||
      existingReview.review_reports.length === 0
    ) {
      return apiResponse.error("해당 리뷰에 대한 신고 내역이 없습니다.", 400);
    }

    const message =
      action === "approve"
        ? "신고가 승인되어 처리되었습니다."
        : "신고가 기각되었습니다.";

    // review_reports 테이블 업데이트
    const { data: updatedReports, error: updateError } = await supabase
      .from("review_reports")
      .update({
        status: action === "approve" ? "reviewed" : "dismissed",
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminCheck.user.id,
      })
      .eq("review_id", reviewId)
      .eq("status", "pending")
      .select();

    if (updateError) {
      console.error("신고 상태 업데이트 오류:", updateError);
      return apiResponse.error("신고 상태 업데이트에 실패했습니다.", 500);
    }

    if (!updatedReports || updatedReports.length === 0) {
      return apiResponse.error("처리할 대기 중인 신고가 없습니다.", 409);
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

import { NextRequest } from "next/server";
import { apiResponse } from "@/lib/api-response";
import { checkAdminAccessForAPI } from "@/lib/auth-utils";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

// 공지사항 상세 조회 (게시된 공지사항은 모든 사용자 가능)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createRouteHandlerSupabaseClient(request);

    const { data: announcement, error } = await supabase
      .from("announcements")
      .select(`
        id,
        title,
        content,
        is_important,
        is_published,
        created_at,
        updated_at,
        published_at,
        author_id,
        profiles:author_id (
          id,
          username
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("공지사항 조회 오류:", error);
      return apiResponse.error("공지사항을 찾을 수 없습니다.", 404);
    }

    // 게시되지 않은 공지사항은 관리자만 조회 가능
    if (!announcement.is_published) {
      const adminCheck = await checkAdminAccessForAPI(request);
      if (!adminCheck.isAdmin) {
        return apiResponse.error("게시되지 않은 공지사항입니다.", 403);
      }
    }

    return apiResponse.success(announcement);
  } catch (error) {
    console.error("공지사항 조회 API 오류:", error);
    return apiResponse.error("공지사항 조회 중 오류가 발생했습니다.", 500);
  }
}

// 공지사항 수정 (관리자 전용)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccessForAPI(request);
    if (!adminCheck.isAdmin) {
      return apiResponse.error("관리자 권한이 필요합니다.", 403);
    }

    const supabase = createRouteHandlerSupabaseClient(request);

    const body = await request.json();
    const { title, content, is_important, is_published } = body;

    // 입력 값 검증
    if (!title || !content) {
      return apiResponse.error("제목과 내용을 입력해주세요.", 400);
    }

    if (title.length < 1 || content.length < 1) {
      return apiResponse.error("제목과 내용은 최소 1자 이상이어야 합니다.", 400);
    }

    // 기존 공지사항 조회
    const { data: existingAnnouncement, error: fetchError } = await supabase
      .from("announcements")
      .select("is_published, published_at")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("기존 공지사항 조회 오류:", fetchError);
      return apiResponse.error("공지사항을 찾을 수 없습니다.", 404);
    }

    // 게시 상태 변경시 published_at 업데이트
    let published_at = existingAnnouncement.published_at;
    if (is_published && !existingAnnouncement.is_published) {
      // 게시하지 않은 상태에서 게시 상태로 변경
      published_at = new Date().toISOString();
    } else if (!is_published && existingAnnouncement.is_published) {
      // 게시 상태에서 게시하지 않은 상태로 변경
      published_at = null;
    }

    const updateData = {
      title,
      content,
      is_important: is_important ?? false,
      is_published: is_published ?? false,
      published_at,
    };

    const { data: announcement, error } = await supabase
      .from("announcements")
      .update(updateData)
      .eq("id", id)
      .select(`
        id,
        title,
        content,
        is_important,
        is_published,
        created_at,
        updated_at,
        published_at,
        author_id,
        profiles:author_id (
          id,
          username
        )
      `)
      .single();

    if (error) {
      console.error("공지사항 수정 오류:", error);
      return apiResponse.error("공지사항 수정 중 오류가 발생했습니다.", 500);
    }

    return apiResponse.success(announcement);
  } catch (error) {
    console.error("공지사항 수정 API 오류:", error);
    return apiResponse.error("공지사항 수정 중 오류가 발생했습니다.", 500);
  }
}

// 공지사항 삭제 (관리자 전용)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccessForAPI(request);
    if (!adminCheck.isAdmin) {
      return apiResponse.error("관리자 권한이 필요합니다.", 403);
    }

    const supabase = createRouteHandlerSupabaseClient(request);

    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("공지사항 삭제 오류:", error);
      return apiResponse.error("공지사항 삭제 중 오류가 발생했습니다.", 500);
    }

    return apiResponse.success({ message: "공지사항이 삭제되었습니다." });
  } catch (error) {
    console.error("공지사항 삭제 API 오류:", error);
    return apiResponse.error("공지사항 삭제 중 오류가 발생했습니다.", 500);
  }
}
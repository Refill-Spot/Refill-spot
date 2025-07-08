import { NextRequest } from "next/server";
import { apiResponse } from "@/lib/api-response";
import { checkAdminAccessForAPI } from "@/lib/auth-utils";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

// 공지사항 목록 조회 (모든 사용자 가능 - 게시된 공지사항만)
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient(request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const includeUnpublished = searchParams.get("includeUnpublished") === "true";

    const offset = (page - 1) * limit;

    // 관리자가 아닌 경우 게시된 공지사항만 조회
    let query = supabase
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
      .order("is_important", { ascending: false })
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 관리자가 아닌 경우 게시된 공지사항만 조회
    if (!includeUnpublished) {
      query = query.eq("is_published", true);
    } else {
      // 관리자 권한 확인
      const adminCheck = await checkAdminAccessForAPI(request);
      if (!adminCheck.isAdmin) {
        return apiResponse.error("관리자 권한이 필요합니다.", 403);
      }
    }

    const { data: announcements, error } = await query;

    if (error) {
      console.error("공지사항 조회 오류:", error);
      return apiResponse.error("공지사항 조회 중 오류가 발생했습니다.", 500);
    }

    // 전체 개수 조회
    let countQuery = supabase
      .from("announcements")
      .select("id", { count: "exact" });

    if (!includeUnpublished) {
      countQuery = countQuery.eq("is_published", true);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("공지사항 개수 조회 오류:", countError);
      return apiResponse.error("공지사항 개수 조회 중 오류가 발생했습니다.", 500);
    }

    return apiResponse.success({
      announcements,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("공지사항 API 오류:", error);
    return apiResponse.error("공지사항 조회 중 오류가 발생했습니다.", 500);
  }
}

// 공지사항 생성 (관리자 전용)
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccessForAPI(request);
    if (!adminCheck.isAdmin) {
      return apiResponse.error("관리자 권한이 필요합니다.", 403);
    }

    const supabase = createRouteHandlerSupabaseClient(request);

    const body = await request.json();
    const { title, content, is_important = false, is_published = false } = body;

    // 입력 값 검증
    if (!title || !content) {
      return apiResponse.error("제목과 내용을 입력해주세요.", 400);
    }

    if (title.length < 1 || content.length < 1) {
      return apiResponse.error("제목과 내용은 최소 1자 이상이어야 합니다.", 400);
    }

    const insertData = {
      title,
      content,
      is_important,
      is_published,
      author_id: adminCheck.user?.id,
      published_at: is_published ? new Date().toISOString() : null,
    };

    const { data: announcement, error } = await supabase
      .from("announcements")
      .insert(insertData)
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
      console.error("공지사항 생성 오류:", error);
      return apiResponse.error("공지사항 생성 중 오류가 발생했습니다.", 500);
    }

    return apiResponse.success(announcement, 201);
  } catch (error) {
    console.error("공지사항 생성 API 오류:", error);
    return apiResponse.error("공지사항 생성 중 오류가 발생했습니다.", 500);
  }
}
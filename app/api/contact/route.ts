import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { apiResponse } from "@/lib/api-response";
import { checkAdminAccessForAPI } from "@/lib/auth-utils";
import { apiLogger } from "@/lib/logger";
import type { Database } from "@/types/supabase";

type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 입력 데이터 검증
    const { type, name, email, phone, storeName, storeAddress, message } = body;
    
    if (!type || !name || !email || !message) {
      return apiResponse.error("필수 필드가 누락되었습니다.", 400);
    }

    if (!["store_registration", "inquiry", "feedback"].includes(type)) {
      return apiResponse.error("유효하지 않은 문의 유형입니다.", 400);
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiResponse.error("유효하지 않은 이메일 형식입니다.", 400);
    }

    // 가게 등록 요청시 필수 필드 검증
    if (type === "store_registration" && (!storeName || !storeAddress)) {
      return apiResponse.error("가게 등록 요청시 가게명과 주소는 필수입니다.", 400);
    }

    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => cookies() 
    });

    // 문의사항 데이터 준비
    const contactData: ContactInsert = {
      type,
      name,
      email,
      phone: phone || null,
      store_name: storeName || null,
      store_address: storeAddress || null,
      message,
      status: "pending",
    };

    // 데이터베이스에 저장
    const { data, error } = await supabase
      .from("contacts")
      .insert(contactData)
      .select()
      .single();

    if (error) {
      apiLogger.error("Contact save failed", error);
      return apiResponse.error("문의사항 저장 중 오류가 발생했습니다.", 500);
    }

    return apiResponse.success(
      {
        id: data.id,
        message: "문의가 성공적으로 접수되었습니다.",
      },
      201
    );
  } catch (error) {
    apiLogger.error("Contact API error", error);
    return apiResponse.error("서버 오류가 발생했습니다.", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccessForAPI();
    if (!adminCheck.isAdmin) {
      return apiResponse.error(adminCheck.error || "관리자 권한이 필요합니다.", adminCheck.status);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => cookies() 
    });

    // 쿼리 빌더 시작
    let query = supabase
      .from("contacts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // 필터 적용
    if (status && ["pending", "in_progress", "completed", "closed"].includes(status)) {
      query = query.eq("status", status);
    }

    if (type && ["store_registration", "inquiry", "feedback"].includes(type)) {
      query = query.eq("type", type);
    }

    // 페이지네이션 적용
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("문의사항 조회 오류:", error);
      return apiResponse.error("문의사항 조회 중 오류가 발생했습니다.", 500);
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return apiResponse.success({
      contacts: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("문의사항 조회 API 오류:", error);
    return apiResponse.error("서버 오류가 발생했습니다.", 500);
  }
}
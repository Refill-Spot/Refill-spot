import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { apiResponse } from "@/lib/api-response";
import { checkAdminAccessForAPI } from "@/lib/auth-utils";
import { apiLogger } from "@/lib/logger";
import type { Database } from "@/types/supabase";
import {
  buildContactMessage,
  contactQuerySchema,
  contactSubmissionSchema,
} from "@/lib/validations";

type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];

export async function POST(request: NextRequest) {
  try {
    const validation = contactSubmissionSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!validation.success) {
      return apiResponse.error(
        "문의 유형과 필수 입력 항목을 확인해 주세요.",
        400,
      );
    }
    const { type, name, email, phone, storeName, storeAddress } =
      validation.data;

    const supabase = createRouteHandlerSupabaseClient(request);

    // 문의사항 데이터 준비
    const contactData: ContactInsert = {
      type,
      name,
      email,
      phone: phone || null,
      store_name: storeName || null,
      store_address: storeAddress || null,
      message: buildContactMessage(validation.data),
      status: "pending",
    };

    // 데이터베이스에 저장
    // 공개 접수에는 INSERT만 필요합니다. 익명 SELECT 권한을 요구하지 않습니다.
    const { error } = await supabase.from("contacts").insert(contactData);

    if (error) {
      apiLogger.error("Contact save failed", error);
      return apiResponse.error("문의사항 저장 중 오류가 발생했습니다.", 500);
    }

    return apiResponse.success(
      {
        message:
          type === "store_registration"
            ? "제보가 검토 대기로 접수되었습니다. 검토 후 반영하며, 즉시 등록·수정되지 않습니다."
            : "문의가 성공적으로 접수되었습니다.",
      },
      201,
    );
  } catch (error) {
    apiLogger.error("Contact API error", error);
    return apiResponse.error("서버 오류가 발생했습니다.", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccessForAPI(request);
    if (!adminCheck.isAdmin) {
      return apiResponse.error(
        adminCheck.error || "관리자 권한이 필요합니다.",
        adminCheck.status,
      );
    }

    const { searchParams } = new URL(request.url);
    const validation = contactQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );
    if (!validation.success) {
      return apiResponse.error(
        "올바른 페이지와 문의 필터를 입력해 주세요.",
        400,
      );
    }
    const { page, limit, status, type } = validation.data;

    const supabase = createRouteHandlerSupabaseClient(request);

    // 쿼리 빌더 시작
    let query = supabase
      .from("contacts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // 필터 적용
    if (status) {
      query = query.eq("status", status);
    }

    if (type) {
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

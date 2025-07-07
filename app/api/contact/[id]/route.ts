import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { apiResponse } from "@/lib/api-response";
import { checkAdminAccessForAPI } from "@/lib/auth-utils";
import type { Database } from "@/types/supabase";

type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccessForAPI();
    if (!adminCheck.isAdmin) {
      return apiResponse.error(adminCheck.error || "관리자 권한이 필요합니다.", adminCheck.status);
    }

    const { id } = await params;
    const contactId = parseInt(id);

    if (isNaN(contactId)) {
      return apiResponse.error("유효하지 않은 문의사항 ID입니다.", 400);
    }

    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => cookies() 
    });

    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return apiResponse.error("문의사항을 찾을 수 없습니다.", 404);
      }
      console.error("문의사항 조회 오류:", error);
      return apiResponse.error("문의사항 조회 중 오류가 발생했습니다.", 500);
    }

    return apiResponse.success(data);
  } catch (error) {
    console.error("문의사항 상세 조회 API 오류:", error);
    return apiResponse.error("서버 오류가 발생했습니다.", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccessForAPI();
    if (!adminCheck.isAdmin) {
      return apiResponse.error(adminCheck.error || "관리자 권한이 필요합니다.", adminCheck.status);
    }

    const { id } = await params;
    const contactId = parseInt(id);

    if (isNaN(contactId)) {
      return apiResponse.error("유효하지 않은 문의사항 ID입니다.", 400);
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !["pending", "in_progress", "completed", "closed"].includes(status)) {
      return apiResponse.error("유효하지 않은 상태값입니다.", 400);
    }

    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => cookies() 
    });

    const updateData: ContactUpdate = {
      status,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", contactId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return apiResponse.error("문의사항을 찾을 수 없습니다.", 404);
      }
      console.error("문의사항 상태 업데이트 오류:", error);
      return apiResponse.error("문의사항 상태 업데이트 중 오류가 발생했습니다.", 500);
    }

    return apiResponse.success({
      ...data,
      message: "문의사항 상태가 성공적으로 업데이트되었습니다.",
    });
  } catch (error) {
    console.error("문의사항 상태 업데이트 API 오류:", error);
    return apiResponse.error("서버 오류가 발생했습니다.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccessForAPI();
    if (!adminCheck.isAdmin) {
      return apiResponse.error(adminCheck.error || "관리자 권한이 필요합니다.", adminCheck.status);
    }

    const { id } = await params;
    const contactId = parseInt(id);

    if (isNaN(contactId)) {
      return apiResponse.error("유효하지 않은 문의사항 ID입니다.", 400);
    }

    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => cookies() 
    });

    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contactId);

    if (error) {
      console.error("문의사항 삭제 오류:", error);
      return apiResponse.error("문의사항 삭제 중 오류가 발생했습니다.", 500);
    }

    return apiResponse.success({
      message: "문의사항이 성공적으로 삭제되었습니다.",
    });
  } catch (error) {
    console.error("문의사항 삭제 API 오류:", error);
    return apiResponse.error("서버 오류가 발생했습니다.", 500);
  }
}
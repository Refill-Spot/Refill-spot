import { createServerSupabaseClient, createRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { NextRequest } from "next/server";

// 관리자 권한 확인 (서버 컴포넌트용)
export async function checkAdminAccess() {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { isAdmin: false, user: null, error: "로그인이 필요합니다." };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("프로필 조회 오류:", error);
      return { isAdmin: false, user: user, error: "프로필을 찾을 수 없습니다." };
    }

    const isAdmin = profile?.is_admin === true || profile?.role === "admin";
    
    return { 
      isAdmin, 
      user: user, 
      profile,
      error: isAdmin ? null : "관리자 권한이 필요합니다." 
    };
  } catch (error) {
    console.error("관리자 권한 확인 오류:", error);
    return { isAdmin: false, user: null, error: "권한 확인 중 오류가 발생했습니다." };
  }
}

// 관리자 권한 확인 (API 라우트용)
export async function checkAdminAccessForAPI(request?: NextRequest) {
  try {
    // request가 제공되지 않은 경우를 위한 대체 방법
    let supabase;
    
    if (request) {
      supabase = createRouteHandlerSupabaseClient(request);
    } else {
      // request가 없는 경우 서버 클라이언트 사용
      supabase = await createServerSupabaseClient();
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { isAdmin: false, user: null, error: "로그인이 필요합니다.", status: 401 };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("프로필 조회 오류:", error);
      return { isAdmin: false, user: user, error: "프로필을 찾을 수 없습니다.", status: 404 };
    }

    const isAdmin = profile?.is_admin === true || profile?.role === "admin";
    
    return { 
      isAdmin, 
      user: user, 
      profile,
      error: isAdmin ? null : "관리자 권한이 필요합니다.",
      status: isAdmin ? 200 : 403
    };
  } catch (error) {
    console.error("관리자 권한 확인 오류:", error);
    return { isAdmin: false, user: null, error: "권한 확인 중 오류가 발생했습니다.", status: 500 };
  }
}


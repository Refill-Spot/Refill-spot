import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

// 관리자 권한 확인 (서버 컴포넌트용)
export async function checkAdminAccess() {
  try {
    const supabase = createServerComponentClient<Database>({ 
      cookies: () => cookies() 
    });

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return { isAdmin: false, user: null, error: "로그인이 필요합니다." };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("프로필 조회 오류:", error);
      return { isAdmin: false, user: session.user, error: "프로필을 찾을 수 없습니다." };
    }

    const isAdmin = profile?.is_admin === true || profile?.role === "admin";
    
    return { 
      isAdmin, 
      user: session.user, 
      profile,
      error: isAdmin ? null : "관리자 권한이 필요합니다." 
    };
  } catch (error) {
    console.error("관리자 권한 확인 오류:", error);
    return { isAdmin: false, user: null, error: "권한 확인 중 오류가 발생했습니다." };
  }
}

// 관리자 권한 확인 (API 라우트용)
export async function checkAdminAccessForAPI() {
  try {
    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => cookies() 
    });

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return { isAdmin: false, user: null, error: "로그인이 필요합니다.", status: 401 };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("프로필 조회 오류:", error);
      return { isAdmin: false, user: session.user, error: "프로필을 찾을 수 없습니다.", status: 404 };
    }

    const isAdmin = profile?.is_admin === true || profile?.role === "admin";
    
    return { 
      isAdmin, 
      user: session.user, 
      profile,
      error: isAdmin ? null : "관리자 권한이 필요합니다.",
      status: isAdmin ? 200 : 403
    };
  } catch (error) {
    console.error("관리자 권한 확인 오류:", error);
    return { isAdmin: false, user: null, error: "권한 확인 중 오류가 발생했습니다.", status: 500 };
  }
}

// 사용자가 관리자인지 확인하는 클라이언트 사이드 훅용 함수
export async function checkCurrentUserAdmin() {
  try {
    const response = await fetch('/api/auth/check-admin');
    if (!response.ok) {
      return { isAdmin: false, error: "권한 확인 실패" };
    }
    
    const data = await response.json();
    return { isAdmin: data.isAdmin, error: null };
  } catch (error) {
    console.error("관리자 권한 확인 오류:", error);
    return { isAdmin: false, error: "권한 확인 중 오류가 발생했습니다." };
  }
}
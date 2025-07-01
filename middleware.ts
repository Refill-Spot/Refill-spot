import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // 응답 객체에 쿠키 설정
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // 응답 객체에서 쿠키 제거
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // 사용자 세션 갱신
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 보호된 경로 확인 및 처리
  const pathname = request.nextUrl.pathname;

  // OAuth 콜백 경로는 특별 처리 (미들웨어에서 리다이렉트하지 않음)
  if (pathname.startsWith("/auth/callback")) {
    return response;
  }

  // 인증이 필요한 경로 (예: 프로필, 즐겨찾기)
  const authRequiredPaths = ["/profile", "/favorites"];

  // 관리자 권한이 필요한 경로
  const adminRequiredPaths = ["/admin"];

  // 로그인 상태에서 접근 불가능한 경로 (로그인, 회원가입)
  const publicOnlyPaths = ["/login", "/register", "/forgot-password"];

  // 관리자 경로 접근 제어
  if (adminRequiredPaths.some((path) => pathname.startsWith(path))) {
    if (!session) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // 관리자 권한 확인
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("id", session.user.id)
        .single();

      const isAdmin = profile?.is_admin === true || profile?.role === "admin";
      
      if (!isAdmin) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    } catch (error) {
      console.error("관리자 권한 확인 오류:", error);
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  // 인증이 필요한 경로이나 로그인하지 않은 경우
  if (authRequiredPaths.some((path) => pathname.startsWith(path)) && !session) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 로그인 상태에서 접근 불가능한 경로인데 로그인한 경우
  if (publicOnlyPaths.some((path) => pathname.startsWith(path)) && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

// 미들웨어가 실행될 경로 패턴 지정
export const config = {
  matcher: [
    /*
     * 미들웨어를 적용할 경로 패턴
     * - 모든 경로에 적용: '/(.*)'
     * - 특정 경로 제외: '/((?!api|_next/static|_next/image|favicon.ico).*)'
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

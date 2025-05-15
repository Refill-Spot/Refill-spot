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
          // 이미 전송된 응답에 쿠키를 설정할 수 없으므로 요청 객체를 복제하여 응답 헤더에 쿠키 설정
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // 마찬가지로 응답 객체에 쿠키 제거
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // 사용자 세션 갱신
  await supabase.auth.getSession();

  // 보호된 경로 확인 및 처리
  const pathname = request.nextUrl.pathname;
  const session = await supabase.auth.getSession();

  // 인증이 필요한 경로 (예: 프로필, 즐겨찾기)
  const authRequiredPaths = ["/profile", "/favorites"];

  // 로그인 상태에서 접근 불가능한 경로 (로그인, 회원가입)
  const publicOnlyPaths = ["/login", "/register", "/forgot-password"];

  // 인증이 필요한 경로이나 로그인하지 않은 경우
  if (
    authRequiredPaths.some((path) => pathname.startsWith(path)) &&
    !session.data.session
  ) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 로그인 상태에서 접근 불가능한 경로인데 로그인한 경우
  if (
    publicOnlyPaths.some((path) => pathname.startsWith(path)) &&
    session.data.session
  ) {
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

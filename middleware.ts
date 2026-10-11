import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;
  const authRequiredPaths = ["/profile", "/favorites", "/my-reviews"];
  const adminRequiredPaths = ["/admin"];
  const publicOnlyPaths = ["/login", "/register", "/forgot-password"];
  const matchesPath = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  // 공개 탐색 화면은 인증 서버의 가용성과 관계없이 렌더링한다.
  // 보호된 경로는 아래에서 기존과 동일하게 사용자와 권한을 검증한다.
  if (
    ![...authRequiredPaths, ...adminRequiredPaths, ...publicOnlyPaths].some(
      matchesPath,
    )
  ) {
    return response;
  }

  const redirect = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  };
  const loginRedirect = () => {
    const url = new URL("/login", request.url);
    url.searchParams.set("returnUrl", pathname + request.nextUrl.search);
    return redirect(url);
  };

  try {
    const supabase = createServerClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            const previousCookies = response.cookies.getAll();
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            for (const cookie of previousCookies) {
              response.cookies.set(cookie);
            }
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );

    // 저장된 세션이 아닌 인증 서버가 검증한 사용자만 신뢰한다.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return publicOnlyPaths.some(matchesPath) ? response : loginRedirect();
    }

    if (adminRequiredPaths.some(matchesPath)) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, is_admin")
          .eq("id", user.id)
          .single();

        const isAdmin = profile?.is_admin === true || profile?.role === "admin";

        if (profileError || !isAdmin) {
          return redirect(new URL("/unauthorized", request.url));
        }
      } catch {
        return redirect(new URL("/unauthorized", request.url));
      }
    }

    if (publicOnlyPaths.some(matchesPath)) {
      const returnUrl = request.nextUrl.searchParams.get("returnUrl");
      if (
        returnUrl &&
        returnUrl.length <= 2048 &&
        returnUrl.startsWith("/") &&
        !returnUrl.startsWith("//") &&
        !/[\\\u0000-\u0020\u007f]/.test(returnUrl)
      ) {
        const destination = new URL(returnUrl, request.url);
        const isAuthPage = [...publicOnlyPaths, "/auth/callback"].some(
          (path) =>
            destination.pathname === path ||
            destination.pathname.startsWith(`${path}/`),
        );
        if (
          destination.origin === request.nextUrl.origin &&
          !destination.pathname.startsWith("//") &&
          !isAuthPage
        ) {
          return redirect(destination);
        }
      }
      return redirect(new URL("/", request.url));
    }
  } catch {
    // 설정 누락이나 인증/권한 서버 예외도 보호된 화면을 열지 않는다.
    return publicOnlyPaths.some(matchesPath) ? response : loginRedirect();
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

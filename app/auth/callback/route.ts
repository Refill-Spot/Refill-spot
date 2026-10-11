import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSafeReturnUrl } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawReturnUrl = requestUrl.searchParams.get("returnUrl");
  const returnUrl = rawReturnUrl
    ? getSafeReturnUrl(rawReturnUrl, "/", requestUrl.origin)
    : null;
  const redirectTo = getSafeReturnUrl(
    requestUrl.searchParams.get("next"),
    "/",
    requestUrl.origin,
  );

  if (code) {
    try {
      // 비밀번호 재설정 플로우인지 확인
      const isPasswordReset =
        new URL(redirectTo, requestUrl.origin).pathname === "/reset-password" ||
        requestUrl.searchParams.get("type") === "recovery";

      if (isPasswordReset) {
        // 비밀번호 재설정의 경우 세션을 생성하지 않고 바로 리다이렉트
        // 코드를 URL 파라미터로 전달하여 reset-password 페이지에서 처리
        const resetUrl = new URL("/reset-password", requestUrl.origin);
        resetUrl.searchParams.set("code", code);
        const response = NextResponse.redirect(resetUrl);
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("Referrer-Policy", "no-referrer");
        return response;
      }

      // 일반 OAuth 로그인의 경우 기존 로직 수행
      // returnUrl이 있으면 사용, 없으면 기본 redirectTo 사용
      const finalRedirectUrl = returnUrl || redirectTo;

      // 서버에서 검증한 내부 경로만 로그인 페이지에 전달
      let redirectUrl: string;
      if (returnUrl) {
        redirectUrl = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
      } else {
        redirectUrl = finalRedirectUrl;
      }

      // 응답 객체를 먼저 생성
      const response = NextResponse.redirect(new URL(redirectUrl, request.url));

      // 쿠키를 올바르게 설정할 수 있는 Supabase 클라이언트 생성
      const supabase = createServerClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet, headers) {
              for (const { name, value, options } of cookiesToSet) {
                request.cookies.set(name, value);
                response.cookies.set(name, value, options);
              }
              for (const [name, value] of Object.entries(headers)) {
                response.headers.set(name, value);
              }
            },
          },
        },
      );

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("OAuth 콜백 오류:", error);
        const failure = NextResponse.redirect(
          new URL("/login?error=oauth_error", request.url),
        );
        for (const cookie of response.cookies.getAll()) {
          failure.cookies.set(cookie);
        }
        failure.headers.set("Cache-Control", "private, no-store");
        return failure;
      }

      if (data.user) {
        // 프로필 확인 및 생성
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", data.user.id)
          .single();

        if (profileError?.code === "PGRST116") {
          // 프로필이 없으면 생성
          const username =
            data.user.email?.split("@")[0] ||
            `user_${Math.random().toString(36).substring(2, 10)}`;

          const { error: insertError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              username,
            });

          if (insertError) {
            console.error("프로필 생성 오류:", insertError);
          }
        }
      }

      // 캐시 방지 헤더 추가
      response.headers.set(
        "Cache-Control",
        "private, no-cache, no-store, max-age=0, must-revalidate",
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");

      return response;
    } catch (error) {
      console.error("OAuth 콜백 처리 오류:", error);
      return NextResponse.redirect(
        new URL("/login?error=callback_error", request.url),
      );
    }
  }

  // 코드가 없는 경우 홈으로 리다이렉트
  return NextResponse.redirect(new URL("/", request.url));
}

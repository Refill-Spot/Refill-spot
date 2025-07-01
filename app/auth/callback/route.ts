import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = requestUrl.searchParams.get("next") || "/";

  if (code) {
    try {
      // 비밀번호 재설정 플로우인지 확인
      const isPasswordReset = redirectTo.includes("/reset-password") || 
                              requestUrl.searchParams.get("type") === "recovery";
      
      if (isPasswordReset) {
        // 비밀번호 재설정의 경우 세션을 생성하지 않고 바로 리다이렉트
        // 코드를 URL 파라미터로 전달하여 reset-password 페이지에서 처리
        const resetUrl = new URL(redirectTo, request.url);
        resetUrl.searchParams.set("code", code);
        return NextResponse.redirect(resetUrl);
      }

      // 일반 OAuth 로그인의 경우 기존 로직 수행
      // 응답 객체를 먼저 생성
      const response = NextResponse.redirect(new URL(redirectTo, request.url));

      // 쿠키를 올바르게 설정할 수 있는 Supabase 클라이언트 생성
      const supabase = createServerClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value;
            },
            set(name: string, value: string, options: CookieOptions) {
              // 요청과 응답 모두에 쿠키 설정
              request.cookies.set({ name, value, ...options });
              response.cookies.set({ name, value, ...options });
            },
            remove(name: string, options: CookieOptions) {
              // 요청과 응답 모두에서 쿠키 제거
              request.cookies.set({ name, value: "", ...options });
              response.cookies.set({ name, value: "", ...options });
            },
          },
        }
      );

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("OAuth 콜백 오류:", error);
        return NextResponse.redirect(
          new URL("/login?error=oauth_error", request.url)
        );
      }

      if (data.user) {
        console.log("OAuth 로그인 성공:", data.user.email);

        // 프로필 확인 및 생성
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", data.user.id)
          .single();

        if (profileError && profileError.code === "PGRST116") {
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
          } else {
            console.log("프로필 생성 완료:", username);
          }
        }
      }

      // 캐시 방지 헤더 추가
      response.headers.set(
        "Cache-Control",
        "no-cache, no-store, max-age=0, must-revalidate"
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");

      return response;
    } catch (error) {
      console.error("OAuth 콜백 처리 오류:", error);
      return NextResponse.redirect(
        new URL("/login?error=callback_error", request.url)
      );
    }
  }

  // 코드가 없는 경우 홈으로 리다이렉트
  return NextResponse.redirect(new URL("/", request.url));
}

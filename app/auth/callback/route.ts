import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = requestUrl.searchParams.get("next") || "/";

  if (code) {
    const supabase = createRouteHandlerSupabaseClient(request);
    await supabase.auth.exchangeCodeForSession(code);
  }

  // 원래 페이지로 리다이렉트
  return NextResponse.redirect(new URL(redirectTo, request.url));
}

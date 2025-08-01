import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { Database } from "@/types/supabase";

// 서버 컴포넌트에서 사용할 Supabase 클라이언트
export const createServerSupabaseClient = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase server environment variables not configured");
  }

  const cookieStore = cookies();

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        async get(name: string) {
          return (await cookieStore).get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          (await cookieStore).set({ name, value, ...options });
        },
        async remove(name: string, options: CookieOptions) {
          (await cookieStore).set({ name, value: "", ...options });
        },
      },
    },
  );
};

// 라우트 핸들러에서 사용할 Supabase 클라이언트
export const createRouteHandlerSupabaseClient = (request: NextRequest) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase server environment variables not configured");
  }

  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );
};

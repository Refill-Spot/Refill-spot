import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import { Database } from "@/types/supabase";

// 서버 컴포넌트에서 사용할 Supabase 클라이언트
export const createServerSupabaseClient = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase server environment variables not configured");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
};

// 라우트 핸들러에서 사용할 Supabase 클라이언트
export const createRouteHandlerSupabaseClient = (request: NextRequest) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase server environment variables not configured");
  }

  const cookieStore = cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      async setAll(cookiesToSet) {
        const responseCookies = await cookieStore;
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          // Next.js가 실제 라우트 응답에 합치는 쿠키 저장소에 기록한다.
          responseCookies.set(name, value, options);
        }
      },
    },
  });
};

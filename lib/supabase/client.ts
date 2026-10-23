"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/supabase";

export const createBrowserSupabaseClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // OAuth is exchanged by /auth/callback; recovery by the reset page.
      // Automatic URL exchange would race those owners and consume PKCE codes.
      auth: { detectSessionInUrl: false },
    },
  );
};

// 간편하게 사용할 수 있는 브라우저 클라이언트 인스턴스
export const supabaseBrowser = createBrowserSupabaseClient();

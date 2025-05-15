"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/supabase";

export const createBrowserSupabaseClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

// 간편하게 사용할 수 있는 브라우저 클라이언트 인스턴스
export const supabaseBrowser = createBrowserSupabaseClient();

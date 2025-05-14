import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Database 타입을 명시적으로 지정하여 타입 안전성 향상
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

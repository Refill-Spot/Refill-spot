import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { handleImageCleanupRequest } from "@/lib/image-cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const result = await handleImageCleanupRequest(
    request,
    {
      CRON_SECRET: process.env.CRON_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    { createClient },
  );
  return NextResponse.json(result.counts, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

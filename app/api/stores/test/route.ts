import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  logger.info("Running test to fetch Gangnam stores...");
  const supabase = createRouteHandlerSupabaseClient(request);

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .like("address", "%강남구%");

  if (error) {
    logger.error("Error fetching Gangnam stores:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logger.info(`Found ${data.length} stores in Gangnam-gu.`);
  return NextResponse.json({ stores: data });
}
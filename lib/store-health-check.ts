import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface StoreTestResult {
  storesCount: number;
  sampleStores: any[];
  categoriesCount: number;
  categories: any[];
  rpcTest: {
    success: boolean;
    error: unknown;
    resultCount: number;
    sampleResults: any[];
  };
}

export async function runStoreHealthCheck(
  supabaseClient?: any,
): Promise<StoreTestResult> {
  const supabase = supabaseClient ?? (await createServerSupabaseClient());
  // 1. 기본 연결 테스트
  console.log("데이터베이스 연결 테스트 시작...");

  // 2. stores 테이블 존재 여부 확인
  const { data: storesCount, error: countError } = await supabase
    .from("stores")
    .select("id", { count: "exact" });

  if (countError) {
    throw new Error(
      `stores 테이블 조회 오류: ${countError.message || countError}`,
    );
  }

  console.log("stores 테이블 레코드 수:", storesCount?.length || 0);

  // 3. 샘플 데이터 조회
  const { data: sampleStores, error: sampleError } = await supabase
    .from("stores")
    .select("id, name, address, position_lat, position_lng")
    .limit(5);

  if (sampleError) {
    throw new Error(
      `샘플 데이터 조회 오류: ${sampleError.message || sampleError}`,
    );
  }

  console.log("샘플 데이터:", sampleStores);

  // 4. categories 테이블 확인
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("*");

  if (categoriesError) {
    console.error("categories 테이블 조회 오류:", categoriesError);
  }

  console.log("카테고리 데이터:", categories?.length || 0, "개");

  // 5. PostGIS RPC 함수 테스트 (강남역 좌표)
  const testLat = 37.498095;
  const testLng = 127.02761;
  const testRadius = 5000; // 5km

  console.log("PostGIS RPC 함수 테스트:", { testLat, testLng, testRadius });

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "stores_within_radius",
    {
      lat: testLat,
      lng: testLng,
      radius_meters: testRadius,
    },
  );

  if (rpcError) {
    console.error("PostGIS RPC 함수 오류:", rpcError);
  } else {
    console.log("PostGIS RPC 함수 결과:", rpcResult?.length || 0, "개 가게");
  }

  return {
    storesCount: storesCount?.length || 0,
    sampleStores: sampleStores || [],
    categoriesCount: categories?.length || 0,
    categories: categories || [],
    rpcTest: {
      success: !rpcError,
      error: rpcError,
      resultCount: rpcResult?.length || 0,
      sampleResults: rpcResult?.slice(0, 3) || [],
    },
  };
}
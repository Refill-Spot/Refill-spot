import { errorResponse, successResponse } from "@/lib/api-response";
import { calculateDistance } from "@/lib/distance";
import { mapStoreFromDb } from "@/lib/stores";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildStoreSearchFilter, storeFilterSchema } from "@/lib/validations";
import { StoreFromDb } from "@/types/store";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return errorResponse(
      {
        code: "invalid_request",
        message: "올바른 JSON 요청을 제공해야 합니다.",
      },
      400,
    );
  }

  if (
    typeof requestBody !== "object" ||
    requestBody === null ||
    Array.isArray(requestBody) ||
    Object.keys(requestBody).length === 0
  ) {
    return errorResponse(
      {
        code: "invalid_request",
        message: "유효한 필터 조건이 제공되지 않았습니다.",
      },
      400,
    );
  }

  const parsedFilters = storeFilterSchema.safeParse(requestBody);
  if (!parsedFilters.success) {
    return errorResponse(
      {
        code: "validation_error",
        message: "요청 데이터가 유효하지 않습니다.",
        details: parsedFilters.error.errors,
      },
      400,
    );
  }

  const {
    categories,
    maxDistance,
    minRating,
    latitude,
    longitude,
    query,
    sort,
  } = parsedFilters.data;
  if ((minRating !== undefined && minRating > 0) || sort === "rating") {
    return errorResponse(
      {
        code: "EXTERNAL_RATINGS_UNAVAILABLE",
        message: "외부 평점 검증 전에는 평점 필터와 정렬을 사용할 수 없습니다.",
      },
      503,
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    let queryBuilder = supabase.from("stores").select(`
      *,
      categories:store_categories(
        category:categories(name)
      )
    `);
    if (query) {
      queryBuilder = queryBuilder.or(buildStoreSearchFilter(query));
    }

    const { data: stores, error } = await queryBuilder;
    if (error || !Array.isArray(stores)) {
      throw error || new Error("Store query did not return an array");
    }

    const hasLocation = latitude !== undefined && longitude !== undefined;
    const maxDistanceKm = maxDistance ?? 5;
    const filteredStores = (stores as StoreFromDb[]).flatMap((store) => {
      const mappedStore = mapStoreFromDb(store);
      if (
        categories &&
        categories.length > 0 &&
        !categories.some((category) =>
          mappedStore.categories.includes(category),
        )
      ) {
        return [];
      }

      const distance = hasLocation
        ? calculateDistance(
            latitude,
            longitude,
            store.position_lat,
            store.position_lng,
          ) / 1000
        : null;
      if (
        distance !== null &&
        (!Number.isFinite(distance) || distance > maxDistanceKm)
      ) {
        return [];
      }

      return [{ store: mappedStore, distance }];
    });

    if (sort === "distance" && hasLocation) {
      filteredStores.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    }

    const formattedStores = filteredStores.map(({ store, distance }) => ({
      ...store,
      distance:
        distance !== null ? String(Math.round(distance * 100) / 100) : null,
    }));
    return successResponse(formattedStores);
  } catch (error: unknown) {
    console.error("가게 필터링 오류:", error);
    return errorResponse(
      {
        code: "database_error",
        message: "가게 정보를 조회하는 중 오류가 발생했습니다.",
      },
      500,
    );
  }
}

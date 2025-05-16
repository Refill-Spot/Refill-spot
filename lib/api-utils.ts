import { StoreFilters } from "@/hooks/use-stores";
import { fetchWithTimeout } from "@/lib/timeout-utils";

/**
 * 가게 데이터를 필터링하여 가져오는 함수
 * @param filters 필터 옵션
 * @returns 필터링된 가게 데이터
 */
export const fetchFilteredStores = async (filters: StoreFilters) => {
  const response = await fetchWithTimeout("/api/stores/filter", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(filters),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(
      data.error?.message || `HTTP error! status: ${response.status}`
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "알 수 없는 오류가 발생했습니다.");
  }

  return data.data;
};

/**
 * 모든 가게 데이터를 가져오는 함수
 * @returns 모든 가게 데이터
 */
export const fetchAllStores = async () => {
  const response = await fetchWithTimeout("/api/stores");

  if (!response.ok) {
    const data = await response.json();
    throw new Error(
      data.error?.message || `HTTP error! status: ${response.status}`
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "알 수 없는 오류가 발생했습니다.");
  }

  return data.data;
};

/**
 * URL 파라미터에서 필터 설정 추출
 * @param searchParams 검색 파라미터
 * @returns 추출된 필터 설정
 */
export const extractFiltersFromURL = (
  searchParams: URLSearchParams
): StoreFilters => {
  const filters: StoreFilters = {};

  const categoryParam = searchParams.get("categories");
  const distanceParam = searchParams.get("distance");
  const ratingParam = searchParams.get("rating");
  const queryParam = searchParams.get("q");
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");

  if (categoryParam) {
    filters.categories = categoryParam.split(",");
  }

  if (distanceParam) {
    const distance = Number(distanceParam);
    if (!isNaN(distance)) {
      filters.maxDistance = distance;
    }
  }

  if (ratingParam) {
    const rating = Number(ratingParam);
    if (!isNaN(rating)) {
      filters.minRating = rating;
    }
  }

  if (queryParam) {
    filters.query = queryParam;
  }

  if (latParam && lngParam) {
    const lat = Number(latParam);
    const lng = Number(lngParam);

    if (!isNaN(lat) && !isNaN(lng)) {
      filters.latitude = lat;
      filters.longitude = lng;
    }
  }

  return filters;
};

/**
 * 필터 설정을 URL 파라미터로 변환
 * @param filters 필터 설정
 * @returns URL 검색 파라미터
 */
export function filtersToURLParams(filters: StoreFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.categories?.length) {
    params.set("categories", filters.categories.join(","));
  }

  if (filters.maxDistance) {
    params.set("distance", filters.maxDistance.toString());
  }

  if (filters.minRating) {
    params.set("rating", filters.minRating.toString());
  }

  if (filters.query) {
    params.set("q", filters.query);
  }

  if (filters.latitude && filters.longitude) {
    params.set("lat", filters.latitude.toString());
    params.set("lng", filters.longitude.toString());
  }

  return params;
}

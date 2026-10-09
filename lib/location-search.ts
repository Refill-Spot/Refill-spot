import { loadKakaoMaps } from "./kakao-sdk";

export interface LocationResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const SEARCH_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coordinate(value: unknown, limit: number): number | null {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !value.trim())
  ) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function mapResults(
  data: unknown,
  mode: "keyword" | "address",
): LocationResult[] {
  if (!Array.isArray(data)) {
    return [];
  }
  const results: LocationResult[] = [];
  const ids = new Set<string>();
  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const lat = coordinate(item.y, 90);
    const lng = coordinate(item.x, 180);
    if (lat === null || lng === null) {
      continue;
    }
    const address =
      mode === "keyword"
        ? text(item.road_address_name) || text(item.address_name)
        : text(item.road_address?.address_name) ||
          text(item.address_name) ||
          text(item.address?.address_name);
    const name =
      mode === "keyword" ? text(item.place_name) || address : address;
    if (!name) {
      continue;
    }
    const placeId =
      text(item.id) ||
      (typeof item.id === "number" && Number.isFinite(item.id)
        ? String(item.id)
        : "");
    const id =
      mode === "keyword" && placeId
        ? `kakao:place:${placeId}`
        : `kakao:address:${address || name}:${lat}:${lng}`;
    if (ids.has(id)) {
      continue;
    }
    ids.add(id);
    results.push({ id, name, address, lat, lng });
    if (results.length === MAX_RESULTS) {
      break;
    }
  }
  return results;
}

function abortError(): Error {
  const error = new Error("위치 검색이 취소되었습니다.");
  error.name = "AbortError";
  return error;
}

function providerError(): Error {
  return new Error(
    "위치 검색에 실패했습니다. 카카오 API 인증 또는 사용량 제한과 네트워크 상태를 확인해주세요.",
  );
}

export async function searchLocations(
  query: string,
  options: { signal?: AbortSignal; mode?: "keyword" | "address" } = {},
): Promise<LocationResult[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length > 100) {
    throw new Error("검색어는 100자 이하로 입력해주세요.");
  }
  if (options.signal?.aborted) {
    throw abortError();
  }
  if (normalizedQuery.length < 2) {
    return [];
  }

  return new Promise<LocationResult[]>((resolve, reject) => {
    let settled = false;
    let phase = options.mode ?? "keyword";
    const finish = (results: LocationResult[], error?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", handleAbort);
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    };
    const handleAbort = () => finish([], abortError());
    const timeout = setTimeout(() => {
      const error = new Error(
        "위치 검색 응답 시간이 초과되었습니다. 다시 시도해주세요.",
      );
      error.name = "TimeoutError";
      finish([], error);
    }, SEARCH_TIMEOUT_MS);
    options.signal?.addEventListener("abort", handleAbort, { once: true });

    void loadKakaoMaps().then(
      (maps) => {
        if (settled) {
          return;
        }
        const services = maps.services;
        const searchAddress = () => {
          if (settled) {
            return;
          }
          phase = "address";
          try {
            new services.Geocoder().addressSearch(
              normalizedQuery,
              (data: unknown, status: string) => {
                if (settled || phase !== "address") {
                  return;
                }
                if (status === services.Status.OK) {
                  finish(mapResults(data, "address"));
                } else if (status === services.Status.ZERO_RESULT) {
                  finish([]);
                } else {
                  finish([], providerError());
                }
              },
              { size: MAX_RESULTS, page: 1 },
            );
          } catch {
            finish([], providerError());
          }
        };

        if (phase === "address") {
          searchAddress();
          return;
        }
        try {
          new services.Places().keywordSearch(
            normalizedQuery,
            (data: unknown, status: string) => {
              if (settled || phase !== "keyword") {
                return;
              }
              if (status === services.Status.OK) {
                finish(mapResults(data, "keyword"));
              } else if (status === services.Status.ZERO_RESULT) {
                searchAddress();
              } else {
                finish([], providerError());
              }
            },
            { size: MAX_RESULTS, page: 1 },
          );
        } catch {
          finish([], providerError());
        }
      },
      (error) => finish([], error),
    );
  });
}

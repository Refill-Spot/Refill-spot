import type { Store } from "@/types/store";

export interface MapPlatformUrls {
  naver: string;
  kakao: string;
}

function encodeStoreSearch(store: Store): string {
  // 도로명·번지·동을 모두 붙이면 검색 누락이 발생하므로 지역과 상호만 사용합니다.
  const name = store.name.trim();
  const address = store.address.trim();
  const region = address.split(/\s+/).slice(0, 2).join(" ");
  const query = [name ? region : address, name].filter(Boolean).join(" ");

  return encodeURIComponent(query).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function hasVerifiedPlaceId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.trim() === id && /^[1-9][0-9]*$/.test(id);
}

// ID는 상호·주소·지점을 검증한 값만 저장합니다. ID가 없으면 검색으로 연결합니다.
export function generateMapPlatformUrls(store: Store): MapPlatformUrls {
  return {
    naver: generateNaverMapUrl(store),
    kakao: generateKakaoMapUrl(store),
  };
}

export function generateNaverMapUrl(store: Store): string {
  if (hasVerifiedPlaceId(store.naverPlaceId)) {
    return `https://m.place.naver.com/place/${store.naverPlaceId}/home`;
  }
  return `https://m.map.naver.com/search?query=${encodeStoreSearch(store)}`;
}

export function generateKakaoMapUrl(store: Store): string {
  if (hasVerifiedPlaceId(store.kakaoPlaceId)) {
    return `https://place.map.kakao.com/${store.kakaoPlaceId}`;
  }
  return `https://m.map.kakao.com/actions/searchView?q=${encodeStoreSearch(store)}`;
}

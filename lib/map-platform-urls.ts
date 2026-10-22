import type { Store } from "@/types/store";

export interface MapPlatformUrls {
  naver: string;
  kakao: string;
}

function encodeStoreSearch(store: Store): string {
  const query = [store.name.trim(), store.address.trim()]
    .filter(Boolean)
    .join(" ");

  return encodeURIComponent(query).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * 이름과 주소로 검색하며, 특정 지점의 상세 페이지임을 보장하지 않습니다.
 */
export function generateMapPlatformUrls(store: Store): MapPlatformUrls {
  return {
    naver: generateNaverMapUrl(store),
    kakao: generateKakaoMapUrl(store),
  };
}

export function generateNaverMapUrl(store: Store): string {
  return `https://map.naver.com/p/search/${encodeStoreSearch(store)}`;
}

export function generateKakaoMapUrl(store: Store): string {
  return `https://map.kakao.com/link/search/${encodeStoreSearch(store)}`;
}

import { Store } from "@/types/store";

export interface MapPlatformUrls {
  naver: string;
  kakao: string;
}

/**
 * 가게 정보를 기반으로 네이버지도와 카카오맵 URL을 생성합니다.
 */
export function generateMapPlatformUrls(store: Store): MapPlatformUrls {
  const { name, address, position } = store;
  const { lat, lng } = position;

  // URL에 안전한 이름과 주소 준비
  const encodedName = encodeURIComponent(name);
  const encodedAddress = encodeURIComponent(address);

  // 네이버지도 URL 생성 (최신 형식)
  // 새로운 /p/search 경로와 간소화된 파라미터 사용
  const naverUrl = `https://map.naver.com/p/search/${encodedName}?c=15.00,0,0,0,dh&isCorrectAnswer=true&locale=ko`;

  // 카카오맵 URL 생성
  // 검색결과로 이동하는 URL 사용
  const kakaoUrl = `https://map.kakao.com/link/search/${encodedName}`;

  return {
    naver: naverUrl,
    kakao: kakaoUrl,
  };
}

/**
 * 네이버지도 검색 URL을 생성합니다 (최신 형식)
 */
export function generateNaverMapUrl(store: Store): string {
  const { name } = store;
  const encodedName = encodeURIComponent(name);
  
  // 최신 네이버지도 URL 형식
  return `https://map.naver.com/p/search/${encodedName}?c=15.00,0,0,0,dh&isCorrectAnswer=true&locale=ko`;
}

/**
 * 카카오맵 검색 URL을 생성합니다
 */
export function generateKakaoMapUrl(store: Store): string {
  const { name, address } = store;
  const encodedName = encodeURIComponent(name);
  const encodedAddress = encodeURIComponent(address);
  
  // 가게명과 주소로 검색하는 카카오맵 URL
  return `https://map.kakao.com/link/search/${encodedName}`;
}

/**
 * 네이버지도 앱 딥링크 URL을 생성합니다 (모바일용)
 */
export function generateNaverMapAppUrl(store: Store): string {
  const { name, position } = store;
  const { lat, lng } = position;
  const encodedName = encodeURIComponent(name);
  
  return `nmap://place?lat=${lat}&lng=${lng}&name=${encodedName}&appname=com.refillspot.app`;
}

/**
 * 카카오맵 앱 딥링크 URL을 생성합니다 (모바일용) 
 */
export function generateKakaoMapAppUrl(store: Store): string {
  const { name, position } = store;
  const { lat, lng } = position;
  const encodedName = encodeURIComponent(name);
  
  return `kakaomap://look?p=${lat},${lng}`;
}
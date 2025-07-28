import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 주어진 URL이 현재 사이트의 유효한 내부 URL인지 확인합니다.
 * @param url - 검사할 URL 문자열
 * @returns 유효한 내부 URL이면 true, 아니면 false
 */
export function isValidInternalUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  // 최대 URL 길이 제한 (2048자)
  if (url.length > 2048) {
    return false;
  }

  try {
    // 위험한 문자열 패턴 차단
    const dangerousPatterns = [
      "javascript:", "data:", "vbscript:", "file:", "ftp:",
      "<script", "onerror=", "onload=", "onclick=", 
      "\\", "../", "..\\", "%2e%2e", "%2f%2f", "%5c%5c",
    ];
    
    const lowerUrl = url.toLowerCase();
    if (dangerousPatterns.some(pattern => lowerUrl.includes(pattern))) {
      return false;
    }

    // 상대 경로인 경우 (/, /search, /store/123 등)
    if (url.startsWith("/")) {
      // 현재 도메인 기준으로 절대 URL 생성
      const fullUrl = new URL(url, window.location.origin);
      
      // 도메인 확인
      if (fullUrl.origin !== window.location.origin) {
        return false;
      }

      // 경로 정규화 후 다시 확인 (path traversal 방지)
      const normalizedPath = fullUrl.pathname;
      if (normalizedPath.includes("/../") || normalizedPath.includes("\\")) {
        return false;
      }

      return true;
    }

    // 절대 URL인 경우
    const parsedUrl = new URL(url);
    
    // 현재 도메인과 동일한지 확인
    if (parsedUrl.origin !== window.location.origin) {
      return false;
    }

    // 허용되지 않는 프로토콜 차단
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return false;
    }

    // 경로 정규화 후 다시 확인 (path traversal 방지)
    const normalizedPath = parsedUrl.pathname;
    if (normalizedPath.includes("/../") || normalizedPath.includes("\\")) {
      return false;
    }

    return true;
  } catch {
    // URL 파싱 실패 시 false 반환
    return false;
  }
}

/**
 * returnUrl을 안전하게 처리하여 유효한 내부 URL만 반환합니다.
 * @param returnUrl - 검사할 returnUrl
 * @param fallbackUrl - 유효하지 않을 때 사용할 기본 URL
 * @returns 유효한 URL 또는 fallbackUrl
 */
export function getSafeReturnUrl(returnUrl: string | null, fallbackUrl: string = "/"): string {
  if (!returnUrl) {
    return fallbackUrl;
  }

  const decodedUrl = decodeURIComponent(returnUrl);
  
  if (isValidInternalUrl(decodedUrl)) {
    return decodedUrl;
  }

  return fallbackUrl;
}

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
export function isValidInternalUrl(url: string, origin?: string): boolean {
  if (
    !url ||
    url.length > 2048 ||
    url !== url.trim() ||
    /[\\\u0000-\u001f\u007f]/.test(url)
  ) {
    return false;
  }
  if (
    url.startsWith("//") ||
    /^\/(?:%2f|%5c)/i.test(url) ||
    (!url.startsWith("/") && !/^https?:\/\//i.test(url)) ||
    (!url.startsWith("/") && !origin && typeof window === "undefined")
  ) {
    return false;
  }
  try {
    const base =
      origin ??
      (typeof window === "undefined"
        ? "https://internal.invalid"
        : window.location.origin);
    const destination = new URL(url, base);
    return (
      ["http:", "https:"].includes(destination.protocol) &&
      destination.origin === new URL(base).origin &&
      !destination.username &&
      !destination.password
    );
  } catch {
    return false;
  }
}

/**
 * returnUrl을 안전하게 처리하여 유효한 내부 URL만 반환합니다.
 * @param returnUrl - 검사할 returnUrl
 * @param fallbackUrl - 유효하지 않을 때 사용할 기본 URL
 * @returns 유효한 URL 또는 fallbackUrl
 */
export function getSafeReturnUrl(
  returnUrl: string | null,
  fallbackUrl: string = "/",
  origin?: string,
): string {
  if (!returnUrl) {
    return fallbackUrl;
  }

  try {
    const decodedUrl = decodeURIComponent(returnUrl);
    if (isValidInternalUrl(decodedUrl, origin)) {
      return decodedUrl;
    }
  } catch {
    // Malformed percent escapes must not break login or redirect validation.
  }

  return fallbackUrl;
}

"use client";

/**
 * 기본 타임아웃 값 (ms)
 */
export const DEFAULT_TIMEOUT = 15000; // 15초
export const LOCATION_TIMEOUT = 5000; // 5초
export const API_REQUEST_TIMEOUT = 15000; // 15초

/**
 * 타임아웃 Promise 생성
 * 지정된 시간 후에 거부되는 Promise를 반환합니다.
 *
 * @param ms 타임아웃 시간 (밀리초)
 * @param errorMessage 타임아웃 발생 시 오류 메시지
 * @returns Promise
 */
export const createTimeoutPromise = (
  ms: number = DEFAULT_TIMEOUT,
  errorMessage: string = "요청 시간이 초과되었습니다."
): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject({
        code: "timeout_error",
        message: errorMessage,
      });
    }, ms);
  });
};

/**
 * AbortController를 사용한 타임아웃 유틸리티
 *
 * @param ms 타임아웃 시간 (밀리초)
 * @returns AbortController 및 타임아웃 ID
 */
export const createTimeoutController = (
  ms: number = DEFAULT_TIMEOUT
): {
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
  cleanup: () => void;
} => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  const cleanup = () => {
    clearTimeout(timeoutId);
  };

  return { controller, timeoutId, cleanup };
};

/**
 * 타임아웃이 포함된 fetch 요청 수행
 *
 * @param url 요청 URL
 * @param options fetch 옵션
 * @param timeout 타임아웃 (ms)
 * @returns fetch 응답
 */
export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout: number = API_REQUEST_TIMEOUT
): Promise<Response> => {
  const { controller, cleanup } = createTimeoutController(timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    cleanup();
    return response;
  } catch (error) {
    cleanup();
    throw error;
  }
};

/**
 * Promise와 타임아웃을 경쟁시키는 유틸리티 함수
 *
 * @param promise 실행할 Promise
 * @param timeout 타임아웃 시간 (ms)
 * @param errorMessage 타임아웃 발생 시 오류 메시지
 * @returns Promise 결과
 */
export const withTimeout = async <T>(
  promise: Promise<T>,
  timeout: number = DEFAULT_TIMEOUT,
  errorMessage: string = "요청 시간이 초과되었습니다."
): Promise<T> => {
  const timeoutPromise = createTimeoutPromise(timeout, errorMessage);
  return Promise.race([promise, timeoutPromise]);
};

/**
 * 위치 정보 가져오기 (타임아웃 포함)
 *
 * @param options 위치 정보 옵션
 * @returns 위치 정보 Promise
 */
export const getPositionWithTimeout = (
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: LOCATION_TIMEOUT,
    maximumAge: 0,
  }
): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    } else {
      reject(new Error("Geolocation is not supported by this browser."));
    }
  });
};

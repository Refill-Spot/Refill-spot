// 온보딩 완료 상태를 관리하는 유틸리티 함수들

const ONBOARDING_STORAGE_KEY = "refill-spot-onboarding-completed";

/**
 * 온보딩 완료 상태를 확인합니다.
 * @returns {boolean} 온보딩 완료 여부
 */
export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") {
    return false; // 서버 사이드에서는 false 반환
  }

  try {
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return completed === "true";
  } catch (error) {
    console.warn("온보딩 상태 확인 중 오류:", error);
    return false;
  }
}

/**
 * 온보딩 완료 상태를 저장합니다.
 */
export function setOnboardingCompleted(): void {
  if (typeof window === "undefined") {
    return; // 서버 사이드에서는 아무것도 하지 않음
  }

  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch (error) {
    console.warn("온보딩 상태 저장 중 오류:", error);
  }
}

/**
 * 온보딩 완료 상태를 초기화합니다. (개발/테스트 용도)
 */
export function resetOnboardingStatus(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch (error) {
    console.warn("온보딩 상태 초기화 중 오류:", error);
  }
}

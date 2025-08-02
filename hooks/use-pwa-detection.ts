import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * PWA로 실행 중인지 감지하는 훅
 * @returns PWA 상태와 조건부 내비게이션 함수
 */
export function usePWADetection() {
  const [isPWA, setIsPWA] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkPWA = () => {
      // PWA 실행 환경 감지
      const standaloneQuery = window.matchMedia("(display-mode: standalone)");
      const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");
      const iosStandalone = (window.navigator as any).standalone === true;

      return standaloneQuery.matches || fullscreenQuery.matches || iosStandalone;
    };

    // 초기 상태 설정
    setIsPWA(checkPWA());

    // display mode 변경 감지 (동적으로 PWA 모드 전환 시)
    const handleDisplayModeChange = () => {
      setIsPWA(checkPWA());
    };

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");

    // 이벤트 리스너 등록
    standaloneQuery.addEventListener("change", handleDisplayModeChange);
    fullscreenQuery.addEventListener("change", handleDisplayModeChange);

    // 클린업
    return () => {
      standaloneQuery.removeEventListener("change", handleDisplayModeChange);
      fullscreenQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  /**
   * PWA 환경에 맞는 내비게이션 함수
   * PWA: 같은 탭에서 이동 (앱 내 내비게이션)
   * 브라우저: 새 탭에서 열기 (검색 결과 유지)
   */
  const navigateConditionally = (url: string) => {
    if (isPWA) {
      // PWA에서는 앱 내 내비게이션
      router.push(url);
    } else {
      // 일반 브라우저에서는 새 탭
      window.open(url, "_blank");
    }
  };

  return {
    isPWA,
    navigateConditionally,
  };
}
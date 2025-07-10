// 클라이언트 사이드 전용 auth 유틸리티

// 사용자가 관리자인지 확인하는 클라이언트 사이드 함수
export async function checkCurrentUserAdmin() {
  try {
    const response = await fetch("/api/auth/check-admin");
    if (!response.ok) {
      return { isAdmin: false, error: "권한 확인 실패" };
    }
    
    const data = await response.json();
    // API 응답 구조에 맞게 수정: data.data.isAdmin
    return { isAdmin: data.success && data.data?.isAdmin, error: null };
  } catch (error) {
    console.error("관리자 권한 확인 오류:", error);
    return { isAdmin: false, error: "권한 확인 중 오류가 발생했습니다." };
  }
}
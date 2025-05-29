// 위치 정보 타입
export interface UserLocation {
  lat: number;
  lng: number;
  timestamp: number;
  source: "gps" | "manual" | "default";
}

const LOCATION_STORAGE_KEY = "refill_spot_user_location";
const LOCATION_EXPIRY_TIME = 30 * 60 * 1000; // 30분

// 위치 정보 저장
export function saveUserLocation(
  location: Omit<UserLocation, "timestamp">
): void {
  try {
    const locationData: UserLocation = {
      ...location,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationData));
  } catch (error) {
    console.warn("위치 정보 저장 실패:", error);
  }
}

// 위치 정보 복원
export function getUserLocation(): UserLocation | null {
  try {
    const stored = sessionStorage.getItem(LOCATION_STORAGE_KEY);
    if (!stored) return null;

    const locationData: UserLocation = JSON.parse(stored);

    // 만료 시간 확인
    if (Date.now() - locationData.timestamp > LOCATION_EXPIRY_TIME) {
      sessionStorage.removeItem(LOCATION_STORAGE_KEY);
      return null;
    }

    return locationData;
  } catch (error) {
    console.warn("위치 정보 복원 실패:", error);
    return null;
  }
}

// 위치 정보 삭제
export function clearUserLocation(): void {
  try {
    sessionStorage.removeItem(LOCATION_STORAGE_KEY);
  } catch (error) {
    console.warn("위치 정보 삭제 실패:", error);
  }
}

// 위치 정보가 유효한지 확인
export function isLocationValid(location: UserLocation | null): boolean {
  if (!location) return false;

  return (
    typeof location.lat === "number" &&
    typeof location.lng === "number" &&
    !isNaN(location.lat) &&
    !isNaN(location.lng) &&
    Math.abs(location.lat) <= 90 &&
    Math.abs(location.lng) <= 180
  );
}

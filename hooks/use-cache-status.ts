import { useEffect, useState } from "react";

/**
 * 캐시 상태와 오프라인 데이터 가용성을 확인하는 훅
 */
export function useCacheStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{
    stores: boolean;
    storeDetails: boolean;
    favorites: boolean;
    reviews: boolean;
  }>({
    stores: false,
    storeDetails: false,
    favorites: false,
    reviews: false,
  });

  useEffect(() => {
    // 온라인/오프라인 상태 감지
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // 초기 상태 설정
    updateOnlineStatus();

    // 이벤트 리스너 등록
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    // 캐시 데이터 확인
    const checkCacheStatus = async () => {
      if ("caches" in window) {
        try {
          const cacheNames = await caches.keys();
          const info = {
            stores: false,
            storeDetails: false,
            favorites: false,
            reviews: false,
          };

          // 각 캐시 타입별로 데이터 존재 여부 확인
          for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();

            for (const request of keys) {
              const url = request.url;
              
              if (url.includes("/api/stores") && !url.includes("/reviews")) {
                info.stores = true;
              } else if (url.includes("/api/stores/") && url.match(/\/\d+$/)) {
                info.storeDetails = true;
              } else if (url.includes("/api/favorites")) {
                info.favorites = true;
              } else if (url.includes("/reviews")) {
                info.reviews = true;
              }
            }
          }

          setCacheInfo(info);
          setHasCachedData(Object.values(info).some(Boolean));
        } catch (error) {
          console.error("캐시 상태 확인 중 오류:", error);
        }
      }
    };

    checkCacheStatus();
  }, [isOnline]);

  /**
   * 특정 캐시 삭제
   */
  const clearCache = async (cacheType?: string) => {
    if ("caches" in window) {
      try {
        const cacheNames = await caches.keys();
        
        if (cacheType) {
          // 특정 캐시만 삭제
          const targetCaches = cacheNames.filter(name => 
            name.includes(cacheType)
          );
          
          await Promise.all(
            targetCaches.map(name => caches.delete(name))
          );
        } else {
          // 모든 API 캐시 삭제
          const apiCaches = cacheNames.filter(name => 
            name.includes("api-") || name.includes("apis")
          );
          
          await Promise.all(
            apiCaches.map(name => caches.delete(name))
          );
        }

        // 캐시 상태 재확인
        const info = { stores: false, storeDetails: false, favorites: false, reviews: false };
        setCacheInfo(info);
        setHasCachedData(false);
        
        return true;
      } catch (error) {
        console.error("캐시 삭제 중 오류:", error);
        return false;
      }
    }
    return false;
  };

  return {
    isOnline,
    hasCachedData,
    cacheInfo,
    clearCache,
  };
}
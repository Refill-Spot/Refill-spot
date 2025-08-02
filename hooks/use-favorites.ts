import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

interface FavoriteStore {
  id: number;
  store_id: number;
  created_at: string;
  stores: {
    id: number;
    name: string;
    address: string;
    naver_rating: number;
    kakao_rating: number;
    image_urls: string[];
    position_lat: number;
    position_lng: number;
  };
}

// 전역 상태로 캐시 관리
let globalFavoritesCache: {
  data: FavoriteStore[];
  storeIds: Set<number>;
  lastFetch: number;
  isLoading: boolean;
} = {
  data: [],
  storeIds: new Set(),
  lastFetch: 0,
  isLoading: false,
};

const CACHE_DURATION = 30000; // 30초 캐시

export function useFavorites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<FavoriteStore[]>(globalFavoritesCache.data);
  const [favoriteStoreIds, setFavoriteStoreIds] = useState<Set<number>>(globalFavoritesCache.storeIds);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 즐겨찾기 목록 조회
  const fetchFavorites = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    const now = Date.now();
    const isCacheValid = (now - globalFavoritesCache.lastFetch) < CACHE_DURATION;
    
    // 캐시가 유효하고 강제 새로고침이 아니면 캐시 사용
    if (!forceRefresh && isCacheValid && globalFavoritesCache.data.length > 0) {
      setFavorites(globalFavoritesCache.data);
      setFavoriteStoreIds(globalFavoritesCache.storeIds);
      return;
    }

    // 이미 로딩 중이면 중복 호출 방지
    if (globalFavoritesCache.isLoading) {
      return;
    }

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    globalFavoritesCache.isLoading = true;
    setLoading(true);

    try {
      const response = await fetch('/api/favorites', {
        signal: abortControllerRef.current.signal,
      });
      
      if (response.ok) {
        const result = await response.json();
        const data = result.data || [];
        const storeIds = new Set<number>(data.map((fav: FavoriteStore) => fav.store_id));
        
        // 전역 캐시 업데이트
        globalFavoritesCache = {
          data,
          storeIds,
          lastFetch: Date.now(),
          isLoading: false,
        };
        
        // 로컬 상태 업데이트
        setFavorites(data);
        setFavoriteStoreIds(storeIds);
      } else {
        throw new Error('즐겨찾기 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 요청이 취소된 경우는 무시
        return;
      }
      console.error('즐겨찾기 조회 오류:', error);
    } finally {
      globalFavoritesCache.isLoading = false;
      setLoading(false);
    }
  }, [user]);

  // 전역 캐시 업데이트 함수
  const updateGlobalCache = useCallback((updater: (cache: typeof globalFavoritesCache) => void) => {
    updater(globalFavoritesCache);
    setFavorites(globalFavoritesCache.data);
    setFavoriteStoreIds(globalFavoritesCache.storeIds);
  }, []);

  // 즐겨찾기 추가
  const addToFavorites = useCallback(async (storeId: number) => {
    if (!user) {
      toast({
        title: '로그인 필요',
        description: '즐겨찾기를 추가하려면 로그인이 필요합니다.',
        variant: 'destructive',
      });
      return false;
    }

    // Optimistic UI update
    updateGlobalCache((cache) => {
      cache.storeIds.add(storeId);
    });

    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ store_id: storeId }),
      });

      if (response.ok) {
        const result = await response.json();
        
        toast({
          title: '즐겨찾기 추가',
          description: '즐겨찾기에 추가되었습니다.',
        });
        
        // 전역 캐시에 새 항목 추가
        if (result.data) {
          updateGlobalCache((cache) => {
            cache.data.push(result.data);
            cache.lastFetch = Date.now(); // 캐시 시간 갱신
          });
        }
        
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.error || '즐겨찾기 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('즐겨찾기 추가 오류:', error);
      
      // Rollback optimistic update
      updateGlobalCache((cache) => {
        cache.storeIds.delete(storeId);
      });

      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '즐겨찾기 추가에 실패했습니다.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast, updateGlobalCache]);

  // 즐겨찾기 제거
  const removeFromFavorites = useCallback(async (storeId: number) => {
    if (!user) return false;

    // Optimistic UI update
    updateGlobalCache((cache) => {
      cache.storeIds.delete(storeId);
      cache.data = cache.data.filter(fav => fav.store_id !== storeId);
    });

    try {
      const response = await fetch(`/api/favorites?store_id=${storeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: '즐겨찾기 제거',
          description: '즐겨찾기에서 제거되었습니다.',
        });
        
        // 캐시 시간 갱신
        updateGlobalCache((cache) => {
          cache.lastFetch = Date.now();
        });
        
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.error || '즐겨찾기 제거에 실패했습니다.');
      }
    } catch (error) {
      console.error('즐겨찾기 제거 오류:', error);
      
      // Rollback optimistic update
      fetchFavorites(true); // 실패 시 서버에서 다시 로드
      
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '즐겨찾기 제거에 실패했습니다.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast, updateGlobalCache, fetchFavorites]);

  // 즐겨찾기 토글
  const toggleFavorite = useCallback(async (storeId: number) => {
    const isFavorite = favoriteStoreIds.has(storeId);
    
    if (isFavorite) {
      return await removeFromFavorites(storeId);
    } else {
      return await addToFavorites(storeId);
    }
  }, [favoriteStoreIds, addToFavorites, removeFromFavorites]);

  // 특정 가게가 즐겨찾기인지 확인
  const isFavorite = useCallback((storeId: number) => {
    return favoriteStoreIds.has(storeId);
  }, [favoriteStoreIds]);

  // 컴포넌트 마운트 시 즐겨찾기 목록 조회
  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      // 로그아웃 시 전역 캐시 초기화
      globalFavoritesCache = {
        data: [],
        storeIds: new Set(),
        lastFetch: 0,
        isLoading: false,
      };
      setFavorites([]);
      setFavoriteStoreIds(new Set());
    }
  }, [user, fetchFavorites]);

  // 컴포넌트 언마운트 시 abort controller 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    favorites,
    favoriteStoreIds,
    loading,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorite,
    refetchFavorites: () => fetchFavorites(true),
  };
}
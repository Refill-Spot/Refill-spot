import { useState, useEffect, useCallback } from 'react';
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

export function useFavorites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<FavoriteStore[]>([]);
  const [favoriteStoreIds, setFavoriteStoreIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // 즐겨찾기 목록 조회
  const fetchFavorites = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch('/api/favorites');
      if (response.ok) {
        const result = await response.json();
        setFavorites(result.data || []);
        
        // 빠른 검색을 위한 Set 생성
        const storeIds = new Set<number>(result.data?.map((fav: FavoriteStore) => fav.store_id) || []);
        setFavoriteStoreIds(storeIds);
      } else {
        throw new Error('즐겨찾기 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('즐겨찾기 조회 오류:', error);
      toast({
        title: '오류',
        description: '즐겨찾기 목록을 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

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
    setFavoriteStoreIds(prev => new Set(prev).add(storeId));

    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ store_id: storeId }),
      });

      if (response.ok) {
        toast({
          title: '즐겨찾기 추가',
          description: '즐겨찾기에 추가되었습니다.',
        });
        
        // 즐겨찾기 목록 새로고침
        await fetchFavorites();
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.error || '즐겨찾기 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('즐겨찾기 추가 오류:', error);
      
      // Rollback optimistic update
      setFavoriteStoreIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(storeId);
        return newSet;
      });

      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '즐겨찾기 추가에 실패했습니다.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast, fetchFavorites]);

  // 즐겨찾기 제거
  const removeFromFavorites = useCallback(async (storeId: number) => {
    if (!user) return false;

    // Optimistic UI update
    setFavoriteStoreIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(storeId);
      return newSet;
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
        
        // 즐겨찾기 목록 새로고침
        await fetchFavorites();
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.error || '즐겨찾기 제거에 실패했습니다.');
      }
    } catch (error) {
      console.error('즐겨찾기 제거 오류:', error);
      
      // Rollback optimistic update
      setFavoriteStoreIds(prev => new Set(prev).add(storeId));

      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '즐겨찾기 제거에 실패했습니다.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast, fetchFavorites]);

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
      // 로그아웃 시 상태 초기화
      setFavorites([]);
      setFavoriteStoreIds(new Set());
    }
  }, [user, fetchFavorites]);

  return {
    favorites,
    favoriteStoreIds,
    loading,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorite,
    refetchFavorites: fetchFavorites,
  };
}
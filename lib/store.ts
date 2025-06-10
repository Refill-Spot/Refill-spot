"use client";

import { fetchAllStores, fetchFilteredStores } from "@/lib/api-utils";
import { getStoreById } from "@/lib/stores";
import { supabaseBrowser } from "@/lib/supabase/client";
import { FormattedReview, Store } from "@/types/store";
import { create } from "zustand";

// 스토어 상태 정의
interface StoreState {
  // 스토어 목록 관련 상태
  stores: Store[];
  loading: boolean;
  error: string | null;

  // 필터 관련 상태
  filters: {
    categories?: string[];
    maxDistance?: number;
    minRating?: number;
    latitude?: number;
    longitude?: number;
    query?: string;
  };

  // 스토어 상세 정보 관련 상태
  currentStore: Store | null;
  storeLoading: boolean;
  storeError: string | null;
  reviews: FormattedReview[];

  // 즐겨찾기 관련 상태
  favorites: Store[];
  favoritesLoading: boolean;

  // 액션
  fetchStores: () => Promise<void>;
  fetchFilteredStores: () => Promise<void>;
  updateFilters: (newFilters: StoreState["filters"]) => void;
  resetFilters: () => void;
  fetchStoreById: (id: number) => Promise<void>;
  fetchReviews: (storeId: number) => Promise<void>;
  toggleFavorite: (storeId: number, userId: string) => Promise<void>;
  fetchFavorites: (userId: string) => Promise<void>;
  addReview: (
    storeId: number,
    userId: string,
    rating: number,
    content: string
  ) => Promise<void>;
  updateReview: (
    reviewId: number,
    rating: number,
    content: string
  ) => Promise<void>;
}

// 스토어 생성
export const useStoreStore = create<StoreState>((set, get) => ({
  // 스토어 목록 관련 상태
  stores: [],
  loading: false,
  error: null,

  // 필터 관련 상태
  filters: {},

  // 스토어 상세 정보 관련 상태
  currentStore: null,
  storeLoading: false,
  storeError: null,
  reviews: [],

  // 즐겨찾기 관련 상태
  favorites: [],
  favoritesLoading: false,

  // 모든 가게 목록 가져오기
  fetchStores: async () => {
    try {
      set({ loading: true, error: null });
      const data = await fetchAllStores();
      set({ stores: data, loading: false });
    } catch (err) {
      console.error("가게 데이터 로드 오류:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      set({ error: errMsg, loading: false });
    }
  },

  // 필터링된 가게 목록 가져오기
  fetchFilteredStores: async () => {
    const { filters } = get();

    try {
      set({ loading: true, error: null });

      if (
        (filters.latitude && filters.longitude) ||
        filters.categories?.length ||
        filters.minRating ||
        filters.query
      ) {
        const data = await fetchFilteredStores(filters);
        set({ stores: data, loading: false });
      } else {
        await get().fetchStores();
      }
    } catch (err) {
      console.error("필터링된 가게 데이터 로드 오류:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      set({ error: errMsg, loading: false });
    }
  },

  // 필터 업데이트
  updateFilters: (newFilters) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters } }));
    get().fetchFilteredStores();
  },

  // 필터 초기화
  resetFilters: () => {
    set({ filters: {} });
    get().fetchStores();
  },

  // 특정 가게 상세 정보 가져오기
  fetchStoreById: async (id) => {
    try {
      set({ storeLoading: true, storeError: null });
      const storeData = await getStoreById(id);

      if (!storeData) {
        set({
          storeError: "가게 정보를 찾을 수 없습니다.",
          storeLoading: false,
        });
        return;
      }

      set({ currentStore: storeData, storeLoading: false });

      // 리뷰 함께 로드
      get().fetchReviews(id);
    } catch (err) {
      console.error("가게 상세 정보 로드 오류:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      set({ storeError: errMsg, storeLoading: false });
    }
  },

  // 리뷰 가져오기
  fetchReviews: async (storeId) => {
    try {
      const { data, error } = await supabaseBrowser
        .from("reviews")
        .select(
          `
          *,
          profiles:profiles(username)
        `
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 리뷰 데이터 가공
      const formattedReviews = data.map((review: any) => ({
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.created_at,
        user: {
          id: review.user_id,
          username: review.profiles.username,
        },
      }));

      set({ reviews: formattedReviews });
    } catch (err) {
      console.error("리뷰 로드 오류:", err);
    }
  },

  // 즐겨찾기 추가/삭제
  toggleFavorite: async (storeId, userId) => {
    const { currentStore } = get();

    try {
      // 현재 즐겨찾기 상태 확인
      const { data } = await supabaseBrowser
        .from("favorites")
        .select("id")
        .eq("user_id", userId)
        .eq("store_id", storeId)
        .single();

      if (data) {
        // 즐겨찾기 삭제
        const { error } = await supabaseBrowser
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("store_id", storeId);

        if (error) throw error;
      } else {
        // 즐겨찾기 추가
        const { error } = await supabaseBrowser.from("favorites").insert({
          user_id: userId,
          store_id: storeId,
        });

        if (error) throw error;
      }

      // 즐겨찾기 목록 갱신
      get().fetchFavorites(userId);
    } catch (err) {
      console.error("즐겨찾기 토글 오류:", err);
    }
  },

  // 즐겨찾기 목록 가져오기
  fetchFavorites: async (userId) => {
    try {
      set({ favoritesLoading: true });

      // 즐겨찾기 ID 목록 가져오기
      const { data: favoriteData, error: favoriteError } = await supabaseBrowser
        .from("favorites")
        .select("store_id")
        .eq("user_id", userId);

      if (favoriteError) throw favoriteError;

      if (favoriteData && favoriteData.length > 0) {
        const storeIds = favoriteData.map((item) => item.store_id);

        // 가게 정보 가져오기
        const { data: storesData, error: storesError } = await supabaseBrowser
          .from("stores")
          .select(
            `
            *,
            categories:store_categories(
              category:categories(name)
            )
          `
          )
          .in("id", storeIds);

        if (storesError) throw storesError;

        // 가게 데이터 가공
        const formattedStores = storesData.map((store) => {
          const categories = store.categories.map(
            (item: { category: { name: string } }) => item.category.name
          );

          return {
            id: store.id,
            name: store.name,
            address: store.address,
            distance: store.distance ? String(store.distance) : null,
            categories,
            rating: {
              naver: store.naver_rating || 0,
              kakao: store.kakao_rating || 0,
            },
            position: {
              lat: store.position_lat,
              lng: store.position_lng,
              x: store.position_x,
              y: store.position_y,
            },
            refillItems: store.refill_items || [],
            description: store.description,
            openHours: store.open_hours,
            price: store.price,
          };
        });

        set({ favorites: formattedStores, favoritesLoading: false });
      } else {
        set({ favorites: [], favoritesLoading: false });
      }
    } catch (err) {
      console.error("즐겨찾기 로드 오류:", err);
      set({ favoritesLoading: false });
    }
  },

  // 리뷰 추가
  addReview: async (storeId, userId, rating, content) => {
    try {
      const { data, error } = await supabaseBrowser
        .from("reviews")
        .insert({
          user_id: userId,
          store_id: storeId,
          rating,
          content,
        })
        .select(
          `
          *,
          profiles:profiles(username)
        `
        )
        .single();

      if (error) throw error;

      // 리뷰 목록 갱신
      get().fetchReviews(storeId);
    } catch (err) {
      console.error("리뷰 추가 오류:", err);
    }
  },

  // 리뷰 업데이트
  updateReview: async (reviewId, rating, content) => {
    try {
      const { currentStore } = get();
      if (!currentStore) return;

      const { error } = await supabaseBrowser
        .from("reviews")
        .update({
          rating,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

      if (error) throw error;

      // 리뷰 목록 갱신
      get().fetchReviews(currentStore.id);
    } catch (err) {
      console.error("리뷰 업데이트 오류:", err);
    }
  },
}));

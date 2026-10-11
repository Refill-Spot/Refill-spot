"use client";

import { fetchAllStores, fetchFilteredStores } from "@/lib/api-utils";
import { getStoreById, mapStoreFromDb } from "@/lib/stores";
import { supabaseBrowser } from "@/lib/supabase/client";
import { coordinateSchema } from "@/lib/validations";
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
  favoritesOwnerId: string | null;
  favoritesOwnerVersion: number;
  favoritesRequestId: number;
  favoritesLoading: boolean;
  favoritesLoaded: boolean;
  favoritesError: string | null;

  // 액션
  fetchStores: () => Promise<void>;
  fetchFilteredStores: () => Promise<void>;
  updateFilters: (newFilters: StoreState["filters"]) => void;
  resetFilters: () => void;
  fetchStoreById: (id: number) => Promise<void>;
  fetchReviews: (storeId: number) => Promise<void>;
  toggleFavorite: (storeId: number, userId: string) => Promise<void>;
  fetchFavorites: (userId: string) => Promise<void>;
  setFavoritesOwner: (userId: string | null) => void;
  saveReview: (
    storeId: number,
    rating: number,
    content: string,
  ) => Promise<void>;
}

let favoritesAbortController: AbortController | null = null;

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
  favoritesOwnerId: null,
  favoritesOwnerVersion: 0,
  favoritesRequestId: 0,
  favoritesLoading: false,
  favoritesLoaded: false,
  favoritesError: null,

  setFavoritesOwner: (userId) => {
    if (get().favoritesOwnerId === userId) {
      return;
    }
    favoritesAbortController?.abort();
    favoritesAbortController = null;
    set((state) => ({
      favorites: [],
      favoritesOwnerId: userId,
      favoritesOwnerVersion: state.favoritesOwnerVersion + 1,
      favoritesRequestId: state.favoritesRequestId + 1,
      favoritesLoading: false,
      favoritesLoaded: false,
      favoritesError: null,
    }));
  },

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
        coordinateSchema.safeParse(filters).success ||
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
      console.log("🔍 [Store] fetchStoreById called", { id });
      set({ storeLoading: true, storeError: null });
      const storeData = await getStoreById(id);

      console.log("🔍 [Store] getStoreById result", {
        id,
        storeData: storeData
          ? {
              id: storeData.id,
              name: storeData.name,
              openHours: storeData.openHours,
              hasOpenHours: !!storeData.openHours,
              openHoursType: typeof storeData.openHours,
              openHoursLength: storeData.openHours?.length,
            }
          : null,
      });

      if (!storeData) {
        console.log("🔍 [Store] No store data found");
        set({
          storeError: "가게 정보를 찾을 수 없습니다.",
          storeLoading: false,
        });
        return;
      }

      console.log("🔍 [Store] Setting currentStore", { storeData });
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
        `,
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

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
    const ownerVersion = get().favoritesOwnerVersion;
    const isCurrentOwner = () =>
      get().favoritesOwnerId === userId &&
      get().favoritesOwnerVersion === ownerVersion;

    try {
      if (!isCurrentOwner()) {
        throw new Error("로그인이 필요합니다.");
      }

      // 현재 즐겨찾기 상태 확인
      const { data, error: favoriteError } = await supabaseBrowser
        .from("favorites")
        .select("id")
        .eq("user_id", userId)
        .eq("store_id", storeId)
        .maybeSingle();

      if (favoriteError) {
        throw favoriteError;
      }
      if (!isCurrentOwner()) {
        throw new Error("사용자가 변경되었습니다.");
      }

      if (data) {
        // 즐겨찾기 삭제
        const { error } = await supabaseBrowser
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("store_id", storeId);

        if (error) {
          throw error;
        }
      } else {
        // 즐겨찾기 추가
        const { error } = await supabaseBrowser.from("favorites").insert({
          user_id: userId,
          store_id: storeId,
        });

        if (error) {
          throw error;
        }
      }

      // 즐겨찾기 목록 갱신
      if (!isCurrentOwner()) {
        throw new Error("사용자가 변경되었습니다.");
      }
      await get().fetchFavorites(userId);
      if (!isCurrentOwner()) {
        throw new Error("사용자가 변경되었습니다.");
      }
    } catch (err) {
      console.error("즐겨찾기 토글 오류:", err);
      throw err;
    }
  },

  // 즐겨찾기 목록 가져오기
  fetchFavorites: async (userId) => {
    // 인증 컨텍스트가 정한 소유자만 요청할 수 있으며 오래된 호출은 소유자를 바꾸지 않는다.
    if (get().favoritesOwnerId !== userId) {
      return;
    }
    favoritesAbortController?.abort();
    const controller = new AbortController();
    favoritesAbortController = controller;
    const requestId = get().favoritesRequestId + 1;
    const isCurrent = () =>
      get().favoritesOwnerId === userId &&
      get().favoritesRequestId === requestId &&
      !controller.signal.aborted;
    set({
      favoritesRequestId: requestId,
      favoritesLoading: true,
      favoritesError: null,
    });

    try {
      // 즐겨찾기 ID 목록 가져오기
      const { data: favoriteData, error: favoriteError } = await supabaseBrowser
        .from("favorites")
        .select("store_id")
        .eq("user_id", userId)
        .abortSignal(controller.signal);

      if (!isCurrent()) {
        return;
      }
      if (favoriteError) {
        throw favoriteError;
      }
      if (!favoriteData) {
        throw new Error("즐겨찾기 목록을 확인할 수 없습니다.");
      }

      if (favoriteData.length > 0) {
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
          `,
          )
          .in("id", storeIds)
          .abortSignal(controller.signal);

        if (!isCurrent()) {
          return;
        }
        if (storesError) {
          throw storesError;
        }
        if (!storesData) {
          throw new Error("즐겨찾기 가게 정보를 확인할 수 없습니다.");
        }

        // 가게 데이터 가공 - mapStoreFromDb 사용
        const formattedStores = storesData.map((store) =>
          mapStoreFromDb(store),
        );

        set({
          favorites: formattedStores,
          favoritesLoading: false,
          favoritesLoaded: true,
        });
      } else {
        set({ favorites: [], favoritesLoading: false, favoritesLoaded: true });
      }
    } catch (err) {
      if (!isCurrent()) {
        return;
      }
      console.error("즐겨찾기 로드 오류:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      set({ favoritesError: errMsg, favoritesLoading: false });
    } finally {
      if (favoritesAbortController === controller) {
        favoritesAbortController = null;
      }
    }
  },

  // 서버의 인증·검증·동시성 처리를 통해 등록과 수정을 수행합니다.
  saveReview: async (storeId, rating, content) => {
    const response = await fetch(`/api/stores/${storeId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, content }),
    });
    const result = await response.json();
    if (!response.ok || result.success !== true) {
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : "리뷰 저장에 실패했습니다.",
      );
    }
    await get().fetchReviews(storeId);
  },
}));

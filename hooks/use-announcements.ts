"use client";

import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import {
  Announcement,
  AnnouncementsResponse,
  GetAnnouncementsParams,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  UseAnnouncementsState,
  UseAnnouncementState,
  UseAnnouncementMutationsState,
} from "@/types/announcements";
import { useCallback, useEffect, useRef, useState } from "react";

// 공지사항 목록 조회 훅
export function useAnnouncements(
  initialParams?: GetAnnouncementsParams
): UseAnnouncementsState & {
  setParams: (params: GetAnnouncementsParams) => void;
  refetch: () => void;
  loadMore: () => void;
  hasMore: boolean;
} {
  const [state, setState] = useState<UseAnnouncementsState>({
    announcements: [],
    loading: true,
    error: null,
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    },
  });

  const [params, setParams] = useState<GetAnnouncementsParams>(
    initialParams || { page: 1, limit: 10 }
  );
  const { toast } = useToast();
  const { t } = useTranslation();
  const isFetching = useRef(false);
  const isInitialMount = useRef(true);

  const fetchAnnouncements = useCallback(async () => {
    if (isFetching.current) return;

    isFetching.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.append("page", params.page.toString());
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.includeUnpublished) {
        searchParams.append("includeUnpublished", "true");
      }

      const response = await fetch(`/api/announcements?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setState((prev) => ({
          ...prev,
          announcements: data.data.announcements,
          pagination: data.data.pagination,
          loading: false,
        }));
      } else {
        throw new Error(data.error || "공지사항 조회에 실패했습니다.");
      }
    } catch (error) {
      console.error("공지사항 조회 오류:", error);
      const errorMessage = error instanceof Error ? error.message : "공지사항 조회 중 오류가 발생했습니다.";
      
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      if (!isInitialMount.current) {
        toast({
          title: "오류",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      isFetching.current = false;
      isInitialMount.current = false;
    }
  }, [params, toast]);

  const refetch = useCallback(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const loadMore = useCallback(() => {
    if (state.pagination.page < state.pagination.totalPages) {
      setParams((prev) => ({
        ...prev,
        page: (prev.page || 1) + 1,
      }));
    }
  }, [state.pagination]);

  const hasMore = state.pagination.page < state.pagination.totalPages;

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return {
    ...state,
    setParams,
    refetch,
    loadMore,
    hasMore,
  };
}

// 공지사항 단일 조회 훅
export function useAnnouncement(id: string): UseAnnouncementState & {
  refetch: () => void;
} {
  const [state, setState] = useState<UseAnnouncementState>({
    announcement: null,
    loading: true,
    error: null,
  });

  const { toast } = useToast();
  const { t } = useTranslation();
  const isFetching = useRef(false);

  const fetchAnnouncement = useCallback(async () => {
    if (!id) {
      setState((prev) => ({ ...prev, loading: false, error: null }));
      return;
    }
    
    if (isFetching.current) return;

    isFetching.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`/api/announcements/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("공지사항을 찾을 수 없습니다.");
        } else if (response.status === 403) {
          throw new Error("권한이 없습니다.");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setState((prev) => ({
          ...prev,
          announcement: data.data,
          loading: false,
        }));
      } else {
        throw new Error(data.error || "공지사항 조회에 실패했습니다.");
      }
    } catch (error) {
      console.error("공지사항 조회 오류:", error);
      const errorMessage = error instanceof Error ? error.message : "공지사항 조회 중 오류가 발생했습니다.";
      
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      toast({
        title: "오류",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      isFetching.current = false;
    }
  }, [id, toast]);

  const refetch = useCallback(() => {
    fetchAnnouncement();
  }, [fetchAnnouncement]);

  useEffect(() => {
    fetchAnnouncement();
  }, [fetchAnnouncement]);

  return {
    ...state,
    refetch,
  };
}

// 공지사항 CRUD 작업 훅
export function useAnnouncementMutations(): UseAnnouncementMutationsState & {
  createAnnouncement: (data: CreateAnnouncementRequest) => Promise<Announcement>;
  updateAnnouncement: (id: string, data: UpdateAnnouncementRequest) => Promise<Announcement>;
  deleteAnnouncement: (id: string) => Promise<void>;
} {
  const [state, setState] = useState<UseAnnouncementMutationsState>({
    creating: false,
    updating: false,
    deleting: false,
    error: null,
  });

  const { toast } = useToast();
  const { t } = useTranslation();

  const createAnnouncement = useCallback(
    async (data: CreateAnnouncementRequest): Promise<Announcement> => {
      setState((prev) => ({ ...prev, creating: true, error: null }));

      try {
        const response = await fetch("/api/announcements", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("관리자 권한이 필요합니다.");
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          toast({
            title: "성공",
            description: result.message || "공지사항이 생성되었습니다.",
          });
          return result.data;
        } else {
          throw new Error(result.error || "공지사항 생성에 실패했습니다.");
        }
      } catch (error) {
        console.error("공지사항 생성 오류:", error);
        const errorMessage = error instanceof Error ? error.message : "공지사항 생성 중 오류가 발생했습니다.";
        
        setState((prev) => ({ ...prev, error: errorMessage }));
        
        toast({
          title: "오류",
          description: errorMessage,
          variant: "destructive",
        });
        
        throw error;
      } finally {
        setState((prev) => ({ ...prev, creating: false }));
      }
    },
    [toast]
  );

  const updateAnnouncement = useCallback(
    async (id: string, data: UpdateAnnouncementRequest): Promise<Announcement> => {
      setState((prev) => ({ ...prev, updating: true, error: null }));

      try {
        const response = await fetch(`/api/announcements/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("관리자 권한이 필요합니다.");
          } else if (response.status === 404) {
            throw new Error("공지사항을 찾을 수 없습니다.");
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          toast({
            title: "성공",
            description: result.message || "공지사항이 수정되었습니다.",
          });
          return result.data;
        } else {
          throw new Error(result.error || "공지사항 수정에 실패했습니다.");
        }
      } catch (error) {
        console.error("공지사항 수정 오류:", error);
        const errorMessage = error instanceof Error ? error.message : "공지사항 수정 중 오류가 발생했습니다.";
        
        setState((prev) => ({ ...prev, error: errorMessage }));
        
        toast({
          title: "오류",
          description: errorMessage,
          variant: "destructive",
        });
        
        throw error;
      } finally {
        setState((prev) => ({ ...prev, updating: false }));
      }
    },
    [toast]
  );

  const deleteAnnouncement = useCallback(
    async (id: string): Promise<void> => {
      setState((prev) => ({ ...prev, deleting: true, error: null }));

      try {
        const response = await fetch(`/api/announcements/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("관리자 권한이 필요합니다.");
          } else if (response.status === 404) {
            throw new Error("공지사항을 찾을 수 없습니다.");
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          toast({
            title: "성공",
            description: result.data?.message || "공지사항이 삭제되었습니다.",
          });
        } else {
          throw new Error(result.error || "공지사항 삭제에 실패했습니다.");
        }
      } catch (error) {
        console.error("공지사항 삭제 오류:", error);
        const errorMessage = error instanceof Error ? error.message : "공지사항 삭제 중 오류가 발생했습니다.";
        
        setState((prev) => ({ ...prev, error: errorMessage }));
        
        toast({
          title: "오류",
          description: errorMessage,
          variant: "destructive",
        });
        
        throw error;
      } finally {
        setState((prev) => ({ ...prev, deleting: false }));
      }
    },
    [toast]
  );

  return {
    ...state,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  };
}

// 중요 공지사항 조회 훅 (메인 페이지용)
export function useImportantAnnouncements(): {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;
} {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchImportantAnnouncements = useCallback(async () => {
    try {
      const response = await fetch("/api/announcements?limit=5");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const importantAnnouncements = data.data.announcements.filter(
          (announcement: Announcement) => announcement.is_important
        );
        setAnnouncements(importantAnnouncements);
      } else {
        throw new Error(data.error || "중요 공지사항 조회에 실패했습니다.");
      }
    } catch (error) {
      console.error("중요 공지사항 조회 오류:", error);
      setError(error instanceof Error ? error.message : "중요 공지사항 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImportantAnnouncements();
  }, [fetchImportantAnnouncements]);

  return {
    announcements,
    loading,
    error,
  };
}
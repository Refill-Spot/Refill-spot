// 공지사항 기본 타입
export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_important: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  author_id: string;
  profiles?: {
    id: string;
    username: string;
  };
}

// 공지사항 생성 요청 타입
export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  is_important?: boolean;
  is_published?: boolean;
}

// 공지사항 수정 요청 타입
export interface UpdateAnnouncementRequest {
  title?: string;
  content?: string;
  is_important?: boolean;
  is_published?: boolean;
}

// 공지사항 목록 응답 타입
export interface AnnouncementsResponse {
  announcements: Announcement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 공지사항 목록 조회 파라미터
export interface GetAnnouncementsParams {
  page?: number;
  limit?: number;
  includeUnpublished?: boolean;
}

// 공지사항 폼 데이터 타입
export interface AnnouncementFormData {
  title: string;
  content: string;
  is_important: boolean;
  is_published: boolean;
}

// 공지사항 상태 타입
export type AnnouncementStatus = 'draft' | 'published';

// 공지사항 중요도 타입
export type AnnouncementPriority = 'normal' | 'important';

// 공지사항 필터 타입
export interface AnnouncementFilters {
  status?: AnnouncementStatus;
  priority?: AnnouncementPriority;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// 공지사항 정렬 타입
export interface AnnouncementSort {
  field: 'created_at' | 'updated_at' | 'published_at' | 'title';
  direction: 'asc' | 'desc';
}

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 공지사항 생성/수정 응답 타입
export type AnnouncementResponse = ApiResponse<Announcement>;

// 공지사항 목록 조회 응답 타입
export type AnnouncementsListResponse = ApiResponse<AnnouncementsResponse>;

// 공지사항 삭제 응답 타입
export type DeleteAnnouncementResponse = ApiResponse<null>;

// 공지사항 통계 타입
export interface AnnouncementStats {
  total: number;
  published: number;
  draft: number;
  important: number;
}

// 공지사항 미리보기 타입 (목록에서 사용)
export interface AnnouncementPreview {
  id: string;
  title: string;
  content: string; // 요약된 내용
  is_important: boolean;
  is_published: boolean;
  published_at: string | null;
  author_name: string;
  created_at: string;
}

// 공지사항 훅 상태 타입
export interface UseAnnouncementsState {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 공지사항 단일 조회 훅 상태 타입
export interface UseAnnouncementState {
  announcement: Announcement | null;
  loading: boolean;
  error: string | null;
}

// 공지사항 CRUD 훅 상태 타입
export interface UseAnnouncementMutationsState {
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  error: string | null;
}

// 공지사항 검색 결과 타입
export interface AnnouncementSearchResult {
  announcements: AnnouncementPreview[];
  total: number;
  query: string;
}

// 공지사항 카테고리 타입 (향후 확장용)
export interface AnnouncementCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

// 공지사항 태그 타입 (향후 확장용)
export interface AnnouncementTag {
  id: string;
  name: string;
  color?: string;
}

// 공지사항 첨부파일 타입 (향후 확장용)
export interface AnnouncementAttachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
  uploaded_at: string;
}

// 공지사항 댓글 타입 (향후 확장용)
export interface AnnouncementComment {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

// 공지사항 알림 설정 타입
export interface AnnouncementNotificationSettings {
  email: boolean;
  push: boolean;
  important_only: boolean;
}

// 공지사항 읽음 상태 타입
export interface AnnouncementReadStatus {
  announcement_id: string;
  user_id: string;
  read_at: string;
}

// 공지사항 에디터 상태 타입
export interface AnnouncementEditorState {
  title: string;
  content: string;
  is_important: boolean;
  is_published: boolean;
  isDirty: boolean;
  isValid: boolean;
  errors: {
    title?: string;
    content?: string;
  };
}
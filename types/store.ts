import { Json } from '@/types/supabase';
import { MenuItem } from '@/types/menu';

// 데이터베이스에서 가져오는 원본 가게 데이터 타입 (Supabase 응답 형식)
export interface StoreFromDb {
  id: number;
  name: string;
  address: string;
  distance?: number | null;
  naver_rating: number | null;
  kakao_rating: number | null;
  position_lat: number;
  position_lng: number;
  position_x: number;
  position_y: number;
  refill_items: MenuItem[] | null;
  open_hours: string | null;
  phone_number: string | null;
  break_time: string | null;
  categories: Array<{ category: { name: string } }> | string[];
  image_urls?: string[] | null;
  created_at: string;
  updated_at: string;
  geom?: unknown;
  [key: string]: any;
}

// 프론트엔드에서 사용하는 통합 가게 타입
export interface Store {
  id: number;
  name: string;
  address: string;
  distance?: string | null; // 문자열 형태의 거리 (예: "1.2km") 또는 null
  categories: string[];
  rating: {
    naver: number;
    kakao: number;
  };
  // 자체 리뷰 시스템 평점
  avgRating?: number; // 평균 평점 (1-5점)
  reviewCount?: number; // 리뷰 개수
  position: {
    lat: number;
    lng: number;
    x: number;
    y: number;
  };
  refillItems: MenuItem[] | null;
  openHours: string | null;
  phoneNumber: string | null;
  imageUrls?: string[] | null;
}

// FormattedStore 타입은 Store 타입과 동일하므로 아래와 같이 타입 별칭으로 정의
export type FormattedStore = Store;

// 가게 상세 정보 타입 (리뷰 포함)
export interface StoreDetail extends Store {
  reviews: FormattedReview[];
  imageUrls?: string[] | null;
}

// API가 반환하는 리뷰 형식은 그대로 유지
export interface FormattedReview {
  id: number;
  rating: number;
  content: string;
  createdAt: string; // ISO 8601 날짜 문자열
  imageUrls?: string[]; // 리뷰 이미지 URL 배열
  keywords?: string[]; // 키워드 배열
  atmosphere?: string[]; // 분위기 키워드 배열
  detailedRatings?: { // 세부 평점
    taste?: number;
    price?: number;
    service?: number;
  };
  menus?: string[]; // 선택한 메뉴 배열
  likeCount?: number; // 좋아요 수
  isLikedByUser?: boolean; // 현재 사용자가 좋아요했는지 여부
  user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

// DB에서 가져오는 리뷰 데이터 타입 (profiles 조인 포함)
export interface ReviewFromDb {
  id: number;
  user_id: string;
  store_id: number;
  rating: number;
  content: string;
  created_at: string;
  updated_at: string;
  profiles: {
    username: string;
    avatar_url?: string;
  };
}

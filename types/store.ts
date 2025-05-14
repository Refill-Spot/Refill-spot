// 기존 StoreFromDb 인터페이스 (categories 포함)
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
  refill_items: string[] | null;
  description: string | null;
  open_hours: string | null;
  price: string | null;
  categories: Array<{ category: { name: string } }>;
  [key: string]: any;
}

export interface FormattedStore {
  id: number;
  name: string;
  address: string;
  distance: string | null;
  categories: string[];
  rating: {
    naver: number;
    kakao: number;
  };
  position: {
    lat: number;
    lng: number;
    x: number;
    y: number;
  };
  refillItems: string[] | null;
  description: string | null;
  openHours: string | null;
  price: string | null;
}

export interface FormattedStoreDetail {
  id: number;
  name: string;
  address: string;
  description: string | null;
  position: {
    lat: number;
    lng: number;
    x: number;
    y: number;
  };
  categories: string[];
  rating: {
    naver: number;
    kakao: number;
  };
  refillItems: string[] | null;
  openHours: string | null;
  price: string | null;
  reviews: FormattedReview[]; // API가 반환할 리뷰 형식 사용
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
  };
}

// API가 반환할 리뷰 형식
export interface FormattedReview {
  id: number;
  rating: number;
  content: string;
  createdAt: string; // ISO 8601 날짜 문자열 또는 Date 객체 (일관성 유지)
  user: {
    id: string;
    username: string;
  };
}

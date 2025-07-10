import { z } from "zod";

// 좌표 스키마 (위도, 경도)
export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// 거리 필터 스키마
export const distanceFilterSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  maxDistance: z.number().positive().max(50), // 최대 50km
});

// 카테고리 필터 스키마
export const categoryFilterSchema = z.object({
  categories: z.array(z.string()).optional(),
});

// 평점 필터 스키마
export const ratingFilterSchema = z.object({
  minRating: z.number().min(0).max(5).optional(),
});

// 검색어 필터 스키마
export const queryFilterSchema = z.object({
  query: z.string().trim().min(1).max(100).optional(),
});

// 가게 필터 종합 스키마
export const storeFilterSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  maxDistance: z.number().positive().max(50).optional(),
  minRating: z.number().min(0).max(5).optional(),
  categories: z.array(z.string()).optional(),
  query: z.string().trim().max(100).optional(),
});

// 반경 검색 스키마
export const radiusSearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50000).default(5000),
});

// 리뷰 생성 스키마
export const reviewSchema = z.object({
  user_id: z.string().uuid(),
  store_id: z.number().int().positive(),
  rating: z.number().min(1).max(5),
  content: z.string().trim().min(1).max(1000),
});

// 즐겨찾기 스키마
export const favoriteSchema = z.object({
  user_id: z.string().uuid(),
  store_id: z.number().int().positive(),
});

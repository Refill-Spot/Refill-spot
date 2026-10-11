import { z } from "zod";

const latitudeSchema = z.number().finite().min(-90).max(90);
const longitudeSchema = z.number().finite().min(-180).max(180);
const distanceKmSchema = z.number().finite().positive().max(50);
const categoriesSchema = z.array(z.string().trim().min(1).max(50)).max(20);
const querySchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^[^\u0000-\u001f\u007f]*$/);
const minRatingSchema = z.number().finite().min(0).max(5);
const sortSchema = z.enum(["default", "distance", "rating"]);
const pageSchema = z.number().finite().int().min(1).max(10000);
const limitSchema = z.number().finite().int().min(1).max(100);

const numericQuerySchema = z
  .string()
  .trim()
  .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/)
  .pipe(z.coerce.number().finite());
const integerQuerySchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .pipe(z.coerce.number().finite().int());

// 좌표 스키마 (위도, 경도)
export const coordinateSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

// 거리 필터 스키마
export const distanceFilterSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  maxDistance: distanceKmSchema, // 최대 50km
});

// 카테고리 필터 스키마
export const categoryFilterSchema = z.object({
  categories: categoriesSchema.optional(),
});

// 평점 필터 스키마
export const ratingFilterSchema = z.object({
  minRating: minRatingSchema.optional(),
});

// 검색어 필터 스키마
export const queryFilterSchema = z.object({
  query: querySchema.min(1).optional(),
});

// 가게 필터 종합 스키마
export const storeFilterSchema = z
  .object({
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    maxDistance: distanceKmSchema.optional(),
    minRating: minRatingSchema.optional(),
    categories: categoriesSchema.optional(),
    query: querySchema.optional(),
    sort: sortSchema.optional(),
  })
  .strict()
  .refine(
    ({ latitude, longitude }) =>
      (latitude === undefined) === (longitude === undefined),
    { message: "위도와 경도를 함께 제공해야 합니다.", path: ["longitude"] },
  );

// GET /api/stores 반경은 km 단위이며, 문자열 전체를 검증한 후 숫자로 변환합니다.
export const paginationQuerySchema = z.object({
  page: integerQuerySchema.pipe(pageSchema).default("1"),
  limit: integerQuerySchema.pipe(limitSchema).default("20"),
});

export const contactQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["pending", "in_progress", "completed", "closed"]).optional(),
  type: z.enum(["store_registration", "inquiry", "feedback"]).optional(),
});

export const contactSubmissionSchema = z
  .object({
    type: z.enum(["store_registration", "inquiry", "feedback"]),
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(50).optional(),
    storeName: z.string().trim().max(200).optional(),
    storeAddress: z.string().trim().max(500).optional(),
    message: z.string().trim().min(1).max(5000),
  })
  .refine(
    (value) =>
      value.type !== "store_registration" ||
      Boolean(value.storeName && value.storeAddress),
    { message: "가게 등록 요청에는 가게명과 주소가 필요합니다." },
  );

export const storeQuerySchema = z
  .object({
    lat: numericQuerySchema.pipe(latitudeSchema).optional(),
    lng: numericQuerySchema.pipe(longitudeSchema).optional(),
    radius: numericQuerySchema.pipe(distanceKmSchema).default("5"),
    minRating: numericQuerySchema.pipe(minRatingSchema).default("0"),
    categories: z
      .string()
      .max(1019)
      .transform((value) => value.split(","))
      .pipe(categoriesSchema)
      .optional(),
    query: querySchema.optional(),
    sort: sortSchema.default("default"),
    ...paginationQuerySchema.shape,
  })
  .strict()
  .refine(({ lat, lng }) => (lat === undefined) === (lng === undefined), {
    message: "위도와 경도를 함께 제공해야 합니다.",
    path: ["lng"],
  });

// imatch는 LIKE의 %, _, * 별칭을 해석하지 않습니다. 정규식과 PostgREST
// 인용 문자열을 각각 이스케이프하여 검색어가 필터 문법으로 해석되지 않게 합니다.
export function buildStoreSearchFilter(query: string): string {
  const literalPattern = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quotedPattern = `"${literalPattern.replace(/[\\"]/g, "\\$&")}"`;
  return `name.imatch.${quotedPattern},address.imatch.${quotedPattern}`;
}

// 반경 검색 스키마
export const radiusSearchSchema = z.object({
  lat: z.union([latitudeSchema, numericQuerySchema.pipe(latitudeSchema)]),
  lng: z.union([longitudeSchema, numericQuerySchema.pipe(longitudeSchema)]),
  radius: z
    .union([
      z.number().finite().positive().max(50000),
      numericQuerySchema.pipe(z.number().finite().positive().max(50000)),
    ])
    .default(5000),
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
  store_id: z.number().int().positive().safe(),
});

export const storeIdQuerySchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(favoriteSchema.shape.store_id);

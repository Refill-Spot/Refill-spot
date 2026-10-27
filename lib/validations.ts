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

const seoulDistricts = [
  "종로구",
  "중구",
  "용산구",
  "성동구",
  "광진구",
  "동대문구",
  "중랑구",
  "성북구",
  "강북구",
  "도봉구",
  "노원구",
  "은평구",
  "서대문구",
  "마포구",
  "양천구",
  "강서구",
  "구로구",
  "금천구",
  "영등포구",
  "동작구",
  "관악구",
  "서초구",
  "강남구",
  "송파구",
  "강동구",
];
const seoulAddressPattern = new RegExp(
  `^(?:서울특별시|서울)\\s*(${seoulDistricts.join("|")})\\s+(\\S.*)$`,
);
const additionalDistrictPattern = new RegExp(
  `(?:^|[\\s,/·])(?:${seoulDistricts.join("|")})(?=[\\s,/·]|$)`,
);

export function getContactToday(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const evidenceUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    if (
      !/^https?:\/\//i.test(value) ||
      /^https?:\/\/[^/?#]*@/i.test(value) ||
      /[\s\u0000-\u001f\u007f]/.test(value)
    )
      return false;
    try {
      const url = new URL(value);
      return Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "근거 링크는 로그인 정보가 없는 http(s) 주소로 입력해 주세요.");

const observedDateSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
      return false;
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value <= getContactToday()
    );
  }, "확인한 날짜는 오늘(한국 시간)까지의 실제 날짜로 입력해 주세요.");

const contactSubmissionFieldsSchema = z.object({
  type: z.enum(["store_registration", "inquiry", "feedback"]),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(50).optional(),
  storeName: z.string().trim().max(200).optional(),
  storeAddress: z.string().trim().max(500).optional(),
  message: z.string().trim().min(1).max(5000),
  reportKind: z.enum(["new_store", "correction"]).optional(),
  refillScope: z.enum(["meal", "buffet", "side", "unknown"]).optional(),
  evidenceUrl: evidenceUrlSchema.optional(),
  observedDate: observedDateSchema.optional(),
});

// 기존 contacts.message에만 검토 정보를 보관합니다. 공개 가게 데이터는 변경하지 않습니다.
export function buildContactMessage(
  value: z.infer<typeof contactSubmissionFieldsSchema>,
): string {
  if (value.type !== "store_registration") return value.message;
  const scopeLabels = {
    meal: "식사·주메뉴 무한리필",
    buffet: "뷔페",
    side: "반찬·사이드만 리필",
    unknown: "확인 필요·모름",
  };
  return [
    value.message,
    "",
    "[서버 생성 제보 정보 — 관리자 검토용]",
    `제보 종류: ${value.reportKind === "correction" ? "기존 정보 수정" : value.reportKind === "new_store" ? "신규 가게" : "미제공"}`,
    `무한리필 범위: ${value.refillScope ? scopeLabels[value.refillScope] : "미제공"}`,
    `근거 URL (제보자 제공·미검증): ${value.evidenceUrl || "미제공"}`,
    `확인한 날짜 (제보자 제공·미검증): ${value.observedDate || "미제공"}`,
    "처리: 검토 대기 — 제보 즉시 등록·수정되지 않습니다.",
  ].join("\n");
}

export const contactSubmissionSchema =
  contactSubmissionFieldsSchema.superRefine((value, context) => {
    if (value.type !== "store_registration") return;
    const issue = (path: string, message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (!value.storeName) issue("storeName", "가게명을 입력해 주세요.");
    const address = seoulAddressPattern.exec(value.storeAddress || "");
    if (!address || additionalDistrictPattern.test(address[2])) {
      issue(
        "storeAddress",
        "서울의 정확한 자치구와 상세 주소를 입력해 주세요.",
      );
    }
    if (!value.refillScope) {
      issue("refillScope", "무한리필 범위를 직접 선택해 주세요.");
    }
    if (value.message.replace(/[^\p{L}\p{N}]/gu, "").length < 10) {
      issue(
        "message",
        "무한리필 내용을 공백·기호 제외 10자 이상 설명해 주세요.",
      );
    }
    if (buildContactMessage(value).length > 5000) {
      issue("message", "설명과 제보 정보를 합쳐 5,000자 이내로 줄여 주세요.");
    }
  });

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

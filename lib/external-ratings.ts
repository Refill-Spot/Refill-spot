export interface ExternalRating {
  status: "unavailable" | "unverified" | "invalid";
  score: number | null;
  reviewCount: number | null;
  sourceUrl: string | null;
  checkedAt: string | null;
}

export interface ExternalRatings {
  naver: ExternalRating;
  kakao: ExternalRating;
}

// Legacy DB scores have no provider provenance or collection timestamp.
// A store's updated_at is not evidence that its external rating was checked.
export function mapStoredExternalRating(value: unknown): ExternalRating {
  const missing = value === null || value === undefined || value === 0;
  const valid =
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 5;

  return {
    status: missing ? "unavailable" : valid ? "unverified" : "invalid",
    score: valid ? value : null,
    reviewCount: null,
    sourceUrl: null,
    checkedAt: null,
  };
}

export function mapStoredExternalRatings(store: {
  naver_rating?: unknown;
  kakao_rating?: unknown;
}): ExternalRatings {
  return {
    naver: mapStoredExternalRating(store.naver_rating),
    kakao: mapStoredExternalRating(store.kakao_rating),
  };
}

export function externalRatingLabel(rating: ExternalRating): string {
  switch (rating.status) {
    case "unverified":
      return "저장된 평점 검증 필요";
    case "invalid":
      return "평점 데이터 확인 필요";
    case "unavailable":
      return "평점 정보 없음";
  }
}

export interface ReviewSummary {
  avgRating?: number;
  reviewCount?: number;
}

export function summarizeReviews(
  reviews: unknown,
  error: unknown = null,
): ReviewSummary {
  if (error !== null || !Array.isArray(reviews)) {
    return {};
  }

  if (reviews.length === 0) {
    return { reviewCount: 0 };
  }

  let totalRating = 0;
  let reviewCount = 0;

  for (const review of reviews) {
    if (
      typeof review !== "object" ||
      review === null ||
      typeof review.rating !== "number" ||
      !Number.isFinite(review.rating) ||
      review.rating < 1 ||
      review.rating > 5
    ) {
      continue;
    }

    totalRating += review.rating;
    reviewCount += 1;
  }

  if (reviewCount === 0) {
    return {};
  }

  return {
    avgRating: Math.round((totalRating / reviewCount) * 10) / 10,
    reviewCount,
  };
}

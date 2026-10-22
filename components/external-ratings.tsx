import React from "react";
import {
  externalRatingLabel,
  type ExternalRatings as Ratings,
} from "@/lib/external-ratings";

export function ExternalRatings({ ratings }: { ratings: Ratings }) {
  return (
    <div aria-label="플랫폼별 외부 평점" className="space-y-1 text-sm">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-lg border border-green-700 bg-green-50 px-3 py-2 text-green-900">
          <strong>네이버</strong> · {externalRatingLabel(ratings.naver)}
        </span>
        <span className="rounded-lg border border-yellow-400 bg-yellow-50 px-3 py-2 text-yellow-950">
          <strong>카카오</strong> · {externalRatingLabel(ratings.kakao)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        외부 평점 자동 연동은 현재 지원되지 않습니다. 출처와 확인 시각이
        검증되지 않은 저장값은 점수로 표시하지 않습니다.
      </p>
    </div>
  );
}

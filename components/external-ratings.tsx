import React from "react";
import {
  externalRatingLabel,
  type ExternalRatings as Ratings,
} from "@/lib/external-ratings";

export function ExternalRatings({ ratings }: { ratings: Ratings }) {
  return (
    <div aria-label="플랫폼별 외부 평점" className="space-y-1 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>네이버 · {externalRatingLabel(ratings.naver)}</span>
        <span>카카오 · {externalRatingLabel(ratings.kakao)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        외부 평점 자동 연동은 현재 지원되지 않습니다. 출처와 확인 시각이
        검증되지 않은 저장값은 점수로 표시하지 않습니다.
      </p>
    </div>
  );
}

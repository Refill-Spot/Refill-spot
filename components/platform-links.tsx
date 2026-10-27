import { Button } from "@/components/ui/button";
import {
  generateNaverMapUrl,
  generateKakaoMapUrl,
  hasVerifiedPlaceId,
} from "@/lib/map-platform-urls";
import type { Store } from "@/types/store";
import { ExternalLink, MapPin } from "lucide-react";

export function PlatformLinks({ store }: { store: Store }) {
  const hasNaverPlaceId = hasVerifiedPlaceId(store.naverPlaceId);
  const hasKakaoPlaceId = hasVerifiedPlaceId(store.kakaoPlaceId);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          size="sm"
          className="bg-green-700 text-white hover:bg-green-800"
        >
          <a
            href={generateNaverMapUrl(store)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="font-black" aria-hidden="true">
              N
            </span>
            {hasNaverPlaceId ? "네이버에서 리뷰 확인" : "네이버에서 검색"}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">(새 탭에서 열림)</span>
          </a>
        </Button>
        <Button
          asChild
          size="sm"
          className="bg-[#FEE500] text-gray-950 hover:bg-yellow-300"
        >
          <a
            href={generateKakaoMapUrl(store)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {hasKakaoPlaceId ? "카카오맵에서 리뷰 확인" : "카카오맵에서 검색"}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">(새 탭에서 열림)</span>
          </a>
        </Button>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {(!hasNaverPlaceId || !hasKakaoPlaceId) && (
          <p>
            검색 링크는 이 가게로 확인된 상세 페이지가 아닙니다. 주소와 지점명을
            비교해 같은 가게인지 확인해 주세요.
          </p>
        )}
        <p>외부 평점과 리뷰의 제공 여부는 각 플랫폼에 따라 다릅니다.</p>
      </div>
    </div>
  );
}

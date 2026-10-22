"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Store } from "@/types/store";
import {
  generateNaverMapUrl,
  generateKakaoMapUrl,
} from "@/lib/map-platform-urls";
import { ExternalLink, MapPin } from "lucide-react";

interface PlatformViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: Store;
  platform: "naver" | "kakao";
}

export function PlatformViewDialog({
  open,
  onOpenChange,
  store,
  platform,
}: PlatformViewDialogProps) {
  const platformConfig = {
    naver: {
      name: "네이버지도",
      mark: "N",
      markClassName: "bg-[#087F3E] text-white",
      cardClassName: "border-[#BDE8CD] bg-[#F2FBF5]",
      linkClassName: "bg-[#087F3E] text-white hover:bg-[#066632]",
      url: generateNaverMapUrl(store),
    },
    kakao: {
      name: "카카오맵",
      mark: "카카오",
      markClassName: "bg-[#FEE500] text-[#191919]",
      cardClassName: "border-[#E8D04C] bg-[#FFFBE5]",
      linkClassName: "bg-[#FEE500] text-[#191919] hover:bg-[#F0D800]",
      url: generateKakaoMapUrl(store),
    },
  };

  const config = platformConfig[platform];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6">
        <DialogHeader className="pr-6">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <span
              aria-hidden="true"
              className={`inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-sm font-bold ${config.markClassName}`}
            >
              {config.mark}
            </span>
            {config.name} 검색 결과
          </DialogTitle>
          <DialogDescription>외부 사이트에서 직접 확인</DialogDescription>
        </DialogHeader>

        <div className={`rounded-xl border p-4 ${config.cardClassName}`}>
          <p className="break-words font-semibold text-gray-950">
            {store.name.trim()}
          </p>
          <p className="mt-2 flex items-start gap-2 text-sm text-gray-700">
            <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">
              {store.address.trim() || "주소 정보 없음"}
            </span>
          </p>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            가게명과 주소로 찾은 검색 결과이며, 이 가게로 확인된 상세 페이지가
            아닙니다. 주소와 지점명을 비교해 같은 가게인지 확인해 주세요.
          </p>
          <p>
            외부 평점은 자동으로 가져오거나 표시하지 않습니다. 평점과 리뷰의
            제공 여부는 {config.name}에서 직접 확인해 주세요.
          </p>
        </div>

        <Button asChild className={config.linkClassName}>
          <a href={config.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            {config.name} 검색 결과 열기 (새 탭)
          </a>
        </Button>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          닫기
        </Button>
      </DialogContent>
    </Dialog>
  );
}

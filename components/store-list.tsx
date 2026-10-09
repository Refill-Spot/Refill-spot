"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/use-favorites";
import { usePWADetection } from "@/hooks/use-pwa-detection";
import { shouldBeUnoptimized } from "@/lib/image-utils";
import {
  formatStoreDistance,
  getRepresentativeMenu,
} from "@/lib/store-presentation";
import { Store } from "@/types/store";
import { Heart, Star } from "lucide-react";
import Image from "next/image";
import { memo, useEffect, useRef, useState } from "react";

interface StoreListProps {
  stores: Store[];
  selectedStore: Store | null;
  onStoreSelect: (store: Store) => void;
}

function StoreList({
  stores = [],
  selectedStore,
  onStoreSelect,
}: StoreListProps) {
  const listRef = useRef<HTMLElement>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isPWA, navigateConditionally } = usePWADetection();

  useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLElement>(
      '[data-selected="true"]',
    );
    if (selected && selected.getClientRects().length > 0) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedStore?.id]);

  const handleFavoriteClick = async (e: React.MouseEvent, storeId: number) => {
    e.stopPropagation();
    await toggleFavorite(storeId);
  };

  return (
    <section ref={listRef} className="bg-card" aria-label="가게 목록">
      <div>
        {stores.length > 0 ? (
          stores.map((store) => {
            const imageUrl = store.imageUrls?.find((url) => url.trim())?.trim();
            const menu = getRepresentativeMenu(store);
            const distanceLabel = formatStoreDistance(store.distance);
            const rating =
              typeof store.avgRating === "number" &&
              Number.isFinite(store.avgRating) &&
              store.avgRating > 0
                ? store.avgRating
                : null;
            const saved = isFavorite(store.id);

            return (
              <article
                key={store.id}
                data-selected={selectedStore?.id === store.id}
                className={`relative flex gap-3 border-b border-l-2 border-border px-4 py-4 transition-colors hover:bg-muted/40 ${
                  selectedStore?.id === store.id
                    ? "border-l-primary bg-muted/60"
                    : "border-l-transparent"
                }`}
              >
                {imageUrl && !failedImages.has(imageUrl) && (
                  <figure className="relative order-2 mt-10 h-[64px] w-[64px] flex-shrink-0 overflow-hidden rounded-sm bg-muted">
                    <Image
                      src={imageUrl}
                      alt={`${store.name} 대표 사진`}
                      fill
                      sizes="64px"
                      className="object-cover"
                      loading="lazy"
                      unoptimized={shouldBeUnoptimized(64, 64, imageUrl)}
                      onError={() =>
                        setFailedImages((previous) =>
                          new Set(previous).add(imageUrl),
                        )
                      }
                    />
                  </figure>
                )}

                <div className="min-w-0 flex-1">
                  <h3
                    className={`break-words text-sm font-semibold leading-5 text-foreground ${user ? "pr-9" : ""}`}
                  >
                    <button
                      type="button"
                      data-store-select-id={store.id}
                      className="text-left text-base after:absolute after:inset-0 after:z-10 focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                      onClick={() => onStoreSelect(store)}
                      aria-pressed={selectedStore?.id === store.id}
                      aria-label={`${store.name} 지도에서 선택`}
                    >
                      {store.name}
                    </button>
                  </h3>

                  {menu ? (
                    <div className="mt-2 flex flex-col gap-1">
                      <span className="break-words text-xs text-foreground">
                        {menu.name}
                        {menu.type && (
                          <span className="ml-1 text-muted-foreground">
                            ({menu.type})
                          </span>
                        )}
                      </span>
                      <span className="break-words text-base font-semibold tabular-nums text-foreground">
                        {menu.price?.trim() || "가격 정보 없음"}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      메뉴·가격 정보 미등록
                    </p>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <Star
                        className={`h-3 w-3 ${rating !== null ? "fill-current" : "text-muted-foreground"}`}
                        aria-hidden="true"
                      />
                      <span className="font-medium">
                        {rating?.toFixed(1) || "평점 없음"}
                      </span>
                      <span className="text-muted-foreground">
                        {typeof store.reviewCount === "number"
                          ? `리뷰 ${store.reviewCount}개`
                          : "리뷰 정보 없음"}
                      </span>
                    </span>
                    {distanceLabel && (
                      <span className="text-muted-foreground">
                        {distanceLabel}
                      </span>
                    )}
                  </div>

                  <address className="mt-1.5 text-xs not-italic text-muted-foreground">
                    <span className="line-clamp-1 break-words">
                      {store.address}
                    </span>
                  </address>
                  {!menu && store.categories.length > 0 && (
                    <p
                      className="mt-1 text-xs text-muted-foreground"
                      aria-label="카테고리"
                    >
                      {store.categories.slice(0, 2).join(" · ")}
                      {store.categories.length > 2 &&
                        ` +${store.categories.length - 2}`}
                    </p>
                  )}
                  <a
                    href={`/store/${store.id}`}
                    target={isPWA ? undefined : "_blank"}
                    rel={isPWA ? undefined : "noopener noreferrer"}
                    className="relative z-20 mt-2 inline-flex min-h-9 items-center text-xs font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`${store.name} 전체 상세${isPWA ? "" : " (새 탭)"}`}
                    onClick={(event) => {
                      if (
                        isPWA &&
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey &&
                        !event.altKey
                      ) {
                        event.preventDefault();
                        navigateConditionally(`/store/${store.id}`);
                      }
                    }}
                  >
                    전체 상세{isPWA ? "" : " ↗"}
                  </a>
                </div>

                {user && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => handleFavoriteClick(event, store.id)}
                    className="absolute right-2 top-2 z-20 h-9 w-9 rounded-sm text-muted-foreground hover:text-primary"
                    aria-label={`${store.name} 즐겨찾기 ${saved ? "해제" : "추가"}`}
                    aria-pressed={saved}
                  >
                    <Heart
                      className={`h-4 w-4 ${saved ? "fill-primary text-primary" : ""}`}
                      aria-hidden="true"
                    />
                  </Button>
                )}
              </article>
            );
          })
        ) : (
          <div
            className="px-4 py-8 text-center"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-medium text-foreground">
              검색 결과가 없습니다
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              다른 검색어나 필터 조건을 시도해보세요
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(StoreList);

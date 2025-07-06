"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getUserLocation, isLocationValid } from "@/lib/location-storage";
import { Store } from "@/types/store";
import { MapPin } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { memo, useState } from "react";

interface StoreListProps {
  stores: Store[];
}

function StoreList({ stores = [] }: StoreListProps) {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const router = useRouter();

  const handleStoreClick = (store: Store) => {
    setSelectedStore(store);

    // 현재 위치 정보를 URL 파라미터로 전달하여 새 탭에서 열기
    const savedLocation = getUserLocation();
    if (savedLocation && isLocationValid(savedLocation)) {
      const params = new URLSearchParams({
        from: "list",
        lat: savedLocation.lat.toString(),
        lng: savedLocation.lng.toString(),
        source: savedLocation.source,
      });
      window.open(`/store/${store.id}?${params.toString()}`, "_blank");
    } else {
      // 위치 정보가 없으면 기본으로 새 탭에서 열기
      window.open(`/store/${store.id}`, "_blank");
    }
  };

  return (
    <section className="h-full bg-[#F5F5F5] p-4" aria-label="가게 목록">
      <ScrollArea className="h-full">
        <div className="space-y-3 pr-2">
          {stores.length > 0 ? (
            stores.map((store) => (
              <article
                key={store.id}
                className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                  selectedStore?.id === store.id ? "ring-2 ring-[#FF5722]" : ""
                }`}
                onClick={() => handleStoreClick(store)}
              >
                <Card className="h-36">
                  <div className="flex h-full">
                    <figure className="w-24 h-full relative flex-shrink-0">
                      {store.imageUrls && store.imageUrls.length > 0 ? (
                        <Image
                          src={store.imageUrls[0]}
                          alt={`${store.name} 대표 이미지`}
                          fill
                          sizes="96px"
                          style={{ objectFit: "cover" }}
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                          className="rounded-l-lg"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-l-lg">
                          <span className="text-gray-400 text-xs">
                            이미지 없음
                          </span>
                        </div>
                      )}
                    </figure>
                    <CardContent className="flex-1 p-4 flex flex-col justify-between">
                      <div className="flex-1">
                        <header className="mb-2">
                          <h3 className="font-bold text-[#333333] text-lg leading-tight">
                            {store.name}
                          </h3>
                        </header>

                        <div className="flex items-center gap-1 text-sm mb-2">
                          <span className="text-[#FFA726]">★</span>
                          <span>{store.rating.naver}</span>
                          <span className="text-gray-400">(네이버)</span>
                          <span className="mx-1">|</span>
                          <span className="text-[#FFA726]">★</span>
                          <span>{store.rating.kakao}</span>
                          <span className="text-gray-400">(카카오)</span>
                          {store.distance && (
                            <>
                              <span className="mx-1">•</span>
                              <span className="text-gray-500">
                                {store.distance}km
                              </span>
                            </>
                          )}
                        </div>

                        <address className="flex items-center gap-1 text-sm text-gray-600 not-italic line-clamp-1">
                          <MapPin className="h-4 w-4 text-[#2196F3] flex-shrink-0" />
                          <span className="line-clamp-1">{store.address}</span>
                        </address>
                      </div>

                      <div className="mt-2">
                        <div
                          className="flex flex-wrap gap-1"
                          aria-label="카테고리"
                        >
                          {store.categories
                            .slice(0, 2)
                            .map((category, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="bg-[#FFA726]/10 text-[#FFA726] border-none text-sm px-2 py-1"
                              >
                                {category}
                              </Badge>
                            ))}
                          {store.categories.length > 2 && (
                            <span className="text-sm text-gray-400">
                              +{store.categories.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </article>
            ))
          ) : (
            <div className="text-center py-12" role="status" aria-live="polite">
              <p className="text-gray-500">검색 결과가 없습니다</p>
              <p className="text-sm text-gray-400 mt-2">
                다른 검색어나 필터 조건을 시도해보세요
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}

export default memo(StoreList);

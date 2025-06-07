"use client";

import { useState, memo } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Clock, Utensils } from "lucide-react";
import { Store } from "@/types/store";
import { useRouter } from "next/navigation";
import { getUserLocation, isLocationValid } from "@/lib/location-storage";

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
        <div className="space-y-4 pr-2">
          {stores.length > 0 ? (
            stores.map((store) => (
              <article
                key={store.id}
                className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                  selectedStore?.id === store.id ? "ring-2 ring-[#FF5722]" : ""
                }`}
                onClick={() => handleStoreClick(store)}
              >
                <Card>
                  <div className="flex md:flex-row flex-col">
                    <figure className="md:w-32 w-full h-32 relative flex-shrink-0">
                      {store.imageUrls && store.imageUrls.length > 0 ? (
                        <Image
                          src={store.imageUrls[0]}
                          alt={`${store.name} 대표 이미지`}
                          fill
                          sizes="(max-width: 768px) 100vw, 128px"
                          style={{ objectFit: "cover" }}
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400 text-sm">
                            이미지 없음
                          </span>
                        </div>
                      )}
                    </figure>
                    <CardContent className="flex-1 p-4">
                      <header className="flex justify-between items-start">
                        <h3 className="font-bold text-[#333333] text-lg">
                          {store.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className="bg-[#FF5722]/10 text-[#FF5722] border-[#FF5722]/20"
                        >
                          {store.price}
                        </Badge>
                      </header>

                      <div className="flex items-center gap-1 text-sm mt-1">
                        <span className="text-[#FFA726]">★</span>
                        <span>{store.rating.naver}</span>
                        <span className="text-gray-400">(Naver)</span>
                        <span className="mx-1">|</span>
                        <span className="text-[#FFA726]">★</span>
                        <span>{store.rating.kakao}</span>
                        <span className="text-gray-400">(Kakao)</span>
                      </div>

                      <address className="flex items-center gap-2 mt-2 text-sm text-gray-600 not-italic">
                        <MapPin className="h-4 w-4 text-[#2196F3]" />
                        <span className="line-clamp-1">{store.address}</span>
                      </address>

                      {store.distance && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          <span>📍 거리: {store.distance}km</span>
                        </div>
                      )}

                      {store.openHours && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <time className="line-clamp-1">
                            {store.openHours}
                          </time>
                        </div>
                      )}

                      <div
                        className="flex flex-wrap gap-2 mt-3"
                        aria-label="카테고리"
                      >
                        {store.categories.map((category, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-[#FFA726]/10 text-[#FFA726] border-none"
                          >
                            {category}
                          </Badge>
                        ))}
                      </div>

                      {store.refillItems && store.refillItems.length > 0 && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Utensils className="h-3 w-3 text-[#FF5722]" />
                          <span>
                            무한리필: {store.refillItems.slice(0, 3).join(", ")}
                            {store.refillItems.length > 3 ? " 외" : ""}
                          </span>
                        </div>
                      )}

                      <div className="mt-4">
                        <div className="text-xs text-gray-400">
                          클릭하여 상세 정보 보기
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

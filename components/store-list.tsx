"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MapPin, Navigation, Clock, Utensils } from "lucide-react"

export default function StoreList({ stores = [] }) {
  const [selectedStore, setSelectedStore] = useState(null)

  return (
    <div className="h-full bg-[#F5F5F5] p-4">
      <ScrollArea className="h-full">
        <div className="space-y-4 pr-2">
          {stores.length > 0 ? (
            stores.map((store) => (
              <Card
                key={store.id}
                className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                  selectedStore?.id === store.id ? "ring-2 ring-[#FF5722]" : ""
                }`}
                onClick={() => setSelectedStore(store)}
              >
                <div className="flex md:flex-row flex-col">
                  <div
                    className="md:w-32 w-full h-32 md:h-full bg-gray-200 flex-shrink-0"
                    style={{
                      backgroundImage: `url('/placeholder.svg?height=128&width=128')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  ></div>
                  <CardContent className="p-4 flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-[#333333] text-lg">{store.name}</h3>
                      <Badge variant="outline" className="bg-[#FF5722]/10 text-[#FF5722] border-[#FF5722]/20">
                        {store.price}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 text-sm mt-1">
                      <span className="text-[#FFA726]">★</span>
                      <span>{store.rating.naver}</span>
                      <span className="text-gray-400">(Naver)</span>
                      <span className="mx-1">|</span>
                      <span className="text-[#FFA726]">★</span>
                      <span>{store.rating.kakao}</span>
                      <span className="text-gray-400">(Kakao)</span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 text-[#2196F3]" />
                      <span className="line-clamp-1">{store.address}</span>
                    </div>

                    {store.openHours && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="line-clamp-1">{store.openHours}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-3">
                      {store.categories.map((category, index) => (
                        <Badge key={index} variant="secondary" className="bg-[#FFA726]/10 text-[#FFA726] border-none">
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

                    <div className="mt-4 flex gap-2">
                      <Button size="sm" className="bg-[#FF5722] hover:bg-[#E64A19] flex-1">
                        상세 보기
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <Navigation className="h-4 w-4 mr-1" />
                        길찾기
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">검색 결과가 없습니다</p>
              <p className="text-sm text-gray-400 mt-2">다른 검색어나 필터 조건을 시도해보세요</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

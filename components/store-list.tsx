"use client"

import { useState } from "react"
import { storeData } from "@/lib/store-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MapPin, Navigation } from "lucide-react"

export default function StoreList() {
  const [selectedStore, setSelectedStore] = useState(null)

  return (
    <div className="h-full bg-[#F5F5F5] p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#333333]">리필 스팟 목록</h2>
        <p className="text-sm text-gray-500">총 {storeData.length}개의 장소를 찾았습니다</p>
      </div>

      <ScrollArea className="h-[calc(100%-60px)]">
        <div className="space-y-4 pr-2">
          {storeData.map((store) => (
            <Card
              key={store.id}
              className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                selectedStore?.id === store.id ? "ring-2 ring-[#4CAF50]" : ""
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
                    <Badge variant="outline" className="bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/20">
                      {store.distance}m
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

                  <div className="flex flex-wrap gap-2 mt-3">
                    {store.categories.map((category, index) => (
                      <Badge key={index} variant="secondary" className="bg-[#FFA726]/10 text-[#FFA726] border-none">
                        {category}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button size="sm" className="bg-[#4CAF50] hover:bg-[#3d8b40] flex-1">
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
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

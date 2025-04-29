"use client"

import { ArrowLeft, Navigation, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"

export default function StoreDetail({ store, onBack }) {
  if (!store) return null

  return (
    <div className="bg-white h-full overflow-y-auto">
      <div className="sticky top-0 z-10 bg-white p-4 flex items-center gap-2 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">뒤로 가기</span>
        </Button>
        <h2 className="text-lg font-bold">{store.name}</h2>
      </div>

      {/* Image carousel */}
      <div
        className="w-full h-48 bg-gray-200"
        style={{
          backgroundImage: `url('/placeholder.svg?height=200&width=400')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      ></div>

      <div className="p-4 space-y-4">
        {/* Store info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="text-xl font-bold text-[#333333]">{store.name}</h3>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-[#FFA726]">★</span>
                <span>{store.rating.naver}</span>
                <span className="text-gray-400">(Naver)</span>
                <span className="mx-1">|</span>
                <span className="text-[#FFA726]">★</span>
                <span>{store.rating.kakao}</span>
                <span className="text-gray-400">(Kakao)</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">{store.address}</p>
              <Button size="sm" variant="outline" className="gap-1">
                <Navigation className="h-4 w-4 text-[#2196F3]" />
                <span>길찾기</span>
              </Button>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">운영 시간</h4>
              <div className="text-sm space-y-1">
                <p>월-금: 09:00 - 22:00</p>
                <p>토-일: 10:00 - 21:00</p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">무한리필 메뉴</h4>
              <div className="text-sm space-y-1">
                {store.refillItems?.map((item, index) => (
                  <p key={index}>- {item}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* External links */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-1">
            <ExternalLink className="h-4 w-4" />
            <span>네이버 플레이스</span>
          </Button>
          <Button variant="outline" className="flex-1 gap-1">
            <ExternalLink className="h-4 w-4" />
            <span>카카오맵</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

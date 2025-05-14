"use client"

import { useState, useRef } from "react"
import { MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function Map({ stores = [] }) {
  const [selectedStore, setSelectedStore] = useState(null)
  const mapRef = useRef(null)

  return (
    <div className="w-full h-full bg-gray-100 relative">
      {/* 실제 지도처럼 보이는 배경 */}
      <div
        ref={mapRef}
        className="w-full h-full relative overflow-hidden"
        style={{
          background: "#f2f4f8",
        }}
      >
        {/* 서울 지도 배경 이미지 */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: "url('/seoul-map.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.9,
          }}
        >
          {/* 지도 그리드 라인 */}
          <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 opacity-10">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={`col-${i}`} className="border-r border-gray-500 h-full"></div>
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={`row-${i}`} className="border-b border-gray-500 w-full"></div>
            ))}
          </div>

          {/* 주요 도로 */}
          <div className="absolute inset-0">
            {/* 강남 지역 주요 도로 */}
            <div
              className="absolute h-2 bg-[#ffcc00]/60 rounded-full"
              style={{ top: "55%", left: "40%", width: "30%" }}
            ></div>
            <div
              className="absolute w-2 bg-[#ffcc00]/60 rounded-full"
              style={{ top: "40%", left: "50%", height: "30%" }}
            ></div>

            {/* 한강 */}
            <div
              className="absolute bg-[#a5d8ff] rounded-lg transform rotate-12"
              style={{ top: "40%", left: "10%", width: "80%", height: "10%" }}
            ></div>

            {/* 기타 도로들 */}
            <div
              className="absolute h-1 bg-white/70 rounded-full"
              style={{ top: "30%", left: "20%", width: "60%" }}
            ></div>
            <div
              className="absolute h-1 bg-white/70 rounded-full"
              style={{ top: "60%", left: "30%", width: "40%" }}
            ></div>
            <div
              className="absolute w-1 bg-white/70 rounded-full"
              style={{ top: "20%", left: "30%", height: "50%" }}
            ></div>
            <div
              className="absolute w-1 bg-white/70 rounded-full"
              style={{ top: "35%", left: "60%", height: "40%" }}
            ></div>
          </div>

          {/* 지역 이름 */}
          <div className="absolute text-xs text-gray-500 font-medium" style={{ top: "55%", left: "50%" }}>
            강남구
          </div>
          <div className="absolute text-xs text-gray-500 font-medium" style={{ top: "65%", left: "45%" }}>
            서초구
          </div>
          <div className="absolute text-xs text-gray-500 font-medium" style={{ top: "35%", left: "25%" }}>
            용산구
          </div>
          <div className="absolute text-xs text-gray-500 font-medium" style={{ top: "25%", left: "20%" }}>
            마포구
          </div>
          <div className="absolute text-xs text-gray-500 font-medium" style={{ top: "15%", left: "22%" }}>
            종로구
          </div>
          <div className="absolute text-xs text-gray-500 font-medium" style={{ top: "50%", left: "70%" }}>
            송파구
          </div>
          <div className="absolute text-xs text-gray-500 font-medium" style={{ top: "30%", left: "60%" }}>
            성동구
          </div>
          <div className="absolute text-xs text-gray-500 font-medium" style={{ top: "35%", left: "70%" }}>
            광진구
          </div>
        </div>

        {/* 지도 마커 */}
        {stores.map((store) => (
          <div
            key={store.id}
            className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110 z-10"
            style={{
              left: `${store.position.x}%`,
              top: `${store.position.y}%`,
            }}
            onClick={() => setSelectedStore(store)}
          >
            <div className="relative group">
              <div className="bg-[#FF5722] text-white rounded-full p-2 shadow-md">
                <MapPin className="h-5 w-5" />
              </div>

              {/* 호버 시 가게 이름 툴팁 */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 whitespace-nowrap bg-white px-2 py-1 rounded shadow-md text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {store.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 지도 컨트롤 */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button variant="secondary" size="icon" className="bg-white shadow-md h-8 w-8">
          <span className="text-lg font-bold">+</span>
        </Button>
        <Button variant="secondary" size="icon" className="bg-white shadow-md h-8 w-8">
          <span className="text-lg font-bold">-</span>
        </Button>
      </div>

      {/* 선택된 가게 정보 팝업 */}
      {selectedStore && (
        <Card className="absolute bottom-24 left-1/2 transform -translate-x-1/2 md:left-auto md:right-4 md:bottom-4 md:transform-none w-80 shadow-lg">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div
                className="w-20 h-20 rounded-md bg-gray-200 flex-shrink-0"
                style={{
                  backgroundImage: `url('/placeholder.svg?height=80&width=80')`,
                  backgroundSize: "cover",
                }}
              ></div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-[#333333]">{selectedStore.name}</h3>
                  <button className="text-gray-400 hover:text-gray-600" onClick={() => setSelectedStore(null)}>
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-[#FFA726]">★</span>
                  <span>{selectedStore.rating.naver}</span>
                  <span className="text-gray-400">(Naver)</span>
                  <span className="mx-1">|</span>
                  <span className="text-[#FFA726]">★</span>
                  <span>{selectedStore.rating.kakao}</span>
                  <span className="text-gray-400">(Kakao)</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  <span>{selectedStore.distance}m</span>
                  <span>|</span>
                  {selectedStore.categories.map((category, index) => (
                    <Badge key={index} variant="outline" className="px-2 py-0 text-xs">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{selectedStore.description}</p>
            <Button className="w-full mt-3 bg-[#FF5722] hover:bg-[#E64A19]">상세 보기</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

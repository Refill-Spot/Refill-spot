"use client"

import { useState } from "react"
import { ChevronUp } from "lucide-react"
import { storeData } from "@/lib/store-data"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function MobileBottomSheet() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-lg transition-transform duration-300 transform ${
        isExpanded ? "h-[70vh]" : "h-[30vh]"
      }`}
    >
      <div
        className="p-4 border-b border-gray-200 flex justify-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mb-2"></div>
        <ChevronUp
          className={`h-5 w-5 text-gray-400 absolute transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </div>

      <div className="px-4 py-2">
        <h2 className="text-lg font-bold text-[#333333]">주변 무한리필 식당</h2>
        <p className="text-sm text-gray-500">총 {storeData.length}개의 장소를 찾았습니다</p>
      </div>

      <ScrollArea className="h-[calc(100%-80px)]">
        <div className="p-4 space-y-4">
          {storeData.map((store) => (
            <div
              key={store.id}
              className="flex gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <div
                className="w-16 h-16 rounded-md bg-gray-200 flex-shrink-0"
                style={{
                  backgroundImage: `url('/placeholder.svg?height=64&width=64')`,
                  backgroundSize: "cover",
                }}
              ></div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <h3 className="font-bold text-[#333333]">{store.name}</h3>
                  <span className="text-xs text-[#FF5722] font-medium">{store.price}</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-[#FFA726]">★</span>
                  <span>{store.rating.naver}</span>
                  <span className="text-gray-400">(Naver)</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600 flex-wrap">
                  <span>{store.distance}m</span>
                  <span>|</span>
                  {store.categories.map((category, index) => (
                    <Badge key={index} variant="outline" className="px-2 py-0 text-xs">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

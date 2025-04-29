"use client"

import { useState, useEffect, useRef } from "react"
import { MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { storeData } from "@/lib/store-data"

export default function Map() {
  const [selectedStore, setSelectedStore] = useState(null)
  const mapRef = useRef(null)

  // Simulate map initialization
  useEffect(() => {
    // In a real implementation, this would initialize a map library like Google Maps or Mapbox
    console.log("Map initialized")
  }, [])

  return (
    <div className="w-full h-full bg-gray-100 relative">
      {/* Placeholder for the actual map */}
      <div
        ref={mapRef}
        className="w-full h-full bg-[#e8eaed]"
        style={{
          backgroundImage: "url('/placeholder.svg?height=800&width=1200')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Map markers */}
        {storeData.map((store) => (
          <div
            key={store.id}
            className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
            style={{
              left: `${store.position.x}%`,
              top: `${store.position.y}%`,
            }}
            onClick={() => setSelectedStore(store)}
          >
            <div className="bg-[#4CAF50] text-white rounded-full p-2 shadow-md">
              <MapPin className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Store popup */}
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
            <Button className="w-full mt-3 bg-[#4CAF50] hover:bg-[#3d8b40]">상세 보기</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

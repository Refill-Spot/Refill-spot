"use client"

import { useState } from "react"
import Map from "@/components/map"
import StoreList from "@/components/store-list"
import Sidebar from "@/components/sidebar"
import MobileBottomSheet from "@/components/mobile-bottom-sheet"
import Header from "@/components/header"
import ViewToggle from "@/components/view-toggle"
import { storeData } from "@/lib/store-data"

export default function Home() {
  const [view, setView] = useState<"map" | "list">("map")
  const [filteredStores, setFilteredStores] = useState(storeData)

  return (
    <main className="flex flex-col h-screen bg-[#F5F5F5]">
      <Header />
      <ViewToggle view={view} setView={setView} />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:block w-80 border-r border-gray-200 overflow-y-auto">
          <Sidebar
            onApplyFilters={(filters) => {
              let results = [...storeData]

              // 카테고리 필터
              if (filters.categories.length > 0) {
                results = results.filter((store) => store.categories.some((cat) => filters.categories.includes(cat)))
              }

              // 거리 필터
              if (filters.maxDistance) {
                results = results.filter((store) => Number.parseInt(store.distance) <= filters.maxDistance * 1000)
              }

              // 평점 필터
              if (filters.minRating > 0) {
                results = results.filter((store) => store.rating.naver >= filters.minRating)
              }

              setFilteredStores(results)
            }}
          />
        </div>
        <div className="flex-1 relative">
          {view === "map" ? (
            <>
              <Map stores={filteredStores} />
              <div className="md:hidden">
                <MobileBottomSheet stores={filteredStores} />
              </div>
            </>
          ) : (
            <StoreList stores={filteredStores} />
          )}
        </div>
      </div>
    </main>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Header from "@/components/header"
import Map from "@/components/map"
import StoreList from "@/components/store-list"
import ViewToggle from "@/components/view-toggle"
import SearchFilters from "@/components/search-filters"
import { storeData } from "@/lib/store-data"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, ArrowUpDown } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export default function SearchPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || ""
  const [view, setView] = useState<"map" | "list">("list")
  const [filteredStores, setFilteredStores] = useState(storeData)
  const [sortOption, setSortOption] = useState("distance")

  // 검색어와 정렬 옵션에 따라 가게 필터링 및 정렬
  useEffect(() => {
    // 1. 먼저 검색어로 필터링
    let results = [...storeData]

    if (query) {
      results = results.filter(
        (store) =>
          store.name.toLowerCase().includes(query.toLowerCase()) ||
          store.address.toLowerCase().includes(query.toLowerCase()) ||
          store.categories.some((cat) => cat.toLowerCase().includes(query.toLowerCase())),
      )
    }

    // 2. 정렬 적용
    switch (sortOption) {
      case "distance":
        results.sort((a, b) => Number.parseInt(a.distance) - Number.parseInt(b.distance))
        break
      case "rating":
        results.sort((a, b) => b.rating.naver - a.rating.naver)
        break
      case "name":
        results.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    setFilteredStores(results)
  }, [query, sortOption]) // 검색어나 정렬 옵션이 변경될 때만 실행

  // 필터 적용 함수
  const applyFilters = (filters) => {
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

    // 정렬 적용
    switch (sortOption) {
      case "distance":
        results.sort((a, b) => Number.parseInt(a.distance) - Number.parseInt(b.distance))
        break
      case "rating":
        results.sort((a, b) => b.rating.naver - a.rating.naver)
        break
      case "name":
        results.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    setFilteredStores(results)
  }

  return (
    <main className="flex flex-col h-screen bg-[#F5F5F5]">
      <Header initialSearchValue={query} />

      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#333333]">"{query}" 검색 결과</h1>
            <p className="text-sm text-gray-500">총 {filteredStores.length}개의 장소를 찾았습니다</p>
          </div>

          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="hidden md:flex gap-1">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>필터</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>검색 필터</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <SearchFilters onApplyFilters={applyFilters} />
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <ArrowUpDown className="h-4 w-4" />
                  <span>정렬</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortOption("distance")}>거리순</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption("rating")}>평점순</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption("name")}>이름순</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex md:hidden justify-center my-2">
        <ViewToggle view={view} setView={setView} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:block w-80 border-r border-gray-200 overflow-y-auto">
          <SearchFilters onApplyFilters={applyFilters} />
        </div>

        <div className="flex-1 relative">
          {view === "map" ? <Map stores={filteredStores} /> : <StoreList stores={filteredStores} />}
        </div>
      </div>
    </main>
  )
}

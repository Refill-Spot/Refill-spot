"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search, MapPin, Menu, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import Sidebar from "@/components/sidebar"

interface HeaderProps {
  initialSearchValue?: string
}

export default function Header({ initialSearchValue = "" }: HeaderProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState(initialSearchValue)

  useEffect(() => {
    setSearchQuery(initialSearchValue)
  }, [initialSearchValue])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
      <div className="flex items-center gap-3 md:gap-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5 text-[#333333]" />
              <span className="sr-only">메뉴</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <Sidebar />
          </SheetContent>
        </Sheet>

        <Link href="/" className="text-xl font-bold text-[#FF5722]">
          Refill Spot
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex-1 max-w-md mx-auto relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="원하는 지역 또는 식당 이름을 입력하세요"
            className="pl-9 pr-9 py-2 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
          >
            <MapPin className="h-4 w-4 text-[#2196F3]" />
            <span className="sr-only">현재 위치</span>
          </Button>
        </div>
      </form>

      <Link href="/login">
        <Button variant="outline" className="hidden md:flex gap-2">
          <User className="h-4 w-4" />
          <span>로그인</span>
        </Button>
      </Link>
    </header>
  )
}

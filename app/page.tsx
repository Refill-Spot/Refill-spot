"use client"

import { useState } from "react"
import Map from "@/components/map"
import StoreList from "@/components/store-list"
import Sidebar from "@/components/sidebar"
import MobileBottomSheet from "@/components/mobile-bottom-sheet"
import Header from "@/components/header"
import ViewToggle from "@/components/view-toggle"

export default function Home() {
  const [view, setView] = useState<"map" | "list">("map")

  return (
    <main className="flex flex-col h-screen bg-[#F5F5F5]">
      <Header />
      <ViewToggle view={view} setView={setView} />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:block w-80 border-r border-gray-200 overflow-y-auto">
          <Sidebar />
        </div>
        <div className="flex-1 relative">
          {view === "map" ? (
            <>
              <Map />
              <div className="md:hidden">
                <MobileBottomSheet />
              </div>
            </>
          ) : (
            <StoreList />
          )}
        </div>
      </div>
    </main>
  )
}

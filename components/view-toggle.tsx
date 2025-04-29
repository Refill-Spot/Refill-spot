"use client"

import { Map, List } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface ViewToggleProps {
  view: "map" | "list"
  setView: (view: "map" | "list") => void
}

export default function ViewToggle({ view, setView }: ViewToggleProps) {
  return (
    <div className="flex justify-center my-2">
      <ToggleGroup type="single" value={view} onValueChange={(value) => value && setView(value as "map" | "list")}>
        <ToggleGroupItem value="map" aria-label="지도 보기" className="px-4">
          <Map className="h-4 w-4 mr-2" />
          <span>지도</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label="목록 보기" className="px-4">
          <List className="h-4 w-4 mr-2" />
          <span>목록</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

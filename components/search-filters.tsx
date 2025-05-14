"use client"

import { useState } from "react"
import { Utensils, Fish, Beef, Pizza, Star } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

interface SearchFiltersProps {
  onApplyFilters: (filters: any) => void
}

export default function SearchFilters({ onApplyFilters }: SearchFiltersProps) {
  const [radius, setRadius] = useState([3])
  const [minRating, setMinRating] = useState(0)
  const [categories, setCategories] = useState({
    고기: false,
    해산물: false,
    양식: false,
    한식: false,
  })

  const handleCategoryChange = (category) => {
    setCategories({
      ...categories,
      [category]: !categories[category],
    })
  }

  const handleApplyFilters = () => {
    const selectedCategories = Object.entries(categories)
      .filter(([_, isSelected]) => isSelected)
      .map(([category]) => category)

    onApplyFilters({
      categories: selectedCategories,
      maxDistance: radius[0],
      minRating: minRating,
    })
  }

  const handleResetFilters = () => {
    setRadius([3])
    setMinRating(0)
    setCategories({
      고기: false,
      해산물: false,
      양식: false,
      한식: false,
    })

    onApplyFilters({
      categories: [],
      maxDistance: 5,
      minRating: 0,
    })
  }

  return (
    <div className="p-4 h-full bg-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#333333]">필터</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetFilters}
          className="text-[#2196F3] hover:text-[#1976d2] hover:bg-[#2196F3]/10"
        >
          초기화
        </Button>
      </div>

      <div className="space-y-6">
        {/* Category filter */}
        <div>
          <h3 className="font-medium mb-3 text-[#333333]">카테고리</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="meat" checked={categories.고기} onCheckedChange={() => handleCategoryChange("고기")} />
              <Label htmlFor="meat" className="flex items-center gap-2 cursor-pointer">
                <Beef className="h-4 w-4 text-[#FF5722]" />
                <span>고기</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="seafood"
                checked={categories.해산물}
                onCheckedChange={() => handleCategoryChange("해산물")}
              />
              <Label htmlFor="seafood" className="flex items-center gap-2 cursor-pointer">
                <Fish className="h-4 w-4 text-[#2196F3]" />
                <span>해산물</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="western" checked={categories.양식} onCheckedChange={() => handleCategoryChange("양식")} />
              <Label htmlFor="western" className="flex items-center gap-2 cursor-pointer">
                <Pizza className="h-4 w-4 text-[#FFC107]" />
                <span>양식</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="korean" checked={categories.한식} onCheckedChange={() => handleCategoryChange("한식")} />
              <Label htmlFor="korean" className="flex items-center gap-2 cursor-pointer">
                <Utensils className="h-4 w-4 text-[#4CAF50]" />
                <span>한식</span>
              </Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* Radius filter */}
        <div>
          <div className="flex justify-between mb-3">
            <h3 className="font-medium text-[#333333]">반경 설정</h3>
            <span className="text-sm font-medium">{radius[0]}km</span>
          </div>
          <Slider
            defaultValue={[3]}
            max={5}
            min={1}
            step={1}
            value={radius}
            onValueChange={setRadius}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1km</span>
            <span>3km</span>
            <span>5km</span>
          </div>
        </div>

        <Separator />

        {/* Rating filter */}
        <div>
          <h3 className="font-medium mb-3 text-[#333333]">최소 평점</h3>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                className={`p-1 rounded-md transition-colors ${
                  minRating >= rating ? "text-[#FFA726]" : "text-gray-300"
                }`}
                onClick={() => setMinRating(rating)}
              >
                <Star className="h-5 w-5 fill-current" />
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleApplyFilters} className="w-full bg-[#FF5722] hover:bg-[#E64A19] mt-4">
          필터 적용
        </Button>
      </div>
    </div>
  )
}

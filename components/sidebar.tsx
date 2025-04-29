"use client"

import { useState } from "react"
import { Coffee, Utensils, Cake, Star } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function Sidebar() {
  const [radius, setRadius] = useState([3])
  const [minRating, setMinRating] = useState(0)
  const [categories, setCategories] = useState({
    coffee: true,
    food: false,
    dessert: true,
  })

  const handleCategoryChange = (category) => {
    setCategories({
      ...categories,
      [category]: !categories[category],
    })
  }

  return (
    <div className="p-4 h-full bg-white">
      <h2 className="text-lg font-bold mb-4 text-[#333333]">필터</h2>

      <div className="space-y-6">
        {/* Category filter */}
        <div>
          <h3 className="font-medium mb-3 text-[#333333]">카테고리</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="coffee"
                checked={categories.coffee}
                onCheckedChange={() => handleCategoryChange("coffee")}
              />
              <Label htmlFor="coffee" className="flex items-center gap-2 cursor-pointer">
                <Coffee className="h-4 w-4 text-[#4CAF50]" />
                <span>커피</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="food" checked={categories.food} onCheckedChange={() => handleCategoryChange("food")} />
              <Label htmlFor="food" className="flex items-center gap-2 cursor-pointer">
                <Utensils className="h-4 w-4 text-[#4CAF50]" />
                <span>음식</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dessert"
                checked={categories.dessert}
                onCheckedChange={() => handleCategoryChange("dessert")}
              />
              <Label htmlFor="dessert" className="flex items-center gap-2 cursor-pointer">
                <Cake className="h-4 w-4 text-[#4CAF50]" />
                <span>디저트</span>
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
      </div>
    </div>
  )
}

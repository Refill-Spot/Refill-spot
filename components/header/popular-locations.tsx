"use client";

import { Button } from "@/components/ui/button";
import { POPULAR_LOCATIONS } from "@/lib/geocoding";
import { MapPin } from "lucide-react";

interface PopularLocationsProps {
  onLocationSelect: (location: { name: string; address: string }) => void;
}

export function PopularLocations({ onLocationSelect }: PopularLocationsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-900">인기 지역</h3>
      <div className="grid grid-cols-2 gap-2">
        {POPULAR_LOCATIONS.map((location, index) => (
          <Button
            key={index}
            type="button"
            variant="outline"
            size="sm"
            className="justify-start h-auto p-3 text-left"
            onClick={() => onLocationSelect(location)}
          >
            <div className="flex items-center space-x-2 w-full">
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {location.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {location.address}
                </div>
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}

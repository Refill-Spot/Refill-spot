"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGooglePlaces } from "@/hooks/use-google-places";
import { MapPin, Search } from "lucide-react";
import { forwardRef, KeyboardEvent } from "react";

interface SearchInputProps {
  onPlaceSelect?: (place: any) => void;
  onManualSearch?: (searchText: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput = forwardRef<HTMLDivElement, SearchInputProps>(
  ({ onPlaceSelect, onManualSearch, placeholder, className }, ref) => {
    const {
      predictions,
      showPredictions,
      searchText,
      isLoading,
      handleInputChange,
      handleSearch,
      handlePredictionSelect,
      clearPredictions,
    } = useGooglePlaces({
      onPlaceSelect,
      onManualSearch,
      placeholder,
    });

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      } else if (e.key === "Escape") {
        clearPredictions();
      }
    };

    const handleInputFocus = () => {
      if (searchText.length >= 2) {
        // 기존 예측 결과가 있으면 다시 표시
        if (predictions.length > 0) {
          // setShowPredictions(true); // 이 함수는 useGooglePlaces에서 반환되지 않음
        }
      }
    };

    return (
      <div ref={ref} className={`relative ${className}`}>
        <div className="relative">
          <Input
            type="text"
            placeholder={placeholder || "지역, 주소를 입력하세요"}
            value={searchText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            className="pr-10 w-full"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => handleSearch()}
            disabled={isLoading}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* 자동완성 예측 결과 */}
        {showPredictions && predictions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {predictions.map((prediction, index) => (
              <button
                key={prediction.place_id || index}
                type="button"
                className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                onClick={() => handlePredictionSelect(prediction)}
              >
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {prediction.structured_formatting?.main_text ||
                        prediction.description}
                    </div>
                    {prediction.structured_formatting?.secondary_text && (
                      <div className="text-xs text-gray-500 truncate">
                        {prediction.structured_formatting.secondary_text}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4">
            <div className="flex items-center justify-center text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              검색 중...
            </div>
          </div>
        )}
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";

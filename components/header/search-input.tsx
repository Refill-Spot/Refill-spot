"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlaceSearch } from "@/hooks/use-place-search";
import type { LocationResult } from "@/lib/location-search";
import { cn } from "@/lib/utils";
import { Loader2, MapPin, Search } from "lucide-react";
import {
  forwardRef,
  KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

interface SearchInputProps {
  onPlaceSelect?: (place: LocationResult) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput = forwardRef<HTMLDivElement, SearchInputProps>(
  ({ onPlaceSelect, placeholder, className }, ref) => {
    const inputId = useId();
    const resultsId = `${inputId}-results`;
    const errorId = `${inputId}-error`;
    const resultsRef = useRef<HTMLDivElement>(null);
    const [activeResult, setActiveResult] = useState(-1);
    const {
      results,
      showResults,
      searchText,
      isLoading,
      error,
      noResults,
      handleInputChange,
      handleSearch,
      handleResultSelect,
      clearResults,
      setShowResults,
    } = usePlaceSearch({
      onPlaceSelect,
    });

    const hasResults = showResults && results.length > 0;

    useEffect(() => {
      setActiveResult(-1);
    }, [results]);

    useEffect(() => {
      if (hasResults && activeResult >= 0) {
        resultsRef.current?.children[activeResult]?.scrollIntoView({
          block: "nearest",
        });
      }
    }, [activeResult, hasResults]);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
        return;
      }

      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        results.length > 0
      ) {
        e.preventDefault();
        setShowResults(true);
        setActiveResult((current) => {
          if (e.key === "ArrowDown") {
            return (current + 1) % results.length;
          }
          return current <= 0 ? results.length - 1 : current - 1;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (hasResults && activeResult >= 0) {
          handleResultSelect(results[activeResult]);
        } else {
          void handleSearch();
        }
        setActiveResult(-1);
      } else if (e.key === "Escape") {
        if (hasResults || isLoading || error || noResults) {
          e.preventDefault();
          e.stopPropagation();
        }
        clearResults();
        setActiveResult(-1);
      }
    };

    return (
      <div
        ref={ref}
        className={cn("relative min-w-0", className)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setShowResults(false);
            setActiveResult(-1);
          }
        }}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={inputId}
            type="text"
            role="combobox"
            aria-label="지역, 역 이름, 가게 이름 또는 주소 검색"
            aria-autocomplete="none"
            aria-expanded={hasResults}
            aria-controls={hasResults ? resultsId : undefined}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error)}
            aria-busy={isLoading}
            aria-activedescendant={
              hasResults && activeResult >= 0
                ? `${resultsId}-${activeResult}`
                : undefined
            }
            placeholder={placeholder || "지역, 역 이름, 가게 이름 검색"}
            value={searchText}
            onChange={(e) => {
              setActiveResult(-1);
              handleInputChange(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) {
                setShowResults(true);
              }
            }}
            className="h-11 w-full rounded-md border-input bg-background pl-10 pr-16 text-base shadow-none placeholder:text-muted-foreground focus-visible:ring-ring sm:text-sm"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={100}
          />
          <Button
            type="button"
            variant="ghost"
            aria-label="검색 실행"
            className="absolute right-0.5 top-1/2 h-11 -translate-y-1/2 px-3 text-foreground"
            onClick={() => void handleSearch()}
            disabled={isLoading}
          >
            검색
          </Button>
        </div>

        {hasResults && (
          <div
            ref={resultsRef}
            id={resultsId}
            role="listbox"
            aria-label="장소 검색 결과"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md"
          >
            {results.map((result, index) => (
              <button
                key={result.id}
                id={`${resultsId}-${index}`}
                type="button"
                role="option"
                aria-selected={activeResult === index}
                tabIndex={-1}
                className={cn(
                  "min-h-11 w-full px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeResult === index && "bg-accent",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  handleResultSelect(result);
                  setActiveResult(-1);
                }}
              >
                <div className="flex items-center space-x-2">
                  <MapPin
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-popover-foreground">
                      {result.name}
                    </div>
                    {result.address && (
                      <div className="truncate text-xs text-muted-foreground">
                        {result.address}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div
            role="status"
            className="absolute z-50 mt-1 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-popover p-4 text-sm text-muted-foreground shadow-md"
          >
            <Loader2
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            검색 중...
          </div>
        )}

        {error && (
          <div
            id={errorId}
            role="alert"
            className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-4 text-sm text-destructive shadow-md"
          >
            {error}
          </div>
        )}

        {noResults && (
          <div
            role="status"
            className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-4 text-sm text-muted-foreground shadow-md"
          >
            검색 결과가 없습니다. 다른 검색어로 다시 검색해 주세요.
          </div>
        )}
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";

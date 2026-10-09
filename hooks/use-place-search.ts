"use client";

import { searchLocations } from "@/lib/location-search";
import type { LocationResult } from "@/lib/location-search";
import { useCallback, useEffect, useRef, useState } from "react";

interface UsePlaceSearchProps {
  onPlaceSelect?: (place: LocationResult) => void;
}

export function usePlaceSearch({ onPlaceSelect }: UsePlaceSearchProps = {}) {
  const [results, setResults] = useState<LocationResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noResults, setNoResults] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const cancelSearch = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const clearResults = useCallback(() => {
    cancelSearch();
    setResults([]);
    setShowResults(false);
    setError(null);
    setNoResults(false);
    setIsLoading(false);
  }, [cancelSearch]);

  const handleInputChange = useCallback(
    (value: string) => {
      clearResults();
      setSearchText(value);
    },
    [clearResults],
  );

  const handleSearch = useCallback(async () => {
    if (controllerRef.current) {
      return;
    }

    const query = searchText.trim();
    setSearchText(query);
    setResults([]);
    setShowResults(false);
    setError(null);
    setNoResults(false);

    if (query.length < 2 || query.length > 100) {
      setError("검색어는 2자 이상 100자 이하로 입력해 주세요.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    controllerRef.current = controller;
    setIsLoading(true);

    try {
      const matches = await searchLocations(query, {
        signal: controller.signal,
      });
      if (requestIdRef.current !== requestId || controller.signal.aborted) {
        return;
      }

      setResults(matches);
      setShowResults(matches.length > 0);
      setNoResults(matches.length === 0);
    } catch (searchError) {
      if (requestIdRef.current !== requestId || controller.signal.aborted) {
        return;
      }
      if (searchError instanceof Error && searchError.name === "AbortError") {
        return;
      }

      setError(
        searchError instanceof Error && searchError.message
          ? searchError.message
          : "장소 검색에 실패했습니다. 잠시 후 다시 검색해 주세요.",
      );
    } finally {
      if (requestIdRef.current === requestId) {
        controllerRef.current = null;
        setIsLoading(false);
      }
    }
  }, [searchText]);

  const handleResultSelect = useCallback(
    (place: LocationResult) => {
      clearResults();
      setSearchText(place.name);
      onPlaceSelect?.(place);
    },
    [clearResults, onPlaceSelect],
  );

  useEffect(() => cancelSearch, [cancelSearch]);

  return {
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
  };
}

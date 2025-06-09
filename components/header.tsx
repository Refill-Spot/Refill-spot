"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  MapPin,
  Menu,
  User,
  LogOut,
  X,
  Map,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Sidebar from "@/components/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { POPULAR_LOCATIONS } from "@/lib/geocoding";
import { useToast } from "@/hooks/use-toast";
import GooglePlacesAutocomplete from "react-google-places-autocomplete";
import { resetOnboardingStatus } from "@/lib/onboarding-storage";

// Google Maps API 타입 선언
declare global {
  interface Window {
    google: any;
  }
}

// 필터 타입 정의
interface FilterOptions {
  categories?: string[];
  maxDistance?: number;
  minRating?: number;
  latitude?: number;
  longitude?: number;
}

// 주소 검색 폼 스키마 정의
const addressFormSchema = z.object({
  address: z.string().min(1, "주소를 입력해주세요"),
  radius: z.coerce
    .number()
    .min(1, "반경은 1km 이상이어야 합니다")
    .max(20, "반경은 20km 이하여야 합니다")
    .default(5),
});

interface HeaderProps {
  initialSearchValue?: string;
  onSearch?: (query: string) => void;
  onLocationRequest?: () => void;
  onCustomLocationSet?: (lat: number, lng: number, radius: number) => void;
  userLocation?: { lat: number; lng: number } | null;
}

export default function Header({
  initialSearchValue = "",
  onSearch,
  onLocationRequest,
  onCustomLocationSet,
  userLocation,
}: HeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, profile, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState(initialSearchValue);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [radiusInput, setRadiusInput] = useState(5);
  const [isLoading, setIsLoading] = useState(false);

  // 주소 검색 폼
  const addressForm = useForm<z.infer<typeof addressFormSchema>>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      address: "",
      radius: 5,
    },
  });

  useEffect(() => {
    setSearchQuery(initialSearchValue);
  }, [initialSearchValue]);

  // 장소 선택 핸들러
  const handlePlaceSelect = async (place: any) => {
    if (!place || !place.place_id) return;
    if (!window.google || !window.google.maps) {
      toast({
        title: "오류",
        description: "Google Maps API가 로드되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Google Places API를 사용하여 장소 상세 정보 가져오기
      const service = new window.google.maps.places.PlacesService(
        document.createElement("div")
      );

      service.getDetails(
        {
          placeId: place.place_id,
          fields: ["geometry", "formatted_address", "name"],
        },
        (result: any, status: any) => {
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            result
          ) {
            const lat = result.geometry?.location?.lat();
            const lng = result.geometry?.location?.lng();

            if (lat && lng) {
              if (onCustomLocationSet) {
                onCustomLocationSet(lat, lng, radiusInput);
              } else {
                router.push(`/?lat=${lat}&lng=${lng}&distance=${radiusInput}`);
              }

              toast({
                title: "위치 설정 완료",
                description: `${
                  result.name || place.description
                } 주변 ${radiusInput}km로 설정되었습니다.`,
              });

              handleLocationDialogChange(false);
            }
          } else {
            toast({
              title: "오류",
              description: "장소 정보를 가져오는 중 오류가 발생했습니다.",
              variant: "destructive",
            });
          }
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error("장소 선택 오류:", error);
      toast({
        title: "오류",
        description: "장소 정보를 가져오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // 인기 지역 선택
  const handlePopularLocationSelect = (location: {
    name: string;
    address: string;
  }) => {
    if (!window.google || !window.google.maps) {
      toast({
        title: "오류",
        description: "Google Maps API가 로드되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    setSelectedPlace({
      description: location.address,
      place_id: null, // 인기 지역은 직접 주소로 처리
    });

    // 직접 지오코딩 처리
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode(
      { address: location.address },
      (results: any, status: any) => {
        if (status === window.google.maps.GeocoderStatus.OK && results?.[0]) {
          const lat = results[0].geometry.location.lat();
          const lng = results[0].geometry.location.lng();

          if (onCustomLocationSet) {
            onCustomLocationSet(lat, lng, radiusInput);
          } else {
            router.push(`/?lat=${lat}&lng=${lng}&distance=${radiusInput}`);
          }

          toast({
            title: "위치 설정 완료",
            description: `${location.name} 주변 ${radiusInput}km로 설정되었습니다.`,
          });

          handleLocationDialogChange(false);
        } else {
          toast({
            title: "오류",
            description: "주소를 찾을 수 없습니다.",
            variant: "destructive",
          });
        }
      }
    );
  };

  // 모바일 검색 처리
  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery.trim());
      } else {
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
      setIsSearchOpen(false);
    }
  };

  // 데스크탑 검색 처리
  const handleDesktopSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery.trim());
      } else {
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
    }
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    await signOut();
  };

  // 현재 위치 요청 처리
  const handleGetCurrentLocation = () => {
    if (onLocationRequest) {
      onLocationRequest();
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          router.push(`/?lat=${latitude}&lng=${longitude}`);
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast({
            title: "위치 오류",
            description: "현재 위치를 가져올 수 없습니다.",
            variant: "destructive",
          });
        }
      );
    }
  };

  // 사이드바 필터 적용
  const handleApplyFilters = (filters: FilterOptions) => {
    // 필터를 적용하고 검색 페이지로 이동
    const queryParams = new URLSearchParams();

    if (filters.categories && filters.categories.length > 0) {
      queryParams.set("categories", filters.categories.join(","));
    }

    if (filters.maxDistance) {
      queryParams.set("distance", filters.maxDistance.toString());
    }

    if (filters.minRating) {
      queryParams.set("rating", filters.minRating.toString());
    }

    if (filters.latitude && filters.longitude) {
      queryParams.set("lat", filters.latitude.toString());
      queryParams.set("lng", filters.longitude.toString());
    }

    const queryString = queryParams.toString();
    router.push(`/search?${queryString}`);
  };

  // 다이얼로그 상태 관리
  const handleLocationDialogChange = (open: boolean) => {
    setIsLocationDialogOpen(open);
    if (!open) {
      // 다이얼로그가 닫힐 때 상태 초기화
      setSelectedPlace(null);
      setRadiusInput(5);
    }
  };

  // 주소 자동완성 컴포넌트
  const AddressAutocomplete = () => (
    <div className="space-y-2">
      <label className="text-sm font-medium">주소 검색</label>
      <GooglePlacesAutocomplete
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
        selectProps={{
          value: selectedPlace,
          onChange: (place: any) => {
            if (place && place.place_id) {
              // 자동완성에서 선택한 경우 즉시 위치 설정
              setSelectedPlace(place);
              handlePlaceSelect(place);
            } else if (place === null) {
              // 선택 해제한 경우
              setSelectedPlace(null);
            }
          },
          placeholder: "예: 강남역, 서울시 강남구 테헤란로 123",
          isClearable: true,
          isLoading: isLoading,
          onInputChange: (inputValue: string) => {
            // 입력값이 변경될 때만 상태 업데이트 (깜빡임 방지)
            if (!selectedPlace || selectedPlace.description !== inputValue) {
              // 입력 중일 때는 selectedPlace를 null로 설정하지 않음
            }
          },
          onKeyDown: (event: any) => {
            if (event.key === "Enter") {
              event.preventDefault();
              // 이미 선택된 place가 있으면 그것을 사용
              if (selectedPlace && selectedPlace.place_id) {
                handlePlaceSelect(selectedPlace);
              } else {
                // 선택된 것이 없으면 입력된 텍스트로 검색
                const inputValue = event.target.value;
                if (inputValue && inputValue.trim()) {
                  handleManualSearch(inputValue.trim());
                }
              }
            }
          },
          styles: {
            control: (provided: any) => ({
              ...provided,
              minHeight: "40px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              "&:hover": {
                borderColor: "#cbd5e1",
              },
            }),
            placeholder: (provided: any) => ({
              ...provided,
              color: "#64748b",
            }),
          },
        }}
        autocompletionRequest={{
          componentRestrictions: { country: "kr" },
          types: ["establishment", "geocode"],
        }}
      />
    </div>
  );

  // 수동 검색 핸들러 (Enter 키 입력 시)
  const handleManualSearch = async (searchText: string) => {
    if (!window.google || !window.google.maps) {
      toast({
        title: "오류",
        description: "Google Maps API가 로드되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // AutocompleteService를 사용하여 첫 번째 결과 가져오기
      const service = new window.google.maps.places.AutocompleteService();

      service.getPlacePredictions(
        {
          input: searchText,
          componentRestrictions: { country: "kr" },
          types: ["establishment", "geocode"],
        },
        (predictions: any, status: any) => {
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            predictions &&
            predictions.length > 0
          ) {
            // 첫 번째 결과를 자동으로 선택
            const firstResult = predictions[0];
            setSelectedPlace(firstResult);
            handlePlaceSelect(firstResult);
          } else {
            // 자동완성 결과가 없으면 직접 지오코딩 시도
            handleDirectGeocoding(searchText);
          }
        }
      );
    } catch (error) {
      console.error("수동 검색 오류:", error);
      toast({
        title: "검색 오류",
        description: "주소 검색 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // 직접 지오코딩 처리 (분리하여 재사용성 향상)
  const handleDirectGeocoding = (searchText: string) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode(
      { address: searchText, componentRestrictions: { country: "KR" } },
      (results: any, status: any) => {
        if (status === window.google.maps.GeocoderStatus.OK && results?.[0]) {
          const lat = results[0].geometry.location.lat();
          const lng = results[0].geometry.location.lng();

          if (onCustomLocationSet) {
            onCustomLocationSet(lat, lng, radiusInput);
          } else {
            router.push(`/?lat=${lat}&lng=${lng}&distance=${radiusInput}`);
          }

          toast({
            title: "위치 설정 완료",
            description: `${searchText} 주변 ${radiusInput}km로 설정되었습니다.`,
          });

          handleLocationDialogChange(false);
        } else {
          toast({
            title: "검색 결과 없음",
            description:
              "입력하신 주소를 찾을 수 없습니다. 다른 주소로 시도해보세요.",
            variant: "destructive",
          });
        }
        setIsLoading(false);
      }
    );
  };

  // 데스크탑 헤더
  const DesktopHeader = () => (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 hidden md:flex items-center gap-3">
      <div className="flex items-center gap-3 md:gap-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5 text-[#333333]" />
              <span className="sr-only">{t("menu")}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <Sidebar
              onApplyFilters={handleApplyFilters}
              userLocation={userLocation}
            />
          </SheetContent>
        </Sheet>

        <Link href="/" className="text-xl font-bold text-[#FF5722]">
          Refill Spot
        </Link>
      </div>

      <form
        onSubmit={handleDesktopSearch}
        className="flex-1 max-w-md mx-auto relative"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder={t("search_placeholder")}
            className="pl-9 pr-16 py-2 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex">
            <Dialog
              open={isLocationDialogOpen}
              onOpenChange={handleLocationDialogChange}
            >
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-1">
                  <Map className="h-4 w-4 text-[#4CAF50]" />
                  <span className="sr-only">위치 설정</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>위치 설정</DialogTitle>
                  <DialogDescription>
                    주소를 검색하거나 인기 지역을 선택하세요.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* 주소 자동완성 */}
                  <AddressAutocomplete />

                  {/* 검색 반경 설정 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">검색 반경</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={radiusInput}
                        onChange={(e) =>
                          setRadiusInput(parseInt(e.target.value) || 5)
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-gray-500">km</span>
                    </div>
                  </div>

                  {/* 인기 지역 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">인기 지역</label>
                    <div className="grid grid-cols-2 gap-2">
                      {POPULAR_LOCATIONS.map((location) => (
                        <Button
                          key={location.name}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handlePopularLocationSelect(location)}
                          disabled={isLoading}
                          className="justify-start"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {location.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleGetCurrentLocation}
            >
              <MapPin className="h-4 w-4 text-[#2196F3]" />
              <span className="sr-only">{t("current_location")}</span>
            </Button>
          </div>
        </div>
      </form>

      {!loading && (
        <div className="flex items-center gap-3">
          {/* 온보딩 및 문의하기 링크 */}
          <Link href="/onboarding">
            <Button variant="ghost" className="text-sm">
              서비스 소개
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="ghost" className="text-sm">
              문의하기
            </Button>
          </Link>

          {/* 개발 모드에서만 표시되는 온보딩 리셋 버튼 */}
          {process.env.NODE_ENV === "development" && (
            <Button
              variant="ghost"
              className="text-sm text-gray-400 hover:text-gray-600"
              onClick={() => {
                resetOnboardingStatus();
                window.location.reload();
              }}
              title="온보딩 상태 리셋 (개발용)"
            >
              🔄
            </Button>
          )}

          {user ? (
            // 로그인된 경우
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex gap-2">
                  <User className="h-4 w-4" />
                  <span>{profile?.username || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  {t("profile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/favorites")}>
                  {t("favorites")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-500"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // 로그인되지 않은 경우
            <Link href="/login">
              <Button variant="outline" className="flex gap-2">
                <User className="h-4 w-4" />
                <span>{t("login")}</span>
              </Button>
            </Link>
          )}
        </div>
      )}
    </header>
  );

  // 모바일 헤더
  const MobileHeader = () => (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 md:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5 text-[#333333]" />
                <span className="sr-only">{t("menu")}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-80">
              <Sidebar
                onApplyFilters={handleApplyFilters}
                userLocation={userLocation}
              />
            </SheetContent>
          </Sheet>

          <Link href="/" className="text-lg font-bold text-[#FF5722]">
            Refill Spot
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* 위치 설정 다이얼로그 */}
          <Dialog
            open={isLocationDialogOpen}
            onOpenChange={handleLocationDialogChange}
          >
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Map className="h-5 w-5 text-[#4CAF50]" />
                <span className="sr-only">위치 설정</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>위치 설정</DialogTitle>
                <DialogDescription>
                  주소를 검색하거나 인기 지역을 선택하세요.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* 주소 자동완성 */}
                <AddressAutocomplete />

                {/* 검색 반경 설정 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">검색 반경</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={radiusInput}
                      onChange={(e) =>
                        setRadiusInput(parseInt(e.target.value) || 5)
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">km</span>
                  </div>
                </div>

                {/* 인기 지역 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">인기 지역</label>
                  <div className="grid grid-cols-2 gap-2">
                    {POPULAR_LOCATIONS.map((location) => (
                      <Button
                        key={location.name}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePopularLocationSelect(location)}
                        disabled={isLoading}
                        className="justify-start"
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        {location.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleGetCurrentLocation}
          >
            <MapPin className="h-5 w-5 text-[#2196F3]" />
            <span className="sr-only">{t("current_location")}</span>
          </Button>

          <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Search className="h-5 w-5 text-[#333333]" />
                <span className="sr-only">{t("search")}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="top" className="pt-12">
              <SheetHeader className="mb-4">
                <SheetTitle>{t("search")}</SheetTitle>
              </SheetHeader>
              <form onSubmit={handleMobileSearch} className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder={t("search_placeholder")}
                    className="pl-9 pr-3 py-2"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                >
                  {t("search")}
                </Button>
              </form>
            </SheetContent>
          </Sheet>

          {!loading && (
            <>
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex gap-2">
                      <User className="h-4 w-4" />
                      <span>{profile?.username || user.email}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push("/profile")}>
                      {t("profile")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/favorites")}>
                      {t("favorites")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-red-500"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {t("logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/login">
                  <Button variant="outline" size="icon">
                    <User className="h-4 w-4" />
                    <span className="sr-only">{t("login")}</span>
                  </Button>
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );

  return (
    <>
      <DesktopHeader />
      <MobileHeader />
    </>
  );
}

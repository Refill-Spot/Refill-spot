"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Menu, User, LogOut, X, Map } from "lucide-react";
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

// 필터 타입 정의
interface FilterOptions {
  categories?: string[];
  maxDistance?: number;
  minRating?: number;
  latitude?: number;
  longitude?: number;
}

// 위치 입력 폼 스키마 정의
const locationFormSchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, "위도는 -90에서 90 사이의 값이어야 합니다")
    .max(90, "위도는 -90에서 90 사이의 값이어야 합니다"),
  longitude: z.coerce
    .number()
    .min(-180, "경도는 -180에서 180 사이의 값이어야 합니다")
    .max(180, "경도는 -180에서 180 사이의 값이어야 합니다"),
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
}

export default function Header({
  initialSearchValue = "",
  onSearch,
  onLocationRequest,
  onCustomLocationSet,
}: HeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, profile, loading, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState(initialSearchValue);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);

  // 위치 설정 폼
  const locationForm = useForm<z.infer<typeof locationFormSchema>>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      latitude: 37.498095,
      longitude: 127.02761,
      radius: 5,
    },
  });

  useEffect(() => {
    setSearchQuery(initialSearchValue);
  }, [initialSearchValue]);

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

  // 위치 설정 제출 핸들러
  const onLocationSubmit = (values: z.infer<typeof locationFormSchema>) => {
    const { latitude, longitude, radius } = values;

    if (onCustomLocationSet) {
      onCustomLocationSet(latitude, longitude, radius);
    } else {
      // 직접 URL 파라미터 설정
      router.push(`/?lat=${latitude}&lng=${longitude}&distance=${radius}`);
    }

    setIsLocationDialogOpen(false);
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
            <Sidebar onApplyFilters={handleApplyFilters} />
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
              onOpenChange={setIsLocationDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-1">
                  <Map className="h-4 w-4 text-[#4CAF50]" />
                  <span className="sr-only">위치 직접 설정</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>위치 직접 설정</DialogTitle>
                  <DialogDescription>
                    찾고자 하는 지역의 위도와 경도를 입력하세요.
                  </DialogDescription>
                </DialogHeader>
                <Form {...locationForm}>
                  <form
                    onSubmit={locationForm.handleSubmit(onLocationSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={locationForm.control}
                      name="latitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>위도 (Latitude)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.000001"
                              placeholder="예: 37.498095"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>위도 값 (-90 ~ 90)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={locationForm.control}
                      name="longitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>경도 (Longitude)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.000001"
                              placeholder="예: 127.027610"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            경도 값 (-180 ~ 180)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={locationForm.control}
                      name="radius"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>검색 반경 (km)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="20"
                              placeholder="5"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            1km ~ 20km 사이 설정
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="submit"
                        className="bg-[#FF5722] hover:bg-[#E64A19]"
                      >
                        위치 설정 적용
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
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
          {/* 문의하기 링크 */}
          <Link href="/contact">
            <Button variant="ghost" className="text-sm">
              문의하기
            </Button>
          </Link>

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
              <Sidebar onApplyFilters={handleApplyFilters} />
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
            onOpenChange={setIsLocationDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Map className="h-5 w-5 text-[#4CAF50]" />
                <span className="sr-only">위치 직접 설정</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>위치 직접 설정</DialogTitle>
                <DialogDescription>
                  찾고자 하는 지역의 위도와 경도를 입력하세요.
                </DialogDescription>
              </DialogHeader>
              <Form {...locationForm}>
                <form
                  onSubmit={locationForm.handleSubmit(onLocationSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={locationForm.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>위도 (Latitude)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.000001"
                            placeholder="예: 37.498095"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>위도 값 (-90 ~ 90)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={locationForm.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>경도 (Longitude)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.000001"
                            placeholder="예: 127.027610"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>경도 값 (-180 ~ 180)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={locationForm.control}
                    name="radius"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>검색 반경 (km)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="20"
                            placeholder="5"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>1km ~ 20km 사이 설정</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      className="bg-[#FF5722] hover:bg-[#E64A19]"
                    >
                      위치 설정 적용
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
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

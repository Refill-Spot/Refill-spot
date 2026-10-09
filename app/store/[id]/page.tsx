"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { SearchInput } from "@/components/header/search-input";
import { StoreReviews } from "@/components/store-reviews";
import { ReviewWriteDialog } from "@/components/review-write-dialog";
import { PlatformViewDialog } from "@/components/platform-view-dialog";
import { ExternalRatings } from "@/components/external-ratings";
import { getUserLocation, isLocationValid } from "@/lib/location-storage";
import type { LocationResult } from "@/lib/location-search";
import { Store } from "@/types/store";
import { MenuItem } from "@/types/menu";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/use-favorites";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Expand,
  Heart,
  LogOut,
  Map,
  MapPin,
  Phone,
  Settings,
  Share,
  Star,
  Utensils,
  User,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllHours, setShowAllHours] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [refreshReviews, setRefreshReviews] = useState(0);
  const [showAllMenus, setShowAllMenus] = useState(false);
  const [showNaverPlatform, setShowNaverPlatform] = useState(false);
  const [showKakaoPlatform, setShowKakaoPlatform] = useState(false);
  const [showLoginAlert, setShowLoginAlert] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const photoTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleReviewChanged = () => {
    setRefreshReviews((previous) => previous + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchStore = async () => {
      try {
        const response = await fetch(`/api/stores/${params.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          if (!controller.signal.aborted) {
            setStore(data.data);
          }
        } else {
          toast({
            title: "오류",
            description: "가게 정보를 불러올 수 없습니다.",
            variant: "destructive",
          });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("가게 정보 조회 오류:", error);
        toast({
          title: "오류",
          description: "가게 정보를 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    if (params.id) {
      fetchStore();
    }

    return () => controller.abort();
  }, [params.id, refreshReviews, toast]);

  const handleViewInNaverMap = () => {
    if (!store) {
      return;
    }

    // 네이버 지도 앱으로 열기 시도
    const naverMapUrl = `nmap://place?lat=${store.position.lat}&lng=${
      store.position.lng
    }&name=${encodeURIComponent(store.name)}&appname=com.refillspot.app`;

    // 앱이 설치되어 있지 않으면 웹으로 리다이렉트
    const webMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(
      store.name,
    )}?c=${store.position.lng},${store.position.lat},15,0,0,0,dh`;

    // 모바일에서는 앱 링크 시도, 데스크톱에서는 바로 웹으로
    if (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      )
    ) {
      window.location.href = naverMapUrl;
      // 1초 후 앱이 열리지 않으면 웹으로 이동
      setTimeout(() => {
        window.open(webMapUrl, "_blank");
      }, 1000);
    } else {
      window.open(webMapUrl, "_blank");
    }
  };

  // 뒤로가기 핸들러
  const handleGoBack = () => {
    // 브라우저 히스토리를 확인하여 이전 페이지로 돌아가기
    if (window.history.length > 1) {
      router.back();
    } else {
      // 히스토리가 없으면 메인 페이지로 이동
      const savedLocation = getUserLocation();
      if (savedLocation && isLocationValid(savedLocation)) {
        const params = new URLSearchParams({
          lat: savedLocation.lat.toString(),
          lng: savedLocation.lng.toString(),
          source: savedLocation.source,
        });
        router.push(`/?${params.toString()}`);
      } else {
        router.push("/");
      }
    }
  };

  // 즐겨찾기 토글 핸들러
  const handleToggleFavorite = async () => {
    if (!store) {
      return;
    }

    if (!user) {
      setShowLoginAlert(true);
      return;
    }

    await toggleFavorite(store.id, false);
  };

  // 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("로그아웃 오류:", error);
    }
  };

  // 공유 핸들러
  const handleShare = async () => {
    if (!store) {
      return;
    }

    const shareData = {
      title: `${store.name} - Refill Spot`,
      text: `${store.name}\n${store.address}\n무한리필 가게 정보를 확인해보세요!`,
      url: window.location.href,
    };

    try {
      // Web Share API 지원 확인 (주로 모바일)
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare(shareData)
      ) {
        await navigator.share(shareData);
        return;
      }
    } catch (error) {
      console.error("Web Share API 오류:", error);
    }

    // Web Share API를 지원하지 않는 경우 클립보드로 복사
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "링크 복사 완료",
        description: "가게 링크가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      console.error("클립보드 복사 오류:", error);
      // 클립보드 API도 실패한 경우 fallback
      const textArea = document.createElement("textarea");
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      toast({
        title: "링크 복사 완료",
        description: "가게 링크가 클립보드에 복사되었습니다.",
      });
    }
  };

  // 검색 핸들러
  const handlePlaceSelect = (place: LocationResult) => {
    if (
      !place ||
      !Number.isFinite(place.lat) ||
      !Number.isFinite(place.lng) ||
      place.lat < -90 ||
      place.lat > 90 ||
      place.lng < -180 ||
      place.lng > 180
    ) {
      toast({
        title: "오류",
        description: "유효한 위치 정보를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    router.push(`/map?lat=${place.lat}&lng=${place.lng}&distance=5`);
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-busy="true"
      >
        <div className="motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="sr-only">가게 정보를 불러오는 중입니다.</span>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            가게를 찾을 수 없습니다
          </h2>
          <Button onClick={handleGoBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            돌아가기
          </Button>
        </div>
      </div>
    );
  }

  const photos =
    store.imageUrls?.map((url) => url.trim()).filter(Boolean) || [];
  const distance = store.distance?.trim();
  const distanceLabel =
    distance && /^\d+(?:\.\d+)?$/.test(distance) ? `${distance}km` : distance;
  const rating =
    typeof store.avgRating === "number" &&
    Number.isFinite(store.avgRating) &&
    store.avgRating > 0
      ? store.avgRating
      : null;
  const saved = isFavorite(store.id);
  const handlePhotoError = (url: string) => {
    setFailedImages((previous) => new Set(previous).add(url));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 헤더 */}
      <header className="bg-background border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-3 md:gap-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoBack}
              aria-label="이전 페이지로 돌아가기"
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>

            {/* 중간: 로고 + 프로젝트명 + 검색창 */}
            <div className="contents">
              <button
                onClick={() => router.push("/map")}
                className="flex items-center space-x-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Refill Spot 가게 지도"
              >
                <div className="bg-primary rounded-lg p-2">
                  <svg
                    className="w-5 h-5 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <div>
                  <span className="text-base font-semibold text-foreground md:text-lg">
                    Refill Spot
                  </span>
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    우리 동네 무한리필 찾기
                  </p>
                </div>
              </button>
              <SearchInput
                className="order-last w-full md:order-none md:min-w-0 md:flex-1 md:max-w-xl"
                onPlaceSelect={handlePlaceSelect}
                placeholder="지역, 주소를 입력하세요"
              />
            </div>

            {/* 오른쪽: 로그인/사용자 정보 */}
            <div className="ml-auto flex flex-shrink-0 items-center gap-3 justify-end">
              {authLoading ? (
                <div className="motion-safe:animate-pulse flex items-center space-x-2">
                  <div className="h-8 w-8 bg-muted rounded-full"></div>
                  <div className="h-4 w-16 bg-muted rounded hidden md:block"></div>
                </div>
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="relative"
                      aria-label="내 계정 메뉴"
                    >
                      <User className="h-5 w-5" />
                      {profile?.username && (
                        <span className="ml-2 hidden md:inline">
                          {profile.username}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <button
                        onClick={() => router.push("/profile")}
                        className="w-full flex items-center"
                      >
                        <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
                        프로필 설정
                      </button>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <button
                        onClick={() => router.push("/my-reviews")}
                        className="w-full flex items-center"
                      >
                        <Star className="h-4 w-4 mr-2 text-primary" />
                        내가 작성한 리뷰
                      </button>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <button
                        onClick={() => router.push("/favorites")}
                        className="w-full flex items-center"
                      >
                        <Heart className="h-4 w-4 mr-2 text-primary" />
                        즐겨찾기한 가게 보기
                      </button>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <button
                        onClick={() => router.push("/")}
                        className="w-full flex items-center"
                      >
                        <Map className="h-4 w-4 mr-2" />
                        지도로 돌아가기
                      </button>
                    </DropdownMenuItem>
                    {profile?.is_admin === true && (
                      <>
                        <DropdownMenuItem asChild>
                          <button
                            onClick={() => router.push("/admin/announcements")}
                            className="w-full flex items-center text-primary"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            공지사항 관리
                          </button>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <button
                            onClick={() => router.push("/admin/contacts")}
                            className="w-full flex items-center text-primary"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            문의 관리
                          </button>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center text-destructive"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        로그아웃
                      </button>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={() => {
                    const currentUrl =
                      window.location.pathname + window.location.search;
                    router.push(
                      `/login?returnUrl=${encodeURIComponent(currentUrl)}`,
                    );
                  }}
                  variant="outline"
                  size="sm"
                >
                  로그인
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="w-full pt-4 md:pt-6">
        <div className="space-y-6">
          {/* 매장 사진과 방문 정보 */}
          <div className="max-w-4xl mx-auto px-4">
            <figure>
              {photos.length > 0 ? (
                <Carousel
                  className="overflow-hidden rounded-xl bg-muted"
                  aria-label="매장 사진"
                >
                  <CarouselContent>
                    {photos.map((url, index) => (
                      <CarouselItem
                        key={`${url}-${index}`}
                        aria-label={`사진 ${index + 1} / ${photos.length}`}
                      >
                        {failedImages.has(url) ? (
                          <div className="flex h-56 flex-col items-center justify-center gap-3 text-muted-foreground sm:h-72 md:h-96">
                            <Utensils className="h-8 w-8" aria-hidden="true" />
                            <p className="text-sm">
                              사진을 불러올 수 없습니다.
                            </p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="relative block h-56 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ring sm:h-72 md:h-96"
                            onClick={(event) => {
                              photoTriggerRef.current = event.currentTarget;
                              setPhotoIndex(index);
                            }}
                            aria-label={`${store.name} 사진 ${index + 1} 크게 보기`}
                          >
                            <Image
                              src={url}
                              alt={`${store.name} 사진 ${index + 1}`}
                              fill
                              sizes="(max-width: 768px) 100vw, 864px"
                              className="object-cover"
                              unoptimized
                              loading={index === 0 ? "eager" : "lazy"}
                              onError={() => handlePhotoError(url)}
                            />
                            <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground">
                              <Expand
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              크게 보기
                            </span>
                          </button>
                        )}
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {photos.length > 1 && (
                    <>
                      <CarouselPrevious
                        className="left-3 h-10 w-10 shadow-none"
                        aria-label="이전 매장 사진"
                      />
                      <CarouselNext
                        className="right-3 h-10 w-10 shadow-none"
                        aria-label="다음 매장 사진"
                      />
                    </>
                  )}
                </Carousel>
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted px-4 py-8 text-center text-muted-foreground">
                  <Utensils className="h-8 w-8" aria-hidden="true" />
                  <p className="text-sm">아직 등록된 매장 사진이 없습니다.</p>
                  <p className="text-xs">
                    메뉴와 방문 정보를 아래에서 확인해보세요.
                  </p>
                </div>
              )}
              {photos.length > 0 && (
                <figcaption className="mt-2 text-xs text-muted-foreground">
                  매장 사진 {photos.length}장 · 사진을 눌러 크게 볼 수 있어요
                </figcaption>
              )}
            </figure>

            <Card className="mt-4 border-border shadow-none">
              <CardContent className="space-y-4 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 basis-48">
                    <h1 className="break-words text-2xl font-semibold leading-snug md:text-3xl">
                      {store.name}
                    </h1>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                      {rating !== null && (
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <Star
                            className="h-4 w-4 fill-primary text-primary"
                            aria-hidden="true"
                          />
                          {rating.toFixed(1)}
                          <span className="text-xs font-normal text-muted-foreground">
                            자체 리뷰 평점
                          </span>
                        </span>
                      )}
                      {typeof store.reviewCount === "number" && (
                        <a
                          href="#reviews-section"
                          className="rounded-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          자체 리뷰 {store.reviewCount}개
                        </a>
                      )}
                      {rating === null && (
                        <span className="text-muted-foreground">
                          {store.reviewCount === 0
                            ? "아직 작성된 자체 리뷰가 없습니다"
                            : "자체 리뷰 평점 정보 없음"}
                        </span>
                      )}
                      {distanceLabel && (
                        <span className="font-medium text-muted-foreground">
                          {distanceLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <ExternalRatings ratings={store.rating} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-10 gap-1.5 ${saved ? "border-primary text-primary" : ""}`}
                      onClick={handleToggleFavorite}
                      aria-label={`${store.name} 즐겨찾기 ${saved ? "해제" : "추가"}`}
                      aria-pressed={saved}
                    >
                      <Heart
                        className={`h-4 w-4 ${saved ? "fill-primary text-primary" : ""}`}
                        aria-hidden="true"
                      />
                      {saved ? "저장됨" : "저장"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 gap-1.5"
                      onClick={handleShare}
                      aria-label={`${store.name} 공유`}
                    >
                      <Share className="h-4 w-4" aria-hidden="true" />
                      공유
                    </Button>
                    <Button
                      size="sm"
                      className="h-10 gap-1.5"
                      onClick={() => setShowReviewDialog(true)}
                    >
                      <Star className="h-4 w-4" aria-hidden="true" />
                      리뷰 작성
                    </Button>
                  </div>
                </div>
                <address className="flex items-start gap-2 text-sm not-italic text-muted-foreground">
                  <MapPin
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span>{store.address}</span>
                </address>
                <div className="flex flex-wrap items-center gap-2">
                  {store.categories.map((category, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs font-normal"
                    >
                      {category}
                    </Badge>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto gap-1.5"
                    onClick={handleViewInNaverMap}
                  >
                    <MapPin
                      className="h-4 w-4 text-primary"
                      aria-hidden="true"
                    />
                    네이버 길찾기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 메뉴와 가격 */}
          <section
            className="max-w-4xl mx-auto px-4"
            aria-labelledby="menu-prices-heading"
          >
            <Card className="border-border shadow-none">
              <CardHeader>
                <CardTitle
                  id="menu-prices-heading"
                  className="flex items-center gap-2 text-lg"
                >
                  <Utensils
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                  무한리필 메뉴와 가격
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div id="store-menu-list" className="space-y-2">
                  {store.refillItems && store.refillItems.length > 0 ? (
                    [...store.refillItems]
                      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
                      .slice(0, showAllMenus ? store.refillItems.length : 3)
                      .map((item: MenuItem, index: number) => (
                        <div
                          key={index}
                          className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/40 p-4"
                        >
                          <div className="min-w-0 flex-1 basis-40">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="break-words font-medium text-foreground">
                                {item.name}
                              </span>
                              {item.is_recommended && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs font-normal"
                                >
                                  추천
                                </Badge>
                              )}
                            </div>
                            {item.type && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.type}
                              </p>
                            )}
                          </div>
                          <span className="break-words text-lg font-semibold text-primary">
                            {item.price?.trim() || "가격 정보 없음"}
                          </span>
                        </div>
                      ))
                  ) : (
                    <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                      등록된 메뉴·가격 정보가 없습니다.
                    </p>
                  )}
                </div>
                {store.refillItems && store.refillItems.length > 3 && (
                  <div className="mt-4 text-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowAllMenus(!showAllMenus)}
                      className="gap-1.5 text-primary"
                      aria-expanded={showAllMenus}
                      aria-controls="store-menu-list"
                    >
                      {showAllMenus ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                      {showAllMenus ? "메뉴 접기" : "모든 메뉴 보기"}
                    </Button>
                  </div>
                )}
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  가격과 이용 조건은 방문 전 매장에 확인해주세요.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* 운영 정보 */}
          <div className="max-w-4xl mx-auto px-4">
            <Card className="border-border shadow-none">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock
                      className="w-5 h-5 text-primary"
                      aria-hidden="true"
                    />
                    운영 정보
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => setShowNaverPlatform(true)}
                      variant="outline"
                      className="text-foreground"
                      size="sm"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      네이버 평점
                    </Button>
                    <Button
                      onClick={() => setShowKakaoPlatform(true)}
                      variant="outline"
                      className="text-foreground"
                      size="sm"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      카카오 평점
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 주소 */}
                <div className="flex items-start gap-3">
                  <MapPin
                    className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h4 className="font-medium text-foreground mb-1">주소</h4>
                    <p className="text-muted-foreground text-sm">
                      {store.address}
                    </p>
                  </div>
                </div>

                {/* 전화번호 */}
                {store.phoneNumber && (
                  <div className="flex items-start gap-3">
                    <Phone
                      className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">
                        전화번호
                      </h4>
                      <p className="text-muted-foreground text-sm">
                        {store.phoneNumber}
                      </p>
                    </div>
                  </div>
                )}

                {/* 카테고리 */}
                <div className="flex items-start gap-3">
                  <Utensils
                    className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h4 className="font-medium text-foreground mb-2">
                      카테고리
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {store.categories.map((category, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs"
                        >
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 운영시간 */}
                {store.openHours && (
                  <div className="flex items-start gap-3">
                    <Clock
                      className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-foreground mb-1">
                          운영시간
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllHours(!showAllHours)}
                          className="h-10 w-10 p-2 text-muted-foreground hover:text-primary"
                          aria-label={
                            showAllHours
                              ? "주간 운영시간 접기"
                              : "주간 운영시간 보기"
                          }
                          aria-expanded={showAllHours}
                          aria-controls="store-business-hours"
                        >
                          {showAllHours ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <div
                        id="store-business-hours"
                        className="text-foreground text-sm"
                      >
                        {showAllHours ? (
                          <div className="space-y-3">
                            {(() => {
                              // 운영시간 파싱 로직
                              const parseBusinessHours = () => {
                                if (!store.openHours) {
                                  return [];
                                }

                                const hoursString = store.openHours;
                                const dayPatterns = [
                                  "월",
                                  "화",
                                  "수",
                                  "목",
                                  "금",
                                  "토",
                                  "일",
                                ];
                                const parsedHours = [];

                                // 라스트오더 정보 추출
                                const lastOrderMatch =
                                  hoursString.match(
                                    /\(라스트오더:\s*([^)]+)\)/,
                                  );
                                const lastOrderTime = lastOrderMatch
                                  ? lastOrderMatch[1].trim()
                                  : null;

                                // 휴무일 정보 확인
                                const closedDays = [];
                                if (hoursString.includes("휴무")) {
                                  const closedMatch =
                                    hoursString.match(
                                      /매주\s*([가-힣]+)요일\s*휴무/,
                                    );
                                  if (closedMatch) {
                                    const closedDayName = closedMatch[1];
                                    closedDays.push(closedDayName);
                                  }
                                }

                                // 각 요일별로 시간 정보 파싱
                                for (const day of dayPatterns) {
                                  // 휴무일인지 확인
                                  if (closedDays.includes(day)) {
                                    parsedHours.push({
                                      day,
                                      hours: "휴무",
                                      isClosed: true,
                                      lastOrder: null,
                                    });
                                    continue;
                                  }

                                  // "월: 11:30-23:30" 패턴 찾기
                                  const regex = new RegExp(
                                    `${day}:\\s*([\\d:]+\\s*-\\s*[\\d:]+)`,
                                  );
                                  const match = hoursString.match(regex);

                                  if (match) {
                                    let hours = match[1].trim();

                                    // 24시간 표기법 처리 (00:00-24:00)
                                    if (hours.includes("00:00-24:00")) {
                                      hours = "24시간 영업";
                                    }

                                    parsedHours.push({
                                      day,
                                      hours,
                                      isClosed: false,
                                      lastOrder: lastOrderTime,
                                    });
                                  } else {
                                    // 해당 요일이 없으면 정보 없음으로 처리
                                    parsedHours.push({
                                      day,
                                      hours: "정보 없음",
                                      isClosed: false,
                                      lastOrder: null,
                                    });
                                  }
                                }

                                return parsedHours;
                              };

                              const businessHours = parseBusinessHours();
                              const today = new Date().getDay();
                              const days = [
                                "일",
                                "월",
                                "화",
                                "수",
                                "목",
                                "금",
                                "토",
                              ];
                              const todayName = days[today];
                              if (
                                businessHours.every(
                                  (item) => item.hours === "정보 없음",
                                )
                              ) {
                                return (
                                  <p className="whitespace-pre-line">
                                    {store.openHours}
                                  </p>
                                );
                              }

                              return businessHours.map((item, index) => (
                                <div
                                  key={index}
                                  className={`p-3 rounded-lg border ${
                                    item.day === todayName
                                      ? "border-primary/40 bg-primary/5"
                                      : "border-border bg-muted/40"
                                  }`}
                                >
                                  <div className="flex flex-wrap justify-between items-start gap-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-semibold ${
                                          item.day === todayName
                                            ? "text-primary"
                                            : "text-foreground"
                                        }`}
                                      >
                                        {item.day}요일
                                      </span>
                                      {item.day === todayName && (
                                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                          오늘
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div
                                        className={`font-medium ${
                                          item.isClosed
                                            ? "text-muted-foreground"
                                            : "text-foreground"
                                        }`}
                                      >
                                        {item.hours}
                                      </div>
                                      {item.lastOrder && !item.isClosed && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          라스트오더: {item.lastOrder}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        ) : (
                          <div>
                            {(() => {
                              const today = new Date().getDay();
                              const days = [
                                "일",
                                "월",
                                "화",
                                "수",
                                "목",
                                "금",
                                "토",
                              ];
                              const todayName = days[today];

                              // 오늘 요일에 해당하는 운영시간 찾기
                              const regex = new RegExp(
                                `${todayName}:\\s*([\\d:]+\\s*-\\s*[\\d:]+)`,
                              );
                              const match = store.openHours.match(regex);

                              // 라스트오더 정보 추출
                              const lastOrderMatch =
                                store.openHours.match(
                                  /\(라스트오더:\s*([^)]+)\)/,
                                );
                              const lastOrderTime = lastOrderMatch
                                ? lastOrderMatch[1].trim()
                                : null;

                              return (
                                <div>
                                  <span className="font-medium text-primary">
                                    {match
                                      ? `오늘 (${todayName})`
                                      : "등록된 운영시간"}
                                  </span>
                                  <br />
                                  {match ? (
                                    <div>
                                      {match[1]}
                                      {lastOrderTime && (
                                        <span className="text-muted-foreground ml-2">
                                          (라스트오더: {lastOrderTime})
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="whitespace-pre-line">
                                      {store.openHours}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 이미지 갤러리 */}
          {photos.length > 1 && (
            <div className="max-w-4xl mx-auto px-4">
              <Card className="border-border shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">추가 사진</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.slice(1).map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        className="aspect-square relative rounded-lg overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={(event) => {
                          photoTriggerRef.current = event.currentTarget;
                          setPhotoIndex(index + 1);
                        }}
                        aria-label={`${store.name} 사진 ${index + 2} 크게 보기`}
                        disabled={failedImages.has(url)}
                      >
                        {failedImages.has(url) ? (
                          <span className="flex h-full items-center justify-center px-3 text-xs text-muted-foreground">
                            사진을 불러올 수 없습니다.
                          </span>
                        ) : (
                          <Image
                            src={url}
                            alt={`${store.name} 사진 ${index + 2}`}
                            fill
                            sizes="(max-width: 768px) 50vw, 288px"
                            className="object-cover"
                            unoptimized
                            loading="lazy"
                            onError={() => handlePhotoError(url)}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 리뷰 섹션 */}
          <div className="max-w-4xl mx-auto px-4">
            <div id="reviews-section" className="scroll-mt-36">
              <StoreReviews
                storeId={store.id}
                storeName={store.name}
                key={refreshReviews}
                onReviewChanged={handleReviewChanged}
              />
            </div>
          </div>
        </div>
      </main>

      <Dialog
        open={photoIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPhotoIndex(null);
          }
        }}
      >
        <DialogContent
          className="max-h-[95dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto rounded-xl border-border bg-card p-4 shadow-none md:p-6"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            photoTriggerRef.current?.focus();
          }}
        >
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>{store.name} 사진</DialogTitle>
            <DialogDescription>
              등록된 사진 {photos.length}장입니다. 좌우 버튼 또는 방향키로
              사진을 넘길 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          {photoIndex !== null && (
            <Carousel
              opts={{ startIndex: photoIndex }}
              aria-label="전체 매장 사진"
            >
              <CarouselContent>
                {photos.map((url, index) => (
                  <CarouselItem
                    key={`${url}-${index}`}
                    aria-label={`사진 ${index + 1} / ${photos.length}`}
                  >
                    <div className="relative flex h-[65dvh] items-center justify-center overflow-hidden rounded-lg bg-muted md:h-[72dvh]">
                      {failedImages.has(url) ? (
                        <p className="text-sm text-muted-foreground">
                          사진을 불러올 수 없습니다.
                        </p>
                      ) : (
                        <Image
                          src={url}
                          alt={`${store.name} 전체 사진 ${index + 1}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 1024px"
                          className="object-contain"
                          unoptimized
                          loading="lazy"
                          onError={() => handlePhotoError(url)}
                        />
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {photos.length > 1 && (
                <div className="mt-3 flex justify-center gap-3">
                  <CarouselPrevious
                    className="static h-10 w-10 translate-y-0 shadow-none"
                    aria-label="이전 전체 사진"
                  />
                  <CarouselNext
                    className="static h-10 w-10 translate-y-0 shadow-none"
                    aria-label="다음 전체 사진"
                  />
                </div>
              )}
            </Carousel>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-12">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 로고 및 설명 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="bg-primary rounded-lg p-2">
                  <svg
                    className="w-6 h-6 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Refill Spot
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    우리 동네 무한리필 찾기
                  </p>
                </div>
              </div>
            </div>

            {/* 서비스 링크 */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">서비스</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button
                    onClick={() => router.push("/")}
                    className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    서비스 소개
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => router.push("/map")}
                    className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    가게 찾기
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => router.push("/announcements")}
                    className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    공지사항
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => router.push("/contact")}
                    className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    문의하기
                  </button>
                </li>
              </ul>
            </div>

            {/* 계정 링크 */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">계정</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {user && profile ? (
                  <>
                    <li>
                      <button
                        onClick={() => router.push("/profile")}
                        className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        프로필
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => router.push("/favorites")}
                        className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        즐겨찾기
                      </button>
                    </li>
                  </>
                ) : (
                  <li>
                    <button
                      onClick={() => {
                        const currentUrl =
                          window.location.pathname + window.location.search;
                        router.push(
                          `/login?returnUrl=${encodeURIComponent(currentUrl)}`,
                        );
                      }}
                      className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      로그인 / 회원가입
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* 하단 구분선 및 저작권 */}
          <div className="border-t border-border mt-8 pt-6 space-y-4">
            {/* 약관 링크들 */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                개인정보처리방침
              </a>
              <span>|</span>
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                이용약관
              </a>
              <span>|</span>
              <a
                href="/location-terms"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                위치기반 서비스 이용약관
              </a>
            </div>

            {/* 회사 정보 */}
            <div className="text-center space-y-2 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">
                  (주)리필스팟
                </span>
              </div>
              <div>이메일 문의 : refillspot.official@gmail.com</div>
            </div>

            {/* 저작권 */}
            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                Copyright ⓒ 2025 Refill-spot
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* 리뷰 작성 다이얼로그 */}
      {store && (
        <ReviewWriteDialog
          open={showReviewDialog}
          onOpenChange={setShowReviewDialog}
          storeId={store.id}
          storeName={store.name}
          onReviewSubmitted={handleReviewChanged}
        />
      )}

      {/* 네이버 플랫폼 다이얼로그 */}
      {store && (
        <PlatformViewDialog
          open={showNaverPlatform}
          onOpenChange={setShowNaverPlatform}
          store={store}
          platform="naver"
        />
      )}

      {/* 카카오 플랫폼 다이얼로그 */}
      {store && (
        <PlatformViewDialog
          open={showKakaoPlatform}
          onOpenChange={setShowKakaoPlatform}
          store={store}
          platform="kakao"
        />
      )}

      {/* 로그인 필요 다이얼로그 */}
      <Dialog open={showLoginAlert} onOpenChange={setShowLoginAlert}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>로그인이 필요합니다</DialogTitle>
            <DialogDescription>
              즐겨찾기를 추가하려면 먼저 로그인해주세요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoginAlert(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                const currentUrl =
                  window.location.pathname + window.location.search;
                router.push(
                  `/login?returnUrl=${encodeURIComponent(currentUrl)}`,
                );
              }}
            >
              로그인하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

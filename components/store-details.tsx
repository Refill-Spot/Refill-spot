"use client";

import { ExternalRatings } from "@/components/external-ratings";
import { PlatformViewDialog } from "@/components/platform-view-dialog";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { shouldBeUnoptimized } from "@/lib/image-utils";
import { useStoreStore } from "@/lib/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MenuItem } from "@/types/menu";
import { FormattedReview } from "@/types/store";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Expand,
  Heart,
  MapPin,
  Navigation,
  Phone,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface StoreDetailsProps {
  storeId: number;
}

export default function StoreDetails({ storeId }: StoreDetailsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const {
    currentStore,
    storeLoading,
    reviews,
    fetchStoreById,
    fetchReviews,
    toggleFavorite,
    saveReview,
  } = useStoreStore();
  const [userReview, setUserReview] = useState({ rating: 0, content: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [uploading, setUploading] = useState(false);
  // liveRating 관련 상태들 제거 - 자체 리뷰 시스템 사용
  const [showAllHours, setShowAllHours] = useState(false);
  const [externalPlatform, setExternalPlatform] = useState<
    "naver" | "kakao" | null
  >(null);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const photoTriggerRef = useRef<HTMLButtonElement | null>(null);

  // 관리자 여부 (user_metadata.role 기반)
  const isAdmin = user && user.user_metadata?.role === "admin";

  // 가게 정보 및 리뷰 로드
  useEffect(() => {
    fetchStoreById(storeId);
  }, [storeId, fetchStoreById]);

  // 네이버 지도로 이동
  const handleViewInNaverMap = () => {
    if (!currentStore) {
      return;
    }

    const storeName = encodeURIComponent(currentStore.name);

    // 네이버 지도 앱 딥링크 (먼저 시도)
    const naverMapUrl = `nmap://place?name=${storeName}&appname=com.refillspot.app`;
    window.location.href = naverMapUrl;

    // 앱이 실행되지 않으면 최신 웹 URL로 리다이렉트 (1초 후)
    setTimeout(() => {
      window.location.href = `https://map.naver.com/p/search/${storeName}?c=15.00,0,0,0,dh&isCorrectAnswer=true&locale=ko`;
    }, 1000);
  };

  // 즐겨찾기 상태 확인
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setIsFavorite(false);
    const checkFavoriteStatus = async () => {
      if (!user || !currentStore) {
        return;
      }

      const { data, error } = await supabaseBrowser
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("store_id", currentStore.id)
        .abortSignal(controller.signal)
        .maybeSingle();

      if (active) {
        setIsFavorite(!error && Boolean(data));
      }
    };

    checkFavoriteStatus();
    return () => {
      active = false;
      controller.abort();
    };
  }, [user, currentStore]);

  // 사용자의 리뷰가 있는지 확인
  useEffect(() => {
    if (user && reviews.length > 0) {
      const existingReview = reviews.find(
        (review: FormattedReview) => review.user.id === user.id,
      );

      if (existingReview) {
        setUserReview({
          rating: existingReview.rating,
          content: existingReview.content,
        });
      }
    }
  }, [reviews, user]);

  // 실시간 평점 조회 제거 - 자체 리뷰 시스템 사용

  // 즐겨찾기 토글
  const handleToggleFavorite = async () => {
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "즐겨찾기 기능을 사용하려면 로그인해주세요.",
      });
      const currentUrl = window.location.pathname + window.location.search;
      router.push(`/login?returnUrl=${encodeURIComponent(currentUrl)}`);
      return;
    }

    if (!currentStore) {
      toast({
        title: "오류",
        description: "가게 정보를 불러올 수 없습니다.",
      });
      return;
    }

    try {
      await toggleFavorite(currentStore.id, user.id);
      setIsFavorite(!isFavorite);

      toast({
        title: isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가",
        description: isFavorite
          ? "즐겨찾기에서 삭제되었습니다."
          : "즐겨찾기에 추가되었습니다.",
      });
    } catch (error) {
      console.error("즐겨찾기 오류:", error);
      toast({
        title: "오류",
        description: "즐겨찾기 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 리뷰 제출
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "로그인 필요",
        description: "리뷰를 작성하려면 로그인해주세요.",
      });
      const currentUrl = window.location.pathname + window.location.search;
      router.push(`/login?returnUrl=${encodeURIComponent(currentUrl)}`);
      return;
    }

    if (!currentStore) {
      toast({
        title: "오류",
        description: "가게 정보를 불러올 수 없습니다.",
      });
      return;
    }

    if (userReview.rating < 1 || userReview.rating > 5) {
      toast({
        title: "평점 오류",
        description: "평점은 1에서 5 사이의 값이어야 합니다.",
      });
      return;
    }

    if (!userReview.content.trim()) {
      toast({
        title: "내용 오류",
        description: "리뷰 내용을 입력해주세요.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await saveReview(currentStore.id, userReview.rating, userReview.content);
      toast({
        title: "리뷰 저장",
        description: "리뷰가 성공적으로 저장되었습니다.",
      });
    } catch (error) {
      console.error("리뷰 제출 오류:", error);
      toast({
        title: "오류",
        description: "리뷰 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 이미지 업로드 핸들러
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (
      !e.target.files ||
      e.target.files.length === 0 ||
      !currentStore ||
      uploading
    ) {
      return;
    }
    if ((currentStore.imageUrls?.length || 0) >= 3) {
      toast({
        title: "업로드 실패",
        description: "가게 사진은 최대 3장까지 추가할 수 있습니다.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    const file = e.target.files[0];
    let uploadCompleted = false;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/stores/${currentStore.id}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && typeof data.url === "string" && data.url) {
        uploadCompleted = true;
        // imageUrls에 추가 (최대 3장)
        const newUrls = [...(currentStore.imageUrls || []), data.url];
        // DB 업데이트
        const { data: updatedStore, error: updateError } = await supabaseBrowser
          .from("stores")
          .update({ image_urls: newUrls })
          .eq("id", currentStore.id)
          .select("id")
          .maybeSingle();
        if (updateError || !updatedStore) {
          throw new Error("매장 사진 저장에 실패했습니다.");
        }
        // UI 갱신
        fetchStoreById(currentStore.id);
        toast({
          title: "업로드 성공",
          description: "이미지가 추가되었습니다.",
        });
      } else {
        toast({
          title: "업로드 실패",
          description: data.error || "오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "업로드 오류",
        description: uploadCompleted
          ? "파일은 업로드되었지만 매장 사진 저장을 확인하지 못했습니다. 연결되지 않은 업로드 파일은 저장소에 남아 있습니다."
          : "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleBack = () => {
    router.back();
  };

  // 리뷰 삭제 핸들러
  const handleDeleteReview = async (reviewId: number) => {
    if (!user || !currentStore) {
      return;
    }
    if (!window.confirm("정말로 이 리뷰를 삭제하시겠습니까?")) {
      return;
    }
    try {
      const res = await fetch(
        `/api/stores/${currentStore.id}/reviews?reviewId=${reviewId}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast({ title: "리뷰 삭제", description: "리뷰가 삭제되었습니다." });
        fetchReviews(currentStore.id);
      } else {
        toast({
          title: "삭제 실패",
          description: data.error || "오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "삭제 오류",
        description: String(err),
        variant: "destructive",
      });
    }
  };

  if (storeLoading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-primary"
          role="status"
        >
          <span className="sr-only">로딩 중...</span>
        </div>
      </div>
    );
  }

  if (!currentStore) {
    return (
      <section className="p-8 text-center" aria-live="assertive">
        <p>가게 정보를 불러올 수 없습니다.</p>
      </section>
    );
  }

  // 평균 평점 계산
  const avgRating =
    reviews.length > 0
      ? reviews.reduce(
          (sum: number, review: FormattedReview) => sum + review.rating,
          0,
        ) / reviews.length
      : 0;

  // 별점 렌더링 도우미 함수
  const renderStars = (rating: number, maxStars = 5) => {
    return Array.from({ length: maxStars }).map((_, i) => (
      <Star
        key={i}
        className={`h-5 w-5 ${
          i < Math.floor(rating)
            ? "fill-primary text-primary"
            : i < rating
              ? "fill-primary/50 text-primary"
              : "fill-none text-muted-foreground/40"
        }`}
        aria-hidden="true"
      />
    ));
  };

  // store는 여기서 확실히 null이 아님
  const storeData = currentStore;
  const photos =
    storeData.imageUrls?.map((url) => url.trim()).filter(Boolean) || [];
  const distance = storeData.distance?.trim();
  const distanceLabel =
    distance && /^\d+(?:\.\d+)?$/.test(distance) ? `${distance}km` : distance;
  const handlePhotoError = (url: string) => {
    setFailedImages((previous) => new Set(previous).add(url));
  };

  // 요일 배열 (Date 객체의 getDay() 순서와 맞춤: 일요일=0)
  const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  // 현재 요일 구하기
  const today = new Date();
  const todayDayOfWeek = DAYS_OF_WEEK[today.getDay()];

  // openHours 문자열을 파싱하여 요일별 시간 정보로 변환
  const parseBusinessHours = () => {
    if (!storeData.openHours) {
      return [];
    }

    const hoursString = storeData.openHours;
    const dayPatterns = ["월", "화", "수", "목", "금", "토", "일"];
    const parsedHours = [];

    // 라스트오더 정보 추출
    const lastOrderMatch = hoursString.match(/\(라스트오더:\s*([^)]+)\)/);
    const lastOrderTime = lastOrderMatch ? lastOrderMatch[1].trim() : null;

    // 휴무일 정보 확인
    const closedDays = [];
    if (hoursString.includes("휴무")) {
      // "매주 일요일 휴무" 패턴 찾기
      const closedMatch = hoursString.match(/매주\s*([가-힣]+)요일\s*휴무/);
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
      const regex = new RegExp(`${day}:\\s*([\\d:]+\\s*-\\s*[\\d:]+)`);
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

    return parsedHours.every((item) => item.hours === "정보 없음")
      ? []
      : parsedHours;
  };

  const businessHours = parseBusinessHours();

  // 오늘 요일의 영업시간 가져오기
  const getTodayHours = () => {
    const todayInfo = businessHours.find((h) => h.day === todayDayOfWeek);
    if (!todayInfo) {
      return storeData.openHours || "영업시간 정보가 없습니다.";
    }

    if (todayInfo.isClosed) {
      return "오늘은 휴무일입니다.";
    }
    return todayInfo.hours;
  };

  return (
    <article className="bg-background text-foreground min-h-screen">
      <header className="sticky top-0 z-30 bg-background p-3 md:p-4 flex items-center gap-2 border-b border-border">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">뒤로 가기</span>
        </Button>
        <h1 className="min-w-0 text-base font-semibold leading-snug md:text-lg">
          {storeData.name}
        </h1>
      </header>

      <Dialog
        open={photoIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPhotoIndex(null);
          }
        }}
      >
        <DialogContent
          className="max-h-[95dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto rounded-lg border-border bg-card p-4 shadow-none md:p-6"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            photoTriggerRef.current?.focus();
          }}
        >
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>{storeData.name} 사진</DialogTitle>
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
                {photos.map((url, idx) => (
                  <CarouselItem
                    key={`${url}-${idx}`}
                    aria-label={`사진 ${idx + 1} / ${photos.length}`}
                  >
                    <div className="relative flex h-[65dvh] items-center justify-center overflow-hidden rounded-lg bg-muted md:h-[72dvh]">
                      {failedImages.has(url) ? (
                        <p className="text-sm text-muted-foreground">
                          사진을 불러올 수 없습니다.
                        </p>
                      ) : (
                        <Image
                          src={url}
                          alt={`${storeData.name} 전체 사진 ${idx + 1}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 1024px"
                          className="object-contain"
                          unoptimized={shouldBeUnoptimized(
                            undefined,
                            undefined,
                            url,
                          )}
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

      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <section aria-labelledby="store-info" className="pb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-48">
              <h2
                id="store-info"
                className="break-words text-2xl font-semibold leading-snug md:text-3xl"
              >
                {storeData.name}
              </h2>
              {storeData.categories.length > 0 && (
                <p
                  className="mt-2 text-sm text-muted-foreground"
                  aria-label="카테고리"
                >
                  {storeData.categories.join(" · ")}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" aria-hidden="true" />
                  자체 리뷰 평점 {avgRating > 0 ? avgRating.toFixed(1) : "없음"}
                </span>
                <span>자체 리뷰 {reviews.length}개</span>
                {distanceLabel && <span>{distanceLabel}</span>}
              </div>
              <section className="mt-3" aria-label="외부 플랫폼 정보">
                <ExternalRatings ratings={storeData.rating} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-green-700 text-white hover:bg-green-800"
                    onClick={() => setExternalPlatform("naver")}
                  >
                    <span className="mr-2 font-black" aria-hidden="true">
                      N
                    </span>
                    네이버에서 리뷰 확인
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#FEE500] text-gray-950 hover:bg-yellow-300"
                    onClick={() => setExternalPlatform("kakao")}
                  >
                    <MapPin className="mr-2 h-4 w-4" aria-hidden="true" />
                    카카오맵에서 리뷰 확인
                  </Button>
                </div>
                {externalPlatform && (
                  <PlatformViewDialog
                    open
                    onOpenChange={(open) => {
                      if (!open) {
                        setExternalPlatform(null);
                      }
                    }}
                    store={storeData}
                    platform={externalPlatform}
                  />
                )}
              </section>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={`h-10 gap-1.5 ${isFavorite ? "border-primary text-primary" : ""}`}
              onClick={handleToggleFavorite}
              aria-label={`${storeData.name} 즐겨찾기 ${isFavorite ? "해제" : "추가"}`}
              aria-pressed={isFavorite}
            >
              <Heart
                className={`h-4 w-4 ${isFavorite ? "fill-primary" : ""}`}
                aria-hidden="true"
              />
              {isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="refill-menu-heading"
          className="border-t border-border py-6"
        >
          <h3 id="refill-menu-heading" className="mb-3 text-lg font-semibold">
            무한리필 메뉴와 가격
          </h3>
          {storeData.refillItems &&
          Array.isArray(storeData.refillItems) &&
          storeData.refillItems.length > 0 ? (
            <dl className="divide-y divide-border">
              {storeData.refillItems.map((item: MenuItem, index: number) => (
                <div
                  key={index}
                  className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-3"
                >
                  <dt className="min-w-0 flex-1 basis-40">
                    <span className="break-words font-medium">{item.name}</span>
                    {item.is_recommended && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        추천
                      </span>
                    )}
                    {item.type && (
                      <span className="mt-1 block whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                        {item.type}
                      </span>
                    )}
                  </dt>
                  <dd className="max-w-full whitespace-pre-line break-words text-right text-lg font-semibold tabular-nums">
                    {item.price?.trim() || "가격 정보 없음"}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">
              등록된 메뉴·가격 정보가 없습니다.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            가격과 이용 조건은 방문 전 매장에 확인해주세요.
          </p>
        </section>

        <section
          aria-labelledby="visit-info-heading"
          className="border-t border-border py-6"
        >
          <h3 id="visit-info-heading" className="mb-4 text-lg font-semibold">
            위치와 방문 정보
          </h3>
          <dl className="space-y-5 text-sm">
            <div className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-4">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                주소
              </dt>
              <dd className="min-w-0">
                <address className="break-words not-italic leading-relaxed">
                  {storeData.address}
                </address>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 gap-1.5"
                    onClick={handleViewInNaverMap}
                  >
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                    네이버 길찾기
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 gap-1.5"
                    onClick={() => {
                      // 카카오 지도 앱으로 연결
                      const kakaoMapUrl = `kakaomap://look?p=${storeData.position.lat},${storeData.position.lng}`;
                      window.location.href = kakaoMapUrl;

                      // 앱이 설치되어 있지 않은 경우를 위한 대체 URL (1초 후)
                      setTimeout(() => {
                        window.location.href = `https://map.kakao.com/link/to/${encodeURIComponent(
                          storeData.name,
                        )},${storeData.position.lat},${storeData.position.lng}`;
                      }, 1000);
                    }}
                  >
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                    카카오 길찾기
                  </Button>
                </div>
              </dd>
            </div>
            <div className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-4">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" aria-hidden="true" />
                전화번호
              </dt>
              <dd className="break-words">
                {storeData.phoneNumber || "전화번호 정보가 없습니다."}
              </dd>
            </div>
            <div className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-4">
              <dt className="flex items-start gap-2 text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4" aria-hidden="true" />
                영업시간
              </dt>
              <dd className="min-w-0">
                <div id="store-business-hours">
                  {!showAllHours || businessHours.length === 0 ? (
                    <>
                      <h4 className="mb-1 font-medium">
                        {businessHours.length > 0
                          ? `오늘(${todayDayOfWeek})의 영업시간`
                          : "등록된 영업시간"}
                      </h4>
                      <p className="whitespace-pre-line leading-relaxed">
                        {getTodayHours()}
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="mb-2 font-medium">주간 영업시간</h4>
                      <div className="divide-y divide-border">
                        {businessHours.map((item, index) => (
                          <div
                            key={index}
                            className="flex flex-wrap items-start justify-between gap-2 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  item.day === todayDayOfWeek
                                    ? "font-semibold"
                                    : ""
                                }
                              >
                                {item.day}요일
                              </span>
                              {item.day === todayDayOfWeek && (
                                <span className="text-xs text-muted-foreground">
                                  오늘
                                </span>
                              )}
                            </div>
                            <div className="text-right tabular-nums">
                              <p
                                className={
                                  item.isClosed ? "text-muted-foreground" : ""
                                }
                              >
                                {item.hours}
                              </p>
                              {item.lastOrder && !item.isClosed && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  라스트오더: {item.lastOrder}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        * 실제 영업시간은 매장 사정에 따라 변경될 수 있습니다.
                      </p>
                    </>
                  )}
                </div>
                {businessHours.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllHours(!showAllHours)}
                    className="mt-2 h-10 gap-2 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    aria-expanded={showAllHours}
                    aria-controls="store-business-hours"
                  >
                    {showAllHours ? "간단히 보기" : "전체 영업시간 보기"}
                    {showAllHours ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="store-photos-heading"
          className="border-t border-border py-6"
        >
          <h3 id="store-photos-heading" className="mb-4 text-lg font-semibold">
            매장 사진
          </h3>
          {isAdmin && (
            <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
              <label className="block">
                <span className="font-medium">가게 사진 업로드 (최대 3장)</span>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block max-w-full"
                  onChange={handleImageUpload}
                  disabled={
                    uploading || (storeData.imageUrls?.length || 0) >= 3
                  }
                />
              </label>
              {uploading && (
                <span className="text-muted-foreground">업로드 중...</span>
              )}
            </div>
          )}
          <figure>
            {photos.length > 0 ? (
              <Carousel
                className="overflow-hidden bg-muted"
                aria-label="매장 사진"
              >
                <CarouselContent>
                  {photos.map((url, idx) => (
                    <CarouselItem
                      key={`${url}-${idx}`}
                      aria-label={`사진 ${idx + 1} / ${photos.length}`}
                    >
                      {failedImages.has(url) ? (
                        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground sm:h-64">
                          사진을 불러올 수 없습니다.
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="relative block h-48 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ring sm:h-64"
                          onClick={(event) => {
                            photoTriggerRef.current = event.currentTarget;
                            setPhotoIndex(idx);
                          }}
                          aria-label={`${storeData.name} 사진 ${idx + 1} 크게 보기`}
                        >
                          <Image
                            src={url}
                            alt={`${storeData.name} 사진 ${idx + 1}`}
                            fill
                            sizes="(max-width: 768px) 100vw, 848px"
                            className="object-cover"
                            unoptimized={shouldBeUnoptimized(
                              undefined,
                              undefined,
                              url,
                            )}
                            onError={() => handlePhotoError(url)}
                          />
                          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-sm bg-card px-2 py-1.5 text-xs font-medium text-card-foreground">
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
              <p className="text-sm text-muted-foreground">
                아직 등록된 매장 사진이 없습니다.
              </p>
            )}
            {photos.length > 0 && (
              <figcaption className="pt-2 text-xs text-muted-foreground">
                매장 사진 {photos.length}장 · 사진을 눌러 크게 볼 수 있어요
              </figcaption>
            )}
          </figure>
        </section>

        {/* 리뷰 섹션 */}
        <section
          className="border-t border-border py-6"
          aria-labelledby="reviews-heading"
        >
          <h3 id="reviews-heading" className="mb-4 text-lg font-semibold">
            자체 리뷰
          </h3>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4 grid h-11 w-full grid-cols-2 rounded-none border-b border-border bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                모든 리뷰 ({reviews.length})
              </TabsTrigger>
              <TabsTrigger
                value="write"
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                리뷰 작성
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {reviews.length > 0 ? (
                <div className="divide-y divide-border">
                  {reviews.map((review: FormattedReview) => (
                    <article key={review.id} className="py-4 first:pt-0">
                      <header className="flex flex-wrap justify-between items-center gap-2 mb-3">
                        <span className="font-semibold">
                          {review.user.username}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex"
                            role="img"
                            aria-label={`평점 ${review.rating}점`}
                          >
                            {renderStars(review.rating)}
                          </span>
                          <time
                            className="text-xs text-muted-foreground"
                            dateTime={review.createdAt}
                          >
                            {new Date(review.createdAt).toLocaleDateString()}
                          </time>
                          {review.user.id === user?.id && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="ml-2"
                              onClick={() => handleDeleteReview(review.id)}
                            >
                              삭제
                            </Button>
                          )}
                        </div>
                      </header>
                      <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground">
                        {review.content}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    아직 작성된 리뷰가 없습니다.
                  </p>
                  {/* 평균 평점 표시 */}
                  {avgRating > 0 && (
                    <div className="mt-2 flex justify-center items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        자체 리뷰 평균 평점:
                      </span>
                      <div className="flex">{renderStars(avgRating)}</div>
                      <span className="text-sm font-medium">
                        ({avgRating.toFixed(1)})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="write">
              {user ? (
                <form onSubmit={handleSubmitReview} className="space-y-4">
                  <fieldset>
                    <legend className="block mb-2 font-medium">평점</legend>
                    <div className="flex gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setUserReview({ ...userReview, rating: star })
                          }
                          className="rounded-md p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          aria-label={`${star}점`}
                          aria-pressed={star === userReview.rating}
                        >
                          <Star
                            className={`h-8 w-8 ${
                              star <= userReview.rating
                                ? "fill-primary text-primary"
                                : "fill-none text-muted-foreground/40"
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label
                      htmlFor="review-content"
                      className="block mb-2 font-medium"
                    >
                      리뷰 내용
                    </label>
                    <textarea
                      id="review-content"
                      className="w-full bg-card p-3 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring min-h-[150px]"
                      placeholder="이 가게에 대한 리뷰를 작성해주세요."
                      value={userReview.content}
                      onChange={(e) =>
                        setUserReview({
                          ...userReview,
                          content: e.target.value,
                        })
                      }
                      required
                      aria-required="true"
                    ></textarea>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? "처리 중..." : "리뷰 등록"}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    리뷰를 작성하려면 로그인이 필요합니다.
                  </p>
                  <Button variant="outline" asChild>
                    <Link href="/login">로그인하러 가기</Link>
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>

        {/* 외부 링크 */}
        <section
          className="border-t border-border pt-4"
          aria-label="외부 검색 링크"
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              className="h-10 gap-2 text-muted-foreground"
              onClick={() =>
                window.open(
                  `https://search.naver.com/search.naver?query=${encodeURIComponent(
                    storeData.name + " " + storeData.address,
                  )}`,
                  "_blank",
                )
              }
            >
              <span>네이버 검색</span>
            </Button>
            <Button
              variant="ghost"
              className="h-10 gap-2 text-muted-foreground"
              onClick={() =>
                window.open(
                  `https://search.daum.net/search?q=${encodeURIComponent(
                    storeData.name + " " + storeData.address,
                  )}`,
                  "_blank",
                )
              }
            >
              <span>카카오 검색</span>
            </Button>
          </div>
        </section>
      </main>
    </article>
  );
}

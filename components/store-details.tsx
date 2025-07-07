"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreStore } from "@/lib/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { FormattedReview } from "@/types/store";
import { MenuItem } from "@/types/menu";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Navigation,
  Phone,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface StoreDetailsProps {
  storeId: number;
}

export default function StoreDetails({ storeId }: StoreDetailsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const {
    currentStore,
    storeLoading,
    storeError,
    reviews,
    fetchStoreById,
    fetchReviews,
    toggleFavorite,
    addReview,
    updateReview,
  } = useStoreStore();
  const [userReview, setUserReview] = useState({ rating: 0, content: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [liveRating, setLiveRating] = useState<{
    naver: number;
    kakao: number;
    average: number;
  } | null>(null);
  const [liveRatingLoading, setLiveRatingLoading] = useState(false);
  const [liveRatingError, setLiveRatingError] = useState<string | null>(null);
  const [showAllHours, setShowAllHours] = useState(false);

  // 디버깅 로그 추가
  console.log("🔍 [StoreDetails] Component rendered", {
    storeId,
    currentStore: currentStore
      ? {
          id: currentStore.id,
          name: currentStore.name,
          openHours: currentStore.openHours,
          hasOpenHours: !!currentStore.openHours,
          openHoursType: typeof currentStore.openHours,
          openHoursLength: currentStore.openHours?.length,
        }
      : null,
    storeLoading,
    storeError,
    showAllHours,
  });

  // 관리자 여부 (user_metadata.role 기반)
  const isAdmin = user && user.user_metadata?.role === "admin";

  // 가게 정보 및 리뷰 로드
  useEffect(() => {
    console.log("🔍 [StoreDetails] fetchStoreById called", { storeId });
    fetchStoreById(storeId);
  }, [storeId, fetchStoreById]);

  // 네이버 지도로 이동
  const handleViewInNaverMap = () => {
    if (!currentStore) return;

    const { lat, lng } = currentStore.position;
    const storeName = encodeURIComponent(currentStore.name);

    // 네이버 지도 앱 딥링크
    const naverMapUrl = `nmap://place?lat=${lat}&lng=${lng}&name=${storeName}&appname=com.example.refillspot`;
    window.location.href = naverMapUrl;

    // 앱이 실행되지 않으면 웹으로 리다이렉트 (1초 후)
    setTimeout(() => {
      window.location.href = `https://map.naver.com/v5/search/${storeName}?c=${lng},${lat},15,0,0,0,dh`;
    }, 1000);
  };

  // 즐겨찾기 상태 확인
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!user || !currentStore) return;

      const { data, error } = await supabaseBrowser
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("store_id", currentStore.id)
        .single();

      if (!error && data) {
        setIsFavorite(true);
      } else {
        setIsFavorite(false);
      }
    };

    checkFavoriteStatus();
  }, [user, currentStore]);

  // 사용자의 리뷰가 있는지 확인
  useEffect(() => {
    if (user && reviews.length > 0) {
      const existingReview = reviews.find(
        (review: FormattedReview) => review.user.id === user.id
      );

      if (existingReview) {
        setUserReview({
          rating: existingReview.rating,
          content: existingReview.content,
        });
      }
    }
  }, [reviews, user]);

  // 실시간 평점 조회
  useEffect(() => {
    if (!currentStore) return;
    const fetchLiveRating = async () => {
      setLiveRatingLoading(true);
      setLiveRatingError(null);
      try {
        const res = await fetch(
          `/api/stores/ratings?name=${encodeURIComponent(
            currentStore.name
          )}&address=${encodeURIComponent(currentStore.address)}`
        );
        const data = await res.json();
        if (res.ok && data.success && data.data) {
          setLiveRating({
            naver: data.data.naverRating,
            kakao: data.data.kakaoRating,
            average: data.data.averageRating,
          });
        } else {
          setLiveRatingError("실시간 평점 정보를 불러오지 못했습니다.");
        }
      } catch (err) {
        setLiveRatingError("실시간 평점 정보를 불러오지 못했습니다.");
      } finally {
        setLiveRatingLoading(false);
      }
    };
    fetchLiveRating();
  }, [currentStore]);

  // 즐겨찾기 토글
  const handleToggleFavorite = async () => {
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "즐겨찾기 기능을 사용하려면 로그인해주세요.",
      });
      router.push("/login");
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
      router.push("/login");
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
      // 리뷰가 있는지 확인
      const { data: existingReview } = await supabaseBrowser
        .from("reviews")
        .select("id")
        .eq("user_id", user.id)
        .eq("store_id", currentStore.id)
        .maybeSingle();

      if (existingReview) {
        // 기존 리뷰 업데이트
        await updateReview(
          existingReview.id,
          userReview.rating,
          userReview.content
        );

        toast({
          title: "리뷰 업데이트",
          description: "리뷰가 성공적으로 업데이트되었습니다.",
        });
      } else {
        // 새 리뷰 추가
        await addReview(
          currentStore.id,
          user.id,
          userReview.rating,
          userReview.content
        );

        toast({
          title: "리뷰 등록",
          description: "리뷰가 성공적으로 등록되었습니다.",
        });
      }
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
    if (!e.target.files || e.target.files.length === 0 || !currentStore) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/stores/${currentStore.id}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        // imageUrls에 추가 (최대 3장)
        const newUrls = [...(currentStore.imageUrls || []), data.url].slice(
          0,
          3
        );
        // DB 업데이트
        await supabaseBrowser
          .from("stores")
          .update({ image_urls: newUrls })
          .eq("id", currentStore.id);
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
    } catch (err) {
      toast({
        title: "업로드 오류",
        description: String(err),
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
    if (!user || !currentStore) return;
    if (!window.confirm("정말로 이 리뷰를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(
        `/api/stores/${currentStore.id}/reviews?reviewId=${reviewId}`,
        {
          method: "DELETE",
        }
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
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722]"
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
          0
        ) / reviews.length
      : 0;

  // 별점 렌더링 도우미 함수
  const renderStars = (rating: number, maxStars = 5) => {
    return Array.from({ length: maxStars }).map((_, i) => (
      <Star
        key={i}
        className={`h-5 w-5 ${
          i < Math.floor(rating)
            ? "fill-[#FFA726] text-[#FFA726]"
            : i < rating
              ? "fill-[#FFA726]/50 text-[#FFA726]"
              : "fill-none text-gray-300"
        }`}
      />
    ));
  };

  // store는 여기서 확실히 null이 아님
  const storeData = currentStore;

  // 요일 배열 (Date 객체의 getDay() 순서와 맞춤: 일요일=0)
  const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  // 현재 요일 구하기
  const today = new Date();
  const todayDayOfWeek = DAYS_OF_WEEK[today.getDay()];

  // openHours 문자열을 파싱하여 요일별 시간 정보로 변환
  const parseBusinessHours = () => {
    if (!storeData.openHours) return [];

    const hoursString = storeData.openHours;
    const dayPatterns = ["월", "화", "수", "목", "금", "토", "일"];
    const parsedHours = [];

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

    for (const day of dayPatterns) {
      // 휴무일인지 확인
      if (closedDays.includes(day)) {
        parsedHours.push({ day, hours: "휴무", isClosed: true });
        continue;
      }

      // "월: 11:30-23:30" 패턴 찾기 (더 정확한 정규표현식)
      const regex = new RegExp(`${day}:\\s*([^,/]+)`, "g");
      const match = regex.exec(hoursString);

      if (match) {
        let hours = match[1].trim();
        // "17:00-22:00 (라스트오더: 21:10)" 에서 괄호 부분 제거
        hours = hours.split("(")[0].trim();

        // 24시간 표기법 처리 (00:00-24:00)
        if (hours.includes("00:00-24:00")) {
          hours = "24시간 영업";
        }

        parsedHours.push({ day, hours, isClosed: false });
      } else {
        // 해당 요일이 없으면 기본값 또는 휴무
        parsedHours.push({ day, hours: "정보 없음", isClosed: true });
      }
    }

    return parsedHours;
  };

  const businessHours = parseBusinessHours();

  // 디버깅용 로그
  console.log("📅 Store Details Debug:", {
    storeId: storeData.id,
    storeName: storeData.name,
    openHours: storeData.openHours,
    todayDayOfWeek,
    businessHours,
    showAllHours,
  });

  // 추가 디버깅 - 화면에 표시
  const debugInfo = {
    storeId: storeData.id,
    storeName: storeData.name,
    openHours: storeData.openHours,
    todayDayOfWeek,
    businessHours,
    showAllHours,
  };

  // 오늘 요일의 영업시간 가져오기
  const getTodayHours = () => {
    const todayInfo = businessHours.find((h) => h.day === todayDayOfWeek);
    if (!todayInfo) return "영업시간 정보가 없습니다.";

    if (todayInfo.isClosed) return "오늘은 휴무일입니다.";
    return todayInfo.hours;
  };

  return (
    <article className="bg-white min-h-screen">
      <header className="sticky top-0 z-10 bg-white p-4 flex items-center gap-2 border-b">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">뒤로 가기</span>
        </Button>
        <h1 className="text-lg font-bold">{storeData.name}</h1>
      </header>

      {/* 관리자만 이미지 업로드 */}
      {isAdmin && (
        <div className="p-4 flex items-center gap-4 bg-gray-50 border-b">
          <label className="block">
            <span className="text-sm font-medium">
              가게 사진 업로드 (최대 3장)
            </span>
            <input
              type="file"
              accept="image/*"
              className="block mt-1"
              onChange={handleImageUpload}
              disabled={uploading || (storeData.imageUrls?.length || 0) >= 3}
            />
          </label>
          {uploading && (
            <span className="text-sm text-gray-500">업로드 중...</span>
          )}
        </div>
      )}

      {/* 가게 이미지 (캐러셀) */}
      <figure className="w-full h-48 md:h-64 relative">
        {storeData.imageUrls && storeData.imageUrls.length > 0 ? (
          <Carousel className="w-full h-full">
            <CarouselContent>
              {storeData.imageUrls.map((url, idx) => (
                <CarouselItem
                  key={idx}
                  className="w-full h-48 md:h-64 relative"
                >
                  <Image
                    src={url}
                    alt={`${storeData.name} 사진 ${idx + 1}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    style={{ objectFit: "cover" }}
                    priority={idx === 0}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <Image
            src="/placeholder.svg"
            alt={`${storeData.name} 이미지`}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            style={{ objectFit: "cover" }}
            priority
          />
        )}
      </figure>

      <main className="p-4 md:p-6 max-w-4xl mx-auto">
        {/* 디버깅 정보 (개발용) */}
        {process.env.NEXT_PUBLIC_LOG_LEVEL === "DEBUG" && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-bold text-yellow-800 mb-2">🔍 디버깅 정보</h3>
            <pre className="text-xs text-yellow-700 overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}

        {/* 가게 정보 */}
        <section aria-labelledby="store-info">
          <h2 id="store-info" className="sr-only">
            가게 정보
          </h2>
          <Card>
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-[#333333]">
                    {storeData.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center">
                      {renderStars(
                        liveRating ? liveRating.naver : storeData.rating.naver
                      )}
                      <span className="ml-2 text-sm text-gray-500">
                        (네이버)
                      </span>
                    </div>
                    <span className="mx-1">|</span>
                    <div className="flex items-center">
                      {renderStars(
                        liveRating ? liveRating.kakao : storeData.rating.kakao
                      )}
                      <span className="ml-2 text-sm text-gray-500">
                        (카카오)
                      </span>
                    </div>
                    {liveRatingLoading && (
                      <span className="ml-2 text-xs text-gray-400">
                        (실시간 평점 불러오는 중...)
                      </span>
                    )}
                    {liveRatingError && (
                      <span className="ml-2 text-xs text-red-400">
                        {liveRatingError}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  variant={isFavorite ? "destructive" : "outline"}
                  size="sm"
                  onClick={handleToggleFavorite}
                >
                  {isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
                </Button>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <address className="text-sm md:text-base text-gray-600 not-italic">
                  {storeData.address}
                </address>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={handleViewInNaverMap}
                  >
                    <Navigation className="h-4 w-4 text-[#2196F3]" />
                    <span>네이버 길찾기</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      // 카카오 지도 앱으로 연결
                      const kakaoMapUrl = `kakaomap://look?p=${storeData.position.lat},${storeData.position.lng}`;
                      window.location.href = kakaoMapUrl;

                      // 앱이 설치되어 있지 않은 경우를 위한 대체 URL (1초 후)
                      setTimeout(() => {
                        window.location.href = `https://map.kakao.com/link/to/${encodeURIComponent(
                          storeData.name
                        )},${storeData.position.lat},${storeData.position.lng}`;
                      }, 1000);
                    }}
                  >
                    <Navigation className="h-4 w-4 text-[#FFA726]" />
                    <span>카카오 길찾기</span>
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">카테고리</h4>
                <div className="flex flex-wrap gap-2">
                  {storeData.categories.map(
                    (category: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="px-2 py-1"
                      >
                        {category}
                      </Badge>
                    )
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                {/* 영업 정보 섹션 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-5 w-5 text-[#FF5722]" />
                    <h4 className="font-semibold text-lg">영업 정보</h4>
                  </div>

                  {/* 영업시간 표시 */}
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-[#FF5722] p-4 rounded-r-lg mb-3">
                    {!showAllHours ? (
                      /* 접힌 상태: 오늘 요일만 표시 */
                      <>
                        <h5 className="font-semibold text-[#FF5722] mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-[#FF5722] rounded-full"></span>
                          오늘({todayDayOfWeek})의 영업시간
                        </h5>
                        <time className="text-sm font-medium text-gray-700">
                          {getTodayHours()}
                        </time>
                      </>
                    ) : (
                      /* 펼친 상태: 전체 요일 표시 */
                      <>
                        <h5 className="font-semibold text-[#FF5722] mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-[#FF5722] rounded-full"></span>
                          주간 영업시간
                        </h5>
                        <div className="space-y-2">
                          {businessHours.map((item, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-center text-sm"
                            >
                              <span
                                className={`font-medium ${
                                  item.day === todayDayOfWeek
                                    ? "text-[#FF5722]"
                                    : "text-gray-700"
                                }`}
                              >
                                {item.day}요일
                                {item.day === todayDayOfWeek && (
                                  <span className="ml-1 text-xs bg-[#FF5722] text-white px-2 py-0.5 rounded-full">
                                    오늘
                                  </span>
                                )}
                              </span>
                              <span
                                className={`font-medium ${
                                  item.isClosed
                                    ? "text-red-500"
                                    : "text-gray-700"
                                }`}
                              >
                                {item.hours}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          * 실제 영업시간은 매장 사정에 따라 변경될 수 있습니다.
                        </p>
                      </>
                    )}
                  </div>

                  {/* 토글 버튼 */}
                  <button
                    onClick={() => setShowAllHours(!showAllHours)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#FF5722] transition-colors"
                  >
                    <span>
                      {showAllHours ? "간단히 보기" : "전체 영업시간 보기"}
                    </span>
                    {showAllHours ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* 전화번호 섹션 */}
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-[#2196F3]" />
                  <div className="flex-1">
                    <h4 className="font-medium">전화번호</h4>
                    <p className="text-sm text-gray-600">
                      {storeData.phoneNumber || "전화번호 정보가 없습니다."}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">무한리필 메뉴</h4>
                <div className="space-y-3">
                  {storeData.refillItems && Array.isArray(storeData.refillItems) && storeData.refillItems.length > 0 ? (
                    storeData.refillItems.map((item: MenuItem, index: number) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{item.name}</h5>
                          {item.type && (
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                              {item.type}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">{item.price}</div>
                          {item.is_recommended && (
                            <Badge variant="secondary" className="text-xs">추천</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                      메뉴 정보가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 리뷰 섹션 */}
        <section className="mt-8" aria-labelledby="reviews-heading">
          <h3 id="reviews-heading" className="text-xl font-bold mb-4">
            리뷰
          </h3>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full grid grid-cols-2 mb-4">
              <TabsTrigger value="all">
                모든 리뷰 ({reviews.length})
              </TabsTrigger>
              <TabsTrigger value="write">리뷰 작성</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review: FormattedReview) => (
                    <article
                      key={review.id}
                      className="border rounded-lg p-4 shadow-sm"
                    >
                      <header className="flex justify-between items-center mb-2">
                        <span className="font-semibold">
                          {review.user.username}
                        </span>
                        <div className="flex items-center gap-2">
                          {renderStars(review.rating)}
                          <time
                            className="ml-2 text-sm text-gray-500"
                            dateTime={review.createdAt}
                          >
                            {new Date(review.createdAt).toLocaleDateString()}
                          </time>
                          {user && review.user.id === user.id && (
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
                      <p className="text-gray-700">{review.content}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">아직 작성된 리뷰가 없습니다.</p>
                  {/* 평균 평점 표시 */}
                  {avgRating > 0 && (
                    <div className="mt-2 flex justify-center items-center gap-2">
                      <span className="text-sm text-gray-600">평균 평점:</span>
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
                          className="focus:outline-none"
                          aria-label={`${star}점`}
                        >
                          <Star
                            className={`h-8 w-8 ${
                              star <= userReview.rating
                                ? "fill-[#FFA726] text-[#FFA726]"
                                : "fill-none text-gray-300"
                            }`}
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
                      className="w-full p-3 border rounded-md focus:ring-2 focus:ring-[#FF5722] focus:border-transparent min-h-[150px]"
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
                    className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? "처리 중..." : "리뷰 등록"}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    리뷰를 작성하려면 로그인이 필요합니다.
                  </p>
                  <Link href="/login">
                    <Button variant="outline">로그인하러 가기</Button>
                  </Link>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>

        {/* 외부 링크 */}
        <section className="mt-8" aria-label="외부 검색 링크">
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                window.open(
                  `https://search.naver.com/search.naver?query=${encodeURIComponent(
                    storeData.name + " " + storeData.address
                  )}`,
                  "_blank"
                )
              }
            >
              <span className="text-[#03C75A] font-bold">N</span>
              <span>네이버 검색</span>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                window.open(
                  `https://search.daum.net/search?q=${encodeURIComponent(
                    storeData.name + " " + storeData.address
                  )}`,
                  "_blank"
                )
              }
            >
              <span className="text-[#FFDE00] bg-[#371D1E] rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">
                K
              </span>
              <span>카카오 검색</span>
            </Button>
          </div>
        </section>
      </main>
    </article>
  );
}

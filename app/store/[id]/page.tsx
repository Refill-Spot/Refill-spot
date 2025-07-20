"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { SearchInput } from "@/components/header/search-input";
import { StoreReviews } from "@/components/store-reviews";
import { getUserLocation, isLocationValid } from "@/lib/location-storage";
import { Store } from "@/types/store";
import { MenuItem } from "@/types/menu";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/use-favorites";
import { resetOnboardingStatus } from "@/lib/onboarding-storage";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
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
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllHours, setShowAllHours] = useState(false);
  const [showAllMenus, setShowAllMenus] = useState(false);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const response = await fetch(`/api/stores/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setStore(data.data);
        } else {
          toast({
            title: "오류",
            description: "가게 정보를 불러올 수 없습니다.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("가게 정보 조회 오류:", error);
        toast({
          title: "오류",
          description: "가게 정보를 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchStore();
    }
  }, [params.id, toast]);

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
    await toggleFavorite(store.id);
  };

  // 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      resetOnboardingStatus();
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
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
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
  const handlePlaceSelect = (place: any) => {
    if (!place?.geometry?.location) {
return;
}
    
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    
    // 지도 페이지로 이동하면서 위치 정보 전달
    router.push(`/?lat=${lat}&lng=${lng}&distance=5`);
  };

  const handleManualSearch = async (searchText: string) => {
    if (!window.google?.maps) {
      toast({
        title: "오류",
        description: "Google Maps API가 로드되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Geocoding을 사용하여 검색어를 위치로 변환
      const geocoder = new window.google.maps.Geocoder();
      
      geocoder.geocode(
        { 
          address: searchText, 
          componentRestrictions: { country: "kr" }, 
        },
        (results: any, status: any) => {
          if (status === window.google.maps.GeocoderStatus.OK && results?.[0]) {
            const lat = results[0].geometry.location.lat();
            const lng = results[0].geometry.location.lng();
            
            // 검색한 위치로 지도 페이지 이동
            router.push(`/?lat=${lat}&lng=${lng}&distance=5&searchLocation=${encodeURIComponent(searchText)}`);
          } else {
            // Geocoding이 실패한 경우 기존 방식으로 fallback
            router.push(`/?search=${encodeURIComponent(searchText)}`);
          }
        },
      );
    } catch (error) {
      console.error("Geocoding error:", error);
      // 오류 발생 시 기존 방식으로 fallback
      router.push(`/?search=${encodeURIComponent(searchText)}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722]"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
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

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-2 py-3">
          <div className="flex items-center">
            {/* 왼쪽: 빈 공간 */}
            <div className="w-60">
            </div>
            
            {/* 중간: 로고 + 프로젝트명 + 검색창 */}
            <div className="flex items-center gap-12 flex-1 justify-center">
              <button 
                onClick={() => router.push("/")}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
              >
                <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg p-2">
                  <svg
                    className="w-6 h-6 text-white"
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
                  <h1 className="text-xl font-bold text-gray-900">Refill-spot</h1>
                  <p className="text-xs text-gray-500">무한리필 가게 찾기</p>
                </div>
              </button>
              <SearchInput
                className="flex-1 max-w-lg"
                onPlaceSelect={handlePlaceSelect}
                onManualSearch={handleManualSearch}
                placeholder="지역, 주소를 입력하세요"
              />
            </div>
            
            {/* 오른쪽: 로그인/사용자 정보 */}
            <div className="flex items-center gap-3 w-60 justify-end">
              {authLoading ? (
                <div className="animate-pulse flex items-center space-x-2">
                  <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
                  <div className="h-4 w-16 bg-gray-300 rounded hidden md:block"></div>
                </div>
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="relative">
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
                        onClick={() => router.push("/my-reviews")}
                        className="w-full flex items-center"
                      >
                        <Star className="h-4 w-4 mr-2 text-yellow-500" />
                        내가 작성한 리뷰
                      </button>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <button
                        onClick={() => router.push("/favorites")}
                        className="w-full flex items-center"
                      >
                        <Heart className="h-4 w-4 mr-2 text-[#FF5722]" />
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
                    {profile?.is_admin && (
                      <>
                        <DropdownMenuItem asChild>
                          <button
                            onClick={() => router.push("/admin/announcements")}
                            className="w-full flex items-center text-blue-600"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            공지사항 관리
                          </button>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <button
                            onClick={() => router.push("/admin/contacts")}
                            className="w-full flex items-center text-blue-600"
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
                        className="w-full flex items-center text-red-600"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        로그아웃
                      </button>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={() => router.push("/login")}
                  variant="outline"
                  size="sm"
                >
                  로그인
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="w-full pt-6">
        <div className="space-y-6">
          {/* 가게 메인 이미지 - 다이닝코드 스타일 */}
          <div className="max-w-4xl mx-auto px-4">
            <div className="relative w-full min-h-[20rem] max-h-[32rem] bg-gray-100 overflow-hidden rounded-lg flex items-center justify-center">
            {store.imageUrls && store.imageUrls.length > 0 ? (
              <img
                src={store.imageUrls[0]}
                alt={`${store.name} 대표 사진`}
                className="w-full h-auto max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div class="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                        <div class="text-center">
                          <svg class="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
                          </svg>
                          <p class="text-sm">이미지를 불러올 수 없습니다</p>
                        </div>
                      </div>
                    `;
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm">이미지를 불러올 수 없습니다</p>
                </div>
              </div>
            )}
            
            {/* 오버레이 그라데이션 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
            
            {/* 상단 액션 버튼들 */}
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/90 text-gray-700 hover:bg-white"
                onClick={handleToggleFavorite}
              >
                <Heart 
                  className={`w-4 h-4 mr-1 ${
                    store && isFavorite(store.id) 
                      ? "fill-red-500 text-red-500" 
                      : ""
                  }`} 
                />
                {store && isFavorite(store.id) ? "저장됨" : "저장"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/90 text-gray-700 hover:bg-white"
                onClick={handleShare}
              >
                <Share className="w-4 h-4 mr-1" />
                공유
              </Button>
            </div>
            
            {/* 하단 가게 정보 오버레이 */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold mb-2">{store.name}</h1>
                
                {/* 평점 정보 */}
                <div className="flex items-center gap-4 mb-3">
                  {(store.rating.naver > 0 || store.rating.kakao > 0) && (
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-400 fill-current" />
                      <span className="text-lg font-semibold">
                        {store.rating.naver > 0 ? store.rating.naver : store.rating.kakao}
                      </span>
                      <span className="text-white/80 text-sm">
                        ({store.rating.naver > 0 ? "네이버" : "카카오"} 평점)
                      </span>
                    </div>
                  )}
                  {store.distance && (
                    <div className="text-white/80 text-sm">
                      현재 위치에서 {store.distance}km
                    </div>
                  )}
                </div>
                
                {/* 주소 */}
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-white/80" />
                  <span className="text-white/90 text-sm">{store.address}</span>
                </div>
                
                {/* 카테고리 태그 */}
                <div className="flex flex-wrap gap-2">
                  {store.categories.map((category, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-white/20 text-white text-xs rounded-full"
                    >
                      #{category}
                    </span>
                  ))}
                  {store.refillItems && Array.isArray(store.refillItems) && store.refillItems.length > 0 && (
                    <span className="px-2 py-1 bg-[#FF5722]/80 text-white text-xs rounded-full">
                      #무한리필
                    </span>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* 운영 정보 */}
          <div className="max-w-4xl mx-auto px-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#FF5722]" />
                    운영 정보
                  </CardTitle>
                  <Button
                    onClick={handleViewInNaverMap}
                    className="bg-[#03C75A] hover:bg-[#02B351] text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    지도로 보기
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 주소 */}
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">주소</h4>
                    <p className="text-gray-700 text-sm">{store.address}</p>
                  </div>
                </div>

                {/* 전화번호 */}
                {store.phoneNumber && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">전화번호</h4>
                      <p className="text-gray-700 text-sm">{store.phoneNumber}</p>
                    </div>
                  </div>
                )}

                {/* 카테고리 */}
                <div className="flex items-start gap-3">
                  <Utensils className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">카테고리</h4>
                    <div className="flex flex-wrap gap-2">
                      {store.categories.map((category, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 운영시간 */}
                {store.openHours && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 mb-1">운영시간</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllHours(!showAllHours)}
                          className="text-gray-500 hover:text-gray-700 p-1"
                        >
                          {showAllHours ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <div className="text-gray-700 text-sm">
                        {showAllHours ? (
                          <div className="space-y-3">
                            {(() => {
                              // 운영시간 파싱 로직
                              const parseBusinessHours = () => {
                                if (!store.openHours) {
return [];
}
                                
                                const hoursString = store.openHours;
                                const dayPatterns = ["월", "화", "수", "목", "금", "토", "일"];
                                const parsedHours = [];

                                // 라스트오더 정보 추출
                                const lastOrderMatch = hoursString.match(/\(라스트오더:\s*([^)]+)\)/);
                                const lastOrderTime = lastOrderMatch ? lastOrderMatch[1].trim() : null;

                                // 휴무일 정보 확인
                                const closedDays = [];
                                if (hoursString.includes("휴무")) {
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
                                    parsedHours.push({ day, hours: "휴무", isClosed: true, lastOrder: null });
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

                                    parsedHours.push({ day, hours, isClosed: false, lastOrder: lastOrderTime });
                                  } else {
                                    // 해당 요일이 없으면 정보 없음으로 처리
                                    parsedHours.push({ day, hours: "정보 없음", isClosed: true, lastOrder: null });
                                  }
                                }

                                return parsedHours;
                              };
                              
                              const businessHours = parseBusinessHours();
                              const today = new Date().getDay();
                              const days = ["일", "월", "화", "수", "목", "금", "토"];
                              const todayName = days[today];
                              
                              return businessHours.map((item, index) => (
                                <div
                                  key={index}
                                  className={`p-3 rounded-lg border-l-4 ${
                                    item.day === todayName
                                      ? "border-[#FF5722] bg-gradient-to-r from-orange-50 to-red-50"
                                      : "border-gray-200 bg-gray-50"
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-semibold ${
                                          item.day === todayName
                                            ? "text-[#FF5722]"
                                            : "text-gray-700"
                                        }`}
                                      >
                                        {item.day}요일
                                      </span>
                                      {item.day === todayName && (
                                        <span className="text-xs bg-[#FF5722] text-white px-2 py-0.5 rounded-full">
                                          오늘
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div
                                        className={`font-medium ${
                                          item.isClosed
                                            ? "text-red-500"
                                            : "text-gray-700"
                                        }`}
                                      >
                                        {item.hours}
                                      </div>
                                      {item.lastOrder && !item.isClosed && (
                                        <div className="text-xs text-gray-500 mt-1">
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
                              const days = ["일", "월", "화", "수", "목", "금", "토"];
                              const todayName = days[today];
                              
                              // 오늘 요일에 해당하는 운영시간 찾기
                              const regex = new RegExp(`${todayName}:\\s*([\\d:]+\\s*-\\s*[\\d:]+)`);
                              const match = store.openHours.match(regex);
                              
                              // 라스트오더 정보 추출
                              const lastOrderMatch = store.openHours.match(/\(라스트오더:\s*([^)]+)\)/);
                              const lastOrderTime = lastOrderMatch ? lastOrderMatch[1].trim() : null;
                              
                              return (
                                <div>
                                  <span className="font-medium text-[#FF5722]">오늘 ({todayName})</span>
                                  <br />
                                  {match ? (
                                    <div>
                                      {match[1]}
                                      {lastOrderTime && (
                                        <span className="text-gray-500 ml-2">(라스트오더: {lastOrderTime})</span>
                                      )}
                                    </div>
                                  ) : (
                                    "운영시간 정보를 확인해주세요"
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

          {/* 메뉴 정보 */}
          {store.refillItems && Array.isArray(store.refillItems) && store.refillItems.length > 0 && (
            <div className="max-w-4xl mx-auto px-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-[#FF5722]" />
                    메뉴 정보
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {store.refillItems
                      .sort((a, b) => {
                        // order 필드를 기준으로 정렬
                        const orderA = typeof a === "object" && a.order ? a.order : 999;
                        const orderB = typeof b === "object" && b.order ? b.order : 999;
                        return orderA - orderB;
                      })
                      .slice(0, showAllMenus ? store.refillItems.length : 3)
                      .map((item: MenuItem, index: number) => (
                        <div
                          key={index}
                          className="flex items-center p-3 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-900">
                              {typeof item === "string" ? item : item.name}
                            </span>
                            {typeof item === "object" && item.is_recommended && (
                              <Badge className="bg-[#FF5722] text-white text-xs">
                                추천
                              </Badge>
                            )}
                          </div>
                          <div className="flex-1 mx-4 border-b-2 border-dotted border-gray-400"></div>
                          <div className="text-right">
                            <span className="font-semibold text-[#FF5722]">
                              {typeof item === "string" ? "" : item.price || "가격 문의"}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                  {store.refillItems.length > 3 && (
                    <div className="mt-4 text-center">
                      <Button
                        variant="outline"
                        onClick={() => setShowAllMenus(!showAllMenus)}
                        className="text-[#FF5722] border-[#FF5722] hover:bg-[#FF5722] hover:text-white"
                      >
                        {showAllMenus ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-2" />
                            접기
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-2" />
                            더보기
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 이미지 갤러리 */}
          {store.imageUrls && store.imageUrls.length > 1 && (
            <div className="max-w-4xl mx-auto px-4">
              <Card>
                <CardHeader>
                  <CardTitle>추가 사진</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {store.imageUrls.slice(1).map((url, index) => (
                      <div
                        key={index}
                        className="aspect-square relative rounded-lg overflow-hidden"
                      >
                        <img
                          src={url}
                          alt={`${store.name} 사진 ${index + 2}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 리뷰 섹션 */}
          <div className="max-w-4xl mx-auto px-4">
            <StoreReviews storeId={store.id} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 로고 및 설명 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg p-2">
                  <svg
                    className="w-6 h-6 text-white"
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
                  <h3 className="text-lg font-bold text-gray-900">Refill-spot</h3>
                  <p className="text-xs text-gray-500">무한리필 가게 찾기</p>
                </div>
              </div>
            </div>

            {/* 서비스 링크 */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">서비스</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <button
                    onClick={() => router.push("/")}
                    className="hover:text-[#FF5722] transition-colors"
                  >
                    가게 찾기
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => router.push("/announcements")}
                    className="hover:text-[#FF5722] transition-colors"
                  >
                    공지사항
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => router.push("/onboarding")}
                    className="hover:text-[#FF5722] transition-colors"
                  >
                    서비스 소개
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => router.push("/contact")}
                    className="hover:text-[#FF5722] transition-colors"
                  >
                    문의하기
                  </button>
                </li>
              </ul>
            </div>

            {/* 계정 링크 */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">계정</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                {user && profile ? (
                  <>
                    <li>
                      <button
                        onClick={() => router.push("/profile")}
                        className="hover:text-[#FF5722] transition-colors"
                      >
                        프로필
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => router.push("/favorites")}
                        className="hover:text-[#FF5722] transition-colors"
                      >
                        즐겨찾기
                      </button>
                    </li>
                  </>
                ) : (
                  <li>
                    <button
                      onClick={() => router.push("/login")}
                      className="hover:text-[#FF5722] transition-colors"
                    >
                      로그인 / 회원가입
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* 하단 구분선 및 저작권 */}
          <div className="border-t border-gray-200 mt-8 pt-6 space-y-4">
            {/* 약관 링크들 */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF5722] transition-colors">
                개인정보처리방침
              </a>
              <span>|</span>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF5722] transition-colors">
                이용약관
              </a>
              <span>|</span>
              <a href="/location-terms" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF5722] transition-colors">
                위치기반 서비스 이용약관
              </a>
            </div>

            {/* 회사 정보 */}
            <div className="text-center space-y-2 text-sm text-gray-500">
              <div>
                <span className="font-medium text-gray-700">(주)리필스팟</span>
              </div>
              <div>
                이메일 문의 : refillspot.official@gmail.com
              </div>
            </div>

            {/* 저작권 */}
            <div className="text-center pt-4">
              <p className="text-sm text-gray-500">
                Copyright ⓒ 2025 Refill-spot
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

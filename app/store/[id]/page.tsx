"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { getUserLocation, isLocationValid } from "@/lib/location-storage";
import { Store } from "@/types/store";
import { MenuItem } from "@/types/menu";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Phone,
  Share,
  Star,
  Utensils,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllHours, setShowAllHours] = useState(false);

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
    if (!store) return;

    // 네이버 지도 앱으로 열기 시도
    const naverMapUrl = `nmap://place?lat=${store.position.lat}&lng=${
      store.position.lng
    }&name=${encodeURIComponent(store.name)}&appname=com.refillspot.app`;

    // 앱이 설치되어 있지 않으면 웹으로 리다이렉트
    const webMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(
      store.name
    )}?c=${store.position.lng},${store.position.lat},15,0,0,0,dh`;

    // 모바일에서는 앱 링크 시도, 데스크톱에서는 바로 웹으로
    if (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
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
    // 저장된 위치 정보가 있는지 확인
    const savedLocation = getUserLocation();

    if (savedLocation && isLocationValid(savedLocation)) {
      // 위치 정보가 있으면 쿼리 파라미터와 함께 메인 페이지로 이동
      const params = new URLSearchParams({
        lat: savedLocation.lat.toString(),
        lng: savedLocation.lng.toString(),
        source: savedLocation.source,
      });
      router.push(`/?${params.toString()}`);
    } else {
      // 위치 정보가 없으면 일반 뒤로가기
      router.back();
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">가게 정보</h1>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* 가게 메인 이미지 - 다이닝코드 스타일 */}
          <div className="relative w-full h-80 md:h-96 bg-gray-100 overflow-hidden">
            {store.imageUrls && store.imageUrls.length > 0 ? (
              <img
                src={store.imageUrls[0]}
                alt={`${store.name} 대표 사진`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
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
              >
                <Heart className="w-4 h-4 mr-1" />
                저장
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/90 text-gray-700 hover:bg-white"
              >
                <Share className="w-4 h-4 mr-1" />
                공유
              </Button>
            </div>
            
            {/* 하단 가게 정보 오버레이 */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="max-w-4xl mx-auto">
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
                        ({store.rating.naver > 0 ? '네이버' : '카카오'} 평점)
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

          {/* 운영 정보 */}
          <div className="px-4">
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
                                if (!store.openHours) return [];
                                
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
                              const days = ['일', '월', '화', '수', '목', '금', '토'];
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
                              const days = ['일', '월', '화', '수', '목', '금', '토'];
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
            <div className="px-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-[#FF5722]" />
                    메뉴 정보
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {store.refillItems.map((item: MenuItem, index: number) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="justify-center py-2"
                      >
                        {typeof item === 'string' ? item : item.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 이미지 갤러리 */}
          {store.imageUrls && store.imageUrls.length > 1 && (
            <div className="px-4">
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
        </div>
      </div>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/header";
import { 
  ArrowRight,
  MapPin, 
  Search, 
  Filter, 
  Star, 
  Heart, 
  ThumbsUp, 
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  Utensils,
  UtensilsCrossed,
  Coffee,
  Soup,
  Smartphone,
  ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  const scrollToGuide = () => {
    const guideSection = document.querySelector("#guide-section");
    if (guideSection) {
      guideSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <Header
        onSearch={() => router.push("/map")}
        onLocationRequest={() => router.push("/map")}
        onCustomLocationSet={() => router.push("/map")}
        userLocation={null}
        onFilterToggle={() => router.push("/map")}
        onApplyFilters={() => router.push("/map")}
      />

      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-br from-orange-50 via-white to-red-50 py-16 px-4">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-8xl mx-auto">
          {/* 메인 히어로 콘텐츠 */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center bg-orange-100 text-orange-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
              🍽️ 대한민국 최대 무한리필 맛집 플랫폼
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              무한리필 맛집을<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
                쉽게 찾아보세요
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              전국 무한리필 음식점을 한눈에! 실시간 위치 기반으로 주변 맛집을 찾고, 
              실제 이용자들의 생생한 리뷰를 확인하세요. 가성비 최고의 무한리필 경험을 시작하세요.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button 
                size="lg" 
                onClick={() => router.push("/map")}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <MapPin className="w-5 h-5 mr-2" />
                지금 바로 찾아보기
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={scrollToGuide}
                className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 px-8 py-4 text-lg font-semibold rounded-full"
              >
                이용 가이드 보기
              </Button>
            </div>
          </div>

          {/* 주요 기능 하이라이트 */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">실시간 위치 기반 검색</h3>
                <p className="text-gray-600 leading-relaxed">
                  GPS를 활용해 현재 위치 주변의 무한리필 맛집을 실시간으로 찾아드립니다. 
                  거리순, 평점순으로 정렬하여 최적의 선택을 도와드려요.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">실제 이용자 리뷰</h3>
                <p className="text-gray-600 leading-relaxed">
                  진짜 이용자들이 남긴 생생한 리뷰와 평점을 확인하세요. 
                  메뉴 구성, 맛, 서비스까지 솔직한 후기로 현명한 선택을 하세요.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">다양한 필터 검색</h3>
                <p className="text-gray-600 leading-relaxed">
                  한식, 일식, 중식, 양식 등 음식 종류별로 검색하고, 
                  가격대, 평점, 거리 등 원하는 조건에 맞는 맛집을 쉽게 찾아보세요.
                </p>
              </CardContent>
            </Card>
          </div>


          {/* 스크롤 안내 */}
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={scrollToGuide}
              className="text-gray-500 hover:text-orange-500 transition-colors duration-300"
            >
              <ChevronDown className="w-6 h-6 animate-bounce" />
            </Button>
          </div>
        </div>
      </section>

      {/* 이용 가이드 섹션 */}
      <section id="guide-section" className="py-16 px-4 bg-white">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-8xl mx-auto">
          {/* 섹션 헤더 */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Refill-spot 이용 가이드
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              처음이세요? 걱정하지 마세요! 쉽고 간단한 4단계로 원하는 무한리필 맛집을 찾아보세요.
            </p>
          </div>

          {/* 이용 단계 */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="relative border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6 text-center">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-4">
                  <MapPin className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">위치 설정</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  GPS로 현재 위치를 확인하거나 원하는 지역을 직접 검색해서 설정하세요.
                </p>
              </CardContent>
            </Card>

            <Card className="relative border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6 text-center">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-4">
                  <Filter className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">조건 설정</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  음식 종류, 가격대, 평점 등 원하는 조건을 설정해서 맞춤 결과를 확인하세요.
                </p>
              </CardContent>
            </Card>

            <Card className="relative border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6 text-center">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-4">
                  <Search className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">맛집 선택</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  지도나 목록에서 마음에 드는 맛집을 선택해서 상세 정보를 확인하세요.
                </p>
              </CardContent>
            </Card>

            <Card className="relative border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6 text-center">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-4">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">리뷰 확인</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  실제 이용자들의 리뷰와 평점을 확인하고 최종 선택을 하세요.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 주요 기능 상세 설명 */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
              더 스마트하게 이용하는 방법
            </h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-yellow-50 border-yellow-200 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-center mb-4">
                    <Heart className="w-6 h-6 text-red-500 mr-3" />
                    <h4 className="text-xl font-bold text-gray-900">즐겨찾기 활용</h4>
                  </div>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    마음에 드는 맛집을 즐겨찾기에 저장해두세요. 언제든지 쉽게 다시 찾을 수 있고, 
                    새로운 리뷰나 정보 업데이트 알림을 받을 수 있습니다.
                  </p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    <li>• 개인 맞춤 맛집 목록 관리</li>
                    <li>• 새 리뷰 및 정보 업데이트 알림</li>
                    <li>• 친구들과 즐겨찾기 공유 가능</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-200 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-center mb-4">
                    <Smartphone className="w-6 h-6 text-blue-500 mr-3" />
                    <h4 className="text-xl font-bold text-gray-900">모바일 최적화</h4>
                  </div>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    언제 어디서나 스마트폰으로 편리하게 이용하세요. PWA 지원으로 
                    앱처럼 사용할 수 있고, 오프라인에서도 기본 기능을 사용할 수 있습니다.
                  </p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    <li>• 반응형 디자인으로 모든 기기 지원</li>
                    <li>• PWA 설치로 앱처럼 사용</li>
                    <li>• 오프라인 모드 지원</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* 무한리필 완벽 가이드 섹션 */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-8xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              무한리필 완벽 가이드
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              무한리필의 모든 것을 알려드립니다. 에티켓부터 꿀팁까지!
            </p>
          </div>

          {/* 무한리필이란? */}
          <Card className="mb-8 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <Utensils className="w-6 h-6 mr-3 text-blue-500" />
                무한리필이란?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  무한리필(All You Can Eat)은 정해진 금액을 지불하고 제한 시간 내에서 
                  원하는 만큼 음식을 즐길 수 있는 식사 방식입니다. 한국에서는 특히 
                  고기, 샐러드바, 뷔페 등 다양한 형태로 운영되고 있습니다.
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                      <DollarSign className="w-4 h-4 mr-2" />
                      경제적 장점
                    </h4>
                    <ul className="text-blue-800 text-sm space-y-1">
                      <li>• 고정 가격으로 다양한 메뉴 체험</li>
                      <li>• 대식가들에게 매우 경제적</li>
                      <li>• 가족 단위 식사에 부담 절감</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-2 flex items-center">
                      <Star className="w-4 h-4 mr-2" />
                      경험적 장점
                    </h4>
                    <ul className="text-green-800 text-sm space-y-1">
                      <li>• 새로운 음식 부담 없이 시도</li>
                      <li>• 친구/가족과 함께 즐기는 재미</li>
                      <li>• 다양한 조합으로 식사 즐기기</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 무한리필 꿀팁 모음 */}
          <Card className="mb-8 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <ThumbsUp className="w-6 h-6 mr-3 text-green-500" />
                무한리필 꿀팁 모음
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center text-yellow-900">
                      <Clock className="w-5 h-5 mr-2" />
                      시간대 활용법
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-yellow-800 text-sm">
                      <li><Badge variant="secondary" className="mr-2">런치</Badge>11:30-12:00 이른 점심으로 대기 없이</li>
                      <li><Badge variant="secondary" className="mr-2">디너</Badge>17:30-18:00 저녁 피크 전 여유롭게</li>
                      <li><Badge variant="secondary" className="mr-2">주말</Badge>오픈 시간에 맞춰 방문하기</li>
                      <li><Badge variant="secondary" className="mr-2">평일</Badge>저녁보다 점심시간 추천</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center text-blue-900">
                      <DollarSign className="w-5 h-5 mr-2" />
                      가성비 극대화
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-blue-800 text-sm">
                      <li><Badge variant="secondary" className="mr-2">전략</Badge>비싼 메뉴부터 먼저 시도</li>
                      <li><Badge variant="secondary" className="mr-2">순서</Badge>샐러드→고기→밥→디저트</li>
                      <li><Badge variant="secondary" className="mr-2">음료</Badge>무료 음료 적극 활용</li>
                      <li><Badge variant="secondary" className="mr-2">조합</Badge>다양한 소스로 맛 변화</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* 더 자세한 가이드 링크 */}
          <div className="text-center">
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-0 shadow-lg">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  더 자세한 가이드가 필요하신가요?
                </h3>
                <p className="text-gray-600 mb-6">
                  무한리필 에티켓, 업종별 상세 가이드, 그리고 더 많은 꿀팁들을 확인해보세요.
                </p>
                <Button 
                  size="lg"
                  onClick={() => router.push("/guide")}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  상세 가이드 보기
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 마무리 CTA 섹션 */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            지금 바로 시작해보세요!
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            전국 수천 개의 무한리필 맛집이 여러분을 기다리고 있습니다. 
            가장 가까운 맛집부터 찾아보세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => router.push("/map")}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <MapPin className="w-5 h-5 mr-2" />
              맛집 찾으러 가기
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => router.push("/guide")}
              className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 px-8 py-4 text-lg font-semibold rounded-full"
            >
              완전한 가이드 보기
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
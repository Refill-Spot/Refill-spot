"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, MapPin, Search, Star } from "lucide-react";

interface HeroSectionProps {
  onGetStarted?: () => void;
}

export default function HeroSection({ onGetStarted }: HeroSectionProps) {
  const scrollToMap = () => {
    const mapSection = document.querySelector("#map-section");
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: "smooth" });
    }
    onGetStarted?.();
  };

  return (
    <section className="bg-gradient-to-br from-orange-50 via-white to-red-50 py-16 px-4">
      <div className="max-w-6xl mx-auto">
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
              onClick={scrollToMap}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <MapPin className="w-5 h-5 mr-2" />
              지금 바로 찾아보기
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => {
                const guideSection = document.querySelector("#guide-section");
                if (guideSection) {
                  guideSection.scrollIntoView({ behavior: "smooth" });
                }
              }}
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

        {/* 통계 정보 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-orange-500 mb-2">1,000+</div>
              <div className="text-gray-600 font-medium">등록된 맛집</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-500 mb-2">50,000+</div>
              <div className="text-gray-600 font-medium">이용자 리뷰</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-500 mb-2">전국</div>
              <div className="text-gray-600 font-medium">서비스 지역</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-500 mb-2">24/7</div>
              <div className="text-gray-600 font-medium">실시간 업데이트</div>
            </div>
          </div>
        </div>

        {/* 스크롤 안내 */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={scrollToMap}
            className="text-gray-500 hover:text-orange-500 transition-colors duration-300"
          >
            <ChevronDown className="w-6 h-6 animate-bounce" />
          </Button>
        </div>
      </div>
    </section>
  );
}
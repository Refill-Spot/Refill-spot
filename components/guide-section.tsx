"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  MapPin, 
  Search, 
  Filter, 
  Star, 
  Heart, 
  Share2,
  Smartphone,
  Clock,
  DollarSign,
  Users
} from "lucide-react";

export default function GuideSection() {
  return (
    <section id="guide-section" className="py-16 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
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
            <Card className="border-0 shadow-lg">
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

            <Card className="border-0 shadow-lg">
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

        {/* 무한리필 이용 팁 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
            💡 무한리필 이용 꿀팁
          </h3>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">시간대 활용</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                점심시간(12-1시)이나 저녁시간(6-7시)을 피해서 방문하면 
                더 여유롭게 식사를 즐길 수 있어요.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">가성비 극대화</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                메뉴판을 미리 확인하고 다양한 종류를 조금씩 시도해보세요. 
                무한리필의 진정한 매력을 느낄 수 있습니다.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">함께 가기</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                가족이나 친구들과 함께 가면 더 많은 메뉴를 시도해볼 수 있고, 
                즐거운 식사 시간을 보낼 수 있어요.
              </p>
            </div>
          </div>
        </div>

        {/* CTA 섹션 */}
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            지금 바로 시작해보세요!
          </h3>
          <p className="text-gray-600 mb-6">
            수천 개의 무한리필 맛집이 여러분을 기다리고 있습니다.
          </p>
          <Button 
            size="lg"
            onClick={() => {
              const mapSection = document.querySelector('#map-section');
              if (mapSection) {
                mapSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Search className="w-5 h-5 mr-2" />
            맛집 찾기 시작하기
          </Button>
        </div>
      </div>
    </section>
  );
}
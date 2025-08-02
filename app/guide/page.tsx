"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Clock, 
  DollarSign, 
  Users, 
  Utensils, 
  ThumbsUp, 
  AlertTriangle,
  Star,
  MapPin,
  Calendar,
  Coffee,
  Soup,
  UtensilsCrossed,
  Heart
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function GuidePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            돌아가기
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">무한리필 완벽 가이드</h1>
            <p className="text-gray-600 mt-2">무한리필의 모든 것을 알려드립니다</p>
          </div>
        </div>

        {/* 목차 */}
        <Card className="mb-8 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Coffee className="w-5 h-5 mr-2 text-orange-500" />
              목차
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <a href="#basics" className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <Utensils className="w-4 h-4 mr-3 text-blue-500" />
                <span>무한리필이란?</span>
              </a>
              <a href="#etiquette" className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <Heart className="w-4 h-4 mr-3 text-red-500" />
                <span>이용 에티켓</span>
              </a>
              <a href="#tips" className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <ThumbsUp className="w-4 h-4 mr-3 text-green-500" />
                <span>꿀팁 모음</span>
              </a>
              <a href="#types" className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <UtensilsCrossed className="w-4 h-4 mr-3 text-purple-500" />
                <span>업종별 가이드</span>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* 무한리필이란? */}
        <section id="basics" className="mb-12">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <Utensils className="w-6 h-6 mr-3 text-blue-500" />
                무한리필이란?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-gray-900">기본 개념</h3>
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

              <div>
                <h3 className="text-xl font-semibold mb-3 text-gray-900">일반적인 운영 방식</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="bg-orange-50 border-orange-200">
                    <CardContent className="p-4">
                      <Clock className="w-8 h-8 text-orange-500 mb-2" />
                      <h4 className="font-semibold text-orange-900 mb-2">시간 제한</h4>
                      <p className="text-orange-800 text-sm">보통 90분~120분 내에서 식사</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="p-4">
                      <Users className="w-8 h-8 text-purple-500 mb-2" />
                      <h4 className="font-semibold text-purple-900 mb-2">인원 제한</h4>
                      <p className="text-purple-800 text-sm">최소 인원 또는 예약 필요한 경우</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-4">
                      <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                      <h4 className="font-semibold text-red-900 mb-2">규칙 준수</h4>
                      <p className="text-red-800 text-sm">음식 남김 시 추가 요금 부과</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 이용 에티켓 */}
        <section id="etiquette" className="mb-12">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <Heart className="w-6 h-6 mr-3 text-red-500" />
                무한리필 이용 에티켓
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-green-900 flex items-center">
                  <ThumbsUp className="w-5 h-5 mr-2" />
                  지켜야 할 매너
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-green-800 mb-2">음식 관련</h4>
                    <ul className="text-green-700 space-y-1 text-sm">
                      <li>• 먹을 수 있는 만큼만 가져가기</li>
                      <li>• 음식 남기지 않기 (추가 요금 발생)</li>
                      <li>• 위생적으로 음식 가져가기</li>
                      <li>• 서빙 도구 올바르게 사용하기</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-800 mb-2">행동 관련</h4>
                    <ul className="text-green-700 space-y-1 text-sm">
                      <li>• 다른 손님들을 배려하기</li>
                      <li>• 줄서기 질서 지키기</li>
                      <li>• 큰 소리로 떠들지 않기</li>
                      <li>• 테이블 정리정돈 하기</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-red-900 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  주의사항
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-red-800 mb-2">금지 행위</h4>
                    <ul className="text-red-700 space-y-1 text-sm">
                      <li>• 음식 포장해서 가져가기</li>
                      <li>• 필요 이상으로 많이 가져가기</li>
                      <li>• 서빙 도구를 개인 그릇에 담그기</li>
                      <li>• 다른 손님들에게 방해되는 행동</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-800 mb-2">위반 시 조치</h4>
                    <ul className="text-red-700 space-y-1 text-sm">
                      <li>• 음식 남김 시 추가 요금</li>
                      <li>• 심한 경우 이용 제한</li>
                      <li>• 매장 규칙에 따른 페널티</li>
                      <li>• 다른 손님 신고 시 주의</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 꿀팁 모음 */}
        <section id="tips" className="mb-12">
          <Card className="border-0 shadow-lg">
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

                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center text-green-900">
                      <Users className="w-5 h-5 mr-2" />
                      함께 가기 좋은 구성
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-green-800 text-sm">
                      <li><Badge variant="secondary" className="mr-2">가족</Badge>아이들과 함께 다양한 음식 체험</li>
                      <li><Badge variant="secondary" className="mr-2">친구</Badge>2-4명이 가장 적당한 인원</li>
                      <li><Badge variant="secondary" className="mr-2">데이트</Badge>대화하며 여유롭게 식사</li>
                      <li><Badge variant="secondary" className="mr-2">회식</Badge>부담 없는 가격으로 단체 식사</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center text-purple-900">
                      <MapPin className="w-5 h-5 mr-2" />
                      매장 선택 기준
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-purple-800 text-sm">
                      <li><Badge variant="secondary" className="mr-2">리뷰</Badge>실제 이용자 후기 꼼꼼히 확인</li>
                      <li><Badge variant="secondary" className="mr-2">메뉴</Badge>원하는 음식 종류가 풍부한지</li>
                      <li><Badge variant="secondary" className="mr-2">위치</Badge>접근성과 주차 여부 확인</li>
                      <li><Badge variant="secondary" className="mr-2">시설</Badge>청결도와 분위기 고려</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 업종별 가이드 */}
        <section id="types" className="mb-12">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <UtensilsCrossed className="w-6 h-6 mr-3 text-purple-500" />
                업종별 무한리필 가이드
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* 고기집 */}
              <div className="border-l-4 border-red-500 pl-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <Soup className="w-5 h-5 mr-2 text-red-500" />
                  고기 무한리필
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">특징</h4>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 다양한 부위의 고기 제공</li>
                      <li>• 보통 90-120분 시간 제한</li>
                      <li>• 반찬과 음료 무제한 제공</li>
                      <li>• 그릴은 직접 구워먹는 방식</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">추천 팁</h4>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 마블링 좋은 부위부터 먼저</li>
                      <li>• 야채와 함께 먹어 느끼함 중화</li>
                      <li>• 소주나 맥주와 함께하면 더 맛있게</li>
                      <li>• 구이 정도는 개인 취향에 맞게</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 뷔페 */}
              <div className="border-l-4 border-blue-500 pl-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <Utensils className="w-5 h-5 mr-2 text-blue-500" />
                  뷔페 레스토랑
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">특징</h4>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 한식, 양식, 중식, 일식 다양</li>
                      <li>• 샐러드바와 디저트 구비</li>
                      <li>• 시간 제한 없는 경우 많음</li>
                      <li>• 특별한 날 이용하기 좋음</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">추천 팁</h4>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 가벼운 샐러드부터 시작</li>
                      <li>• 메인 요리는 소량씩 다양하게</li>
                      <li>• 디저트는 마지막에 여유 있게</li>
                      <li>• 신선한 음식 위주로 선택</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 샤브샤브/훠궈 */}
              <div className="border-l-4 border-green-500 pl-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <Coffee className="w-5 h-5 mr-2 text-green-500" />
                  샤브샤브 / 훠궈
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">특징</h4>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 육수에 재료를 직접 익혀먹기</li>
                      <li>• 다양한 채소와 고기 제공</li>
                      <li>• 개인 위생 중요</li>
                      <li>• 따뜻한 국물로 속 편함</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">추천 팁</h4>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 육수가 끓을 때까지 기다리기</li>
                      <li>• 고기는 완전히 익혀서 먹기</li>
                      <li>• 채소는 마지막에 넣어 식감 살리기</li>
                      <li>• 개인 젓가락으로 건져먹기</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 마무리 CTA */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-50 to-red-50">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              이제 무한리필 전문가가 되셨나요?
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              이 가이드를 참고해서 더욱 즐겁고 만족스러운 무한리필 경험을 만들어보세요. 
              Refill-spot에서 전국의 무한리필 맛집을 찾아보실 수 있습니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => router.push('/')}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <MapPin className="w-5 h-5 mr-2" />
                맛집 찾으러 가기
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => router.push('/recommendations')}
                className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 px-8 py-4 text-lg font-semibold rounded-full"
              >
                추천 맛집 보기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
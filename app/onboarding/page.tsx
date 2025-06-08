"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin,
  Search,
  Heart,
  Star,
  Users,
  Clock,
  ChevronRight,
  ChevronLeft,
  Utensils,
  Navigation,
  Filter,
  Smartphone,
  DollarSign,
  MessageCircle,
  Bookmark,
  Settings,
  Map,
  ArrowRight,
  Play,
  Sparkles,
  Zap,
  Target,
  Globe,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { setOnboardingCompleted } from "@/lib/onboarding-storage";

const onboardingSteps = [
  {
    id: 1,
    title: "내 주변 무한리필 맛집 발견",
    subtitle: "위치 기반 스마트 검색",
    description:
      "GPS를 활용해 현재 위치에서 가장 가까운 무한리필 식당들을 실시간으로 찾아드려요. 지도에서 한눈에 확인하고 바로 방문하세요.",
    icon: <Target className="w-16 h-16" />,
    gradient: "from-blue-500 to-cyan-400",
    features: [
      { text: "실시간 GPS 검색", icon: <Zap className="w-5 h-5" /> },
      { text: "지도 기반 탐색", icon: <Globe className="w-5 h-5" /> },
      { text: "거리별 정렬", icon: <Navigation className="w-5 h-5" /> },
    ],
    stats: { number: "500+", label: "등록된 맛집" },
  },
  {
    id: 2,
    title: "똑똑한 맞춤 검색",
    subtitle: "원하는 조건으로 정확하게",
    description:
      "음식 종류, 가격대, 평점까지 세밀한 필터링으로 취향에 딱 맞는 무한리필 식당을 찾아보세요. 시간 낭비 없이 바로 결정하세요.",
    icon: <Search className="w-16 h-16" />,
    gradient: "from-emerald-500 to-teal-400",
    features: [
      { text: "다중 필터 검색", icon: <Filter className="w-5 h-5" /> },
      { text: "가격대별 분류", icon: <DollarSign className="w-5 h-5" /> },
      { text: "실시간 추천", icon: <Sparkles className="w-5 h-5" /> },
    ],
    stats: { number: "98%", label: "검색 만족도" },
  },
  {
    id: 3,
    title: "신뢰할 수 있는 정보",
    subtitle: "실제 이용자들의 생생한 후기",
    description:
      "운영시간, 메뉴, 가격부터 실제 방문자들의 솔직한 리뷰까지. 모든 정보를 투명하게 공개해 현명한 선택을 도와드려요.",
    icon: <Star className="w-16 h-16" />,
    gradient: "from-amber-500 to-orange-400",
    features: [
      { text: "실시간 운영 정보", icon: <Clock className="w-5 h-5" /> },
      { text: "검증된 리뷰", icon: <MessageCircle className="w-5 h-5" /> },
      { text: "상세 메뉴 정보", icon: <Utensils className="w-5 h-5" /> },
    ],
    stats: { number: "4.8★", label: "평균 평점" },
  },
  {
    id: 4,
    title: "나만의 맛집 컬렉션",
    subtitle: "개인화된 맛집 관리",
    description:
      "마음에 드는 맛집을 저장하고 나만의 리스트를 만들어보세요. 친구들과 공유하고 새로운 맛집도 추천받을 수 있어요.",
    icon: <Heart className="w-16 h-16" />,
    gradient: "from-rose-500 to-pink-400",
    features: [
      { text: "즐겨찾기 저장", icon: <Bookmark className="w-5 h-5" /> },
      { text: "리스트 공유", icon: <Users className="w-5 h-5" /> },
      { text: "개인 추천", icon: <Settings className="w-5 h-5" /> },
    ],
    stats: { number: "10K+", label: "활성 사용자" },
  },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const router = useRouter();

  const nextStep = () => {
    if (currentStep < onboardingSteps.length - 1 && !isAnimating) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const prevStep = () => {
    if (currentStep > 0 && !isAnimating) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handleGetStarted = () => {
    // 온보딩 완료 상태 저장
    setOnboardingCompleted();
    router.push("/");
  };

  // 키보드 네비게이션 지원
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        nextStep();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevStep();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (currentStep === onboardingSteps.length - 1) {
          handleGetStarted();
        } else {
          nextStep();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep]);

  const currentStepData = onboardingSteps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full opacity-60 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full opacity-60 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-amber-50 to-orange-50 rounded-full opacity-40 blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 container mx-auto px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Utensils className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Refill Spot</h1>
              <p className="text-sm text-gray-500">무한리필 맛집 가이드</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>{currentStep + 1}</span>
            <span>/</span>
            <span>{onboardingSteps.length}</span>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="relative z-10 container mx-auto px-6 mb-12">
        <div className="flex items-center justify-center space-x-4">
          {onboardingSteps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-500 ${
                  index <= currentStep
                    ? "bg-gradient-to-r from-orange-500 to-red-500 scale-125"
                    : "bg-gray-200"
                }`}
              />
              {index < onboardingSteps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 transition-all duration-500 ${
                    index < currentStep ? "bg-orange-300" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <Card
            className={`border-0 shadow-2xl bg-white/80 backdrop-blur-sm transition-all duration-500 ${
              isAnimating ? "scale-95 opacity-50" : "scale-100 opacity-100"
            }`}
          >
            <CardContent className="p-0">
              <div className="relative overflow-hidden">
                {/* Gradient background for each step */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${currentStepData.gradient} opacity-5`}
                ></div>

                <div className="relative p-12 lg:p-16">
                  {/* Icon and stats */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8">
                    <div className="flex items-center space-x-6 mb-6 lg:mb-0">
                      <div
                        className={`p-4 rounded-2xl bg-gradient-to-br ${currentStepData.gradient} text-white shadow-lg`}
                      >
                        {currentStepData.icon}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-500 mb-1">
                          {currentStepData.subtitle}
                        </div>
                        <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                          {currentStepData.title}
                        </h2>
                      </div>
                    </div>

                    <div className="text-center lg:text-right">
                      <div
                        className={`text-3xl font-bold bg-gradient-to-r ${currentStepData.gradient} bg-clip-text text-transparent`}
                      >
                        {currentStepData.stats.number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {currentStepData.stats.label}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-3xl">
                    {currentStepData.description}
                  </p>

                  {/* Features */}
                  <div className="grid md:grid-cols-3 gap-6 mb-12">
                    {currentStepData.features.map((feature, index) => (
                      <div
                        key={index}
                        className="group flex items-center space-x-3 p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:scale-105"
                      >
                        <div
                          className={`p-2 rounded-lg bg-gradient-to-br ${currentStepData.gradient} text-white group-hover:scale-110 transition-transform duration-300`}
                        >
                          {feature.icon}
                        </div>
                        <span className="font-medium text-gray-700">
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={prevStep}
                      disabled={currentStep === 0}
                      className="flex items-center space-x-2 px-6 py-3 border-gray-200 hover:border-gray-300 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>이전</span>
                    </Button>

                    {currentStep === onboardingSteps.length - 1 ? (
                      <Button
                        onClick={handleGetStarted}
                        className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <Play className="w-5 h-5" />
                        <span>시작하기</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={nextStep}
                        className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <span>다음</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Skip option */}
          <div className="text-center mt-8">
            <Button
              variant="ghost"
              onClick={() => {
                // 건너뛰기도 온보딩 완료로 처리
                setOnboardingCompleted();
                router.push("/");
              }}
              className="text-gray-400 hover:text-gray-600 font-medium"
            >
              건너뛰고 바로 시작하기
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom info */}
      <div className="relative z-10 container mx-auto px-6 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-12 text-sm">
              <div className="flex items-center space-x-2 text-gray-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>10,000+ 만족한 사용자</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>500+ 검증된 맛집</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span>평균 4.8점 만족도</span>
              </div>
            </div>
            <div className="text-center mt-4 text-xs text-gray-400">
              키보드 탐색: ← → 방향키, 스페이스바, 엔터키
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

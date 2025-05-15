"use client";

import { useState, useEffect, useMemo } from "react";

// 지원 언어 정의
export type SupportedLocale = "ko" | "en";

// 한국어 번역
const koTranslations = {
  // 공통
  view_details: "상세 보기",
  close: "닫기",
  loading: "로딩 중...",
  error_occurred: "오류가 발생했습니다",
  try_again: "다시 시도",
  try_again_message: "문제가 발생했습니다. 다시 시도해 주세요.",
  no_description: "설명이 없습니다",
  no_distance_info: "거리 정보 없음",

  // 지도 관련
  map_aria_label: "무한리필 가게 지도",
  zoom_in: "확대",
  zoom_out: "축소",
  current_location: "현재 위치",
  naver: "네이버",
  kakao: "카카오",
  store_image_aria: "{name} 이미지",
  map_initialization_error: "지도 초기화 오류",
  map_initialization_error_description:
    "지도를 초기화하는 중 문제가 발생했습니다.",
  map_load_error: "지도 로딩 오류",
  map_load_error_description: "지도를 불러오는 중 문제가 발생했습니다.",
  marker_error: "마커 생성 오류",
  marker_error_description: "지도 마커를 생성하는 중 문제가 발생했습니다.",
  location_error: "위치 정보 오류",
  location_error_description: "현재 위치를 가져오는 중 문제가 발생했습니다.",
  location_not_supported: "위치 정보 지원 안됨",
  location_not_supported_description:
    "이 브라우저는 위치 정보를 지원하지 않습니다.",

  // 가게 관련
  store_load_error: "가게 정보 로드 오류",
  store_detail_error: "가게 상세 정보 로드 오류",
  no_search_results: "검색 결과가 없습니다",
  try_different_search: "다른 검색어나 필터 조건을 시도해보세요",
  all_stores: "모든 가게",

  // 필터 관련
  filter: "필터",
  reset: "초기화",
  category: "카테고리",
  radius: "반경 설정",
  min_rating: "최소 평점",
  apply_filter: "필터 적용",

  // 카테고리
  meat: "고기",
  seafood: "해산물",
  western: "양식",
  korean: "한식",

  // 리뷰 관련
  reviews: "리뷰",
  all_reviews: "모든 리뷰",
  write_review: "리뷰 작성",
  no_reviews: "아직 작성된 리뷰가 없습니다",
  average_rating: "평균 평점",
  rating: "평점",
  review_content: "리뷰 내용",
  submit_review: "리뷰 등록",
  processing: "처리 중...",

  // 인증 관련
  login_required: "로그인 필요",
  login_required_for_review: "리뷰를 작성하려면 로그인해주세요.",
  go_to_login: "로그인하러 가기",
  signup_success: "회원가입 성공",
  email_verification_sent: "이메일 인증 링크가 발송되었습니다.",
  login_success: "로그인 성공",
  welcome_back: "환영합니다!",
  logout_success: "로그아웃 성공",
  logged_out_message: "성공적으로 로그아웃되었습니다.",
  logout_error: "로그아웃 오류",
  logout_error_description: "로그아웃 처리 중 문제가 발생했습니다.",
  profile_updated: "프로필 업데이트 완료",
  profile_updated_description: "프로필 정보가 성공적으로 업데이트되었습니다.",
};

// 영어 번역 (필요시 추가)
const enTranslations = {
  // 공통
  view_details: "View Details",
  close: "Close",
  loading: "Loading...",
  error_occurred: "An error occurred",
  try_again: "Try Again",
  try_again_message: "Something went wrong. Please try again.",
  no_description: "No description available",
  no_distance_info: "No distance information",

  // 지도 관련
  map_aria_label: "Map of all-you-can-eat restaurants",
  zoom_in: "Zoom In",
  zoom_out: "Zoom Out",
  current_location: "Current Location",
  naver: "Naver",
  kakao: "Kakao",
  store_image_aria: "{name} image",
  map_initialization_error: "Map Initialization Error",
  map_initialization_error_description:
    "There was a problem initializing the map.",
  map_load_error: "Map Loading Error",
  map_load_error_description: "There was a problem loading the map.",
  marker_error: "Marker Creation Error",
  marker_error_description: "There was a problem creating map markers.",
  location_error: "Location Error",
  location_error_description:
    "There was a problem getting your current location.",
  location_not_supported: "Location Not Supported",
  location_not_supported_description:
    "This browser does not support geolocation.",

  // 가게 관련
  store_load_error: "Store Loading Error",
  store_detail_error: "Store Detail Loading Error",
  no_search_results: "No search results",
  try_different_search: "Try different search terms or filter conditions",
  all_stores: "All Stores",

  // 필터 관련
  filter: "Filter",
  reset: "Reset",
  category: "Category",
  radius: "Radius",
  min_rating: "Minimum Rating",
  apply_filter: "Apply Filter",

  // 카테고리
  meat: "Meat",
  seafood: "Seafood",
  western: "Western",
  korean: "Korean",

  // 리뷰 관련
  reviews: "Reviews",
  all_reviews: "All Reviews",
  write_review: "Write Review",
  no_reviews: "No reviews yet",
  average_rating: "Average Rating",
  rating: "Rating",
  review_content: "Review Content",
  submit_review: "Submit Review",
  processing: "Processing...",

  // 인증 관련
  login_required: "Login Required",
  login_required_for_review: "You need to login to write a review.",
  go_to_login: "Go to Login",
  signup_success: "Signup Success",
  email_verification_sent: "Email verification link has been sent.",
  login_success: "Login Success",
  welcome_back: "Welcome back!",
  logout_success: "Logout Success",
  logged_out_message: "Successfully logged out.",
  logout_error: "Logout Error",
  logout_error_description: "There was a problem logging out.",
  profile_updated: "Profile Updated",
  profile_updated_description:
    "Your profile information has been successfully updated.",
};

// 번역 타입 정의
type Translations = typeof koTranslations;

// 번역 맵 정의
const translations: Record<SupportedLocale, Translations> = {
  ko: koTranslations,
  en: enTranslations,
};

export function useTranslation() {
  // 기본 언어는 한국어
  const [locale, setLocale] = useState<SupportedLocale>("ko");

  // 브라우저 언어 감지
  useEffect(() => {
    const browserLocale = navigator.language.split("-")[0];
    if (browserLocale === "en") {
      setLocale("en");
    }
    // 나머지는 기본값인 한국어 유지
  }, []);

  // 현재 언어의 번역 객체 가져오기
  const currentTranslations = useMemo(() => {
    return translations[locale];
  }, [locale]);

  // 번역 함수
  const t = (key: keyof Translations, params?: Record<string, string>) => {
    // 해당 키에 대한 번역 가져오기
    let translation = currentTranslations[key] || key;

    // 파라미터가 있으면 치환
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(`{${param}}`, value);
      });
    }

    return translation;
  };

  // 언어 변경 함수
  const changeLocale = (newLocale: SupportedLocale) => {
    setLocale(newLocale);
  };

  return {
    t,
    locale,
    changeLocale,
  };
}

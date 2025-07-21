"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";
import { useReviews } from "@/hooks/use-reviews";
import { ReviewReportDialog } from "@/components/review-report-dialog";
import { FormattedReview } from "@/types/store";
import { formatDistanceToNow } from "date-fns";
import { enUS, ko } from "date-fns/locale";
import { Flag, Star, ThumbsUp, Upload, X, Image as ImageIcon, Filter, ChevronDown, Heart, MessageCircle, Share2, Sparkles, TrendingUp, Calendar, Award, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

interface StoreReviewsProps {
  storeId: number;
}

export function StoreReviews({ storeId }: StoreReviewsProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [userReview, setUserReview] = useState({
    rating: 0,
    content: "",
    imageUrls: [] as string[],
  });
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<number | null>(null);
  
  // 필터링 상태
  const [ratingFilter, setRatingFilter] = useState<string>("all"); // "all", "5", "4", "3", "2", "1"
  const [sortOption, setSortOption] = useState<string>("newest"); // "newest", "oldest", "highest", "lowest", "most_liked"
  const [showOnlyWithImages, setShowOnlyWithImages] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // 새로운 커스텀 훅 사용
  const {
    reviews: allReviews,
    loading,
    submitting,
    myReview,
    averageRating,
    totalReviews,
    actions: { submitReview, updateReview, deleteReview, toggleLike, reportReview }
  } = useReviews({ storeId });

  // 필터링된 리뷰 계산
  const filteredReviews = allReviews
    .filter(review => {
      // 평점 필터
      if (ratingFilter !== "all" && review.rating !== parseInt(ratingFilter)) {
        return false;
      }
      
      // 이미지 포함 필터
      if (showOnlyWithImages && (!review.imageUrls || review.imageUrls.length === 0)) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "highest":
          return b.rating - a.rating;
        case "lowest":
          return a.rating - b.rating;
        case "most_liked":
          return (b.likeCount || 0) - (a.likeCount || 0);
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const filteredCount = filteredReviews.length;
  
  // 필터링 상태를 고려한 평균 평점 계산
  const filterAverageRating = filteredReviews.length > 0 
    ? filteredReviews.reduce((sum, review) => sum + review.rating, 0) / filteredReviews.length
    : 0;

  // 활성 필터 수 계산
  const activeFiltersCount = [
    ratingFilter !== "all",
    sortOption !== "newest",
    showOnlyWithImages
  ].filter(Boolean).length;

  // 필터 초기화
  const resetFilters = () => {
    setRatingFilter("all");
    setSortOption("newest");
    setShowOnlyWithImages(false);
  };

  // 필터가 설정되면 필터 UI를 자동으로 펼침
  useEffect(() => {
    if (activeFiltersCount > 0 && !showFilters) {
      setShowFilters(true);
    }
  }, [activeFiltersCount, showFilters]);

  // 현재 사용자의 리뷰가 있는지 확인
  useEffect(() => {
    if (myReview) {
      setUserReview({
        rating: myReview.rating,
        content: myReview.content,
        imageUrls: myReview.imageUrls || [],
      });
      // 기존 이미지들을 미리보기로 설정
      if (myReview.imageUrls && myReview.imageUrls.length > 0) {
        setImagePreviewUrls(myReview.imageUrls);
      }
      // 자동 탭 전환 제거: 페이지 새로고침 시에도 기본 "all" 탭이 유지됨
    }
  }, [myReview]);

  // 이미지 업로드 핸들러
  const uploadImages = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];

    setUploadingImages(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('images', file);
      });

      const response = await fetch('/api/reviews/images/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '이미지 업로드에 실패했습니다.');
      }

      const data = await response.json();
      return data.imageUrls || [];
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      toast({
        title: '이미지 업로드 실패',
        description: error instanceof Error ? error.message : '이미지 업로드 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setUploadingImages(false);
    }
  };

  // 리뷰 제출 핸들러
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (userReview.rating < 1 || userReview.rating > 5) {
      toast({
        title: t("rating_error"),
        description: t("rating_error_description"),
        variant: "destructive",
      });
      return;
    }

    if (!userReview.content.trim()) {
      toast({
        title: t("content_error"),
        description: t("content_error_description"),
        variant: "destructive",
      });
      return;
    }

    // 새로 선택된 이미지가 있으면 업로드
    let finalImageUrls = [...userReview.imageUrls];
    if (selectedImages.length > 0) {
      const uploadedUrls = await uploadImages(selectedImages);
      if (uploadedUrls.length > 0) {
        finalImageUrls = [...finalImageUrls, ...uploadedUrls];
      }
    }

    const reviewData = {
      ...userReview,
      imageUrls: finalImageUrls,
    };

    const success = myReview 
      ? await updateReview(reviewData) 
      : await submitReview(reviewData);

    if (success) {
      // 성공 시 폼 초기화 (새 리뷰인 경우만)
      if (!myReview) {
        setUserReview({ rating: 0, content: "", imageUrls: [] });
        setSelectedImages([]);
        setImagePreviewUrls([]);
        // 새 리뷰 작성 후 리뷰 보기 탭으로 이동
        setActiveTab("all");
      } else {
        // 기존 리뷰 수정의 경우 선택된 이미지만 초기화
        setSelectedImages([]);
        // 미리보기를 업데이트된 이미지로 설정
        setImagePreviewUrls(finalImageUrls);
      }
    }
  };

  // 리뷰 삭제 핸들러
  const handleDeleteReview = async () => {
    if (!user || !myReview) return;

    const success = await deleteReview();
    if (success) {
      setUserReview({ rating: 0, content: "", imageUrls: [] });
      setSelectedImages([]);
      setImagePreviewUrls([]);
      setActiveTab("all");
    }
  };

  // 이미지 선택 핸들러
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxImages = 5;
    const currentImageCount = userReview.imageUrls.length + selectedImages.length;
    
    if (currentImageCount + files.length > maxImages) {
      toast({
        title: '이미지 개수 초과',
        description: `이미지는 최대 ${maxImages}개까지 첨부할 수 있습니다.`,
        variant: 'destructive',
      });
      return;
    }

    // 파일 크기 및 형식 검증
    const validFiles = files.filter(file => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: '지원하지 않는 파일 형식',
          description: 'JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.',
          variant: 'destructive',
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: '파일 크기 초과',
          description: '각 이미지는 5MB 이하여야 합니다.',
          variant: 'destructive',
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...validFiles]);
      
      // 미리보기 URL 생성
      const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file));
      setImagePreviewUrls(prev => [...prev, ...newPreviewUrls]);
    }

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 이미지 제거 핸들러
  const handleImageRemove = (index: number) => {
    const totalExistingImages = userReview.imageUrls.length;
    
    if (index < totalExistingImages) {
      // 기존 이미지 제거
      const newImageUrls = [...userReview.imageUrls];
      newImageUrls.splice(index, 1);
      setUserReview(prev => ({ ...prev, imageUrls: newImageUrls }));
    } else {
      // 새로 선택된 이미지 제거
      const selectedIndex = index - totalExistingImages;
      const newSelectedImages = [...selectedImages];
      newSelectedImages.splice(selectedIndex, 1);
      setSelectedImages(newSelectedImages);
      
      // 미리보기 URL 정리
      URL.revokeObjectURL(imagePreviewUrls[index]);
    }
    
    // 미리보기 URL 업데이트
    const newPreviewUrls = [...imagePreviewUrls];
    newPreviewUrls.splice(index, 1);
    setImagePreviewUrls(newPreviewUrls);
  };

  // 신고 핸들러
  const handleReportClick = (reviewId: number) => {
    setReportingReviewId(reviewId);
    setReportDialogOpen(true);
  };

  const handleReportSubmit = async (reason: string, description?: string) => {
    if (!reportingReviewId) return false;
    
    const success = await reportReview(reportingReviewId, reason, description);
    if (success) {
      setReportingReviewId(null);
    }
    return success;
  };

  // 리뷰 날짜 포맷팅
  const formatReviewDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: locale === "ko" ? ko : enUS,
      });
    } catch (error) {
      return dateString;
    }
  };

  // 평균 평점은 훅에서 가져옴

  // 별점 렌더링 도우미 함수
  const renderStars = (rating: number, maxStars = 5, size = "md") => {
    const sizeClasses = {
      sm: "h-3 w-3",
      md: "h-4 w-4", 
      lg: "h-5 w-5",
      xl: "h-6 w-6"
    };
    
    return Array.from({ length: maxStars }).map((_, i) => (
      <Star
        key={i}
        className={`${sizeClasses[size as keyof typeof sizeClasses]} ${
          i < Math.floor(rating)
            ? "fill-yellow-400 text-yellow-400"
            : i < rating
              ? "fill-yellow-400/50 text-yellow-400"
              : "fill-gray-200 text-gray-200"
        } transition-colors duration-200`}
      />
    ));
  };

  // 평점에 따른 색상 반환
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "text-green-600";
    if (rating >= 3.5) return "text-yellow-600";
    if (rating >= 2.5) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold mb-4">{t("reviews")}</h3>

      <Tabs 
        defaultValue="all" 
        value={activeTab} 
        onValueChange={setActiveTab}
        onClick={(e) => e.stopPropagation()}
      >
        <TabsList className="w-full grid grid-cols-2 mb-4">
          <TabsTrigger value="all">
            {t("all_reviews")} ({totalReviews})
          </TabsTrigger>
          <TabsTrigger value="write">{t("write_review")}</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {/* 필터 컨트롤 - 애플 스타일 */}
          <div className="mb-8">
            {/* 필터 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FF5722]/10 rounded-2xl flex items-center justify-center">
                    <Filter className="h-5 w-5 text-[#FF5722]" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">리뷰 필터</h4>
                    <p className="text-sm text-gray-500">원하는 리뷰만 찾아보세요</p>
                  </div>
                </div>
                {activeFiltersCount > 0 && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-orange-400 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-semibold">{activeFiltersCount}개 활성</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {activeFiltersCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-full font-medium hover:bg-red-100 transition-colors duration-200 flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    초기화
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-6 py-3 bg-white border-2 border-gray-200 rounded-2xl font-semibold text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-all duration-200 flex items-center gap-3 shadow-sm hover:shadow-md"
                >
                  <span>{showFilters ? '필터 닫기' : '필터 열기'}</span>
                  <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${
                    showFilters ? 'rotate-180' : ''
                  }`} />
                </button>
              </div>
            </div>
            
            {/* 필터 옵션들 */}
            <div className={`transition-all duration-500 ease-out overflow-hidden ${
              showFilters ? 'max-h-[800px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-4'
            }`}>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 평점 필터 */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Star className="h-5 w-5 text-[#FF5722]" />
                      <h5 className="text-lg font-semibold text-gray-900">평점별 필터</h5>
                    </div>
                    
                    <div className="space-y-2">
                      {[
                        { value: 'all', label: '전체', stars: 0 },
                        { value: '5', label: '5점', stars: 5 },
                        { value: '4', label: '4점', stars: 4 },
                        { value: '3', label: '3점', stars: 3 },
                        { value: '2', label: '2점', stars: 2 },
                        { value: '1', label: '1점', stars: 1 }
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setRatingFilter(option.value)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                            ratingFilter === option.value
                              ? 'bg-[#FF5722]/10 border-[#FF5722] text-[#FF5722] shadow-sm ring-1 ring-[#FF5722]/20'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-[#FF5722]/50 hover:bg-[#FF5722]/5 hover:text-[#FF5722]'
                          }`}
                        >
                          <span className="font-medium">{option.label}</span>
                          {option.stars > 0 && (
                            <div className="flex">
                              {renderStars(option.stars, 5, "sm")}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 정렬 옵션 */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-[#FF5722]" />
                      <h5 className="text-lg font-semibold text-gray-900">정렬 순서</h5>
                    </div>
                    
                    <div className="space-y-2">
                      {[
                        { value: 'newest', label: '최신순', desc: '방금 올라온 리뷰' },
                        { value: 'highest', label: '평점 높은순', desc: '높은 평점부터' },
                        { value: 'most_liked', label: '인기순', desc: '좋아요가 많은 리뷰' },
                        { value: 'oldest', label: '오래된순', desc: '오래된 리뷰부터' },
                        { value: 'lowest', label: '평점 낮은순', desc: '솔직한 리뷰' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSortOption(option.value)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                            sortOption === option.value
                              ? 'bg-[#FF5722]/10 border-[#FF5722] text-[#FF5722] shadow-sm ring-1 ring-[#FF5722]/20'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-[#FF5722]/50 hover:bg-[#FF5722]/5 hover:text-[#FF5722]'
                          }`}
                        >
                          <div className={`font-medium mb-1 ${
                            sortOption === option.value ? 'text-[#FF5722]' : 'text-gray-900'
                          }`}>
                            {option.label}
                          </div>
                          <div className={`text-xs ${
                            sortOption === option.value ? 'text-[#FF5722]/70' : 'text-gray-500'
                          }`}>
                            {option.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 콘텐츠 필터 */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <ImageIcon className="h-5 w-5 text-[#FF5722]" />
                      <h5 className="text-lg font-semibold text-gray-900">콘텐츠 필터</h5>
                    </div>
                    
                    {/* 사진 필터 */}
                    <button
                      type="button"
                      onClick={() => setShowOnlyWithImages(!showOnlyWithImages)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 mb-6 ${
                        showOnlyWithImages
                          ? 'bg-[#FF5722]/10 border-[#FF5722] text-[#FF5722] shadow-sm ring-1 ring-[#FF5722]/20'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-[#FF5722]/50 hover:bg-[#FF5722]/5 hover:text-[#FF5722]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <ImageIcon className="h-5 w-5" />
                        <div className="text-left">
                          <div className={`font-medium ${
                            showOnlyWithImages ? 'text-[#FF5722]' : 'text-gray-700'
                          }`}>
                            사진 있는 리뷰만
                          </div>
                          <div className={`text-xs ${
                            showOnlyWithImages ? 'text-[#FF5722]/70' : 'text-gray-500'
                          }`}>
                            현재 {allReviews.filter(r => r.imageUrls && r.imageUrls.length > 0).length}개 이미지 리뷰
                          </div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-200 ${
                        showOnlyWithImages
                          ? 'bg-[#FF5722] border-[#FF5722]'
                          : 'border-gray-300'
                      }`}>
                        {showOnlyWithImages && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>

                    {/* 필터 요약 */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-gray-600" />
                        <h6 className="font-semibold text-gray-900">필터 결과</h6>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">전체 리뷰</span>
                          <span className="font-semibold text-gray-900">{totalReviews}건</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">필터링된 리뷰</span>
                          <span className="font-semibold text-[#FF5722]">{filteredCount}건</span>
                        </div>
                        
                        {activeFiltersCount > 0 && (
                          <div className="pt-2 border-t border-gray-300">
                            <div className="text-xs text-gray-500 mb-2">적용된 필터</div>
                            <div className="flex flex-wrap gap-1">
                              {ratingFilter !== 'all' && (
                                <span className="px-2 py-1 bg-[#FF5722] text-white rounded-full text-xs font-medium">
                                  {ratingFilter}점
                                </span>
                              )}
                              {sortOption !== 'newest' && (
                                <span className="px-2 py-1 bg-blue-500 text-white rounded-full text-xs font-medium">
                                  {
                                    sortOption === 'oldest' ? '오래된순' :
                                    sortOption === 'highest' ? '높은평점' :
                                    sortOption === 'lowest' ? '낮은평점' :
                                    sortOption === 'most_liked' ? '인기순' : ''
                                  }
                                </span>
                              )}
                              {showOnlyWithImages && (
                                <span className="px-2 py-1 bg-purple-500 text-white rounded-full text-xs font-medium">
                                  사진만
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5722] mx-auto"></div>
              <p className="text-gray-500 mt-2">리뷰를 불러오는 중...</p>
            </div>
          ) : filteredReviews.length > 0 ? (
            <div className="space-y-4">
              {/* 평균 평점 표시 */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#FF5722]/10 rounded-2xl flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-[#FF5722]" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">고객 만족도</h3>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1">
                    <Award className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-600">공인 리뷰</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 items-center">
                  {/* 주 평점 */}
                  <div className="md:col-span-1">
                    <div className="text-center">
                      <div className="text-5xl font-bold text-gray-900 mb-3">
                        {(ratingFilter === "all" ? averageRating : filterAverageRating).toFixed(1)}
                      </div>
                      <div className="flex justify-center mb-3">
                        {renderStars(ratingFilter === "all" ? averageRating : filterAverageRating, 5, "lg")}
                      </div>
                      <div className="text-gray-600 font-medium">
                        {ratingFilter === "all" ? totalReviews : filteredCount}개 리뷰 기준
                      </div>
                      {ratingFilter !== "all" && (
                        <div className="text-sm text-gray-500 mt-1">
                          (전체 {totalReviews}개 중)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 평점 분포 */}
                  <div className="md:col-span-2">
                    <div className="space-y-3">
                      <div className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-700">
                        <TrendingUp className="h-4 w-4 text-[#FF5722]" />
                        평점 분포
                      </div>
                      {[5, 4, 3, 2, 1].map(rating => {
                        const count = allReviews.filter(r => Math.floor(r.rating) === rating).length;
                        const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                        return (
                          <div key={rating} className="flex items-center gap-4">
                            <div className="flex items-center gap-1 w-16">
                              <span className="font-semibold text-gray-700">{rating}</span>
                              <Star className="h-3 w-3 fill-[#FF5722] text-[#FF5722]" />
                            </div>
                            <div className="flex-1 relative">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-[#FF5722] rounded-full transition-all duration-700 ease-out"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-sm font-medium w-12 text-right text-gray-600">
                              {percentage}%
                            </div>
                            <div className="text-xs text-gray-500 w-8 text-right">
                              {count}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 추가 통계 */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {Math.round((allReviews.filter(r => r.rating >= 4).length / totalReviews) * 100) || 0}%
                    </div>
                    <div className="text-xs text-gray-500">우수 이상</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {allReviews.filter(r => r.imageUrls && r.imageUrls.length > 0).length}
                    </div>
                    <div className="text-xs text-gray-500">사진 리뷰</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {allReviews.reduce((sum, r) => sum + (r.likeCount || 0), 0)}
                    </div>
                    <div className="text-xs text-gray-500">총 좋아요</div>
                  </div>
                </div>
              </div>

              {/* 리뷰 목록 - 프리미엄 디자인 */}
              <div className="space-y-6">
                {filteredReviews.map((review) => (
                  <div key={review.id} className="group relative">
                    {/* 메인 카드 */}
                    <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
                      {/* 배경 오버레이 */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-full -translate-y-12 translate-x-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      
                      <div className="relative p-6" onClick={(e) => e.stopPropagation()}>
                        {/* 헤더 - 사용자 정보 및 평점 */}
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-start gap-4">
                            {/* 사용자 이니셜 아이콘 */}
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF5722] to-[#FF7043] flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
                              {review.user.username.substring(0, 1).toUpperCase()}
                            </div>
                            
                            {/* 사용자 정보 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-bold text-gray-900 text-lg">
                                  {review.user.username}
                                </h4>
                                {/* 리뷰 등급 배지 */}
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  allReviews.filter(r => r.user.username === review.user.username).length >= 5
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : allReviews.filter(r => r.user.username === review.user.username).length >= 2
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {
                                    allReviews.filter(r => r.user.username === review.user.username).length >= 5
                                      ? '활발한 리뷰어'
                                      : allReviews.filter(r => r.user.username === review.user.username).length >= 2
                                        ? '정규 리뷰어'
                                        : '신규 리뷰어'
                                  }
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{formatReviewDate(review.createdAt)}</span>
                                </div>
                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                <div className="flex items-center gap-1">
                                  <MessageCircle className="h-4 w-4" />
                                  <span>리뷰 {allReviews.filter(r => r.user.username === review.user.username).length}개</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* 평점 디스플레이 */}
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2 mb-2">
                              {renderStars(review.rating, 5, "md")}
                            </div>
                            <div className="text-right">
                              <span className={`text-2xl font-black ${getRatingColor(review.rating)}`}>
                                {review.rating}.0
                              </span>
                              <div className={`text-xs font-bold mt-1 px-2 py-1 rounded-full ${
                                review.rating >= 4.5 ? 'bg-green-100 text-green-800' :
                                review.rating >= 3.5 ? 'bg-blue-100 text-blue-800' :
                                review.rating >= 2.5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {review.rating >= 4.5 ? '우수' : 
                                 review.rating >= 3.5 ? '만족' :
                                 review.rating >= 2.5 ? '보통' : '아쉬움'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 리뷰 내용 */}
                        <div className="mb-6">
                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <p className="text-gray-800 leading-relaxed text-base">
                              {review.content}
                            </p>
                          </div>
                        </div>
                        
                        {/* 리뷰 이미지 갤러리 */}
                        {review.imageUrls && review.imageUrls.length > 0 && (
                          <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                              <ImageIcon className="h-5 w-5 text-gray-600" />
                              <span className="text-sm font-semibold text-gray-700">리뷰 사진</span>
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                                {review.imageUrls.length}장
                              </span>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                              {review.imageUrls.map((imageUrl, imageIndex) => (
                                <div key={imageIndex} className="relative group/image">
                                  <div className="aspect-square overflow-hidden rounded-2xl border-2 border-gray-100 shadow-sm group-hover/image:shadow-lg transition-shadow duration-300">
                                    <Image
                                      src={imageUrl}
                                      alt={`리뷰 이미지 ${imageIndex + 1}`}
                                      width={200}
                                      height={200}
                                      className="object-cover w-full h-full group-hover/image:scale-110 transition-transform duration-500"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  </div>
                                  {/* 이미지 오버레이 */}
                                  <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 rounded-2xl transition-colors duration-300 flex items-center justify-center">
                                    <div className="opacity-0 group-hover/image:opacity-100 transition-opacity duration-300">
                                      <div className="w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 액션 바 */}
                        <div className="flex items-center justify-between pt-5 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            {/* 좋아요 버튼 */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleLike(review.id);
                              }}
                              disabled={submitting}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                                review.isLikedByUser 
                                  ? "bg-[#FF5722] text-white shadow-sm" 
                                  : "bg-gray-100 text-gray-600 hover:bg-[#FF5722] hover:text-white"
                              }`}
                            >
                              <Heart 
                                className={`h-4 w-4 ${
                                  review.isLikedByUser ? "fill-current" : ""
                                }`} 
                              />
                              <span>좋아요</span>
                              {(review.likeCount || 0) > 0 && (
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  review.isLikedByUser 
                                    ? "bg-white/20 text-white" 
                                    : "bg-[#FF5722] text-white"
                                }`}>
                                  {review.likeCount}
                                </span>
                              )}
                            </button>
                            
                            {/* 신고 버튼 */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleReportClick(review.id);
                              }}
                              disabled={submitting}
                              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                            >
                              <Flag className="h-4 w-4" />
                              <span>신고</span>
                            </button>
                          </div>
                          
                        </div>
                      </div>

                      {/* 데코레이션 사이드 바 */}
                      <div className={`absolute left-0 top-0 w-1 h-full rounded-r-full ${
                        review.rating >= 4.5 ? 'bg-green-500' :
                        review.rating >= 3.5 ? 'bg-[#FF5722]' :
                        review.rating >= 2.5 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              {totalReviews > 0 ? (
                // 필터링으로 인해 결과가 없는 경우
                <>
                  <p className="text-gray-500 mb-2">필터 조건에 맞는 리뷰가 없습니다</p>
                  <p className="text-sm text-gray-400 mb-4">
                    다른 필터 조건을 시도해보세요
                  </p>
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="mr-2"
                  >
                    필터 초기화
                  </Button>
                </>
              ) : (
                // 전체 리뷰가 없는 경우
                <>
                  <p className="text-gray-500 mb-2">{t("no_reviews")}</p>
                  <p className="text-sm text-gray-400">{t("be_first_reviewer")}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setActiveTab("write")}
                  >
                    {t("write_first_review")}
                  </Button>
                </>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="write">
          {user ? (
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <label className="block mb-3 font-semibold text-gray-900">{t("rating")}</label>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setUserReview({ ...userReview, rating: star })
                        }
                        className="focus:outline-none hover:scale-110 transition-transform duration-200"
                        aria-label={`${star} ${t("stars")}`}
                      >
                        <Star
                          className={`h-8 w-8 ${
                            star <= userReview.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-gray-200 text-gray-200 hover:fill-yellow-200 hover:text-yellow-200"
                          } transition-colors duration-200`}
                        />
                      </button>
                    ))}
                  </div>
                  {userReview.rating > 0 && (
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${getRatingColor(userReview.rating)}`}>
                        {userReview.rating}.0
                      </span>
                      <span className="text-sm text-gray-600">
                        ({userReview.rating >= 4.5 ? "우수" : 
                          userReview.rating >= 3.5 ? "만족" :
                          userReview.rating >= 2.5 ? "보통" : "아쉬움"})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block mb-2 font-medium">
                  {t("review_content")}
                </label>
                <Textarea
                  className="w-full p-3 border rounded-md focus:ring-2 focus:ring-[#FF5722] focus:border-transparent min-h-[150px]"
                  placeholder={t("review_placeholder")}
                  value={userReview.content}
                  onChange={(e) =>
                    setUserReview({
                      ...userReview,
                      content: e.target.value,
                    })
                  }
                  required
                ></Textarea>
              </div>

              {/* 이미지 업로드 섹션 */}
              <div>
                <label className="block mb-2 font-medium flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  이미지 첨부 (선택사항)
                </label>
                
                {/* 이미지 미리보기 */}
                {imagePreviewUrls.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {imagePreviewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <Image
                            src={url}
                            alt={`미리보기 ${index + 1}`}
                            width={80}
                            height={80}
                            className="object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleImageRemove(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="이미지 제거"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 이미지 선택 버튼 */}
                {(userReview.imageUrls.length + selectedImages.length) < 5 && (
                  <div className="mb-4">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImages}
                      className="w-full border-dashed border-2 hover:border-[#FF5722] hover:bg-orange-50"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingImages ? '업로드 중...' : '이미지 선택 (최대 5개)'}
                    </Button>
                    <p className="text-xs text-gray-500 mt-1">
                      JPG, PNG, WebP 형식, 각 5MB 이하
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 bg-[#FF5722] hover:bg-[#E64A19]"
                  disabled={submitting || uploadingImages}
                >
                  {submitting || uploadingImages ? 
                    (uploadingImages ? '이미지 업로드 중...' : t("processing")) : 
                    (myReview ? t("update_review") : t("submit_review"))
                  }
                </Button>
                {myReview && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDeleteReview}
                    disabled={submitting || uploadingImages}
                    className="text-red-600 hover:text-red-700"
                  >
                    {t("delete_review")}
                  </Button>
                )}
              </div>
            </form>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500 mb-4">
                {t("login_required_for_review")}
              </p>
              <Link href="/login">
                <Button variant="outline">{t("go_to_login")}</Button>
              </Link>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 신고 다이얼로그 */}
      <ReviewReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        onSubmit={handleReportSubmit}
        submitting={submitting}
      />
    </div>
  );
}

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";
import { useReviews } from "@/hooks/use-reviews";
import { ReviewReportDialog } from "@/components/review-report-dialog";
import { FormattedReview } from "@/types/store";
import { formatDistanceToNow } from "date-fns";
import { enUS, ko } from "date-fns/locale";
import { Flag, Star, ThumbsUp, Upload, X, Image as ImageIcon, Filter, ChevronDown, Heart, MessageCircle, Share2, Sparkles, TrendingUp, Calendar, Award, Users, Trash2, Shield, ZoomIn, ChevronLeft, ChevronRight, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";

interface StoreReviewsProps {
  storeId: number;
  storeName?: string;
  showWriteForm?: boolean;
  onShowWriteFormChange?: (show: boolean) => void;
}

export function StoreReviews({ storeId, storeName, showWriteForm: externalShowWriteForm, onShowWriteFormChange }: StoreReviewsProps) {
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
  const [internalShowWriteForm, setInternalShowWriteForm] = useState(false);
  
  // 외부에서 제어하는 경우와 내부에서 제어하는 경우를 모두 지원
  const showWriteForm = externalShowWriteForm !== undefined ? externalShowWriteForm : internalShowWriteForm;
  const setShowWriteForm = (show: boolean) => {
    if (onShowWriteFormChange) {
      onShowWriteFormChange(show);
    } else {
      setInternalShowWriteForm(show);
    }
  };
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<number | null>(null);
  
  // 이미지 모달 상태
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [currentReviewImages, setCurrentReviewImages] = useState<string[]>([]);
  
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
    actions: { submitReview, updateReview, deleteReview, toggleLike, reportReview, fetchReviews },
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
    showOnlyWithImages,
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
    if (files.length === 0) {
return [];
}

    setUploadingImages(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append("images", file);
      });

      const response = await fetch("/api/reviews/images/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "이미지 업로드에 실패했습니다.");
      }

      const data = await response.json();
      return data.imageUrls || [];
    } catch (error) {
      console.error("이미지 업로드 오류:", error);
      toast({
        title: "이미지 업로드 실패",
        description: error instanceof Error ? error.message : "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
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
        // 새 리뷰 작성 후 폼 닫기
        setShowWriteForm(false);
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
    if (!user || !myReview) {
return;
}

    const success = await deleteReview();
    if (success) {
      setUserReview({ rating: 0, content: "", imageUrls: [] });
      setSelectedImages([]);
      setImagePreviewUrls([]);
      setShowWriteForm(false);
    }
  };

  // 관리자용 리뷰 삭제 핸들러
  const handleAdminDeleteReview = async (reviewId: number) => {
    if (!user || !profile?.is_admin) {
      toast({
        title: "권한 없음",
        description: "관리자 권한이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "리뷰 삭제에 실패했습니다.");
      }

      toast({
        title: "리뷰 삭제 완료",
        description: "리뷰가 성공적으로 삭제되었습니다.",
      });

      // 리뷰 목록 새로고침
      await fetchReviews();
    } catch (error) {
      console.error("관리자 리뷰 삭제 오류:", error);
      toast({
        title: "삭제 실패",
        description: error instanceof Error ? error.message : "리뷰 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 이미지 선택 핸들러
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxImages = 5;
    const currentImageCount = userReview.imageUrls.length + selectedImages.length;
    
    if (currentImageCount + files.length > maxImages) {
      toast({
        title: "이미지 개수 초과",
        description: `이미지는 최대 ${maxImages}개까지 첨부할 수 있습니다.`,
        variant: "destructive",
      });
      return;
    }

    // 파일 크기 및 형식 검증
    const validFiles = files.filter(file => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "지원하지 않는 파일 형식",
          description: "JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.",
          variant: "destructive",
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: "파일 크기 초과",
          description: "각 이미지는 5MB 이하여야 합니다.",
          variant: "destructive",
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
      fileInputRef.current.value = "";
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

  // 이미지 클릭 핸들러
  const handleImageClick = (imageUrl: string, reviewImages: string[], imageIndex: number) => {
    setSelectedImageUrl(imageUrl);
    setCurrentReviewImages(reviewImages);
    setCurrentImageIndex(imageIndex);
    setImageModalOpen(true);
  };

  // 이미지 네비게이션 핸들러
  const handlePrevImage = () => {
    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : currentReviewImages.length - 1;
    setCurrentImageIndex(newIndex);
    setSelectedImageUrl(currentReviewImages[newIndex]);
  };

  const handleNextImage = () => {
    const newIndex = currentImageIndex < currentReviewImages.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    setSelectedImageUrl(currentReviewImages[newIndex]);
  };

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!imageModalOpen) {
return;
}
      
      if (e.key === "ArrowLeft") {
        handlePrevImage();
      } else if (e.key === "ArrowRight") {
        handleNextImage();
      } else if (e.key === "Escape") {
        setImageModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageModalOpen, currentImageIndex, currentReviewImages]);

  // 신고 핸들러
  const handleReportClick = (reviewId: number) => {
    setReportingReviewId(reviewId);
    setReportDialogOpen(true);
  };

  const handleReportSubmit = async (reason: string, description?: string) => {
    if (!reportingReviewId) {
return false;
}
    
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
      xl: "h-6 w-6",
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
    if (rating >= 4.5) {
return "text-green-600";
}
    if (rating >= 3.5) {
return "text-yellow-600";
}
    if (rating >= 2.5) {
return "text-orange-600";
}
    return "text-red-600";
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">{t("reviews")} ({totalReviews})</h3>
      </div>

      {/* 리뷰 작성 폼 */}
      {showWriteForm && (
        <div className="mb-8 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
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
                      {uploadingImages ? "업로드 중..." : "이미지 선택 (최대 5개)"}
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
                    (uploadingImages ? "이미지 업로드 중..." : t("processing")) : 
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
        </div>
      )}

      {/* 리뷰 목록 */}
      <div>
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
                  <span>{showFilters ? "필터 닫기" : "필터 열기"}</span>
                  <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${
                    showFilters ? "rotate-180" : ""
                  }`} />
                </button>
              </div>
            </div>
            
            {/* 필터 옵션들 */}
            <div className={`transition-all duration-500 ease-out overflow-hidden ${
              showFilters ? "max-h-[800px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-4"
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
                        { value: "all", label: "전체", stars: 0 },
                        { value: "5", label: "5점", stars: 5 },
                        { value: "4", label: "4점", stars: 4 },
                        { value: "3", label: "3점", stars: 3 },
                        { value: "2", label: "2점", stars: 2 },
                        { value: "1", label: "1점", stars: 1 },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setRatingFilter(option.value)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                            ratingFilter === option.value
                              ? "bg-[#FF5722]/10 border-[#FF5722] text-[#FF5722] shadow-sm ring-1 ring-[#FF5722]/20"
                              : "bg-white border-gray-200 text-gray-700 hover:border-[#FF5722]/50 hover:bg-[#FF5722]/5 hover:text-[#FF5722]"
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
                        { value: "newest", label: "최신순", desc: "방금 올라온 리뷰" },
                        { value: "highest", label: "평점 높은순", desc: "높은 평점부터" },
                        { value: "most_liked", label: "인기순", desc: "좋아요가 많은 리뷰" },
                        { value: "oldest", label: "오래된순", desc: "오래된 리뷰부터" },
                        { value: "lowest", label: "평점 낮은순", desc: "솔직한 리뷰" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSortOption(option.value)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                            sortOption === option.value
                              ? "bg-[#FF5722]/10 border-[#FF5722] text-[#FF5722] shadow-sm ring-1 ring-[#FF5722]/20"
                              : "bg-white border-gray-200 text-gray-700 hover:border-[#FF5722]/50 hover:bg-[#FF5722]/5 hover:text-[#FF5722]"
                          }`}
                        >
                          <div className={`font-medium mb-1 ${
                            sortOption === option.value ? "text-[#FF5722]" : "text-gray-900"
                          }`}>
                            {option.label}
                          </div>
                          <div className={`text-xs ${
                            sortOption === option.value ? "text-[#FF5722]/70" : "text-gray-500"
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
                          ? "bg-[#FF5722]/10 border-[#FF5722] text-[#FF5722] shadow-sm ring-1 ring-[#FF5722]/20"
                          : "bg-white border-gray-200 text-gray-700 hover:border-[#FF5722]/50 hover:bg-[#FF5722]/5 hover:text-[#FF5722]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <ImageIcon className="h-5 w-5" />
                        <div className="text-left">
                          <div className={`font-medium ${
                            showOnlyWithImages ? "text-[#FF5722]" : "text-gray-700"
                          }`}>
                            사진 있는 리뷰만
                          </div>
                          <div className={`text-xs ${
                            showOnlyWithImages ? "text-[#FF5722]/70" : "text-gray-500"
                          }`}>
                            현재 {allReviews.filter(r => r.imageUrls && r.imageUrls.length > 0).length}개 이미지 리뷰
                          </div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-200 ${
                        showOnlyWithImages
                          ? "bg-[#FF5722] border-[#FF5722]"
                          : "border-gray-300"
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
                              {ratingFilter !== "all" && (
                                <span className="px-2 py-1 bg-[#FF5722] text-white rounded-full text-xs font-medium">
                                  {ratingFilter}점
                                </span>
                              )}
                              {sortOption !== "newest" && (
                                <span className="px-2 py-1 bg-blue-500 text-white rounded-full text-xs font-medium">
                                  {
                                    sortOption === "oldest" ? "오래된순" :
                                    sortOption === "highest" ? "높은평점" :
                                    sortOption === "lowest" ? "낮은평점" :
                                    sortOption === "most_liked" ? "인기순" : ""
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
              {/* 평균 평점 표시 - 다이닝코드 스타일 */}
              <div className="bg-white border border-gray-200 p-6 mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">{storeName || "가게"} 방문자 리뷰</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  {/* 왼쪽: 전체 평점 */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-6xl font-bold text-gray-900 mb-2">
                      {(ratingFilter === "all" ? averageRating : filterAverageRating).toFixed(1)}
                    </div>
                    <div className="flex justify-center mb-3">
                      {renderStars(ratingFilter === "all" ? averageRating : filterAverageRating, 5, "lg")}
                    </div>
                    <div className="font-medium text-center text-gray-900">
                      <span className="text-[#FF5722]">{ratingFilter === "all" ? totalReviews : filteredCount}건</span>의 리뷰가 작성되었어요.
                    </div>
                  </div>

                  {/* 오른쪽: 평점 분포 */}
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map(rating => {
                      const count = allReviews.filter(r => Math.floor(r.rating) === rating).length;
                      const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                      const label = rating === 5 ? "최고예요" : 
                                   rating === 4 ? "만족해요" : 
                                   rating === 3 ? "괜찮아요" : 
                                   rating === 2 ? "아쉬워요" : "별로예요";
                      
                      // 가장 많은 리뷰 개수 찾기
                      const maxCount = Math.max(...[5, 4, 3, 2, 1].map(r => 
                        allReviews.filter(review => Math.floor(review.rating) === r).length,
                      ));
                      const isHighest = count === maxCount && count > 0;
                      
                      return (
                        <div key={rating} className="flex items-center gap-3">
                          <div className="w-8 text-right font-medium text-gray-700">{rating}</div>
                          <div className={`flex-1 text-sm font-medium ${
                            isHighest ? "text-[#FF5722]" : "text-gray-600"
                          }`}>
                            {label}
                          </div>
                          <div className="flex-1 relative">
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-700 ease-out ${
                                  percentage > 0 ? "bg-[#FF5722]" : "bg-gray-200"
                                }`}
                                style={{ width: `${Math.max(percentage, 0)}%` }}
                              />
                            </div>
                          </div>
                          <div className="w-8 text-right text-sm text-gray-500">
                            ({count})
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 하단: 세부 평점 - 박스로 묶어서 표시 */}
                <div className="grid grid-cols-3 gap-6">
                  {(() => {
                    // 실제 리뷰 데이터에서 세부 평점 계산
                    const reviewsWithDetailedRatings = allReviews.filter(r => r.detailedRatings);
                    const tasteRatings = reviewsWithDetailedRatings.map(r => r.detailedRatings?.taste).filter((rating): rating is number => typeof rating === "number");
                    const priceRatings = reviewsWithDetailedRatings.map(r => r.detailedRatings?.price).filter((rating): rating is number => typeof rating === "number");
                    const serviceRatings = reviewsWithDetailedRatings.map(r => r.detailedRatings?.service).filter((rating): rating is number => typeof rating === "number");
                    
                    const avgTaste = tasteRatings.length > 0 ? tasteRatings.reduce((a, b) => a + b, 0) / tasteRatings.length : 0;
                    const avgPrice = priceRatings.length > 0 ? priceRatings.reduce((a, b) => a + b, 0) / priceRatings.length : 0;
                    const avgService = serviceRatings.length > 0 ? serviceRatings.reduce((a, b) => a + b, 0) / serviceRatings.length : 0;
                    
                    // 각 평점별 분포 계산
                    const calculateDistribution = (ratings: number[]) => {
                      if (ratings.length === 0) {
return { high: 0, medium: 0, low: 0 };
}
                      const high = ratings.filter(r => r >= 4).length;
                      const medium = ratings.filter(r => r === 3).length;
                      const low = ratings.filter(r => r <= 2).length;
                      const total = ratings.length;
                      return {
                        high: Math.round((high / total) * 100),
                        medium: Math.round((medium / total) * 100),
                        low: Math.round((low / total) * 100),
                      };
                    };
                    
                    const tasteDistribution = calculateDistribution(tasteRatings);
                    const priceDistribution = calculateDistribution(priceRatings);
                    const serviceDistribution = calculateDistribution(serviceRatings);
                    
                    return (
                      <>
                        {/* 맛 평점 박스 */}
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="text-center mb-3">
                            <div className="text-sm text-gray-600 mb-1 font-medium">맛</div>
                            <div className="text-2xl font-bold text-[#FF5722]">{avgTaste.toFixed(1)}</div>
                          </div>
                          
                          <div className="space-y-2">
                            {(() => {
                              const items = [
                                { label: "좋음", percentage: tasteDistribution.high },
                                { label: "보통", percentage: tasteDistribution.medium },
                                { label: "부족", percentage: tasteDistribution.low },
                              ];
                              const maxPercentage = Math.max(...items.map(item => item.percentage));
                              
                              return items.map((item) => {
                                const isHighest = item.percentage === maxPercentage && item.percentage > 0;
                                return (
                                  <div key={item.label} className="flex items-center gap-2 text-sm">
                                    <span className={`w-10 font-medium ${
                                      isHighest ? "text-[#FF5722]" : "text-gray-600"
                                    }`}>
                                      {item.label}
                                    </span>
                                    <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="h-full bg-[#FF5722] rounded-full" style={{ width: `${item.percentage}%` }}></div>
                                    </div>
                                    <span className="w-10 text-right text-gray-500">{item.percentage}%</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* 가격 평점 박스 */}
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="text-center mb-3">
                            <div className="text-sm text-gray-600 mb-1 font-medium">가격</div>
                            <div className="text-2xl font-bold text-[#FF5722]">{avgPrice.toFixed(1)}</div>
                          </div>
                          
                          <div className="space-y-2">
                            {(() => {
                              const items = [
                                { label: "만족", percentage: priceDistribution.high },
                                { label: "보통", percentage: priceDistribution.medium },
                                { label: "불만", percentage: priceDistribution.low },
                              ];
                              const maxPercentage = Math.max(...items.map(item => item.percentage));
                              
                              return items.map((item) => {
                                const isHighest = item.percentage === maxPercentage && item.percentage > 0;
                                return (
                                  <div key={item.label} className="flex items-center gap-2 text-sm">
                                    <span className={`w-10 font-medium ${
                                      isHighest ? "text-[#FF5722]" : "text-gray-600"
                                    }`}>
                                      {item.label}
                                    </span>
                                    <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="h-full bg-[#FF5722] rounded-full" style={{ width: `${item.percentage}%` }}></div>
                                    </div>
                                    <span className="w-10 text-right text-gray-500">{item.percentage}%</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* 응대 평점 박스 */}
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="text-center mb-3">
                            <div className="text-sm text-gray-600 mb-1 font-medium">응대</div>
                            <div className="text-2xl font-bold text-[#FF5722]">{avgService.toFixed(1)}</div>
                          </div>
                          
                          <div className="space-y-2">
                            {(() => {
                              const items = [
                                { label: "친절함", percentage: serviceDistribution.high },
                                { label: "보통", percentage: serviceDistribution.medium },
                                { label: "불친절", percentage: serviceDistribution.low },
                              ];
                              const maxPercentage = Math.max(...items.map(item => item.percentage));
                              
                              return items.map((item) => {
                                const isHighest = item.percentage === maxPercentage && item.percentage > 0;
                                return (
                                  <div key={item.label} className="flex items-center gap-2 text-sm">
                                    <span className={`w-10 font-medium ${
                                      isHighest ? "text-[#FF5722]" : "text-gray-600"
                                    }`}>
                                      {item.label}
                                    </span>
                                    <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="h-full bg-[#FF5722] rounded-full" style={{ width: `${item.percentage}%` }}></div>
                                    </div>
                                    <span className="w-10 text-right text-gray-500">{item.percentage}%</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 리뷰 목록 */}
              <div className="bg-white">
                {filteredReviews.map((review, reviewIndex) => (
                  <div key={review.id} className={`py-6 px-4 ${reviewIndex !== filteredReviews.length - 1 ? "border-b border-gray-100" : ""}`}>
                    {/* 헤더 - 사용자 정보 */}
                    <div className="flex items-start gap-4 mb-4">
                      {/* 사용자 아바타 */}
                      <Avatar className="w-16 h-16 border-2 border-gray-200 flex-shrink-0">
                        <AvatarImage src={review.user.avatar_url} alt={review.user.username} />
                        <AvatarFallback className="bg-gray-100">
                          <User className="w-8 h-8 text-gray-400" />
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        {/* 사용자 이름 */}
                        <h4 className="font-bold text-gray-900 text-lg mb-1">
                          {review.user.username}
                        </h4>
                        
                        {/* 사용자 통계 */}
                        <div className="text-sm text-gray-500">
                          평균 별점 {review.rating}.0 평가 {allReviews.filter(r => r.user.username === review.user.username).length}
                        </div>
                      </div>
                    </div>
                        
                    {/* 리뷰 이미지 갤러리 - 맨 위에 위치 */}
                    {review.imageUrls && review.imageUrls.length > 0 && (
                      <div className="mb-4">
                        <div className="grid grid-cols-4 gap-2">
                          {review.imageUrls.slice(0, 4).map((imageUrl, imageIndex) => (
                            <button
                              key={imageIndex}
                              type="button"
                              className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log("Image clicked:", imageUrl);
                                handleImageClick(imageUrl, review.imageUrls || [], imageIndex);
                              }}
                            >
                              <Image
                                src={imageUrl}
                                alt={`리뷰 이미지 ${imageIndex + 1}`}
                                fill
                                className="object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                              {/* 더보기 오버레이 (4번째 이미지에 추가 이미지가 있을 때) */}
                              {imageIndex === 3 && review.imageUrls && review.imageUrls.length > 4 && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                  <span className="text-white text-sm font-medium">
                                    +{review.imageUrls.length - 4}개 더보기
                                  </span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 별점과 날짜 */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {renderStars(review.rating, 5, "md")}
                        <span className="font-bold text-gray-900">{review.rating}점</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatReviewDate(review.createdAt)}
                      </div>
                    </div>

                    {/* 리뷰 내용 */}
                    <div className="mb-4">
                      <p className="text-gray-800 leading-relaxed text-base font-medium tracking-wide break-words whitespace-pre-wrap">
                        {review.content}
                      </p>
                    </div>

                    {/* 세부 평점 - 다이닝코드 스타일 */}
                    {review.detailedRatings && Object.keys(review.detailedRatings).length > 0 && (
                      <div className="mb-4">
                        <div className="flex gap-4 text-sm">
                          {(() => {
                            const ratings = [];
                            if (review.detailedRatings.taste) {
                              ratings.push(
                                <span key="taste" className="text-gray-700">
                                  <span className="font-medium">맛:</span> {review.detailedRatings.taste === 5 ? "맛있음" : review.detailedRatings.taste === 4 ? "괜찮음" : review.detailedRatings.taste === 3 ? "보통" : review.detailedRatings.taste === 2 ? "별로" : "맛없음"}
                                </span>,
                              );
                            }
                            if (review.detailedRatings.price) {
                              ratings.push(
                                <span key="price" className="text-gray-700">
                                  <span className="font-medium">가격:</span> {review.detailedRatings.price === 5 ? "저렴" : review.detailedRatings.price === 4 ? "적당" : review.detailedRatings.price === 3 ? "보통" : review.detailedRatings.price === 2 ? "비쌈" : "너무 비쌈"}
                                </span>,
                              );
                            }
                            if (review.detailedRatings.service) {
                              ratings.push(
                                <span key="service" className="text-gray-700">
                                  <span className="font-medium">응대:</span> {review.detailedRatings.service === 5 ? "친절함" : review.detailedRatings.service === 4 ? "괜찮음" : review.detailedRatings.service === 3 ? "보통" : review.detailedRatings.service === 2 ? "별로" : "불친절"}
                                </span>,
                              );
                            }
                            
                            return ratings.map((rating, index) => (
                              <span key={index} className="flex items-center gap-2">
                                {rating}
                                {index < ratings.length - 1 && (
                                  <span className="text-gray-400">|</span>
                                )}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    )}

                    {/* 메뉴 선택 */}
                    {review.menus && review.menus.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm">
                          <span className="font-bold text-gray-900">주문한 메뉴:</span>
                          <span className="ml-2 text-gray-700 font-medium">
                            {review.menus.join(" • ")}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 키워드 */}
                    {((review.keywords && review.keywords.length > 0) || (review.atmosphere && review.atmosphere.length > 0)) && (
                      <div className="mb-4">
                        <div className="text-sm">
                          <span className="font-bold text-gray-900">키워드:</span>
                          <span className="ml-2 text-gray-700 font-medium leading-relaxed">
                            {[...(review.keywords || []), ...(review.atmosphere || [])].join(" • ")}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 액션 바 */}
                    <div className="flex items-center gap-3 pt-3">
                      {/* 좋아요 버튼 */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleLike(review.id);
                        }}
                        disabled={submitting}
                        className={`flex items-center gap-1 text-sm transition-colors ${
                          review.isLikedByUser 
                            ? "text-[#FF5722]" 
                            : "text-gray-500 hover:text-[#FF5722]"
                        }`}
                      >
                        <Heart 
                          className={`h-4 w-4 ${
                            review.isLikedByUser ? "fill-current" : ""
                          }`} 
                        />
                        <span>좋아요</span>
                        {(review.likeCount || 0) > 0 && (
                          <span className="text-xs">
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
                        className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-700 transition-colors"
                      >
                        <Flag className="h-4 w-4" />
                        <span>신고</span>
                      </button>

                      {/* 관리자 삭제 버튼 */}
                      {profile?.is_admin && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const confirmed = window.confirm(
                              `관리자 권한으로 이 리뷰를 삭제하시겠습니까?\n\n작성자: ${review.user.username}\n평점: ${review.rating}점\n내용: ${review.content?.substring(0, 100)}${review.content && review.content.length > 100 ? "..." : ""}\n\n이 작업은 되돌릴 수 없습니다.`,
                            );
                            
                            if (confirmed) {
                              handleAdminDeleteReview(review.id);
                            }
                          }}
                          className="flex items-center gap-1 text-red-600 text-sm hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>삭제</span>
                        </button>
                      )}
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
                    onClick={() => setShowWriteForm(true)}
                  >
                    {t("write_first_review")}
                  </Button>
                </>
              )}
            </div>
          )}
      </div>

      {/* 신고 다이얼로그 */}
      <ReviewReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        onSubmit={handleReportSubmit}
        submitting={submitting}
      />

      {/* 이미지 확대 모달 */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-black/95 border-none">
          <DialogTitle className="sr-only">리뷰 이미지 확대보기</DialogTitle>
          <div className="relative w-full h-full flex items-center justify-center">
            {/* 닫기 버튼 */}
            <button
              onClick={() => setImageModalOpen(false)}
              className="absolute top-4 right-4 z-50 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors duration-200"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* 이미지 정보 */}
            <div className="absolute top-4 left-4 z-50 bg-black/50 backdrop-blur rounded-lg px-3 py-2">
              <span className="text-white text-sm font-medium">
                {currentImageIndex + 1} / {currentReviewImages.length}
              </span>
            </div>

            {/* 이전 버튼 */}
            {currentReviewImages.length > 1 && (
              <button
                onClick={handlePrevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors duration-200"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
            )}

            {/* 다음 버튼 */}
            {currentReviewImages.length > 1 && (
              <button
                onClick={handleNextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors duration-200"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            )}

            {/* 메인 이미지 */}
            <div className="relative w-full h-full flex items-center justify-center p-8">
              <Image
                src={selectedImageUrl}
                alt="확대된 리뷰 이미지"
                width={1200}
                height={800}
                className="max-w-full max-h-full object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder-image.png";
                }}
              />
            </div>

            {/* 하단 썸네일 (여러 이미지가 있을 때) */}
            {currentReviewImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
                <div className="flex gap-2 bg-black/50 backdrop-blur rounded-lg p-2">
                  {currentReviewImages.map((imageUrl, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentImageIndex(index);
                        setSelectedImageUrl(imageUrl);
                      }}
                      className={`relative w-12 h-12 rounded border-2 overflow-hidden transition-all duration-200 ${
                        index === currentImageIndex 
                          ? "border-white shadow-lg" 
                          : "border-gray-400 hover:border-gray-200"
                      }`}
                    >
                      <Image
                        src={imageUrl}
                        alt={`썸네일 ${index + 1}`}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 키보드 단축키 안내 */}
            <div className="absolute bottom-4 right-4 z-50 bg-black/50 backdrop-blur rounded-lg px-3 py-2 text-xs text-white/80">
              <div>← → 이미지 이동</div>
              <div>ESC 닫기</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

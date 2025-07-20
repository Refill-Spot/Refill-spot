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
import { Flag, Star, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  });
  const [activeTab, setActiveTab] = useState("all");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<number | null>(null);
  
  // 새로운 커스텀 훅 사용
  const {
    reviews,
    loading,
    submitting,
    myReview,
    averageRating,
    totalReviews,
    actions: { submitReview, updateReview, deleteReview, toggleLike, reportReview }
  } = useReviews({ storeId });

  // 현재 사용자의 리뷰가 있는지 확인
  useEffect(() => {
    if (myReview) {
      setUserReview({
        rating: myReview.rating,
        content: myReview.content,
      });
      // 사용자가 이미 리뷰를 작성했다면 작성 탭으로 자동 전환
      setActiveTab("write");
    }
  }, [myReview]);

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

    const success = myReview 
      ? await updateReview(userReview) 
      : await submitReview(userReview);

    if (success) {
      // 성공 시 폼 초기화 (새 리뷰인 경우만)
      if (!myReview) {
        setUserReview({ rating: 0, content: "" });
        // 새 리뷰 작성 후 리뷰 보기 탭으로 이동
        setActiveTab("all");
      }
      // 기존 리뷰 수정의 경우는 작성 탭에 유지
    }
  };

  // 리뷰 삭제 핸들러
  const handleDeleteReview = async () => {
    if (!user || !myReview) return;

    const success = await deleteReview();
    if (success) {
      setUserReview({ rating: 0, content: "" });
      setActiveTab("all");
    }
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
  const renderStars = (rating: number, maxStars = 5) => {
    return Array.from({ length: maxStars }).map((_, i) => (
      <Star
        key={i}
        className={`h-5 w-5 ${
          i < Math.floor(rating)
            ? "fill-[#FFA726] text-[#FFA726]"
            : i < rating
              ? "fill-[#FFA726]/50 text-[#FFA726]"
              : "fill-none text-gray-300"
        }`}
      />
    ));
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
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5722] mx-auto"></div>
              <p className="text-gray-500 mt-2">리뷰를 불러오는 중...</p>
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-4">
              {/* 평균 평점 표시 */}
              <div className="flex items-center gap-2 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex">{renderStars(averageRating)}</div>
                <span className="text-2xl font-bold">
                  {averageRating.toFixed(1)}
                </span>
                <span className="text-gray-500">
                  ({totalReviews} {t("reviews_count")})
                </span>
              </div>

              {/* 리뷰 목록 */}
              {reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${review.user.username}`}
                          />
                          <AvatarFallback>
                            {review.user.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-semibold block">
                            {review.user.username}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatReviewDate(review.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {renderStars(review.rating)}
                      </div>
                    </div>
                    <p className="text-gray-700 mt-2">{review.content}</p>
                    <div className="flex justify-between mt-4 pt-2 border-t border-gray-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`text-xs gap-1 ${
                          review.isLikedByUser 
                            ? "text-blue-600 hover:text-blue-700" 
                            : "text-gray-500 hover:text-blue-600"
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleLike(review.id);
                        }}
                        disabled={submitting}
                        type="button"
                      >
                        <ThumbsUp 
                          className={`h-3 w-3 ${
                            review.isLikedByUser ? "fill-current" : ""
                          }`} 
                        />
                        좋아요 {review.likeCount || 0}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-red-600 text-xs gap-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleReportClick(review.id);
                        }}
                        disabled={submitting}
                        type="button"
                      >
                        <Flag className="h-3 w-3" />
                        신고
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500 mb-2">{t("no_reviews")}</p>
              <p className="text-sm text-gray-400">{t("be_first_reviewer")}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setActiveTab("write")}
              >
                {t("write_first_review")}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="write">
          {user ? (
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block mb-2 font-medium">{t("rating")}</label>
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setUserReview({ ...userReview, rating: star })
                      }
                      className="focus:outline-none"
                      aria-label={`${star} ${t("stars")}`}
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= userReview.rating
                            ? "fill-[#FFA726] text-[#FFA726]"
                            : "fill-none text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
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

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 bg-[#FF5722] hover:bg-[#E64A19]"
                  disabled={submitting}
                >
                  {submitting ? t("processing") : (myReview ? t("update_review") : t("submit_review"))}
                </Button>
                {myReview && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDeleteReview}
                    disabled={submitting}
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

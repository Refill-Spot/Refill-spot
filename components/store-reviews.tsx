"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { FormattedReview } from "@/types/store";
import { formatDistanceToNow } from "date-fns";
import { enUS, ko } from "date-fns/locale";
import { Flag, Star, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface StoreReviewsProps {
  storeId: number;
  initialReviews: FormattedReview[];
}

export default function StoreReviews({
  storeId,
  initialReviews,
}: StoreReviewsProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [reviews, setReviews] = useState<FormattedReview[]>(
    initialReviews || [],
  );
  const [userReview, setUserReview] = useState({
    rating: 0,
    content: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const supabase = supabaseBrowser;

  // 현재 사용자의 리뷰가 있는지 확인
  useEffect(() => {
    if (user && reviews.length > 0) {
      const existingReview = reviews.find(
        (review) => review.user.id === user.id,
      );

      if (existingReview) {
        setUserReview({
          rating: existingReview.rating,
          content: existingReview.content,
        });
        // 사용자가 이미 리뷰를 작성했다면 작성 탭으로 자동 전환
        setActiveTab("write");
      }
    }
  }, [user, reviews]);

  // 모든 리뷰 가져오기
  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          `
          *,
          profiles:profiles(username)
        `,
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const formattedReviews = data.map((review) => ({
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.created_at,
        user: {
          id: review.user_id,
          username: review.profiles.username,
        },
      }));

      setReviews(formattedReviews);
    } catch (error) {
      console.error("리뷰 로드 오류:", error);
      toast({
        title: t("review_load_error"),
        description: t("review_load_error_description"),
        variant: "destructive",
      });
    }
  };

  // 리뷰 제출
  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: t("login_required"),
        description: t("login_required_for_review"),
      });
      return;
    }

    if (userReview.rating < 1 || userReview.rating > 5) {
      toast({
        title: t("rating_error"),
        description: t("rating_error_description"),
      });
      return;
    }

    if (!userReview.content.trim()) {
      toast({
        title: t("content_error"),
        description: t("content_error_description"),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 기존 리뷰 확인
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("user_id", user.id)
        .eq("store_id", storeId)
        .maybeSingle();

      let result;

      if (existingReview) {
        // 기존 리뷰 업데이트
        result = await supabase
          .from("reviews")
          .update({
            rating: userReview.rating,
            content: userReview.content,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingReview.id)
          .select(
            `
            *,
            profiles:profiles(username)
          `,
          )
          .single();

        toast({
          title: t("review_updated"),
          description: t("review_updated_description"),
        });
      } else {
        // 새 리뷰 추가
        result = await supabase
          .from("reviews")
          .insert({
            user_id: user.id,
            store_id: storeId,
            rating: userReview.rating,
            content: userReview.content,
          })
          .select(
            `
            *,
            profiles:profiles(username)
          `,
          )
          .single();

        toast({
          title: t("review_created"),
          description: t("review_created_description"),
        });
      }

      if (result.error) {
        throw result.error;
      }

      // 리뷰 목록 새로고침
      fetchReviews();

      // 탭 전환
      setActiveTab("all");
    } catch (error) {
      console.error("리뷰 제출 오류:", error);
      toast({
        title: t("review_submit_error"),
        description: t("review_submit_error_description"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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

  // 평균 평점 계산
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

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

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-2 mb-4">
          <TabsTrigger value="all">
            {t("all_reviews")} ({reviews.length})
          </TabsTrigger>
          <TabsTrigger value="write">{t("write_review")}</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {/* 평균 평점 표시 */}
              <div className="flex items-center gap-2 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex">{renderStars(avgRating)}</div>
                <span className="text-2xl font-bold">
                  {avgRating.toFixed(1)}
                </span>
                <span className="text-gray-500">
                  ({reviews.length} {t("reviews_count")})
                </span>
              </div>

              {/* 리뷰 목록 */}
              {reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-4">
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
                        className="text-gray-500 text-xs gap-1"
                      >
                        <ThumbsUp className="h-3 w-3" />
                        {t("helpful")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 text-xs gap-1"
                      >
                        <Flag className="h-3 w-3" />
                        {t("report")}
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
            <form onSubmit={submitReview} className="space-y-4">
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

              <Button
                type="submit"
                className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                disabled={isSubmitting}
              >
                {isSubmitting ? t("processing") : t("submit_review")}
              </Button>
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
    </div>
  );
}

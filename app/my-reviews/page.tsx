"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowLeft, Calendar, Star, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface MyReview {
  id: number;
  rating: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  store: {
    id: number;
    name: string;
    address: string;
    imageUrl: string | null;
  };
}

interface ReviewStatistics {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: { [key: number]: number };
}

export default function MyReviewsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [statistics, setStatistics] = useState<ReviewStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [ratingFilter, setRatingFilter] = useState<string>("all");

  // 리뷰 데이터 조회
  const fetchMyReviews = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        limit: "20",
        offset: "0",
      });

      if (ratingFilter) {
        params.append("rating", ratingFilter);
      }

      const response = await fetch(`/api/my-reviews?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews);
        setStatistics(data.statistics);
      } else {
        throw new Error("리뷰 조회 실패");
      }
    } catch (error) {
      console.error("내 리뷰 조회 오류:", error);
      toast({
        title: "오류 발생",
        description: "리뷰를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, sortBy, sortOrder, ratingFilter, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchMyReviews();
    } else if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, fetchMyReviews, router]);

  // 별점 렌더링
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? "fill-yellow-400 text-yellow-400"
            : "fill-none text-gray-300"
        }`}
      />
    ));
  };

  // 날짜 포맷팅
  const formatReviewDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: ko,
      });
    } catch (error) {
      return dateString;
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              돌아가기
            </Button>
            <h1 className="text-xl font-bold text-gray-900">
              내가 작성한 리뷰
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 통계 카드 */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">총 리뷰 수</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {statistics.totalReviews}개
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Star className="h-5 w-5 text-yellow-600 fill-current" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">평균 평점</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {statistics.averageRating.toFixed(1)}점
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">최근 활동</p>
                    <p className="text-sm font-medium text-gray-900">
                      {reviews.length > 0
                        ? formatReviewDate(reviews[0].createdAt)
                        : "리뷰 없음"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 필터 및 정렬 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">필터 및 정렬</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">정렬:</label>
                <Select
                  value={`${sortBy}-${sortOrder}`}
                  onValueChange={(value) => {
                    const [newSortBy, newSortOrder] = value.split("-");
                    setSortBy(newSortBy);
                    setSortOrder(newSortOrder);
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at-desc">최신순</SelectItem>
                    <SelectItem value="created_at-asc">오래된순</SelectItem>
                    <SelectItem value="rating-desc">평점 높은순</SelectItem>
                    <SelectItem value="rating-asc">평점 낮은순</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">평점:</label>
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="5">5점</SelectItem>
                    <SelectItem value="4">4점</SelectItem>
                    <SelectItem value="3">3점</SelectItem>
                    <SelectItem value="2">2점</SelectItem>
                    <SelectItem value="1">1점</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 리뷰 목록 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5722] mx-auto"></div>
            <p className="text-gray-500 mt-2">리뷰를 불러오는 중...</p>
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card
                key={review.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    {/* 가게 이미지 */}
                    <div className="flex-shrink-0">
                      <Avatar className="h-16 w-16 rounded-lg">
                        <AvatarImage
                          src={review.store.imageUrl || undefined}
                          alt={review.store.name}
                          className="object-cover"
                        />
                        <AvatarFallback className="rounded-lg bg-gray-100">
                          <div className="text-gray-400 text-xs">이미지</div>
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* 리뷰 내용 */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {review.store.name}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2">
                            {review.store.address}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {renderStars(review.rating)}
                          <span className="ml-1 text-sm font-medium">
                            {review.rating}
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-700 mb-3 line-clamp-3">
                        {review.content}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{formatReviewDate(review.createdAt)}</span>
                          {review.updatedAt !== review.createdAt && (
                            <Badge variant="secondary" className="text-xs">
                              수정됨
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/store/${review.store.id}`)
                          }
                        >
                          가게 보기
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Star className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                아직 작성한 리뷰가 없습니다
              </h3>
              <p className="text-gray-600 mb-6">
                방문한 가게에 첫 번째 리뷰를 작성해보세요!
              </p>
              <Button onClick={() => router.push("/")}>가게 찾아보기</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

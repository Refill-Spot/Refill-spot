"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle,
  Trash2,
  CheckCircle,
  XCircle,
  Star,
  Calendar,
  User,
  MapPin,
  Eye,
  EyeOff,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Review {
  id: string;
  rating: number;
  content: string;
  created_at: string;
  updated_at: string;
  image_urls?: string[];
  is_reported: boolean;
  report_count: number;
  store_id: string;
  stores: {
    id: string;
    name: string;
    address: string;
  };
  profiles: {
    id: string;
    username: string;
    email: string;
  };
}

interface ReviewsResponse {
  reviews: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export default function AdminReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  });
  const [adminCheck, setAdminCheck] = useState<{isAdmin: boolean, loading: boolean}>({
    isAdmin: false,
    loading: true,
  });

  // 관리자 권한 확인
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/auth/check-admin");
        const data = await response.json();
        
        if (!data.success || !data.data.isAdmin) {
          router.push("/unauthorized");
          return;
        }
        
        setAdminCheck({ isAdmin: true, loading: false });
      } catch (error) {
        console.error("관리자 권한 확인 오류:", error);
        router.push("/unauthorized");
      }
    };

    checkAdmin();
  }, [router]);

  // 리뷰 목록 로드
  const loadReviews = async (page: number = 1, reportedOnly: boolean = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        reported_only: reportedOnly.toString(),
      });

      const response = await fetch(`/api/admin/reviews?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "리뷰를 불러오는데 실패했습니다.");
      }

      const reviewsData: ReviewsResponse = data.data;
      setReviews(reviewsData.reviews);
      setPagination(reviewsData.pagination);
      setError(null);
    } catch (error) {
      console.error("리뷰 로드 오류:", error);
      setError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 탭 변경시 리뷰 로드
  useEffect(() => {
    if (adminCheck.isAdmin) {
      const reportedOnly = activeTab === "reported";
      loadReviews(1, reportedOnly);
    }
  }, [activeTab, adminCheck.isAdmin]);

  // 리뷰 삭제
  const handleDeleteReview = async (reviewId: string) => {
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "리뷰 삭제에 실패했습니다.");
      }

      // 리뷰 목록 새로고침
      loadReviews(pagination.page, activeTab === "reported");
    } catch (error) {
      console.error("리뷰 삭제 오류:", error);
      setError(error instanceof Error ? error.message : "리뷰 삭제 중 오류가 발생했습니다.");
    }
  };

  // 리뷰 신고 상태 업데이트
  const handleReviewAction = async (reviewId: string, action: "approve" | "reject") => {
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "리뷰 상태 업데이트에 실패했습니다.");
      }

      // 리뷰 목록 새로고침
      loadReviews(pagination.page, activeTab === "reported");
    } catch (error) {
      console.error("리뷰 상태 업데이트 오류:", error);
      setError(error instanceof Error ? error.message : "리뷰 상태 업데이트 중 오류가 발생했습니다.");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR");
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "text-yellow-400 fill-current" : "text-gray-300"}`}
      />
    ));
  };

  if (adminCheck.loading) {
    return <div className="p-6">권한 확인 중...</div>;
  }

  if (!adminCheck.isAdmin) {
    return null; // 리다이렉트됨
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">리뷰 관리</h1>
        <p className="text-gray-600">사용자 리뷰를 관리하고 신고된 리뷰를 처리할 수 있습니다.</p>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            전체 리뷰
          </TabsTrigger>
          <TabsTrigger value="reported" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            신고된 리뷰
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {loading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {activeTab === "reported" ? "신고된 리뷰가 없습니다." : "리뷰가 없습니다."}
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                총 {pagination.total}개의 리뷰 (페이지 {pagination.page})
              </div>
              
              <div className="space-y-4">
                {reviews.map((review) => (
                  <Card key={review.id} className={`${review.is_reported ? "border-red-200 bg-red-50" : ""}`}>
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{review.stores.name}</CardTitle>
                            {review.is_reported && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                신고됨 ({review.report_count})
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {review.profiles.username}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {review.stores.address}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(review.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderStars(review.rating)}
                          <span className="text-sm text-gray-600">({review.rating})</span>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {review.content && (
                        <p className="text-gray-700 leading-relaxed">{review.content}</p>
                      )}
                      
                      {review.image_urls && review.image_urls.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {review.image_urls.map((url, index) => (
                            <img
                              key={index}
                              src={url}
                              alt={`리뷰 이미지 ${index + 1}`}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-xs text-gray-500">
                          리뷰 ID: {review.id}
                        </div>
                        <div className="flex gap-2">
                          {review.is_reported && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReviewAction(review.id, "approve")}
                                className="flex items-center gap-1"
                              >
                                <CheckCircle className="h-4 w-4" />
                                승인 (정상화)
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReviewAction(review.id, "reject")}
                                className="flex items-center gap-1"
                              >
                                <XCircle className="h-4 w-4" />
                                거부
                              </Button>
                            </>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="flex items-center gap-1"
                              >
                                <Trash2 className="h-4 w-4" />
                                삭제
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>리뷰 삭제 확인</AlertDialogTitle>
                                <AlertDialogDescription>
                                  이 리뷰를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                  <br /><br />
                                  <strong>작성자:</strong> {review.profiles.username}<br />
                                  <strong>매장:</strong> {review.stores.name}<br />
                                  <strong>내용:</strong> {review.content?.substring(0, 100)}...
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteReview(review.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 페이지네이션 */}
              {pagination.hasMore && (
                <div className="text-center mt-6">
                  <Button
                    onClick={() => loadReviews(pagination.page + 1, activeTab === "reported")}
                    disabled={loading}
                  >
                    더 보기
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
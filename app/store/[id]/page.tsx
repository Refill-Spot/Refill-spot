"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getStoreById } from "@/lib/stores";
import { ArrowLeft, Navigation, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { Store } from "@/lib/stores";

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const [store, setStore] = useState<Store | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userReview, setUserReview] = useState({ rating: 0, content: "" });
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 가게 정보 및 리뷰 로드
  useEffect(() => {
    const fetchStoreData = async () => {
      if (!params.id) return;

      try {
        setLoading(true);
        const storeData = await getStoreById(parseInt(params.id as string));

        if (!storeData) {
          toast({
            title: "오류",
            description: "가게 정보를 찾을 수 없습니다.",
            variant: "destructive",
          });
          router.push("/");
          return;
        }

        setStore(storeData);

        // 리뷰 가져오기
        const { data: reviewsData, error: reviewsError } = await supabase
          .from("reviews")
          .select(
            `
            *,
            profiles:profiles(username)
          `
          )
          .eq("store_id", storeData.id)
          .order("created_at", { ascending: false });

        if (reviewsError) {
          throw reviewsError;
        }

        setReviews(reviewsData);

        // 현재 로그인한 사용자 확인
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);

        // 사용자의 리뷰가 있는지 확인
        if (user) {
          const userReviewData = reviewsData.find(
            (review) => review.user_id === user.id
          );

          if (userReviewData) {
            setUserReview({
              rating: userReviewData.rating,
              content: userReviewData.content,
            });
          }
        }
      } catch (error) {
        console.error("가게 정보 로드 오류:", error);
        toast({
          title: "오류",
          description: "가게 정보를 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [params.id, router]);

  // 즐겨찾기 상태 관리
  const [isFavorite, setIsFavorite] = useState(false);

  // 즐겨찾기 상태 확인
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!user || !store) return;

      const { data, error } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("store_id", store.id)
        .single();

      if (!error && data) {
        setIsFavorite(true);
      } else {
        setIsFavorite(false);
      }
    };

    checkFavoriteStatus();
  }, [user, store]);

  // 즐겨찾기 토글
  const toggleFavorite = async () => {
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "즐겨찾기 기능을 사용하려면 로그인해주세요.",
      });
      router.push("/login");
      return;
    }

    if (!store) {
      toast({
        title: "오류",
        description: "가게 정보를 불러올 수 없습니다.",
      });
      return;
    }

    try {
      if (isFavorite) {
        // 즐겨찾기 삭제
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("store_id", store!.id);

        if (error) throw error;

        setIsFavorite(false);
        toast({
          title: "즐겨찾기 해제",
          description: "즐겨찾기에서 삭제되었습니다.",
        });
      } else {
        // 즐겨찾기 추가
        const { error } = await supabase.from("favorites").insert({
          user_id: user.id,
          store_id: store!.id,
        });

        if (error) throw error;

        setIsFavorite(true);
        toast({
          title: "즐겨찾기 추가",
          description: "즐겨찾기에 추가되었습니다.",
        });
      }
    } catch (error) {
      console.error("즐겨찾기 오류:", error);
      toast({
        title: "오류",
        description: "즐겨찾기 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 리뷰 제출
  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "로그인 필요",
        description: "리뷰를 작성하려면 로그인해주세요.",
      });
      router.push("/login");
      return;
    }

    if (!store) {
      toast({
        title: "오류",
        description: "가게 정보를 불러올 수 없습니다.",
      });
      return;
    }

    if (userReview.rating < 1 || userReview.rating > 5) {
      toast({
        title: "평점 오류",
        description: "평점은 1에서 5 사이의 값이어야 합니다.",
      });
      return;
    }

    if (!userReview.content.trim()) {
      toast({
        title: "내용 오류",
        description: "리뷰 내용을 입력해주세요.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 리뷰가 있는지 확인
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("user_id", user.id)
        .eq("store_id", store!.id)
        .maybeSingle();

      if (existingReview) {
        // 기존 리뷰 업데이트
        const { data, error } = await supabase
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
          `
          )
          .single();

        if (error) throw error;

        // 리뷰 목록 업데이트
        setReviews(
          reviews.map((review) => (review.id === data.id ? data : review))
        );

        toast({
          title: "리뷰 업데이트",
          description: "리뷰가 성공적으로 업데이트되었습니다.",
        });
      } else {
        // 새 리뷰 추가
        const { data, error } = await supabase
          .from("reviews")
          .insert({
            user_id: user.id,
            store_id: store!.id,
            rating: userReview.rating,
            content: userReview.content,
          })
          .select(
            `
            *,
            profiles:profiles(username)
          `
          )
          .single();

        if (error) throw error;

        // 리뷰 목록 업데이트
        setReviews([data, ...reviews]);

        toast({
          title: "리뷰 등록",
          description: "리뷰가 성공적으로 등록되었습니다.",
        });
      }
    } catch (error) {
      console.error("리뷰 제출 오류:", error);
      toast({
        title: "오류",
        description: "리뷰 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722]"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-8 text-center">가게 정보를 불러올 수 없습니다.</div>
    );
  }

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

  // store는 여기서 확실히 null이 아님
  const storeData = store as Store;

  return (
    <div className="bg-white min-h-screen">
      <div className="sticky top-0 z-10 bg-white p-4 flex items-center gap-2 border-b">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">뒤로 가기</span>
        </Button>
        <h2 className="text-lg font-bold">{storeData.name}</h2>
      </div>

      {/* 가게 이미지 (플레이스 홀더) */}
      <div
        className="w-full h-48 md:h-64 bg-gray-200"
        style={{
          backgroundImage: `url('/placeholder.svg?height=200&width=400')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      ></div>

      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        {/* 가게 정보 */}
        <Card>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-[#333333]">
                  {storeData.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center">
                    {renderStars(storeData.rating.naver)}
                    <span className="ml-2 text-sm text-gray-500">(네이버)</span>
                  </div>
                  <span className="mx-1">|</span>
                  <div className="flex items-center">
                    {renderStars(storeData.rating.kakao)}
                    <span className="ml-2 text-sm text-gray-500">(카카오)</span>
                  </div>
                </div>
              </div>

              <Button
                variant={isFavorite ? "destructive" : "outline"}
                size="sm"
                onClick={toggleFavorite}
              >
                {isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
              </Button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <p className="text-sm md:text-base text-gray-600">
                {storeData.address}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    // 네이버 지도 앱으로 연결
                    const naverMapUrl = `nmap://place?lat=${
                      storeData.position.lat
                    }&lng=${storeData.position.lng}&name=${encodeURIComponent(
                      storeData.name
                    )}&appname=com.example.myapp`;
                    window.location.href = naverMapUrl;

                    // 앱이 설치되어 있지 않은 경우를 위한 대체 URL (1초 후)
                    setTimeout(() => {
                      window.location.href = `https://map.naver.com/v5/search/${encodeURIComponent(
                        storeData.name
                      )}`;
                    }, 1000);
                  }}
                >
                  <Navigation className="h-4 w-4 text-[#2196F3]" />
                  <span>네이버 길찾기</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    // 카카오 지도 앱으로 연결
                    const kakaoMapUrl = `kakaomap://look?p=${storeData.position.lat},${storeData.position.lng}`;
                    window.location.href = kakaoMapUrl;

                    // 앱이 설치되어 있지 않은 경우를 위한 대체 URL (1초 후)
                    setTimeout(() => {
                      window.location.href = `https://map.kakao.com/link/to/${encodeURIComponent(
                        storeData.name
                      )},${storeData.position.lat},${storeData.position.lng}`;
                    }, 1000);
                  }}
                >
                  <Navigation className="h-4 w-4 text-[#FFA726]" />
                  <span>카카오 길찾기</span>
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">카테고리</h4>
              <div className="flex flex-wrap gap-2">
                {storeData.categories.map((category: string, index: number) => (
                  <Badge key={index} variant="secondary" className="px-2 py-1">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">운영 시간</h4>
              <p className="text-sm text-gray-600">
                {storeData.openHours || "운영 시간 정보가 없습니다."}
              </p>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">무한리필 메뉴</h4>
              <div className="text-sm text-gray-600 space-y-1">
                {storeData.refillItems && storeData.refillItems.length > 0 ? (
                  storeData.refillItems.map((item: string, index: number) => (
                    <p key={index}>- {item}</p>
                  ))
                ) : (
                  <p>메뉴 정보가 없습니다.</p>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">가격</h4>
              <p className="text-sm text-gray-600 font-semibold">
                {storeData.price || "가격 정보가 없습니다."}
              </p>
            </div>

            {storeData.description && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">매장 설명</h4>
                  <p className="text-sm text-gray-600">
                    {storeData.description}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 리뷰 섹션 */}
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">리뷰</h3>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full grid grid-cols-2 mb-4">
              <TabsTrigger value="all">
                모든 리뷰 ({reviews.length})
              </TabsTrigger>
              <TabsTrigger value="write">리뷰 작성</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <Card key={review.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold">
                            {review.profiles.username}
                          </span>
                          <div className="flex items-center">
                            {renderStars(review.rating)}
                            <span className="ml-2 text-sm text-gray-500">
                              {new Date(review.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-700">{review.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">아직 작성된 리뷰가 없습니다.</p>
                  {/* 평균 평점 표시 */}
                  {avgRating > 0 && (
                    <div className="mt-2 flex justify-center items-center gap-2">
                      <span className="text-sm text-gray-600">평균 평점:</span>
                      <div className="flex">{renderStars(avgRating)}</div>
                      <span className="text-sm font-medium">
                        ({avgRating.toFixed(1)})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="write">
              {user ? (
                <form onSubmit={submitReview} className="space-y-4">
                  <div>
                    <label className="block mb-2 font-medium">평점</label>
                    <div className="flex gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setUserReview({ ...userReview, rating: star })
                          }
                          className="focus:outline-none"
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
                    <label className="block mb-2 font-medium">리뷰 내용</label>
                    <textarea
                      className="w-full p-3 border rounded-md focus:ring-2 focus:ring-[#FF5722] focus:border-transparent min-h-[150px]"
                      placeholder="이 가게에 대한 리뷰를 작성해주세요."
                      value={userReview.content}
                      onChange={(e) =>
                        setUserReview({
                          ...userReview,
                          content: e.target.value,
                        })
                      }
                      required
                    ></textarea>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "처리 중..." : "리뷰 등록"}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    리뷰를 작성하려면 로그인이 필요합니다.
                  </p>
                  <Link href="/login">
                    <Button variant="outline">로그인하러 가기</Button>
                  </Link>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* 외부 링크 */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              window.open(
                `https://search.naver.com/search.naver?query=${encodeURIComponent(
                  storeData.name + " " + storeData.address
                )}`,
                "_blank"
              )
            }
          >
            <img
              src="/images/naver-logo.png"
              alt="네이버"
              className="h-5 w-5"
            />
            <span>네이버 검색</span>
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              window.open(
                `https://search.daum.net/search?q=${encodeURIComponent(
                  storeData.name + " " + storeData.address
                )}`,
                "_blank"
              )
            }
          >
            <img
              src="/images/kakao-logo.png"
              alt="카카오"
              className="h-5 w-5"
            />
            <span>카카오 검색</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePWADetection } from "@/hooks/use-pwa-detection";
import { shouldBeUnoptimized } from "@/lib/image-utils";
import { useStoreStore } from "@/lib/store";
import { Store } from "@/types/store";
import {
  ChevronLeft,
  Heart,
  MapPin,
  Navigation,
  Star,
  Trash2,
  Utensils,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function FavoritesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { navigateConditionally } = usePWADetection();
  const { toast } = useToast();
  const { favorites, favoritesLoading, fetchFavorites, toggleFavorite } =
    useStoreStore();
  const [storeToRemove, setStoreToRemove] = useState<number | null>(null);

  // 뒤로가기 핸들러
  const handleGoBack = () => {
    // 브라우저 히스토리를 확인하여 이전 페이지로 돌아가기
    if (window.history.length > 1) {
      router.back();
    } else {
      // 히스토리가 없으면 지도 페이지로 이동
      router.push("/map");
    }
  };

  // 첫 로딩시 및 사용자 변경시 즐겨찾기 목록 불러오기
  useEffect(() => {
    if (!loading && user) {
      fetchFavorites(user.id);
    } else if (!loading && !user) {
      router.push("/login");
      toast({
        title: "로그인 필요",
        description: "즐겨찾기를 보려면 로그인이 필요합니다.",
      });
    }
  }, [user, loading, router, toast, fetchFavorites]);

  // 즐겨찾기 삭제 처리
  const handleRemoveFavorite = async (storeId: number) => {
    if (!user) {
return;
}

    try {
      await toggleFavorite(storeId, user.id);

      toast({
        title: "즐겨찾기 삭제",
        description: "즐겨찾기에서 삭제되었습니다.",
      });
    } catch (error) {
      console.error("즐겨찾기 삭제 오류:", error);
      toast({
        title: "오류",
        description: "즐겨찾기 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setStoreToRemove(null);
    }
  };

  // 별점 렌더링 도우미 함수
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        <Star
          className={`h-4 w-4 ${
            rating > 0 ? "fill-[#FFA726] text-[#FFA726]" : "text-gray-300"
          }`}
        />
        <span className="ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  };

  if (loading || favoritesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722]" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleGoBack}
          className="mr-2"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="sr-only">뒤로 가기</span>
        </Button>
        <h1 className="text-2xl font-bold">내 즐겨찾기</h1>
      </div>

      {favorites.length > 0 ? (
        <div className="grid gap-4">
          {favorites.map((store: Store) => (
            <Card key={store.id} className="overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="h-48 md:h-auto md:w-48 relative flex-shrink-0">
                  <Image
                    src={store.imageUrls && store.imageUrls.length > 0 
                      ? store.imageUrls[0]
                      : "/placeholder.svg"
                    }
                    alt={`${store.name} 이미지`}
                    fill
                    sizes="(max-width: 768px) 100vw, 192px"
                    style={{ objectFit: "cover" }}
                    unoptimized={store.imageUrls && store.imageUrls.length > 0 
                      ? shouldBeUnoptimized(192, undefined, store.imageUrls[0])
                      : shouldBeUnoptimized(undefined, undefined, "/placeholder.svg")
                    }
                  />
                </div>
                <CardContent className="flex-1 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold text-[#333333]">
                        {store.name}
                      </h2>
                      <div className="flex items-center gap-3 mt-1">
                        {renderStars(store.rating.naver)}
                        <span className="text-xs text-gray-500">네이버</span>
                        <span className="mx-1">|</span>
                        {renderStars(store.rating.kakao)}
                        <span className="text-xs text-gray-500">카카오</span>
                      </div>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setStoreToRemove(store.id)}
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  즐겨찾기 삭제
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  정말로 이 가게를 즐겨찾기에서
                                  삭제하시겠습니까?
                                  <div className="mt-2 font-semibold">
                                    {store.name}
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveFavorite(store.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>즐겨찾기에서 삭제</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <address className="flex items-center gap-2 mt-3 text-sm text-gray-600 not-italic">
                    <MapPin className="h-4 w-4 text-[#2196F3]" />
                    <span>{store.address}</span>
                  </address>

                  {store.openHours && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">영업시간: </span>
                      <time>{store.openHours}</time>
                    </div>
                  )}

                  {/* 가격 정보는 현재 Store 타입에 없어서 주석 처리 */}
                  {/* {store.price && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">가격: </span>
                      <span className="font-semibold text-[#FF5722]">
                        {store.price}
                      </span>
                    </div>
                  )} */}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {store.categories.map((category: string, index: number) => (
                      <Badge key={index} variant="secondary">
                        {category}
                      </Badge>
                    ))}
                  </div>

                  {store.refillItems && Array.isArray(store.refillItems) && store.refillItems.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1 text-sm text-[#FF5722]">
                        <Utensils className="h-4 w-4" />
                        <span className="font-medium">무한리필 메뉴</span>
                      </div>
                      <ul className="mt-1 text-sm text-gray-600 pl-5 grid grid-cols-2 gap-x-2">
                        {store.refillItems
                          .slice(0, 4)
                          .map((item: any, index: number) => (
                            <li key={index} className="line-clamp-1">
                              • {typeof item === "string" ? item : item.name}
                            </li>
                          ))}
                        {store.refillItems.length > 4 && (
                          <li className="text-gray-500">
                            외 {store.refillItems.length - 4}개...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <Separator className="my-4" />

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-[#FF5722] hover:bg-[#E64A19]"
                      onClick={() => navigateConditionally(`/store/${store.id}`)}
                    >
                      상세 보기
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        // 네이버 지도 앱으로 연결
                        const naverMapUrl = `nmap://place?lat=${
                          store.position.lat
                        }&lng=${store.position.lng}&name=${encodeURIComponent(
                          store.name,
                        )}&appname=com.example.myapp`;
                        window.location.href = naverMapUrl;

                        // 앱이 설치되어 있지 않은 경우를 위한 대체 URL (1초 후)
                        setTimeout(() => {
                          window.location.href = `https://map.naver.com/v5/search/${encodeURIComponent(
                            store.name,
                          )}`;
                        }, 1000);
                      }}
                    >
                      <Navigation className="h-4 w-4 mr-1" />
                      길찾기
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed">
          <Heart className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-xl font-semibold text-gray-700">
            저장된 즐겨찾기가 없습니다
          </h2>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            가게 상세 페이지에서 즐겨찾기 버튼을 눌러 자주 방문하는 가게를
            저장해보세요.
          </p>
          <Button
            className="mt-6 bg-[#FF5722] hover:bg-[#E64A19]"
            onClick={() => router.push("/map")}
          >
            가게 찾아보기
          </Button>
        </div>
      )}
    </div>
  );
}

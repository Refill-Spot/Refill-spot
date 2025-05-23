"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Clock,
  Star,
  Phone,
  ArrowLeft,
  ExternalLink,
  Utensils,
} from "lucide-react";
import { Store } from "@/types/store";
import { useToast } from "@/hooks/use-toast";

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const response = await fetch(`/api/stores/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setStore(data.data);
        } else {
          toast({
            title: "오류",
            description: "가게 정보를 불러올 수 없습니다.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("가게 정보 조회 오류:", error);
        toast({
          title: "오류",
          description: "가게 정보를 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchStore();
    }
  }, [params.id, toast]);

  const handleViewInNaverMap = () => {
    if (!store) return;

    // 네이버 지도 앱으로 열기 시도
    const naverMapUrl = `nmap://place?lat=${store.position.lat}&lng=${
      store.position.lng
    }&name=${encodeURIComponent(store.name)}&appname=com.refillspot.app`;

    // 앱이 설치되어 있지 않으면 웹으로 리다이렉트
    const webMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(
      store.name
    )}?c=${store.position.lng},${store.position.lat},15,0,0,0,dh`;

    // 모바일에서는 앱 링크 시도, 데스크톱에서는 바로 웹으로
    if (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    ) {
      window.location.href = naverMapUrl;
      // 1초 후 앱이 열리지 않으면 웹으로 이동
      setTimeout(() => {
        window.open(webMapUrl, "_blank");
      }, 1000);
    } else {
      window.open(webMapUrl, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722]"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            가게를 찾을 수 없습니다
          </h2>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">가게 정보</h1>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* 기본 정보 카드 */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl text-gray-900 mb-2">
                    {store.name}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-gray-600 mb-3">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{store.address}</span>
                  </div>
                  {store.distance && (
                    <div className="text-sm text-[#FF5722] font-medium">
                      현재 위치에서 {store.distance}km
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleViewInNaverMap}
                  className="bg-[#03C75A] hover:bg-[#02B351] text-white"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  지도로 보기
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* 카테고리 */}
              <div className="flex flex-wrap gap-2 mb-4">
                {store.categories.map((category, index) => (
                  <Badge key={index} variant="secondary">
                    {category}
                  </Badge>
                ))}
              </div>

              {/* 평점 */}
              <div className="flex items-center gap-4 mb-4">
                {store.rating.naver > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-medium">
                      네이버 {store.rating.naver}
                    </span>
                  </div>
                )}
                {store.rating.kakao > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-medium">
                      카카오 {store.rating.kakao}
                    </span>
                  </div>
                )}
              </div>

              {/* 설명 */}
              {store.description && (
                <div className="mb-4">
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {store.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 무한리필 메뉴 */}
          {store.refillItems && store.refillItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-[#FF5722]" />
                  무한리필 메뉴
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {store.refillItems.map((item, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="justify-center py-2"
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 운영 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FF5722]" />
                운영 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {store.openHours && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">운영시간</h4>
                  <p className="text-gray-700 text-sm">{store.openHours}</p>
                </div>
              )}

              {store.price && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">가격 정보</h4>
                  <p className="text-gray-700 text-sm">{store.price}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 이미지 갤러리 */}
          {store.imageUrls && store.imageUrls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>사진</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {store.imageUrls.map((url, index) => (
                    <div
                      key={index}
                      className="aspect-square relative rounded-lg overflow-hidden"
                    >
                      <img
                        src={url}
                        alt={`${store.name} 사진 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

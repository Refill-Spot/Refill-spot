"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Store } from "@/types/store";
import { generateMapPlatformUrls } from "@/lib/map-platform-urls";
import { useState } from "react";
import { ExternalLink, Loader2, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MapComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: Store;
}

export function MapComparisonDialog({ 
  open, 
  onOpenChange, 
  store 
}: MapComparisonDialogProps) {
  const [naverLoading, setNaverLoading] = useState(true);
  const [kakaoLoading, setKakaoLoading] = useState(true);
  
  const mapUrls = generateMapPlatformUrls(store);

  const handleOpenExternal = (platform: 'naver' | 'kakao') => {
    const url = platform === 'naver' ? mapUrls.naver : mapUrls.kakao;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold">{store.name}</div>
              <div className="text-sm font-normal text-gray-600 mt-1">
                네이버지도 · 카카오맵 평점 비교
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              {store.address}
            </div>
            {(store.rating.naver > 0 || store.rating.kakao > 0) && (
              <div className="flex items-center gap-3">
                {store.rating.naver > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    네이버 {store.rating.naver}
                  </Badge>
                )}
                {store.rating.kakao > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    카카오 {store.rating.kakao}
                  </Badge>
                )}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {/* 데스크톱: 나란히 보기 */}
          <div className="hidden lg:flex h-full">
            {/* 네이버지도 */}
            <div className="flex-1 flex flex-col border-r">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#03C75A] rounded"></div>
                  <span className="font-semibold text-gray-800">네이버지도</span>
                  {store.rating.naver > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      평점 {store.rating.naver}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenExternal('naver')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  새 창
                </Button>
              </div>
              <div className="flex-1 relative">
                {naverLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#03C75A] mx-auto mb-2" />
                      <p className="text-sm text-gray-600">네이버지도 로딩 중...</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={mapUrls.naver}
                  className="w-full h-full border-0"
                  onLoad={() => setNaverLoading(false)}
                  title={`${store.name} - 네이버지도`}
                />
              </div>
            </div>
            
            {/* 카카오맵 */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#FEE500] rounded"></div>
                  <span className="font-semibold text-gray-800">카카오맵</span>
                  {store.rating.kakao > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      평점 {store.rating.kakao}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenExternal('kakao')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  새 창
                </Button>
              </div>
              <div className="flex-1 relative">
                {kakaoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#FEE500] mx-auto mb-2" />
                      <p className="text-sm text-gray-600">카카오맵 로딩 중...</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={mapUrls.kakao}
                  className="w-full h-full border-0"
                  onLoad={() => setKakaoLoading(false)}
                  title={`${store.name} - 카카오맵`}
                />
              </div>
            </div>
          </div>
          
          {/* 모바일/태블릿: 탭으로 보기 */}
          <div className="lg:hidden h-full">
            <Tabs defaultValue="naver" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mx-4 my-3">
                <TabsTrigger value="naver" className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#03C75A] rounded"></div>
                  네이버지도
                  {store.rating.naver > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {store.rating.naver}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="kakao" className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#FEE500] rounded"></div>
                  카카오맵
                  {store.rating.kakao > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {store.rating.kakao}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="naver" className="flex-1 mx-4 mb-4">
                <Card className="h-full">
                  <CardContent className="p-0 h-full">
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                      <span className="font-semibold text-gray-800">네이버지도에서 보기</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenExternal('naver')}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        새 창
                      </Button>
                    </div>
                    <div className="relative" style={{ height: 'calc(100% - 57px)' }}>
                      {naverLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-[#03C75A] mx-auto mb-2" />
                            <p className="text-sm text-gray-600">네이버지도 로딩 중...</p>
                          </div>
                        </div>
                      )}
                      <iframe
                        src={mapUrls.naver}
                        className="w-full h-full border-0 rounded-b-lg"
                        onLoad={() => setNaverLoading(false)}
                        title={`${store.name} - 네이버지도`}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="kakao" className="flex-1 mx-4 mb-4">
                <Card className="h-full">
                  <CardContent className="p-0 h-full">
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                      <span className="font-semibold text-gray-800">카카오맵에서 보기</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenExternal('kakao')}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        새 창
                      </Button>
                    </div>
                    <div className="relative" style={{ height: 'calc(100% - 57px)' }}>
                      {kakaoLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-[#FEE500] mx-auto mb-2" />
                            <p className="text-sm text-gray-600">카카오맵 로딩 중...</p>
                          </div>
                        </div>
                      )}
                      <iframe
                        src={mapUrls.kakao}
                        className="w-full h-full border-0 rounded-b-lg"
                        onLoad={() => setKakaoLoading(false)}
                        title={`${store.name} - 카카오맵`}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        {/* 하단 도움말 */}
        <div className="px-6 py-3 border-t bg-gray-50">
          <p className="text-xs text-gray-600 text-center">
            💡 각 플랫폼에서 가게의 평점, 리뷰, 사진 등을 자세히 확인하실 수 있습니다
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
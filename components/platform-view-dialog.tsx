"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Store } from "@/types/store";
import { generateNaverMapUrl, generateKakaoMapUrl } from "@/lib/map-platform-urls";
import { useState } from "react";
import { ExternalLink, Loader2, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlatformViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: Store;
  platform: 'naver' | 'kakao';
}

export function PlatformViewDialog({ 
  open, 
  onOpenChange, 
  store,
  platform 
}: PlatformViewDialogProps) {
  const [loading, setLoading] = useState(true);
  
  const platformConfig = {
    naver: {
      name: '네이버지도',
      color: '#03C75A',
      url: generateNaverMapUrl(store),
      rating: store.rating.naver
    },
    kakao: {
      name: '카카오맵',
      color: '#FEE500',
      url: generateKakaoMapUrl(store),
      rating: store.rating.kakao
    }
  };

  const config = platformConfig[platform];

  const handleOpenExternal = () => {
    window.open(config.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: config.color }}
            >
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold">{store.name}</div>
              <div className="text-sm font-normal text-gray-600 mt-1">
                {config.name}에서 평점과 리뷰 보기
              </div>
            </div>
          </DialogTitle>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              {store.address}
            </div>
            {config.rating > 0 && (
              <Badge 
                variant="outline" 
                className="flex items-center gap-1"
              >
                <Star className="w-3 h-3 text-yellow-500 fill-current" />
                {config.name} {config.rating}
              </Badge>
            )}
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: config.color }}
                ></div>
                <span className="font-semibold text-gray-800">{config.name}</span>
                {config.rating > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    평점 {config.rating}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenExternal}
                className="text-gray-600 hover:text-gray-900"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                새 창에서 열기
              </Button>
            </div>
            
            <div className="flex-1 relative">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                  <div className="text-center">
                    <Loader2 
                      className="w-8 h-8 animate-spin mx-auto mb-2"
                      style={{ color: config.color }}
                    />
                    <p className="text-sm text-gray-600">{config.name} 로딩 중...</p>
                  </div>
                </div>
              )}
              <iframe
                src={config.url}
                className="w-full h-full border-0"
                onLoad={() => setLoading(false)}
                title={`${store.name} - ${config.name}`}
              />
            </div>
          </div>
        </div>
        
        {/* 하단 도움말 */}
        <div className="px-6 py-3 border-t bg-gray-50">
          <p className="text-xs text-gray-600 text-center">
            💡 {config.name}에서 가게의 상세 평점, 리뷰, 사진 등을 확인하실 수 있습니다
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
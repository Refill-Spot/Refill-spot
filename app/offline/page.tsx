"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCacheStatus } from "@/hooks/use-cache-status";
import { WifiOff, RefreshCw, Database, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OfflinePage() {
  const router = useRouter();
  const { isOnline, hasCachedData, cacheInfo, clearCache } = useCacheStatus();
  const [isClearing, setIsClearing] = useState(false);

  const handleRetry = () => {
    if (navigator.onLine) {
      router.back();
    } else {
      window.location.reload();
    }
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    await clearCache();
    setIsClearing(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            <WifiOff className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">오프라인 상태</CardTitle>
          <CardDescription>
            인터넷 연결을 확인해주세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            현재 네트워크에 연결되어 있지 않습니다. 
            인터넷 연결을 확인한 후 다시 시도해주세요.
          </p>
          
          <div className="space-y-2">
            <Button 
              onClick={handleRetry} 
              className="w-full"
              variant="default"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 시도
            </Button>
            
            <Button 
              onClick={() => router.push("/")} 
              className="w-full"
              variant="outline"
            >
              홈으로 가기
            </Button>
          </div>

          {hasCachedData && (
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2 justify-center">
                <Database className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">캐시된 데이터</span>
              </div>
              
              <div className="flex flex-wrap gap-2 justify-center">
                {cacheInfo.stores && (
                  <Badge variant="secondary" className="text-xs">
                    가게 목록
                  </Badge>
                )}
                {cacheInfo.storeDetails && (
                  <Badge variant="secondary" className="text-xs">
                    가게 상세
                  </Badge>
                )}
                {cacheInfo.favorites && (
                  <Badge variant="secondary" className="text-xs">
                    즐겨찾기
                  </Badge>
                )}
                {cacheInfo.reviews && (
                  <Badge variant="secondary" className="text-xs">
                    리뷰
                  </Badge>
                )}
              </div>

              <Button
                onClick={handleClearCache}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isClearing}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isClearing ? "삭제 중..." : "캐시 데이터 삭제"}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                💡 오프라인에서도 이전 데이터를 확인할 수 있습니다.
              </p>
            </div>
          )}

          {!hasCachedData && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center">
                💡 온라인 상태에서 데이터를 불러오면 오프라인에서도 사용할 수 있습니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
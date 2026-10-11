"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WifiOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OfflinePage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            <WifiOff className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">오프라인 상태</CardTitle>
          <CardDescription>인터넷 연결을 확인해주세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            현재 네트워크에 연결되어 있지 않습니다. 인터넷 연결을 확인한 후 다시
            시도해주세요.
          </p>
          <div className="space-y-2">
            <Button
              onClick={() => window.location.reload()}
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
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              개인정보 보호를 위해 즐겨찾기·리뷰 등 사용자 데이터는 오프라인에
              저장하지 않습니다. 지도와 가게 정보는 인터넷 연결 후 이용할 수
              있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

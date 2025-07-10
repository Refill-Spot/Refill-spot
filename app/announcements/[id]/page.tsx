"use client";

import { useAnnouncement } from "@/hooks/use-announcements";
import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, User, AlertCircle, ArrowLeft, Home, Map } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AnnouncementDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AnnouncementDetailPage({ params }: AnnouncementDetailPageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [id, setId] = useState<string>("");
  const [paramsLoaded, setParamsLoaded] = useState(false);

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
      setParamsLoaded(true);
    };
    loadParams();
  }, [params]);

  const { announcement, loading, error, refetch } = useAnnouncement(paramsLoaded ? id : "");

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "yyyy년 MM월 dd일", { locale: ko });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "yyyy-MM-dd HH:mm", { locale: ko });
    } catch {
      return dateString;
    }
  };

  const formatContent = (content: string) => {
    // 간단한 마크다운 스타일 지원
    return content
      .split("\n")
      .map((line, index) => (
        <p key={index} className="mb-2 last:mb-0 leading-relaxed">
          {line}
        </p>
      ));
  };

  if (!paramsLoaded || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Skeleton className="h-10 w-32 mb-4" />
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-full mb-2" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              돌아가기
            </Button>
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button onClick={refetch} variant="outline">
              다시 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              돌아가기
            </Button>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              공지사항을 찾을 수 없습니다.
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button asChild variant="outline">
              <Link href="/announcements">
                공지사항 목록으로
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FF5722]/5 via-white to-orange-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 네비게이션 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => router.back()}
                  className="text-black hover:text-black hover:bg-gray-100"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  돌아가기
                </Button>
                <Button variant="ghost" asChild className="text-black hover:text-black hover:bg-gray-100">
                  <Link href="/">
                    <Home className="h-4 w-4 mr-2" />
                    지도로 돌아가기
                  </Link>
                </Button>
              </div>
              <nav className="text-sm text-muted-foreground">
                <Link href="/" className="hover:text-[#FF5722] transition-colors">
                  홈
                </Link>
                <span className="mx-2">/</span>
                <Link href="/announcements" className="hover:text-[#FF5722] transition-colors">
                  공지사항
                </Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">
                  {announcement.title}
                </span>
              </nav>
            </div>
          </div>

          {/* 공지사항 상세 */}
          <Card className="bg-white/80 backdrop-blur-sm border-l-4 border-l-[#FF5722] shadow-lg">
            <CardHeader className="border-b border-[#FF5722]/10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <CardTitle className="text-3xl leading-tight text-black">
                      {announcement.title}
                    </CardTitle>
                    {announcement.is_important && (
                      <Badge className="bg-gradient-to-r from-[#FF5722] to-red-600 text-white border-0">
                        중요
                      </Badge>
                    )}
                    {!announcement.is_published && (
                      <Badge variant="secondary">
                        임시저장
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4 text-[#FF5722]" />
                      {announcement.profiles?.username || "관리자"}
                    </div>
                    {announcement.published_at && (
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-4 w-4 text-orange-500" />
                        {formatDate(announcement.published_at)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-6" />
              <div className="prose prose-sm max-w-none">
                <div className="text-foreground leading-relaxed">
                  {formatContent(announcement.content)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 하단 네비게이션 */}
          <div className="mt-8 flex justify-between items-center">
            <Button 
              asChild 
              variant="outline"
              className="border-[#FF5722] text-[#FF5722] hover:bg-[#FF5722] hover:text-white transition-colors"
            >
              <Link href="/announcements">
                <ArrowLeft className="h-4 w-4 mr-2" />
                목록으로
              </Link>
            </Button>
            
            <div className="flex gap-2">
              <Button 
                onClick={refetch} 
                variant="ghost" 
                size="sm"
                className="text-[#FF5722] hover:text-[#FF5722] hover:bg-[#FF5722]/10"
              >
                새로고침
              </Button>
            </div>
          </div>

          {/* 공지사항 메타 정보 */}
          <Card className="mt-6 bg-gradient-to-r from-[#FF5722]/5 to-orange-100/50 border-[#FF5722]/20">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">
                {announcement.published_at && (
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#FF5722]" />
                    <strong>게시일:</strong> {formatDateTime(announcement.published_at)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
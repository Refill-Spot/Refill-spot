"use client";

import { useAnnouncements } from "@/hooks/use-announcements";
import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import { CalendarDays, User, AlertCircle, Home, Map } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export default function AnnouncementsPage() {
  const { t } = useTranslation();
  const {
    announcements,
    loading,
    error,
    pagination,
    setParams,
    refetch,
  } = useAnnouncements({
    page: 1,
    limit: 10,
  });

  const handlePageChange = (page: number) => {
    setParams({ page, limit: 10 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "yyyy년 MM월 dd일", { locale: ko });
    } catch {
      return dateString;
    }
  };


  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  if (loading && announcements.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <div className="flex items-center gap-4 text-sm">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FF5722]/5 via-white to-orange-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 상단 네비게이션 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" asChild className="text-black hover:text-black hover:bg-gray-100">
                <Link href="/">
                  <Home className="h-4 w-4 mr-2" />
                  지도로 돌아가기
                </Link>
              </Button>
              <nav className="text-sm text-muted-foreground">
                <Link href="/" className="hover:text-[#FF5722] transition-colors">
                  홈
                </Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">공지사항</span>
              </nav>
            </div>
          </div>

          {/* 헤더 */}
          <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-[#FF5722] to-orange-500 bg-clip-text text-transparent">
              공지사항
            </h1>
            <p className="text-muted-foreground text-lg">
              리필스팟의 최신 소식과 중요한 공지사항을 확인하세요
            </p>
          </div>

          {/* 공지사항 목록 */}
          {announcements.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-[#FF5722]/10 to-orange-100 rounded-full mb-4">
                <AlertCircle className="h-10 w-10 text-[#FF5722]" />
              </div>
              <div className="text-muted-foreground text-lg mb-4">
                공지사항이 없습니다.
              </div>
              <Button 
                onClick={refetch} 
                variant="outline" 
                className="border-[#FF5722] text-[#FF5722] hover:bg-[#FF5722] hover:text-white"
              >
                새로고침
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {announcements.map((announcement) => (
                <Card key={announcement.id} className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-[#FF5722] hover:border-l-orange-600 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <CardTitle className="text-xl">
                            <Link href={`/announcements/${announcement.id}`}>
                              {announcement.title}
                            </Link>
                          </CardTitle>
                          {announcement.is_important && (
                            <Badge className="bg-gradient-to-r from-[#FF5722] to-red-600 text-white text-xs border-0">
                              중요
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
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      {truncateContent(announcement.content)}
                    </p>
                    <Button 
                      asChild 
                      variant="outline" 
                      size="sm"
                      className="border-[#FF5722] text-[#FF5722] hover:bg-[#FF5722] hover:text-white transition-colors duration-300"
                    >
                      <Link href={`/announcements/${announcement.id}`}>
                        자세히 보기
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="mt-12 flex justify-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="border-[#FF5722] text-[#FF5722] hover:bg-[#FF5722] hover:text-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#FF5722]"
                >
                  이전
                </Button>
                
                <div className="flex items-center gap-1">
                  {/* 페이지 번호 표시 */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const startPage = Math.max(1, pagination.page - 2);
                    const pageNumber = startPage + i;
                    
                    if (pageNumber > pagination.totalPages) return null;
                    
                    return (
                      <Button
                        key={pageNumber}
                        variant={pageNumber === pagination.page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNumber)}
                        className={pageNumber === pagination.page 
                          ? "bg-gradient-to-r from-[#FF5722] to-orange-600 text-white border-0" 
                          : "border-[#FF5722] text-[#FF5722] hover:bg-[#FF5722] hover:text-white"
                        }
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="border-[#FF5722] text-[#FF5722] hover:bg-[#FF5722] hover:text-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#FF5722]"
                >
                  다음
                </Button>
              </div>
            </div>
          )}

          {/* 페이지 정보 */}
          {announcements.length > 0 && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              전체 {pagination.total}개 중 {((pagination.page - 1) * pagination.limit) + 1}~
              {Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
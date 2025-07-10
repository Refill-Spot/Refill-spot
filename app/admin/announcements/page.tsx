"use client";

import { useAnnouncements, useAnnouncementMutations } from "@/hooks/use-announcements";
import { useTranslation } from "@/hooks/use-translation";
import { checkCurrentUserAdmin } from "@/lib/auth-utils-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarDays, Clock, User, AlertCircle, Plus, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminAnnouncementsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);

  const {
    announcements,
    loading,
    error,
    pagination,
    setParams,
    refetch,
  } = useAnnouncements({
    page: 1,
    limit: 20,
    includeUnpublished: true, // 관리자는 모든 공지사항 조회
  });

  const { deleteAnnouncement, deleting } = useAnnouncementMutations();

  // 관리자 권한 확인
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { isAdmin } = await checkCurrentUserAdmin();
        setIsAdmin(isAdmin);
        if (!isAdmin) {
          router.push("/unauthorized");
        }
      } catch (error) {
        console.error("관리자 권한 확인 오류:", error);
        setIsAdmin(false);
        router.push("/unauthorized");
      } finally {
        setAdminCheckLoading(false);
      }
    };

    checkAdmin();
  }, [router]);

  const handlePageChange = (page: number) => {
    setParams({ page, limit: 20, includeUnpublished: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 공지사항을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteAnnouncement(id);
      refetch();
    } catch (error) {
      // 에러는 hook에서 처리됨
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "yyyy-MM-dd", { locale: ko });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "MM-dd HH:mm", { locale: ko });
    } catch {
      return dateString;
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) {
return content;
}
    return content.substring(0, maxLength) + "...";
  };

  if (adminCheckLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // 이미 리다이렉트됨
  }

  if (loading && announcements.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="space-y-4 p-6">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
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
        <div className="max-w-6xl mx-auto">
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">공지사항 관리</h1>
            <p className="text-muted-foreground">
              공지사항을 작성, 수정, 삭제할 수 있습니다.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/announcements/new">
              <Plus className="h-4 w-4 mr-2" />
              새 공지사항
            </Link>
          </Button>
        </div>

        {/* 공지사항 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>공지사항 목록 ({pagination.total}개)</span>
              <Button onClick={refetch} variant="outline" size="sm">
                새로고침
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {announcements.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground text-lg mb-4">
                  공지사항이 없습니다.
                </div>
                <Button asChild>
                  <Link href="/admin/announcements/new">
                    첫 번째 공지사항 작성하기
                  </Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">상태</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead className="hidden md:table-cell w-[200px]">내용</TableHead>
                    <TableHead className="w-[100px]">작성자</TableHead>
                    <TableHead className="hidden sm:table-cell w-[120px]">작성일</TableHead>
                    <TableHead className="hidden sm:table-cell w-[120px]">게시일</TableHead>
                    <TableHead className="w-[80px]">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {announcement.is_important && (
                            <Badge variant="destructive" className="text-xs">
                              중요
                            </Badge>
                          )}
                          <Badge 
                            variant={announcement.is_published ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {announcement.is_published ? "게시" : "임시저장"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          <Link 
                            href={`/announcements/${announcement.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {announcement.title}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm text-muted-foreground">
                          {truncateContent(announcement.content)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {announcement.profiles?.username || "관리자"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(announcement.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-sm text-muted-foreground">
                          {announcement.published_at 
                            ? formatDateTime(announcement.published_at)
                            : "-"
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/announcements/${announcement.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                보기
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/announcements/edit/${announcement.id}`}>
                                <Edit className="h-4 w-4 mr-2" />
                                수정
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(announcement.id, announcement.title)}
                              className="text-destructive focus:text-destructive"
                              disabled={deleting}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                이전
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const startPage = Math.max(1, pagination.page - 2);
                  const pageNumber = startPage + i;
                  
                  if (pageNumber > pagination.totalPages) {
return null;
}
                  
                  return (
                    <Button
                      key={pageNumber}
                      variant={pageNumber === pagination.page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNumber)}
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
  );
}
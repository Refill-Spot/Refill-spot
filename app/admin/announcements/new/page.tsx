"use client";

import { useAnnouncementMutations } from "@/hooks/use-announcements";
import { useTranslation } from "@/hooks/use-translation";
import { checkCurrentUserAdmin } from "@/lib/auth-utils-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Eye, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnnouncementFormData } from "@/types/announcements";

export default function NewAnnouncementPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  
  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: "",
    content: "",
    is_important: false,
    is_published: false,
  });
  
  const [formErrors, setFormErrors] = useState<{
    title?: string;
    content?: string;
  }>({});

  const { createAnnouncement, creating } = useAnnouncementMutations();

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

  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};
    
    if (!formData.title.trim()) {
      errors.title = "제목을 입력해주세요.";
    } else if (formData.title.length < 1) {
      errors.title = "제목은 최소 1자 이상이어야 합니다.";
    }
    
    if (!formData.content.trim()) {
      errors.content = "내용을 입력해주세요.";
    } else if (formData.content.length < 1) {
      errors.content = "내용은 최소 1자 이상이어야 합니다.";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    const submitData = {
      ...formData,
      is_published: !isDraft, // 임시저장이 아니면 게시, 임시저장이면 비게시
    };

    if (!validateForm()) {
      return;
    }

    try {
      const newAnnouncement = await createAnnouncement(submitData);
      router.push("/admin/announcements");
    } catch (error) {
      // 에러는 hook에서 처리됨
    }
  };

  const handleInputChange = (field: keyof AnnouncementFormData, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    
    // 에러 초기화
    if (formErrors[field as keyof typeof formErrors]) {
      setFormErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  if (adminCheckLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-32 mb-6" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <div className="flex gap-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // 이미 리다이렉트됨
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 네비게이션 */}
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/admin/announcements">
              <ArrowLeft className="h-4 w-4 mr-2" />
              공지사항 관리로 돌아가기
            </Link>
          </Button>
          <nav className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">
              홈
            </Link>
            <span className="mx-2">/</span>
            <Link href="/admin/announcements" className="hover:text-primary">
              공지사항 관리
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">새 공지사항</span>
          </nav>
        </div>

        {/* 공지사항 작성 폼 */}
        <Card>
          <CardHeader>
            <CardTitle>새 공지사항 작성</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 제목 */}
            <div className="space-y-2">
              <Label htmlFor="title">제목 *</Label>
              <Input
                id="title"
                placeholder="공지사항 제목을 입력하세요"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className={formErrors.title ? "border-destructive" : ""}
              />
              {formErrors.title && (
                <p className="text-sm text-destructive">{formErrors.title}</p>
              )}
            </div>

            {/* 내용 */}
            <div className="space-y-2">
              <Label htmlFor="content">내용 *</Label>
              <Textarea
                id="content"
                placeholder="공지사항 내용을 입력하세요"
                value={formData.content}
                onChange={(e) => handleInputChange("content", e.target.value)}
                className={`min-h-[200px] ${formErrors.content ? "border-destructive" : ""}`}
              />
              {formErrors.content && (
                <p className="text-sm text-destructive">{formErrors.content}</p>
              )}
              <p className="text-sm text-muted-foreground">
                마크다운 문법을 사용할 수 있습니다.
              </p>
            </div>

            {/* 옵션 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="important">중요 공지사항</Label>
                  <p className="text-sm text-muted-foreground">
                    중요 공지사항으로 설정하면 목록 상단에 표시됩니다.
                  </p>
                </div>
                <Switch
                  id="important"
                  checked={formData.is_important}
                  onCheckedChange={(checked) => handleInputChange("is_important", checked)}
                />
              </div>

            </div>

            {/* 미리보기 */}
            {formData.title || formData.content ? (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    {formData.title && (
                      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                        {formData.title}
                        {formData.is_important && (
                          <span className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded">
                            중요
                          </span>
                        )}
                      </h3>
                    )}
                    {formData.content && (
                      <div className="text-sm text-muted-foreground">
                        {formData.content.split("\n").map((line, index) => (
                          <p key={index} className="mb-1 last:mb-0">
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {/* 버튼 */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => handleSubmit(true)}
                variant="outline"
                disabled={creating}
              >
                <Save className="h-4 w-4 mr-2" />
                임시저장
              </Button>
              
              <Button
                onClick={() => handleSubmit(false)}
                disabled={creating}
              >
                <Eye className="h-4 w-4 mr-2" />
                게시하기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileImageUpload } from "@/components/profile-image-upload";
import { ChevronLeft, LogOut, Save, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const { user, profile, loading, signOut, updateProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    username: "",
    bio: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // 로그인 상태 확인 및 프로필 데이터 로드
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    if (profile) {
      setProfileData({
        username: profile.username || "",
        bio: profile.bio || "",
      });
    }
  }, [user, profile, loading, router]);

  // 입력값 변경 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 프로필 업데이트 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await updateProfile({
        username: profileData.username,
        bio: profileData.bio,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "프로필 업데이트 성공",
        description: "프로필 정보가 성공적으로 업데이트되었습니다.",
      });
      setIsEditing(false);
    } catch (error) {
      console.error("프로필 업데이트 오류:", error);
      toast({
        title: "프로필 업데이트 실패",
        description: "프로필 정보 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로그아웃 핸들러
  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
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
        <h1 className="text-2xl font-bold">내 프로필</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* 사이드바 */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-6 flex flex-col items-center">
              <div className="mb-4">
                <Avatar className="w-24 h-24 border-2 border-gray-200">
                  <AvatarImage src={profile?.avatar_url} alt={profile?.username} />
                  <AvatarFallback className="bg-gray-100">
                    <User className="w-12 h-12 text-gray-400" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold">{profile?.username}</h2>
                <p className="text-sm text-gray-500 mt-1 mb-4">{user?.email}</p>
              </div>
              <Button
                variant="outline"
                className="w-full mb-2"
                onClick={() => router.push("/favorites")}
              >
                즐겨찾기 목록
              </Button>
              <Button
                variant="outline"
                className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                로그아웃
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 프로필 정보 */}
        <div className="md:col-span-3">
          {/* 프로필 이미지 업로드 카드 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>프로필 사진</CardTitle>
              <CardDescription>
                프로필 사진을 변경하거나 삭제할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileImageUpload />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>프로필 정보</CardTitle>
              <CardDescription>
                개인 정보를 관리하고 업데이트할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500">
                      이메일은 변경할 수 없습니다.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">사용자 이름</Label>
                    <Input
                      id="username"
                      name="username"
                      value={profileData.username}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">자기소개</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      value={profileData.bio}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder="자신을 소개해보세요..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          if (profile) {
                            setProfileData({
                              username: profile.username || "",
                              bio: profile.bio || "",
                            });
                          }
                        }}
                        className="mr-2"
                      >
                        취소
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-[#FF5722] hover:bg-[#E64A19]"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center">
                            <div className="animate-spin mr-2 h-4 w-4 border-b-2 border-white" />
                            저장 중...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Save className="h-4 w-4 mr-2" />
                            변경사항 저장
                          </div>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      variant="outline"
                    >
                      프로필 편집
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>계정 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">비밀번호 변경</h3>
                <p className="text-sm text-gray-500 mt-1">
                  계정 보안을 위해 주기적으로 비밀번호를 변경하세요.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push("/forgot-password")}
                >
                  비밀번호 재설정
                </Button>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium text-red-500">계정 삭제</h3>
                <p className="text-sm text-gray-500 mt-1">
                  계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.
                </p>
                <Button
                  variant="destructive"
                  className="mt-4"
                  onClick={() => {
                    toast({
                      title: "기능 준비 중",
                      description: "계정 삭제 기능은 현재 개발 중입니다.",
                    });
                  }}
                >
                  계정 삭제
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

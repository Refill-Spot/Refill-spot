"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getSafeReturnUrl } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { SiKakao } from "react-icons/si";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, signInWithGoogle, signInWithKakao, loading } =
    useAuth();
  const [error, setError] = useState<string | null>(null);

  // 디버깅을 위한 returnUrl 확인
  useEffect(() => {
    const returnUrl = searchParams.get('returnUrl');
    console.log('🔍 로그인 페이지 - returnUrl:', returnUrl);
    console.log('🔍 로그인 페이지 - 전체 URL:', window.location.href);
    console.log('🔍 로그인 페이지 - searchParams:', Array.from(searchParams.entries()));
    
    // 보안 검사 결과도 로그로 출력
    if (returnUrl) {
      const safeReturnUrl = getSafeReturnUrl(returnUrl, '/');
      console.log('🔒 보안 검사 결과 - safeReturnUrl:', safeReturnUrl);
      console.log('🔒 보안 검사 - 원본과 동일:', returnUrl === safeReturnUrl);
      
      if (returnUrl !== safeReturnUrl) {
        console.warn('⚠️ 위험한 returnUrl이 차단되었습니다:', returnUrl);
      }
    }
  }, [searchParams]);

  // URL 파라미터에서 오류 확인
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "oauth_error") {
      setError("소셜 로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    } else if (errorParam === "callback_error") {
      setError("로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  }, [searchParams]);

  // 로그인 폼 상태
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    remember: false,
  });

  // 회원가입 폼 상태
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeAll: false,
    agreeTerms: false,
    agreePrivacy: false,
    agreeLocation: false,
  });

  // 로그인 폼 핸들러
  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setLoginForm({
      ...loginForm,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // 회원가입 폼 핸들러
  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setRegisterForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAgreeAllChange = (checked: boolean) => {
    setRegisterForm((prev) => ({
      ...prev,
      agreeAll: checked,
      agreeTerms: checked,
      agreePrivacy: checked,
      agreeLocation: checked,
    }));
  };

  useEffect(() => {
    const { agreeTerms, agreePrivacy, agreeLocation } = registerForm;
    setRegisterForm((prev) => ({
      ...prev,
      agreeAll: agreeTerms && agreePrivacy && agreeLocation,
    }));
  }, [registerForm.agreeTerms, registerForm.agreePrivacy, registerForm.agreeLocation]);

  // 로그인 제출
  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const { error } = await signIn(loginForm.email, loginForm.password);

    if (error) {
      setError(error.message);
    } else {
      // returnUrl 파라미터 확인하여 안전한 URL로 리다이렉트
      const returnUrl = searchParams.get('returnUrl');
      console.log('🚀 로그인 성공 - returnUrl:', returnUrl);
      
      const safeReturnUrl = getSafeReturnUrl(returnUrl, '/');
      console.log('🚀 로그인 성공 - safeReturnUrl:', safeReturnUrl);
      
      toast({
        title: "로그인 성공",
        description: `${safeReturnUrl}로 이동합니다.`,
      });
      
      router.push(safeReturnUrl);
    }
  };

  // 회원가입 제출
  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // 비밀번호 확인 검증
    if (registerForm.password !== registerForm.confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    // 약관 동의 확인
    if (!registerForm.agreeTerms || !registerForm.agreePrivacy || !registerForm.agreeLocation) {
      setError("모든 필수 약관에 동의해주세요.");
      return;
    }

    const { error } = await signUp(registerForm.email, registerForm.password, {
      username: registerForm.username,
    });

    if (error) {
      setError(error.message);
    } else {
      toast({
        title: "회원가입 성공",
        description: "이메일을 확인하여 계정을 인증해주세요.",
      });
      router.push("/login");
    }
  };

  // 소셜 로그인 핸들러
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      setError("구글 로그인 중 오류가 발생했습니다.");
    }
  };

  const handleKakaoSignIn = async () => {
    try {
      await signInWithKakao();
    } catch (error) {
      setError("카카오 로그인 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <div className="bg-[#FF5722] p-3 rounded-full">
              <svg
                className="h-8 w-8 text-white"
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
          </div>
          <h1 className="text-2xl font-bold text-[#FF5722]">Refill-spot</h1>
          <p className="text-gray-500 mt-1">무한리필 가게 찾기</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">로그인</TabsTrigger>
            <TabsTrigger value="register">회원가입</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <form onSubmit={handleLoginSubmit}>
                <CardHeader>
                  <CardTitle>로그인</CardTitle>
                  <CardDescription>
                    계정 정보를 입력하여 로그인하세요
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      value={loginForm.email}
                      onChange={handleLoginChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">비밀번호</Label>
                      <Link
                        href="/forgot-password"
                        className="text-sm text-[#2196F3] hover:underline"
                      >
                        비밀번호 찾기
                      </Link>
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="비밀번호를 입력하세요"
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      name="remember"
                      checked={loginForm.remember}
                      onCheckedChange={(checked) =>
                        setLoginForm({ ...loginForm, remember: !!checked })
                      }
                    />
                    <Label htmlFor="remember" className="text-sm">
                      로그인 상태 유지
                    </Label>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button
                    type="submit"
                    className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                    disabled={loading}
                  >
                    {loading ? "로그인 중..." : "로그인"}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-500">
                        또는 소셜 로그인
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full"
                    >
                      <FcGoogle className="mr-2 h-4 w-4" />
                      구글
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleKakaoSignIn}
                      disabled={loading}
                      className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-black border-[#FEE500]"
                    >
                      <SiKakao className="mr-2 h-4 w-4" />
                      카카오
                    </Button>
                  </div>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <form onSubmit={handleRegisterSubmit}>
                <CardHeader>
                  <CardTitle>회원가입</CardTitle>
                  <CardDescription>
                    새 계정을 만들어 Refill Spot을 이용하세요
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">사용자명</Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder="사용자명을 입력하세요"
                      value={registerForm.username}
                      onChange={handleRegisterChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">이메일</Label>
                    <Input
                      id="register-email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      value={registerForm.email}
                      onChange={handleRegisterChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">비밀번호</Label>
                    <Input
                      id="register-password"
                      name="password"
                      type="password"
                      placeholder="비밀번호를 입력하세요"
                      value={registerForm.password}
                      onChange={handleRegisterChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">비밀번호 확인</Label>
                    <Input
                      id="confirm-password"
                      name="confirmPassword"
                      type="password"
                      placeholder="비밀번호를 다시 입력하세요"
                      value={registerForm.confirmPassword}
                      onChange={handleRegisterChange}
                      required
                    />
                  </div>
                  <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="agree-all"
                        name="agreeAll"
                        checked={registerForm.agreeAll}
                        onCheckedChange={handleAgreeAllChange}
                      />
                      <Label htmlFor="agree-all" className="text-sm font-bold">
                        전체 동의
                      </Label>
                    </div>
                    <div className="border-t border-gray-200 pt-3 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="agree-terms"
                          name="agreeTerms"
                          checked={registerForm.agreeTerms}
                          onCheckedChange={(checked) =>
                            setRegisterForm({
                              ...registerForm,
                              agreeTerms: !!checked,
                            })
                          }
                        />
                        <Label htmlFor="agree-terms" className="text-sm">
                          <Link
                            href="/terms"
                            className="text-[#2196F3] hover:underline"
                            target="_blank"
                          >
                            이용약관
                          </Link>
                          에 동의합니다 (필수)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="agree-privacy"
                          name="agreePrivacy"
                          checked={registerForm.agreePrivacy}
                          onCheckedChange={(checked) =>
                            setRegisterForm({
                              ...registerForm,
                              agreePrivacy: !!checked,
                            })
                          }
                        />
                        <Label htmlFor="agree-privacy" className="text-sm">
                          <Link
                            href="/privacy"
                            className="text-[#2196F3] hover:underline"
                            target="_blank"
                          >
                            개인정보처리방침
                          </Link>
                          에 동의합니다 (필수)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="agree-location"
                          name="agreeLocation"
                          checked={registerForm.agreeLocation}
                          onCheckedChange={(checked) =>
                            setRegisterForm({
                              ...registerForm,
                              agreeLocation: !!checked,
                            })
                          }
                        />
                        <Label htmlFor="agree-location" className="text-sm">
                          <Link
                            href="/location-terms"
                            className="text-[#2196F3] hover:underline"
                            target="_blank"
                          >
                            위치기반서비스 이용약관
                          </Link>
                          에 동의합니다 (필수)
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button
                    type="submit"
                    className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                    disabled={loading}
                  >
                    {loading ? "가입 중..." : "회원가입"}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-500">
                        또는 소셜 로그인
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full"
                    >
                      <FcGoogle className="mr-2 h-4 w-4" />
                      구글
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleKakaoSignIn}
                      disabled={loading}
                      className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-black border-[#FEE500]"
                    >
                      <SiKakao className="mr-2 h-4 w-4" />
                      카카오
                    </Button>
                  </div>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-[#FF5722] transition-colors"
          >
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Utensils, Pizza, Github, Mail } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle, signInWithGithub, loading } =
    useAuth();
  const [error, setError] = useState<string | null>(null);

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
    agreeTerms: false,
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
    setRegisterForm({
      ...registerForm,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // 로그인 제출
  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const { error } = await signIn(loginForm.email, loginForm.password);

    if (error) {
      setError(error.message);
    } else {
      toast({
        title: "로그인 성공",
        description: "환영합니다!",
      });
      router.push("/");
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

  const handleGithubSignIn = async () => {
    try {
      await signInWithGithub();
    } catch (error) {
      setError("깃허브 로그인 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <div className="bg-[#FF5722] p-3 rounded-full">
              <Utensils className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#FF5722]">Refill Spot</h1>
          <p className="text-gray-500 mt-1">무한리필 식당을 찾아보세요</p>
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
                      placeholder="••••••••"
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

                  {/* 소셜 로그인 버튼 */}
                  <div className="space-y-2 pt-2">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-300"></span>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-gray-500">
                          소셜 계정으로 로그인
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleGoogleSignIn}
                      >
                        <FcGoogle className="h-5 w-5 mr-2" />
                        Google
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleGithubSignIn}
                      >
                        <Github className="h-5 w-5 mr-2" />
                        Github
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                    disabled={loading}
                  >
                    {loading ? "로그인 중..." : "로그인"}
                  </Button>
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
                    새 계정을 만들어 무한리필 식당을 찾아보세요
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">사용자 이름</Label>
                    <Input
                      id="username"
                      name="username"
                      placeholder="사용자 이름"
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
                      placeholder="••••••••"
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
                      placeholder="••••••••"
                      value={registerForm.confirmPassword}
                      onChange={handleRegisterChange}
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="terms"
                      name="agreeTerms"
                      checked={registerForm.agreeTerms}
                      onCheckedChange={(checked) =>
                        setRegisterForm({
                          ...registerForm,
                          agreeTerms: !!checked,
                        })
                      }
                      required
                    />
                    <Label htmlFor="terms" className="text-sm">
                      <span>이용약관 및 </span>
                      <Link
                        href="/privacy"
                        className="text-[#2196F3] hover:underline"
                      >
                        개인정보 처리방침
                      </Link>
                      <span>에 동의합니다</span>
                    </Label>
                  </div>

                  {/* 소셜 회원가입 버튼 */}
                  <div className="space-y-2 pt-2">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-300"></span>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-gray-500">
                          소셜 계정으로 가입
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleGoogleSignIn}
                      >
                        <FcGoogle className="h-5 w-5 mr-2" />
                        Google
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleGithubSignIn}
                      >
                        <Github className="h-5 w-5 mr-2" />
                        Github
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                    disabled={loading || !registerForm.agreeTerms}
                  >
                    {loading ? "가입 중..." : "회원가입"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Pizza className="h-4 w-4 text-[#FF5722]" />
            <span>맛있는 무한리필 식당을 찾는 가장 쉬운 방법</span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useToast } from "@/hooks/use-toast";
import { Lock, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    message: string;
  }>({ score: 0, message: "" });
  const router = useRouter();
  const { toast } = useToast();

  // 비밀번호 강도 체크
  const checkPasswordStrength = (password: string) => {
    let score = 0;
    let message = "";

    // 길이 체크
    if (password.length < 8) {
      message = "비밀번호는 최소 8자 이상이어야 합니다.";
    } else {
      score += 1;

      // 대소문자 포함 여부
      if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
        score += 1;
      }

      // 숫자 포함 여부
      if (/[0-9]/.test(password)) {
        score += 1;
      }

      // 특수문자 포함 여부
      if (/[^A-Za-z0-9]/.test(password)) {
        score += 1;
      }

      // 메시지 설정
      if (score <= 1) {
        message = "매우 약함";
      } else if (score === 2) {
        message = "약함";
      } else if (score === 3) {
        message = "보통";
      } else {
        message = "강함";
      }
    }

    setPasswordStrength({ score, message });
  };

  // 비밀번호 변경 처리
  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 비밀번호 일치 확인
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    // 비밀번호 강도 확인
    if (passwordStrength.score < 3) {
      setError("더 강력한 비밀번호를 사용해주세요.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabaseBrowser.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      toast({
        title: "비밀번호 변경 성공",
        description: "비밀번호가 성공적으로 변경되었습니다.",
      });

      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      console.error("비밀번호 재설정 에러:", err);
      setError(err.message || "비밀번호 변경 중 오류가 발생했습니다.");
      toast({
        title: "오류",
        description: "비밀번호 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 비밀번호 변경시 강도 체크
  useEffect(() => {
    if (password) {
      checkPasswordStrength(password);
    } else {
      setPasswordStrength({ score: 0, message: "" });
    }
  }, [password]);

  const getStrengthColor = () => {
    switch (passwordStrength.score) {
      case 1:
        return "text-red-500";
      case 2:
        return "text-orange-500";
      case 3:
        return "text-yellow-500";
      case 4:
        return "text-green-500";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              비밀번호 재설정
            </CardTitle>
            <CardDescription className="text-center">
              새로운 비밀번호를 입력해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-700">
                  비밀번호 변경 완료
                </AlertTitle>
                <AlertDescription className="text-green-600">
                  비밀번호가 성공적으로 변경되었습니다. 잠시 후 로그인 페이지로
                  이동합니다.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">새 비밀번호</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="새로운 비밀번호 입력"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {password && (
                      <div className="flex justify-between items-center mt-1 text-xs">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((score) => (
                            <div
                              key={score}
                              className={`h-1 w-5 rounded-full ${
                                passwordStrength.score >= score
                                  ? score === 1
                                    ? "bg-red-500"
                                    : score === 2
                                    ? "bg-orange-500"
                                    : score === 3
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                  : "bg-gray-200"
                              }`}
                            />
                          ))}
                        </div>
                        <span className={getStrengthColor()}>
                          {passwordStrength.message}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      비밀번호는 최소 8자 이상, 대소문자, 숫자, 특수문자를
                      포함해야 합니다.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="비밀번호 확인"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">
                        비밀번호가 일치하지 않습니다.
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                    disabled={loading}
                  >
                    {loading ? "비밀번호 변경 중..." : "비밀번호 변경"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-xs text-gray-500">
              Refill Spot &copy; {new Date().getFullYear()}
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

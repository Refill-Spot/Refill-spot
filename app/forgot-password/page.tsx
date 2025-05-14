"use client";

import { useState } from "react";
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
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
      toast({
        title: "비밀번호 재설정 이메일 전송 완료",
        description: "이메일을 확인하여 비밀번호를 재설정해주세요.",
      });
    } catch (error) {
      toast({
        title: "오류",
        description: "비밀번호 재설정 요청 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center mb-4 text-[#2196F3] hover:underline"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          로그인으로 돌아가기
        </Link>
        <Card>
          <form onSubmit={handleResetPassword}>
            <CardHeader>
              <CardTitle>비밀번호 찾기</CardTitle>
              <CardDescription>
                계정의 이메일 주소를 입력하시면 비밀번호 재설정 링크를
                보내드립니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {submitted ? (
                <div className="p-4 bg-green-50 text-green-800 rounded-md">
                  <p className="font-medium">
                    비밀번호 재설정 이메일이 전송되었습니다.
                  </p>
                  <p className="text-sm mt-1">
                    이메일을 확인하여 비밀번호를 재설정해주세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              )}
            </CardContent>
            <CardFooter>
              {!submitted && (
                <Button
                  type="submit"
                  className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                  disabled={loading}
                >
                  {loading ? "처리 중..." : "비밀번호 재설정 요청"}
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

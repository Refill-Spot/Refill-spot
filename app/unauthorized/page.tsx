"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, Home, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            접근 권한이 없습니다
          </CardTitle>
          <CardDescription className="text-center">
            이 페이지에 접근할 수 있는 권한이 없습니다.
            <br />
            관리자 권한이 필요한 페이지입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-sm text-red-700">
              <strong>관리자 페이지 접근 거부</strong>
              <br />
              현재 계정으로는 관리자 기능을 사용할 수 없습니다.
              관리자 권한이 필요하시면 시스템 관리자에게 문의해주세요.
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              이전 페이지로
            </Button>
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
            >
              <Home className="w-4 h-4 mr-2" />
              메인 페이지로
            </Button>
          </div>

          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              관리자 권한 문의: refillspot.official@gmail.com
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
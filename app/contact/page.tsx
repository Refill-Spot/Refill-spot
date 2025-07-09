"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Mail, MapPin, Phone, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ContactPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: "store_registration", // store_registration, inquiry, feedback
    name: "",
    email: "",
    phone: "",
    storeName: "",
    storeAddress: "",
    message: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "문의가 접수되었습니다",
          description: "빠른 시일 내에 답변드리겠습니다. 감사합니다!",
        });

        // 폼 초기화
        setFormData({
          type: "store_registration",
          name: "",
          email: "",
          phone: "",
          storeName: "",
          storeAddress: "",
          message: "",
        });
      } else {
        throw new Error(data.message || "문의 접수에 실패했습니다.");
      }
    } catch (error) {
      console.error("문의 접수 오류:", error);
      toast({
        title: "오류가 발생했습니다",
        description: error instanceof Error ? error.message : "문의 접수 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">문의하기</h1>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* 안내 메시지 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-[#FF5722]" />
                가게 등록 및 문의
              </CardTitle>
              <CardDescription>
                새로운 무한리필 가게 등록이나 기타 문의사항이 있으시면 언제든지
                연락해주세요.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* 문의 폼 */}
          <Card>
            <CardHeader>
              <CardTitle>문의 내용</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 문의 유형 */}
                <div className="space-y-2">
                  <Label htmlFor="type">문의 유형</Label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                    required
                  >
                    <option value="store_registration">가게 등록 요청</option>
                    <option value="inquiry">일반 문의</option>
                    <option value="feedback">피드백 및 건의</option>
                  </select>
                </div>

                {/* 개인 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">이름 *</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="이름을 입력하세요"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일 *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="이메일을 입력하세요"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">연락처</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="연락처를 입력하세요"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>

                {/* 가게 정보 (가게 등록 요청 시에만 표시) */}
                {formData.type === "store_registration" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="storeName">가게명 *</Label>
                      <Input
                        id="storeName"
                        name="storeName"
                        type="text"
                        placeholder="등록하고 싶은 가게명을 입력하세요"
                        value={formData.storeName}
                        onChange={handleInputChange}
                        required={formData.type === "store_registration"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storeAddress">가게 주소 *</Label>
                      <Input
                        id="storeAddress"
                        name="storeAddress"
                        type="text"
                        placeholder="가게 주소를 입력하세요"
                        value={formData.storeAddress}
                        onChange={handleInputChange}
                        required={formData.type === "store_registration"}
                      />
                    </div>
                  </>
                )}

                {/* 문의 내용 */}
                <div className="space-y-2">
                  <Label htmlFor="message">문의 내용 *</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder={
                      formData.type === "store_registration"
                        ? "가게의 무한리필 메뉴, 가격, 운영시간 등 자세한 정보를 알려주세요."
                        : "문의하고 싶은 내용을 자세히 작성해주세요."
                    }
                    value={formData.message}
                    onChange={handleInputChange}
                    rows={6}
                    required
                  />
                </div>

                {/* 제출 버튼 */}
                <Button
                  type="submit"
                  className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                  disabled={loading}
                >
                  {loading ? "전송 중..." : "문의 접수"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 연락처 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>고객 지원</CardTitle>
              <CardDescription>
                급한 문의사항이 있으시면 아래 연락처로 직접 연락해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#FF5722]" />
                <span className="text-sm">refillspot.official@gmail.com</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

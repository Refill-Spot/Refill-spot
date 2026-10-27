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
import { contactSubmissionSchema, getContactToday } from "@/lib/validations";
import { ArrowLeft, Mail, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const initialFormData = {
  type: "store_registration",
  name: "",
  email: "",
  phone: "",
  storeName: "",
  storeAddress: "",
  message: "",
  reportKind: "new_store",
  refillScope: "",
  evidenceUrl: "",
  observedDate: "",
};

export default function ContactPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
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
      const { reportKind, refillScope, evidenceUrl, observedDate, ...contact } =
        formData;
      const validation = contactSubmissionSchema.safeParse({
        ...contact,
        ...(formData.type === "store_registration"
          ? { reportKind, refillScope, evidenceUrl, observedDate }
          : {}),
      });
      if (!validation.success) {
        throw new Error(validation.error.issues[0].message);
      }
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title:
            formData.type === "store_registration"
              ? "제보가 검토 대기로 접수되었습니다"
              : "문의가 접수되었습니다",
          description:
            formData.type === "store_registration"
              ? "검토 후 반영하며, 제보 즉시 등록·수정되는 것은 아닙니다."
              : "빠른 시일 내에 답변드리겠습니다. 감사합니다!",
        });

        // 폼 초기화
        setFormData(initialFormData);
      } else {
        throw new Error(data.error?.message || "문의 접수에 실패했습니다.");
      }
    } catch (error) {
      console.error("문의 접수 오류:", error);
      toast({
        title: "오류가 발생했습니다",
        description:
          error instanceof Error
            ? error.message
            : "문의 접수 중 오류가 발생했습니다. 다시 시도해주세요.",
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
                서울 가게 신규 제보·정보 수정
              </CardTitle>
              <CardDescription>
                서울 소재 가게의 신규 제보와 기존 정보 수정을 받습니다. 검토 후
                반영하며, 제보 즉시 등록되는 것은 아닙니다. 일반 문의와 피드백도
                남길 수 있습니다.
              </CardDescription>
              <CardDescription>
                기존 가게 정보는 공개 자료 수집과 이용자 제보를 함께 참고합니다.
                모든 정보가 이용자 제보이거나 최신 확인을 마친 것은 아니므로,
                방문 전 매장에 확인해 주세요.
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
                    <option value="store_registration">
                      서울 가게 신규 제보·정보 수정
                    </option>
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
                      maxLength={100}
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
                      maxLength={254}
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
                    maxLength={50}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  이름·이메일·연락처는 문의 응대용이며 공개하지 않습니다.
                </p>

                {/* 가게 제보는 기존 store_registration 문의로 검토 대기 접수 */}
                {formData.type === "store_registration" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="reportKind">제보 종류 *</Label>
                      <select
                        id="reportKind"
                        name="reportKind"
                        value={formData.reportKind}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                        required
                      >
                        <option value="new_store">신규 가게 제보</option>
                        <option value="correction">기존 가게 정보 수정</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storeName">가게명 *</Label>
                      <Input
                        id="storeName"
                        name="storeName"
                        type="text"
                        placeholder="제보하거나 수정할 가게명을 입력하세요"
                        value={formData.storeName}
                        onChange={handleInputChange}
                        maxLength={200}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storeAddress">가게 주소 *</Label>
                      <Input
                        id="storeAddress"
                        name="storeAddress"
                        type="text"
                        placeholder="예: 서울특별시 마포구 양화로 10, 2층"
                        value={formData.storeAddress}
                        onChange={handleInputChange}
                        maxLength={500}
                        aria-describedby="storeAddressHelp"
                        required
                      />
                      <p
                        id="storeAddressHelp"
                        className="text-sm text-gray-500"
                      >
                        서울 또는 서울특별시, 자치구와 도로명·건물번호 또는
                        동·번지를 포함한 실제 가게 주소를 입력해 주세요.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="refillScope">무한리필 범위 *</Label>
                      <select
                        id="refillScope"
                        name="refillScope"
                        value={formData.refillScope}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                        required
                      >
                        <option value="" disabled>
                          범위를 선택해 주세요
                        </option>
                        <option value="meal">식사·주메뉴 무한리필</option>
                        <option value="buffet">뷔페</option>
                        <option value="side">반찬·사이드만 리필</option>
                        <option value="unknown">확인 필요·모름</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="evidenceUrl">근거 링크 (선택)</Label>
                      <Input
                        id="evidenceUrl"
                        name="evidenceUrl"
                        type="url"
                        placeholder="https://... (메뉴 안내, 매장 공지 등)"
                        value={formData.evidenceUrl}
                        onChange={handleInputChange}
                        maxLength={2048}
                      />
                      <p className="text-sm text-gray-500">
                        로그인 정보가 포함되지 않은 공개 http(s) 링크만 입력해
                        주세요.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="observedDate">
                        직접 확인한 날짜 (선택)
                      </Label>
                      <Input
                        id="observedDate"
                        name="observedDate"
                        type="date"
                        max={getContactToday()}
                        value={formData.observedDate}
                        onChange={handleInputChange}
                      />
                      <p className="text-sm text-gray-500">
                        직접 확인한 경우에만 입력해 주세요. 입력한 날짜와 링크는
                        제보자의 설명이며, 운영팀의 검증 완료를 뜻하지 않습니다.
                      </p>
                    </div>
                  </>
                )}

                {/* 문의 내용 */}
                <div className="space-y-2">
                  <Label htmlFor="message">
                    {formData.type === "store_registration"
                      ? "무한리필 내용·수정할 정보 *"
                      : "문의 내용 *"}
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder={
                      formData.type === "store_registration"
                        ? "어떤 메뉴를 얼마나 리필할 수 있는지, 가격·시간 제한과 수정할 정보를 공백·기호 제외 10자 이상 설명해 주세요. 범위를 모르면 확인이 필요한 내용을 적어 주세요."
                        : "문의하고 싶은 내용을 자세히 작성해주세요."
                    }
                    value={formData.message}
                    onChange={handleInputChange}
                    rows={6}
                    maxLength={5000}
                    required
                  />
                  {formData.type === "store_registration" && (
                    <p className="text-sm text-gray-500">
                      설명과 제보 종류·범위·링크·날짜를 합쳐 5,000자까지
                      접수됩니다.
                    </p>
                  )}
                </div>

                {/* 제출 버튼 */}
                <Button
                  type="submit"
                  className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                  disabled={loading}
                >
                  {loading
                    ? "전송 중..."
                    : formData.type === "store_registration"
                      ? "제보 검토 요청"
                      : "문의 접수"}
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

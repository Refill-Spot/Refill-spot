"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center text-[#2196F3] hover:underline mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            로그인으로 돌아가기
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Refill-spot 이용약관
            </CardTitle>
            <CardDescription className="text-center">
              서비스 이용에 앞서 다음 약관을 확인해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#FF5722]">
                제1조 (목적)
              </h2>
              <p className="text-gray-700 leading-relaxed">
                이 약관은 Refill-spot (이하 "회사")이 제공하는 무한리필 가게 정보 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#FF5722]">
                제2조 (정의)
              </h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>1. "서비스"란 회사가 제공하는 무한리필 가게 정보 검색 및 관련 서비스를 말합니다.</p>
                <p>2. "이용자"란 회사의 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.</p>
                <p>3. "회원"란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 회사의 정보를 지속적으로 제공받으며 회사가 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#FF5722]">
                제3조 (약관의 효력 및 변경)
              </h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>1. 이 약관은 서비스 화면에 게시하거나 기타의 방법으로 공지함으로써 효력이 발생합니다.</p>
                <p>2. 회사는 합리적인 사유가 발생할 경우에는 이 약관을 변경할 수 있으며, 약관이 변경되는 경우 변경된 약관의 적용일자 및 변경사유를 명시하여 현행약관과 함께 그 적용일자 7일 이전부터 적용일자 전일까지 공지합니다.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#FF5722]">
                제4조 (서비스의 제공)
              </h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>1. 회사는 다음과 같은 서비스를 제공합니다:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>무한리필 가게 정보 검색 서비스</li>
                  <li>가게 위치 및 메뉴 정보 제공</li>
                  <li>사용자 리뷰 및 평점 서비스</li>
                  <li>기타 회사가 정하는 서비스</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#FF5722]">
                제5조 (개인정보보호)
              </h2>
              <p className="text-gray-700 leading-relaxed">
                회사는 관련법령이 정하는 바에 따라 이용자의 개인정보를 보호하기 위해 노력합니다. 개인정보의 보호 및 사용에 대해서는 관련법령 및 회사의 개인정보처리방침이 적용됩니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#FF5722]">
                제6조 (이용자의 의무)
              </h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>이용자는 다음 행위를 하여서는 안 됩니다:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>신청 또는 변경시 허위내용의 등록</li>
                  <li>타인의 정보도용</li>
                  <li>회사가 게시한 정보의 변경</li>
                  <li>회사가 금지한 정보(컴퓨터 프로그램 등)의 송신 또는 게시</li>
                  <li>회사 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
                  <li>회사 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                  <li>외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#FF5722]">
                제7조 (저작권의 귀속 및 이용제한)
              </h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>1. 회사가 작성한 저작물에 대한 저작권 기타 지적재산권은 회사에 귀속합니다.</p>
                <p>2. 이용자는 서비스를 이용함으로써 얻은 정보 중 회사에게 지적재산권이 귀속된 정보를 회사의 사전 승낙 없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용하거나 제3자에게 이용하게 하여서는 안됩니다.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#FF5722]">
                제8조 (면책조항)
              </h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.</p>
                <p>2. 회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.</p>
                <p>3. 회사는 이용자가 서비스와 관련하여 게재한 정보, 자료, 사실의 신뢰도, 정확성 등의 내용에 관하여는 책임을 지지 않습니다.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#FF5722]">
                제9조 (관할법원)
              </h2>
              <p className="text-gray-700 leading-relaxed">
                회사와 이용자 간에 발생한 서비스 이용에 관한 분쟁에 대하여는 대한민국 법을 적용하며, 본 분쟁으로 인한 소는 회사의 본사 소재지를 관할하는 법원에 제기합니다.
              </p>
            </section>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 text-center">
                본 약관은 2024년 1월 1일부터 시행됩니다.
              </p>
              <p className="text-sm text-gray-600 text-center mt-1">
                Refill-spot &copy; {new Date().getFullYear()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
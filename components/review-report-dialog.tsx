"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface ReviewReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string, description?: string) => Promise<boolean>;
  submitting?: boolean;
}

const REPORT_REASONS = [
  { value: "spam", label: "스팸 또는 광고" },
  { value: "inappropriate", label: "부적절한 내용" },
  { value: "harassment", label: "괴롭힘 또는 욕설" },
  { value: "fake", label: "가짜 리뷰" },
  { value: "offensive", label: "혐오 발언" },
  { value: "other", label: "기타" },
];

export function ReviewReportDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
}: ReviewReportDialogProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!reason) {
return;
}

    const success = await onSubmit(reason, description.trim() || undefined);
    if (success) {
      // 성공 시 폼 초기화 및 다이얼로그 닫기
      setReason("");
      setDescription("");
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // 다이얼로그가 닫힐 때 폼 초기화
      setReason("");
      setDescription("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>리뷰 신고하기</DialogTitle>
          <DialogDescription>
            부적절한 리뷰를 신고해주세요. 검토 후 조치하겠습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 신고 사유 선택 */}
          <div>
            <Label className="text-sm font-medium">신고 사유</Label>
            <RadioGroup
              value={reason}
              onValueChange={setReason}
              className="mt-2"
            >
              {REPORT_REASONS.map((item) => (
                <div key={item.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={item.value} id={item.value} />
                  <Label htmlFor={item.value} className="text-sm cursor-pointer">
                    {item.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 상세 설명 (선택사항) */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              상세 설명 (선택사항)
            </Label>
            <Textarea
              id="description"
              placeholder="신고 사유에 대한 자세한 설명을 입력해주세요..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 min-h-[80px]"
              maxLength={500}
            />
            <div className="text-xs text-gray-500 mt-1">
              {description.length}/500자
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="bg-red-600 hover:bg-red-700"
          >
            {submitting ? "신고 중..." : "신고하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
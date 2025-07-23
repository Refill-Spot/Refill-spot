"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";
import { Star, Upload, X, ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface ReviewWriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: number;
  storeName: string;
  existingReview?: {
    id: number;
    rating: number;
    content: string;
    imageUrls?: string[];
  } | null;
  onReviewSubmitted?: () => void;
}

export function ReviewWriteDialog({ 
  open, 
  onOpenChange, 
  storeId, 
  storeName,
  existingReview = null,
  onReviewSubmitted 
}: ReviewWriteDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [review, setReview] = useState({
    rating: 0,
    content: "",
    imageUrls: [] as string[],
  });
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // 기존 리뷰가 있으면 초기값 설정
  useEffect(() => {
    if (existingReview) {
      setReview({
        rating: existingReview.rating,
        content: existingReview.content,
        imageUrls: existingReview.imageUrls || [],
      });
      if (existingReview.imageUrls && existingReview.imageUrls.length > 0) {
        setImagePreviewUrls(existingReview.imageUrls);
      }
    } else {
      // 새 리뷰인 경우 초기화
      setReview({ rating: 0, content: "", imageUrls: [] });
      setSelectedImages([]);
      setImagePreviewUrls([]);
    }
  }, [existingReview, open]);

  // 모달이 닫힐 때 폼 초기화
  useEffect(() => {
    if (!open) {
      setReview({ rating: 0, content: "", imageUrls: [] });
      setSelectedImages([]);
      setImagePreviewUrls([]);
    }
  }, [open]);

  // 이미지 업로드
  const uploadImages = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];

    setUploadingImages(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('images', file);
      });

      const response = await fetch('/api/reviews/images/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '이미지 업로드에 실패했습니다.');
      }

      const data = await response.json();
      return data.imageUrls || [];
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      toast({
        title: '이미지 업로드 실패',
        description: error instanceof Error ? error.message : '이미지 업로드 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setUploadingImages(false);
    }
  };

  // 리뷰 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (review.rating < 1 || review.rating > 5) {
      toast({
        title: t("rating_error"),
        description: t("rating_error_description"),
        variant: "destructive",
      });
      return;
    }

    if (!review.content.trim()) {
      toast({
        title: t("content_error"),
        description: t("content_error_description"),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // 새로 선택된 이미지 업로드
      let finalImageUrls = [...review.imageUrls];
      if (selectedImages.length > 0) {
        const uploadedUrls = await uploadImages(selectedImages);
        if (uploadedUrls.length > 0) {
          finalImageUrls = [...finalImageUrls, ...uploadedUrls];
        }
      }

      const method = existingReview ? 'PUT' : 'POST';
      const response = await fetch(`/api/stores/${storeId}/reviews`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...review,
          imageUrls: finalImageUrls,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '리뷰 저장에 실패했습니다.');
      }

      toast({
        title: existingReview ? "리뷰 수정 완료" : "리뷰 작성 완료",
        description: existingReview ? "리뷰가 성공적으로 수정되었습니다." : "리뷰가 성공적으로 작성되었습니다.",
      });

      // 폼 초기화
      setReview({ rating: 0, content: "", imageUrls: [] });
      setSelectedImages([]);
      setImagePreviewUrls([]);
      
      // 모달 닫기
      onOpenChange(false);
      
      // 리뷰 목록 새로고침 콜백 호출
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }

    } catch (error) {
      console.error('리뷰 저장 오류:', error);
      toast({
        title: "저장 실패",
        description: error instanceof Error ? error.message : '리뷰 저장 중 오류가 발생했습니다.',
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 이미지 선택
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxImages = 5;
    const currentImageCount = review.imageUrls.length + selectedImages.length;
    
    if (currentImageCount + files.length > maxImages) {
      toast({
        title: '이미지 개수 초과',
        description: `이미지는 최대 ${maxImages}개까지 첨부할 수 있습니다.`,
        variant: 'destructive',
      });
      return;
    }

    // 파일 검증
    const validFiles = files.filter(file => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: '지원하지 않는 파일 형식',
          description: 'JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.',
          variant: 'destructive',
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: '파일 크기 초과',
          description: '각 이미지는 5MB 이하여야 합니다.',
          variant: 'destructive',
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...validFiles]);
      
      // 미리보기 URL 생성
      const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file));
      setImagePreviewUrls(prev => [...prev, ...newPreviewUrls]);
    }

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 이미지 제거
  const handleImageRemove = (index: number) => {
    const totalExistingImages = review.imageUrls.length;
    
    if (index < totalExistingImages) {
      // 기존 이미지 제거
      const newImageUrls = [...review.imageUrls];
      newImageUrls.splice(index, 1);
      setReview(prev => ({ ...prev, imageUrls: newImageUrls }));
    } else {
      // 새로 선택된 이미지 제거
      const selectedIndex = index - totalExistingImages;
      const newSelectedImages = [...selectedImages];
      newSelectedImages.splice(selectedIndex, 1);
      setSelectedImages(newSelectedImages);
      
      // 미리보기 URL 정리
      URL.revokeObjectURL(imagePreviewUrls[index]);
    }
    
    // 미리보기 URL 업데이트
    const newPreviewUrls = [...imagePreviewUrls];
    newPreviewUrls.splice(index, 1);
    setImagePreviewUrls(newPreviewUrls);
  };

  // 평점에 따른 색상
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "text-green-600";
    if (rating >= 3.5) return "text-yellow-600";
    if (rating >= 2.5) return "text-orange-600";
    return "text-red-600";
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>로그인이 필요합니다</DialogTitle>
            <DialogDescription>
              리뷰를 작성하려면 먼저 로그인해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Link href="/login">
              <Button>로그인하기</Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-[#FF5722]" />
            {existingReview ? "리뷰 수정" : "리뷰 작성"}
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-gray-900">{storeName}</span>에 대한 솔직한 리뷰를 남겨주세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 평점 선택 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="block mb-3 font-semibold text-gray-900">평점</label>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReview({ ...review, rating: star })}
                    className="focus:outline-none hover:scale-110 transition-transform duration-200"
                    aria-label={`${star}점`}
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-gray-200 text-gray-200 hover:fill-yellow-200 hover:text-yellow-200"
                      } transition-colors duration-200`}
                    />
                  </button>
                ))}
              </div>
              {review.rating > 0 && (
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${getRatingColor(review.rating)}`}>
                    {review.rating}.0
                  </span>
                  <span className="text-sm text-gray-600">
                    ({review.rating >= 4.5 ? "우수" : 
                      review.rating >= 3.5 ? "만족" :
                      review.rating >= 2.5 ? "보통" : "아쉬움"})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 리뷰 내용 */}
          <div>
            <label className="block mb-2 font-medium">리뷰 내용</label>
            <Textarea
              className="w-full p-3 border rounded-md focus:ring-2 focus:ring-[#FF5722] focus:border-transparent min-h-[120px]"
              placeholder="가게에 대한 솔직한 리뷰를 작성해주세요..."
              value={review.content}
              onChange={(e) => setReview({ ...review, content: e.target.value })}
              required
            />
          </div>

          {/* 이미지 업로드 */}
          <div>
            <label className="block mb-2 font-medium flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              이미지 첨부 (선택사항)
            </label>
            
            {/* 이미지 미리보기 */}
            {imagePreviewUrls.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {imagePreviewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <Image
                        src={url}
                        alt={`미리보기 ${index + 1}`}
                        width={80}
                        height={80}
                        className="object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleImageRemove(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="이미지 제거"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 이미지 선택 버튼 */}
            {(review.imageUrls.length + selectedImages.length) < 5 && (
              <div className="mb-4">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImages}
                  className="w-full border-dashed border-2 hover:border-[#FF5722] hover:bg-orange-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingImages ? '업로드 중...' : '이미지 선택 (최대 5개)'}
                </Button>
                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG, WebP 형식, 각 5MB 이하
                </p>
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting || uploadingImages}
            >
              취소
            </Button>
            <Button
              type="submit"
              className="bg-[#FF5722] hover:bg-[#E64A19]"
              disabled={submitting || uploadingImages}
            >
              {submitting || uploadingImages ? 
                (uploadingImages ? '이미지 업로드 중...' : '저장 중...') : 
                (existingReview ? '수정하기' : '작성하기')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
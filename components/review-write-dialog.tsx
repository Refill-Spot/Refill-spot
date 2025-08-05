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
import { Star, Upload, X, ImageIcon, Plus, Minus } from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
  onReviewSubmitted, 
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
  const [selectedMenuImages, setSelectedMenuImages] = useState<File[]>([]);
  const [menuImagePreviewUrls, setMenuImagePreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  
  // 새로운 상태 추가
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedAtmosphere, setSelectedAtmosphere] = useState<string[]>([]);
  const [detailedRatings, setDetailedRatings] = useState({
    taste: 3,
    price: 3,
    service: 3,
  });
  const [selectedMenus, setSelectedMenus] = useState<string[]>([]);
  const [customMenu, setCustomMenu] = useState<string>("");
  const [storeMenus, setStoreMenus] = useState<string[]>([]);
  const [customMenuList, setCustomMenuList] = useState<string[]>([]);

  // 키워드 및 메뉴 옵션
  const restaurantKeywords = [
    "무료주차", "발렛주차", "주차불가", "개별룸", "대형룸", "24시간영업",
    "야외좌석(테라스)", "놀이방", "애완동물동반", "콜키지무료", "해당없음",
  ];

  const atmosphereKeywords = [
    "배달", "아이동반", "다이어트식단", "실버푸드", "아침식사", "점심식사",
    "저녁식사", "식사모임", "술모임", "차모임", "혼카페", "혼밥", "혼술",
    "점대", "회식", "데이트", "기념일", "가족외식", "간식",
  ];

  const atmosphereDescriptions = [
    "숨은맛집", "서민적인", "캐주얼한", "고급스러운", "격식있는", "가성비좋은",
    "푸짐한", "조용한", "시끌벅적한", "예쁜", "깔끔한", "이국적/이색적",
    "경관/야경이좋은", "지역주민이찾는", "핫플레이스",
  ];

  const menuOptions = [
    "바지락칼국수",
    "양푼보리밥",
    "영양밥",
    "해물파전",
  ];

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
      setSelectedMenuImages([]);
      setMenuImagePreviewUrls([]);
      setSelectedKeywords([]);
      setSelectedAtmosphere([]);
      setDetailedRatings({ taste: 3, price: 3, service: 3 });
      setSelectedMenus([]);
      setCustomMenu("");
      setCustomMenuList([]);
    }
  }, [open]);

  // 가게 메뉴 정보 불러오기
  useEffect(() => {
    const fetchStoreMenus = async () => {
      if (storeId) {
        try {
          const response = await fetch(`/api/stores/${storeId}`);
          if (response.ok) {
            const data = await response.json();
            console.log("=== Store API Response Debug ===");
            console.log("API Success:", data.success);
            console.log("Store data exists:", !!data.data);
            console.log("refillItems:", data.data?.refillItems);
            console.log("refillItems count:", data.data?.refillItems?.length || 0);
            
            if (data.success && data.data) {
              // refillItems를 메뉴로 사용
              let menus = [];
              const refillItems = data.data.refillItems;
              
              if (refillItems && Array.isArray(refillItems)) {
                console.log("Processing", refillItems.length, "refill items");
                
                // order 속성으로 정렬 후 name 속성 추출
                const sortedItems = refillItems
                  .filter(item => item && typeof item === "object" && item.name)
                  .sort((a, b) => {
                    const orderA = a.order || 999; // order가 없으면 맨 뒤로
                    const orderB = b.order || 999;
                    return orderA - orderB;
                  });
                
                menus = sortedItems.map((item: any) => {
                  console.log("Extracted menu (order:", item.order + "):", item.name);
                  return item.name;
                });
                
                console.log("Sorted menu names:", menus);
              } else {
                console.log("No valid refillItems found, using default menus");
              }
              
              console.log("Final parsed menus:", menus);
              
              if (menus.length > 0) {
                setStoreMenus(menus);
              } else {
                // 리필 아이템이 없으면 기본 메뉴 사용
                setStoreMenus(menuOptions);
              }
            } else {
              console.log("No data or not successful");
              setStoreMenus(menuOptions);
            }
          } else {
            console.log("Response not OK:", response.status);
            setStoreMenus(menuOptions);
          }
        } catch (error) {
          console.error("메뉴 정보 로딩 실패:", error);
          // 기본 메뉴 옵션 사용
          setStoreMenus(menuOptions);
        }
      }
    };

    fetchStoreMenus();
  }, [storeId]);

  // 키워드 토글 함수
  const toggleKeyword = (keyword: string, type: "restaurant" | "atmosphere") => {
    if (type === "restaurant") {
      setSelectedKeywords(prev => 
        prev.includes(keyword) 
          ? prev.filter(k => k !== keyword)
          : [...prev, keyword],
      );
    } else {
      setSelectedAtmosphere(prev => 
        prev.includes(keyword) 
          ? prev.filter(k => k !== keyword)
          : [...prev, keyword],
      );
    }
  };

  // 세부 평점 변경 함수 (3가지 선택)
  const handleDetailedRatingChange = (type: "taste" | "price" | "service", value: number) => {
    setDetailedRatings(prev => ({
      ...prev,
      [type]: value,
    }));
  };

  // 메뉴 토글 함수
  const toggleMenu = (menu: string) => {
    setSelectedMenus(prev => 
      prev.includes(menu) 
        ? prev.filter(m => m !== menu)
        : [...prev, menu],
    );
  };

  // 커스텀 메뉴 추가
  const handleAddCustomMenu = () => {
    if (customMenu.trim() && !customMenuList.includes(customMenu.trim())) {
      const newMenu = customMenu.trim();
      setCustomMenuList(prev => [...prev, newMenu]);
      setSelectedMenus(prev => [...prev, newMenu]); // 추가한 메뉴를 자동으로 선택
      setCustomMenu(""); // 입력 필드 초기화
      
      toast({
        title: "메뉴 추가 완료",
        description: `"${newMenu}" 메뉴가 추가되었습니다.`,
      });
    } else if (!customMenu.trim()) {
      toast({
        title: "입력 오류",
        description: "메뉴명을 입력해주세요.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "중복 메뉴",
        description: "이미 추가된 메뉴입니다.",
        variant: "destructive",
      });
    }
  };

  // 이미지 업로드
  const uploadImages = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) {
return [];
}

    setUploadingImages(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append("images", file);
      });

      const response = await fetch("/api/reviews/images/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "이미지 업로드에 실패했습니다.");
      }

      const data = await response.json();
      return data.imageUrls || [];
    } catch (error) {
      console.error("이미지 업로드 오류:", error);
      toast({
        title: "이미지 업로드 실패",
        description: error instanceof Error ? error.message : "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
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
        title: "평점을 선택해주세요",
        description: "1점에서 5점 사이의 평점을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (selectedMenus.length === 0) {
      toast({
        title: "메뉴를 선택해주세요",
        description: "드신 음식을 하나 이상 선택해주세요.",
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

      const method = existingReview ? "PUT" : "POST";
      const response = await fetch(`/api/stores/${storeId}/reviews`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...review,
          imageUrls: finalImageUrls,
          keywords: selectedKeywords,
          atmosphere: selectedAtmosphere,
          detailedRatings,
          menus: selectedMenus,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "리뷰 저장에 실패했습니다.");
      }

      toast({
        title: existingReview ? "리뷰 수정 완료" : "리뷰 작성 완료",
        description: existingReview ? "리뷰가 성공적으로 수정되었습니다." : "리뷰가 성공적으로 작성되었습니다.",
      });

      // 폼 초기화
      setReview({ rating: 0, content: "", imageUrls: [] });
      setSelectedImages([]);
      setImagePreviewUrls([]);
      setSelectedMenuImages([]);
      setMenuImagePreviewUrls([]);
      setSelectedKeywords([]);
      setSelectedAtmosphere([]);
      setDetailedRatings({ taste: 3, price: 3, service: 3 });
      setSelectedMenus([]);
      setCustomMenu("");
      setCustomMenuList([]);
      
      // 모달 닫기
      onOpenChange(false);
      
      // 리뷰 목록 새로고침 콜백 호출
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }

    } catch (error) {
      console.error("리뷰 저장 오류:", error);
      toast({
        title: "저장 실패",
        description: error instanceof Error ? error.message : "리뷰 저장 중 오류가 발생했습니다.",
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
        title: "이미지 개수 초과",
        description: `이미지는 최대 ${maxImages}개까지 첨부할 수 있습니다.`,
        variant: "destructive",
      });
      return;
    }

    // 파일 검증
    const validFiles = files.filter(file => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "지원하지 않는 파일 형식",
          description: "JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.",
          variant: "destructive",
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: "파일 크기 초과",
          description: "각 이미지는 5MB 이하여야 합니다.",
          variant: "destructive",
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
      fileInputRef.current.value = "";
    }
  };

  // 메뉴 이미지 선택
  const handleMenuImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxImages = 5;
    
    if (selectedMenuImages.length + files.length > maxImages) {
      toast({
        title: "이미지 개수 초과",
        description: `이미지는 최대 ${maxImages}개까지 첨부할 수 있습니다.`,
        variant: "destructive",
      });
      return;
    }

    // 파일 검증
    const validFiles = files.filter(file => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "지원하지 않는 파일 형식",
          description: "JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.",
          variant: "destructive",
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: "파일 크기 초과",
          description: "각 이미지는 5MB 이하여야 합니다.",
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      setSelectedMenuImages(prev => [...prev, ...validFiles]);
      
      // 미리보기 URL 생성
      const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file));
      setMenuImagePreviewUrls(prev => [...prev, ...newPreviewUrls]);
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

  // 메뉴 이미지 제거
  const handleMenuImageRemove = (index: number) => {
    const newSelectedImages = [...selectedMenuImages];
    newSelectedImages.splice(index, 1);
    setSelectedMenuImages(newSelectedImages);
    
    // 미리보기 URL 정리
    URL.revokeObjectURL(menuImagePreviewUrls[index]);
    const newPreviewUrls = [...menuImagePreviewUrls];
    newPreviewUrls.splice(index, 1);
    setMenuImagePreviewUrls(newPreviewUrls);
  };

  // 평점에 따른 색상
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) {
return "text-green-600";
}
    if (rating >= 3.5) {
return "text-yellow-600";
}
    if (rating >= 2.5) {
return "text-orange-600";
}
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
              <Button className="bg-[#FF5722] hover:bg-[#E64A19] text-white">로그인하기</Button>
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
          {/* 전체적으로 어떠셨나요? */}
          <div>
            <h3 className="text-xl font-bold text-center mb-2">전체적으로 어떠셨나요?</h3>
            <p className="text-center text-gray-600 mb-6">별점을 선택해주세요</p>
            
            <div className="flex justify-center items-center gap-2 mb-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReview({ ...review, rating: Math.max(1, review.rating - 1) })}
                disabled={review.rating <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              
              <div className="flex gap-1 mx-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReview({ ...review, rating: star })}
                    className="focus:outline-none hover:scale-110 transition-transform duration-200"
                  >
                    <Star
                      className={`h-10 w-10 ${
                        star <= review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-gray-200 text-gray-200"
                      } transition-colors duration-200`}
                    />
                  </button>
                ))}
              </div>
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReview({ ...review, rating: Math.min(5, review.rating + 1) })}
                disabled={review.rating >= 5}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 항목별 평점 */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">항목별 평점 <span className="text-gray-500 text-sm">(필수)</span></h3>
            
            <div className="space-y-6">
              {/* 맛 */}
              <div>
                <label className="font-medium mb-3 block">맛</label>
                <div className="flex gap-2">
                  {[
                    { value: 2, label: "부족" },
                    { value: 3, label: "보통" },
                    { value: 4, label: "좋음" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleDetailedRatingChange("taste", option.value)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        detailedRatings.taste === option.value
                          ? "bg-orange-50 border-[#FF5722] text-[#FF5722]"
                          : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 가격 */}
              <div>
                <label className="font-medium mb-3 block">가격</label>
                <div className="flex gap-2">
                  {[
                    { value: 2, label: "불만" },
                    { value: 3, label: "보통" },
                    { value: 4, label: "만족" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleDetailedRatingChange("price", option.value)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        detailedRatings.price === option.value
                          ? "bg-orange-50 border-[#FF5722] text-[#FF5722]"
                          : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 응대 */}
              <div>
                <label className="font-medium mb-3 block">응대</label>
                <div className="flex gap-2">
                  {[
                    { value: 2, label: "불친절" },
                    { value: 3, label: "보통" },
                    { value: 4, label: "친절함" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleDetailedRatingChange("service", option.value)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        detailedRatings.service === option.value
                          ? "bg-orange-50 border-[#FF5722] text-[#FF5722]"
                          : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 어떤 음식을 드셨나요? */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              어떤 음식을 드셨나요? <span className="text-gray-500 text-sm">(복수 선택 가능)</span>
            </h3>
            
            <div className="space-y-3">
              {/* 가게 메뉴 */}
              {(storeMenus.length > 0 ? storeMenus : menuOptions).map((menu) => (
                <div key={menu} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                  <Checkbox 
                    id={menu}
                    checked={selectedMenus.includes(menu)}
                    onCheckedChange={() => toggleMenu(menu)}
                  />
                  <Label htmlFor={menu} className="flex-1 cursor-pointer">{menu}</Label>
                </div>
              ))}
              
              {/* 커스텀 추가된 메뉴들 */}
              {customMenuList.map((menu) => (
                <div key={`custom-${menu}`} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 bg-blue-50">
                  <Checkbox 
                    id={`custom-${menu}`}
                    checked={selectedMenus.includes(menu)}
                    onCheckedChange={() => toggleMenu(menu)}
                  />
                  <Label htmlFor={`custom-${menu}`} className="flex-1 cursor-pointer">
                    {menu} <span className="text-xs text-blue-600">(추가됨)</span>
                  </Label>
                </div>
              ))}
            </div>

            {/* 선택된 메뉴 표시 */}
            {selectedMenus.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-2">선택한 메뉴 ({selectedMenus.length}개):</p>
                <div className="flex flex-wrap gap-2">
                  {selectedMenus.map((menu) => (
                    <span 
                      key={menu} 
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {menu}
                      <button
                        type="button"
                        onClick={() => toggleMenu(menu)}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-4">
              <p className="mb-2 font-medium">주문했던 메뉴가 없다면 직접 추가해보세요!</p>
              <div className="flex gap-2">
                <Input
                  placeholder="메뉴명 직접 입력"
                  value={customMenu}
                  onChange={(e) => setCustomMenu(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomMenu();
                    }
                  }}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  className="bg-black text-white hover:bg-gray-800"
                  onClick={handleAddCustomMenu}
                >
                  추가
                </Button>
              </div>
            </div>
          </div>

          {/* 방문 후기 */}
          <div className="border-t pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                방문 후기 <span className="text-gray-500 text-sm">(선택)</span>
              </h3>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-4">
                음식, 서비스, 분위기, 위생상태 등의 방문 경험을 적어주세요.
              </p>
              <Textarea
                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px] bg-white"
                placeholder="가게에 대한 솔직한 리뷰를 작성해주세요..."
                value={review.content}
                onChange={(e) => setReview({ ...review, content: e.target.value })}
              />
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center text-xs text-gray-500">
                  <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-1">i</span>
                  {review.content.length}/1000자
                </div>
              </div>
            </div>
          </div>

          {/* 편의시설 키워드 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900">
              이 식당은 어떤 <span className="text-blue-600">편의시설</span>이 있었나요? (복수 선택 가능)
            </h3>
            <div className="flex flex-wrap gap-2">
              {restaurantKeywords.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                    selectedKeywords.includes(keyword)
                      ? "bg-blue-100 text-blue-800 border-blue-300"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => toggleKeyword(keyword, "restaurant")}
                >
                  {keyword}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Input
                placeholder="위 항목에 없는 키워드 직접 입력"
                className="w-full"
              />
              <Button type="button" className="mt-2 bg-black text-white hover:bg-gray-800">
                추가
              </Button>
            </div>
          </div>

          {/* 음식점 키워드 */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-900">
              이 식당은 어떤 <span className="text-blue-600">방문목적</span>에 적합한가요? (복수 선택 가능)
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {atmosphereKeywords.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                    selectedAtmosphere.includes(keyword)
                      ? "bg-blue-100 text-blue-800 border-blue-300"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => toggleKeyword(keyword, "atmosphere")}
                >
                  {keyword}
                </button>
              ))}
            </div>
            
            <h4 className="text-base font-semibold mb-3 text-gray-900">
              이 식당의 <span className="text-blue-600">분위기</span>를 선택해주세요. (복수 선택 가능)
            </h4>
            <div className="flex flex-wrap gap-2">
              {atmosphereDescriptions.map((desc) => (
                <button
                  key={desc}
                  type="button"
                  className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                    selectedAtmosphere.includes(desc)
                      ? "bg-pink-100 text-pink-800 border-pink-300"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => toggleKeyword(desc, "atmosphere")}
                >
                  {desc}
                </button>
              ))}
            </div>
          </div>

          {/* 음식·인테리어·외관 사진 섹션 */}
          <div className="border-t pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                음식·인테리어·외관 사진 <span className="text-gray-500 text-sm">(선택)</span>
              </h3>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
              <div className="flex flex-col items-center">
                <ImageIcon className="h-12 w-12 text-gray-400 mb-2" />
                <p className="text-gray-600 mb-1">본인이 직접 촬영하지 않은 사진</p>
                <p className="text-sm text-gray-500 mb-4">1000*1000 미만 해상도의 사진은 등록없이 삭제될 수 있습니다.</p>
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
                >
                  <Upload className="h-4 w-4 mr-2" />
                  이미지 선택
                </Button>
              </div>
            </div>
            
            {imagePreviewUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {imagePreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <Image
                      src={url}
                      alt={`미리보기 ${index + 1}`}
                      width={100}
                      height={100}
                      className="object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleImageRemove(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 메뉴판·영업시간·주차 사진 섹션 */}
          <div className="border-t pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                메뉴판·영업시간·주차 사진 <span className="text-gray-500 text-sm">(선택)</span>
              </h3>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
              <div className="flex flex-col items-center">
                <ImageIcon className="h-12 w-12 text-gray-400 mb-2" />
                <p className="text-gray-600 mb-1">본인이 직접 촬영하지 않은 사진</p>
                <p className="text-sm text-gray-500 mb-4">1000*1000 미만의 사진은 등록없이 삭제될 수 있습니다.</p>
                <Input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleMenuImageSelect}
                  className="hidden"
                  id="menu-images"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("menu-images")?.click()}
                  disabled={uploadingImages}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  이미지 선택
                </Button>
              </div>
            </div>
            
            {menuImagePreviewUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {menuImagePreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <Image
                      src={url}
                      alt={`메뉴 미리보기 ${index + 1}`}
                      width={100}
                      height={100}
                      className="object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleMenuImageRemove(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>



          {/* 액션 버튼 */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting || uploadingImages}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={submitting || uploadingImages || selectedMenus.length === 0 || review.rating === 0}
            >
              {submitting || uploadingImages ? 
                (uploadingImages ? "업로드 중..." : "저장 중...") : 
                (existingReview ? "수정 완료" : "평가 완료")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
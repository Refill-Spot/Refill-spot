"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, Trash2, Upload, User } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface ProfileImageUploadProps {
  onUploadComplete?: (url: string) => void;
}

export function ProfileImageUpload({ onUploadComplete }: ProfileImageUploadProps) {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;

    // 파일 유효성 검사
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "JPEG, PNG, WebP 파일만 업로드 가능합니다.",
        variant: "destructive",
      });
      return;
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "파일 크기는 5MB 이하여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "업로드 실패");
      }

      toast({
        title: "프로필 사진 업로드 완료",
        description: "프로필 사진이 성공적으로 업데이트되었습니다.",
      });

      onUploadComplete?.(result.url);
      
      // 페이지 새로고침으로 프로필 데이터 갱신
      window.location.reload();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "업로드 실패",
        description: error.message || "프로필 사진 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast, onUploadComplete]);

  const handleDeleteImage = async () => {
    if (!profile?.avatar_url) return;

    setIsUploading(true);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "삭제 실패");
      }

      toast({
        title: "프로필 사진 삭제 완료",
        description: "프로필 사진이 삭제되었습니다.",
      });

      // 페이지 새로고침으로 프로필 데이터 갱신
      window.location.reload();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "삭제 실패",
        description: error.message || "프로필 사진 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* 프로필 이미지 */}
      <div
        className={`relative group ${isDragging ? "opacity-75" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Avatar className="w-32 h-32 border-4 border-gray-200">
          <AvatarImage src={profile?.avatar_url} alt={profile?.username} />
          <AvatarFallback className="text-2xl bg-gray-100">
            <User className="w-16 h-16 text-gray-400" />
          </AvatarFallback>
        </Avatar>

        {/* 업로드 오버레이 */}
        <div
          className={`absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center transition-opacity ${
            isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <Camera className="w-8 h-8 text-white" />
        </div>

        {/* 드래그 오버레이 */}
        {isDragging && (
          <div className="absolute inset-0 border-2 border-dashed border-blue-400 rounded-full bg-blue-50 bg-opacity-75 flex items-center justify-center">
            <div className="text-center text-blue-600">
              <Upload className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-medium">여기에 드롭하세요</p>
            </div>
          </div>
        )}
      </div>

      {/* 컨트롤 버튼들 */}
      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? "업로드 중..." : "사진 변경"}
        </Button>

        {profile?.avatar_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteImage}
            disabled={isUploading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            삭제
          </Button>
        )}
      </div>

      {/* 숨겨진 파일 인풋 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileSelect(file);
          }
        }}
        className="hidden"
      />

      {/* 업로드 가이드 */}
      <div className="text-center text-sm text-gray-500 max-w-xs">
        <p>JPEG, PNG, WebP 파일만 가능</p>
        <p>최대 파일 크기: 5MB</p>
        <p>드래그 앤 드롭도 지원합니다</p>
      </div>
    </div>
  );
}
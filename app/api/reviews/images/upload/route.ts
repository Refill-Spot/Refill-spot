import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_IMAGES = 5;
const REVIEW_IMAGES_BUCKET = process.env.SUPABASE_STORAGE_BUCKET_REVIEW_IMAGES || 'review-images';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // 현재 로그인한 사용자 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("images") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "업로드할 이미지를 선택해주세요." },
        { status: 400 },
      );
    }

    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `이미지는 최대 ${MAX_IMAGES}개까지 업로드할 수 있습니다.` },
        { status: 400 },
      );
    }

    // 파일 유효성 검사
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다." },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "각 이미지는 5MB 이하여야 합니다." },
          { status: 400 },
        );
      }
    }

    const uploadedUrls: string[] = [];

    // 각 파일을 Supabase Storage에 업로드
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const fileBuffer = await file.arrayBuffer();
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(REVIEW_IMAGES_BUCKET)
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("이미지 업로드 오류:", uploadError);
        console.error("업로드 시도한 파일:", fileName);
        console.error("사용자 ID:", user.id);
        console.error("버킷:", REVIEW_IMAGES_BUCKET);
        
        // 이미 업로드된 이미지들 정리
        for (const url of uploadedUrls) {
          const path = url.split('/').pop();
          if (path) {
            await supabase.storage.from(REVIEW_IMAGES_BUCKET).remove([path]);
          }
        }
        
        return NextResponse.json(
          { 
            error: "이미지 업로드 중 오류가 발생했습니다.",
            details: uploadError 
          },
          { status: 500 },
        );
      }

      // 공개 URL 생성
      const { data: urlData } = supabase.storage
        .from(REVIEW_IMAGES_BUCKET)
        .getPublicUrl(uploadData.path);

      uploadedUrls.push(urlData.publicUrl);
    }

    return NextResponse.json({
      message: "이미지가 성공적으로 업로드되었습니다.",
      imageUrls: uploadedUrls,
    });

  } catch (error) {
    console.error("이미지 업로드 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
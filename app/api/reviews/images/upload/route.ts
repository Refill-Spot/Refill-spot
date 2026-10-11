import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  readImageUploadFormData,
  validateImageUpload,
} from "@/lib/image-utils";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const MAX_IMAGES = 5;
const REVIEW_IMAGES_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_REVIEW_IMAGES || "review-images";

export async function POST(request: NextRequest) {
  let cleanupUploads: (() => Promise<void>) | null = null;
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

    const uploadRequest = await readImageUploadFormData(request, MAX_IMAGES);
    if (!uploadRequest.valid) {
      return NextResponse.json(
        {
          error:
            uploadRequest.error === "body_too_large"
              ? "각 이미지는 5MB 이하여야 합니다."
              : "올바른 파일 업로드 요청이 필요합니다.",
        },
        { status: uploadRequest.error === "body_too_large" ? 413 : 400 },
      );
    }
    const files = uploadRequest.formData.getAll("images");

    if (files.length === 0) {
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

    const validatedFiles: {
      file: File;
      contentType: string;
      extension: string;
    }[] = [];
    // 업로드를 시작하기 전에 모든 파일을 검사합니다.
    for (const file of files) {
      const validation = await validateImageUpload(file);
      if (!validation.valid) {
        const message =
          validation.error === "invalid_file"
            ? "업로드할 이미지 파일이 필요합니다."
            : validation.error === "invalid_size"
              ? "각 이미지는 1바이트 이상 5MB 이하여야 합니다."
              : "JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      validatedFiles.push(validation);
    }

    const uploadedUrls: string[] = [];
    const uploadedPaths: string[] = [];
    const storage = supabase.storage.from(REVIEW_IMAGES_BUCKET);
    cleanupUploads = async () => {
      if (uploadedPaths.length === 0) {
        return;
      }
      try {
        const { error: cleanupError } = await storage.remove(uploadedPaths);
        if (cleanupError) {
          console.error("Review image rollback failed:", cleanupError);
        }
      } catch (cleanupError) {
        console.error("Review image rollback failed:", cleanupError);
      }
    };

    // 각 파일을 Supabase Storage에 업로드
    for (const validation of validatedFiles) {
      const fileName = `${user.id}/${uuidv4()}.${validation.extension}`;
      const { data: uploadData, error: uploadError } = await storage.upload(
        fileName,
        validation.file,
        {
          contentType: validation.contentType,
          cacheControl: "3600",
          upsert: false,
        },
      );

      if (uploadError || !uploadData) {
        console.error("이미지 업로드 오류:", uploadError);
        await cleanupUploads();
        cleanupUploads = null;
        return NextResponse.json(
          { error: "이미지 업로드 중 오류가 발생했습니다." },
          { status: 500 },
        );
      }
      uploadedPaths.push(fileName);

      // 공개 URL 생성
      const { data: urlData } = storage.getPublicUrl(fileName);

      uploadedUrls.push(urlData.publicUrl);
    }

    return NextResponse.json({
      message: "이미지가 성공적으로 업로드되었습니다.",
      imageUrls: uploadedUrls,
    });
  } catch (error) {
    if (cleanupUploads) {
      await cleanupUploads();
    }
    console.error("이미지 업로드 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

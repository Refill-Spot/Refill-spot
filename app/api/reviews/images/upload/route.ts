import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  readImageUploadFormData,
  validateImageUpload,
} from "@/lib/image-utils";
import {
  ManagedImageUploadError,
  uploadManagedImage,
} from "@/lib/managed-image-upload";
import { NextRequest, NextResponse } from "next/server";

const MAX_IMAGES = 5;
const REVIEW_IMAGES_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_REVIEW_IMAGES || "review-images";

export async function POST(request: NextRequest) {
  let confirmedUploadCount = 0;
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

    const validatedFiles: File[] = [];
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
      validatedFiles.push(validation.file);
    }

    const uploadedUrls: string[] = [];

    // 준비 상태와 Storage 메타데이터가 확인된 관리 이미지만 반환합니다.
    for (const file of validatedFiles) {
      const finalizedImage = await uploadManagedImage(supabase, {
        ownerId: user.id,
        bucketId: REVIEW_IMAGES_BUCKET,
        file,
      });
      confirmedUploadCount++;
      uploadedUrls.push(finalizedImage.canonical_url);
    }

    return NextResponse.json({
      message: "이미지가 성공적으로 업로드되었습니다.",
      imageUrls: uploadedUrls,
    });
  } catch (error) {
    console.error("이미지 업로드 API 오류:", error);
    const uploadFailure =
      error instanceof ManagedImageUploadError ? error : null;
    if (uploadFailure?.uploadState === "confirmed") {
      confirmedUploadCount++;
    }
    // 파일이 확인되었더라도 실제 삭제나 정리 예약을 추정하지 않습니다.
    return NextResponse.json(
      {
        error:
          "이미지 업로드 요청을 완료하지 못했습니다. " +
          (confirmedUploadCount > 0
            ? `업로드가 확인된 이미지 ${confirmedUploadCount}개의 파일 정리는 보류 중입니다. `
            : "") +
          (uploadFailure?.uploadState === "unknown"
            ? "파일의 업로드 상태를 확인하지 못했습니다. "
            : uploadFailure?.stage === "finalize"
              ? "관리 이미지의 준비 상태를 확인하지 못했습니다. "
              : "") +
          "저장소 파일은 삭제하지 않았습니다. 다시 시도해주세요.",
        ...(confirmedUploadCount > 0
          ? {
              imageCleanup: {
                status: "deferred",
                count: confirmedUploadCount,
                reason:
                  uploadFailure?.stage === "finalize"
                    ? "managed_finalization_unconfirmed"
                    : "cleanup_unconfirmed",
              },
            }
          : {}),
      },
      { status: 500 },
    );
  }
}

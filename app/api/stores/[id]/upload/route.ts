import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  readImageUploadFormData,
  validateImageUpload,
} from "@/lib/image-utils";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const STORE_IMAGES_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_STORE_IMAGES || "store-images";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(storeId)) {
    return NextResponse.json(
      { error: "올바르지 않은 가게 ID입니다." },
      { status: 400 },
    );
  }
  try {
    const supabase = await createServerSupabaseClient();

    // 인증 체크
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const uploadRequest = await readImageUploadFormData(request, 1);
    if (!uploadRequest.valid) {
      return NextResponse.json(
        {
          error:
            uploadRequest.error === "body_too_large"
              ? "파일 크기가 너무 큽니다. (최대 5MB)"
              : "올바른 파일 업로드 요청이 필요합니다.",
        },
        { status: uploadRequest.error === "body_too_large" ? 413 : 400 },
      );
    }
    const { formData } = uploadRequest;
    if (formData.getAll("file").length !== 1) {
      return NextResponse.json(
        { error: "파일은 하나만 선택해야 합니다." },
        { status: 400 },
      );
    }
    const validation = await validateImageUpload(formData.get("file"));
    if (!validation.valid) {
      const message =
        validation.error === "invalid_file"
          ? "파일이 필요합니다."
          : validation.error === "invalid_size"
            ? "파일 크기는 1바이트 이상 5MB 이하여야 합니다."
            : "지원하지 않는 파일 형식입니다. (jpeg, jpg, png, webp만 가능)";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .maybeSingle();
    if (storeError) {
      console.error("Store image target lookup failed:", storeError);
      return NextResponse.json(
        { error: "가게 정보를 가져오지 못했습니다." },
        { status: 500 },
      );
    }
    if (!store) {
      return NextResponse.json(
        { error: "가게를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // 파일명: storeId/uuid.확장자
    const fileName = `${storeId}/${uuidv4()}.${validation.extension}`;

    // Supabase Storage 업로드
    const { data, error } = await supabase.storage
      .from(STORE_IMAGES_BUCKET)
      .upload(fileName, validation.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: validation.contentType,
      });

    if (error || !data) {
      console.error("Store image upload failed:", error);
      return NextResponse.json(
        { error: "이미지 업로드에 실패했습니다." },
        { status: 500 },
      );
    }

    // public URL 생성
    const {
      data: { publicUrl },
    } = supabase.storage.from(STORE_IMAGES_BUCKET).getPublicUrl(fileName);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("Store image upload failed:", error);
    return NextResponse.json(
      { error: "이미지 업로드에 실패했습니다." },
      { status: 500 },
    );
  }
}

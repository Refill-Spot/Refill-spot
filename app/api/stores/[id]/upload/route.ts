import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const STORE_IMAGES_BUCKET = process.env.SUPABASE_STORAGE_BUCKET_STORE_IMAGES || "store-images";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = id;
  try {
    const supabase = await createServerSupabaseClient();

    // 인증 체크
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    // multipart/form-data 파싱
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "파일이 필요합니다." },
        { status: 400 },
      );
    }

    // 파일명: storeId/uuid.확장자
    const ext = file.name.split(".").pop();
    const fileName = `${storeId}/${uuidv4()}.${ext}`;

    // Supabase Storage 업로드
    const { data, error } = await supabase.storage
      .from(STORE_IMAGES_BUCKET)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // public URL 생성
    const {
      data: { publicUrl },
    } = supabase.storage.from(STORE_IMAGES_BUCKET).getPublicUrl(fileName);

    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

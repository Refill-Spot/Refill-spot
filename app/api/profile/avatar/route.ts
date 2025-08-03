import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const PROFILE_IMAGES_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_PROFILE_IMAGES || "image";

export async function POST(request: NextRequest) {
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

    // 파일 유효성 검사
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: "지원하지 않는 파일 형식입니다. (jpeg, jpg, png, webp만 가능)",
        },
        { status: 400 },
      );
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "파일 크기가 너무 큽니다. (최대 5MB)" },
        { status: 400 },
      );
    }

    // 기존 프로필 이미지 삭제
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    if (profile?.avatar_url) {
      const oldFileName = profile.avatar_url.split("/").pop();
      if (oldFileName) {
        await supabase.storage
          .from(PROFILE_IMAGES_BUCKET)
          .remove([`${user.id}/${oldFileName}`]);
      }
    }

    // 새 파일명 생성: userId/uuid.확장자
    const ext = file.name.split(".").pop();
    const fileName = `${user.id}/${uuidv4()}.${ext}`;

    // Supabase Storage 업로드
    const { data, error } = await supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
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
    } = supabase.storage.from(PROFILE_IMAGES_BUCKET).getPublicUrl(fileName);

    // profiles 테이블 업데이트
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    // 현재 프로필 이미지 정보 가져오기
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    if (profile?.avatar_url) {
      const fileName = profile.avatar_url.split("/").pop();
      if (fileName) {
        // 스토리지에서 파일 삭제
        await supabase.storage
          .from(PROFILE_IMAGES_BUCKET)
          .remove([`${user.id}/${fileName}`]);
      }
    }

    // profiles 테이블에서 avatar_url 제거
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

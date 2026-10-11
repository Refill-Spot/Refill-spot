import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getOwnedProfileImagePath,
  readImageUploadFormData,
  validateImageUpload,
} from "@/lib/image-utils";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const PROFILE_IMAGES_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_PROFILE_IMAGES || "image";

export async function POST(request: NextRequest) {
  let cleanupUpload: (() => Promise<void>) | null = null;
  try {
    const supabase = await createServerSupabaseClient();
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Profile image lookup failed:", profileError);
      return NextResponse.json(
        { error: "프로필 정보를 가져오지 못했습니다." },
        { status: 500 },
      );
    }
    if (!profile) {
      return NextResponse.json(
        { error: "프로필을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const storage = supabase.storage.from(PROFILE_IMAGES_BUCKET);
    const oldFileName = getOwnedProfileImagePath(
      profile.avatar_url,
      user.id,
      storage.getPublicUrl("").data.publicUrl,
    );
    const fileName = `${user.id}/${uuidv4()}.${validation.extension}`;
    const { data, error } = await storage.upload(fileName, validation.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: validation.contentType,
    });

    if (error || !data) {
      console.error("Profile image upload failed:", error);
      return NextResponse.json(
        { error: "프로필 이미지 업로드에 실패했습니다." },
        { status: 500 },
      );
    }
    cleanupUpload = async () => {
      try {
        const { error: cleanupError } = await storage.remove([fileName]);
        if (cleanupError) {
          console.error(
            "Unreferenced profile image cleanup failed:",
            cleanupError,
          );
        }
      } catch (cleanupError) {
        console.error(
          "Unreferenced profile image cleanup failed:",
          cleanupError,
        );
      }
    };

    const {
      data: { publicUrl },
    } = storage.getPublicUrl(fileName);

    // 다른 요청이 이미 변경한 이미지를 덮어쓰지 않습니다.
    const updateQuery = supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);
    const { data: updatedProfile, error: updateError } = await (
      profile.avatar_url === null
        ? updateQuery.is("avatar_url", null)
        : updateQuery.eq("avatar_url", profile.avatar_url)
    )
      .select("id")
      .maybeSingle();

    if (updateError || !updatedProfile) {
      await cleanupUpload();
      cleanupUpload = null;
      if (updateError) {
        console.error("Profile image update failed:", updateError);
      }
      return NextResponse.json(
        {
          error: updateError
            ? "프로필 이미지 변경에 실패했습니다."
            : "프로필 이미지가 변경되었습니다. 다시 시도해 주세요.",
        },
        { status: updateError ? 500 : 409 },
      );
    }
    cleanupUpload = null;

    // 새 이미지가 저장된 후에만 이전 이미지를 삭제합니다.
    if (oldFileName) {
      const { error: removeError } = await storage.remove([oldFileName]);
      if (removeError) {
        console.error("Previous profile image cleanup failed:", removeError);
        return NextResponse.json(
          {
            error:
              "프로필 이미지는 변경되었으나 이전 이미지 삭제에 실패했습니다.",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    if (cleanupUpload) {
      await cleanupUpload();
    }
    console.error("Profile image upload failed:", error);
    return NextResponse.json(
      { error: "프로필 이미지 업로드에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Profile image lookup failed:", profileError);
      return NextResponse.json(
        { error: "프로필 정보를 가져오지 못했습니다." },
        { status: 500 },
      );
    }
    if (!profile) {
      return NextResponse.json(
        { error: "프로필을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const storage = supabase.storage.from(PROFILE_IMAGES_BUCKET);
    const fileName = getOwnedProfileImagePath(
      profile.avatar_url,
      user.id,
      storage.getPublicUrl("").data.publicUrl,
    );

    // 먼저 프로필 참조를 제거하여 삭제된 파일을 가리키지 않습니다.
    const updateQuery = supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);
    const { data: updatedProfile, error: updateError } = await (
      profile.avatar_url === null
        ? updateQuery.is("avatar_url", null)
        : updateQuery.eq("avatar_url", profile.avatar_url)
    )
      .select("id")
      .maybeSingle();

    if (updateError || !updatedProfile) {
      if (updateError) {
        console.error("Profile image removal failed:", updateError);
      }
      return NextResponse.json(
        {
          error: updateError
            ? "프로필 이미지 삭제에 실패했습니다."
            : "프로필 이미지가 변경되었습니다. 다시 시도해 주세요.",
        },
        { status: updateError ? 500 : 409 },
      );
    }
    if (fileName) {
      const { error: removeError } = await storage.remove([fileName]);
      if (removeError) {
        console.error("Profile image storage removal failed:", removeError);
        return NextResponse.json(
          { error: "프로필 이미지는 해제되었으나 파일 삭제에 실패했습니다." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile image removal failed:", error);
    return NextResponse.json(
      { error: "프로필 이미지 삭제에 실패했습니다." },
      { status: 500 },
    );
  }
}

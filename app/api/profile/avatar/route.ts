import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getOwnedProfileImagePath,
  readImageUploadFormData,
  validateImageUpload,
} from "@/lib/image-utils";
import {
  ManagedImageUploadError,
  uploadManagedImage,
} from "@/lib/managed-image-upload";
import { NextRequest, NextResponse } from "next/server";

const PROFILE_IMAGES_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_PROFILE_IMAGES || "profile-images";

function getImageCleanup(
  fileName: string | null,
  reason:
    | "cleanup_unconfirmed"
    | "managed_finalization_unconfirmed" = "cleanup_unconfirmed",
) {
  if (!fileName) {
    return { status: "not_needed" as const, count: 0 };
  }

  // Only the lifecycle worker may delete a claimed managed object. A route
  // cannot assert completion; ownership alone never makes a legacy key eligible.
  return {
    status: "deferred" as const,
    count: 1,
    reason,
  };
}

export async function POST(request: NextRequest) {
  let imageCleanup: ReturnType<typeof getImageCleanup> | undefined =
    getImageCleanup(null);
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다.", imageCleanup },
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
          imageCleanup,
        },
        { status: uploadRequest.error === "body_too_large" ? 413 : 400 },
      );
    }
    const { formData } = uploadRequest;
    if (formData.getAll("file").length !== 1) {
      return NextResponse.json(
        { error: "파일은 하나만 선택해야 합니다.", imageCleanup },
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
      return NextResponse.json(
        { error: message, imageCleanup },
        { status: 400 },
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
        { error: "프로필 정보를 가져오지 못했습니다.", imageCleanup },
        { status: 500 },
      );
    }
    if (!profile) {
      return NextResponse.json(
        { error: "프로필을 찾을 수 없습니다.", imageCleanup },
        { status: 404 },
      );
    }

    const storage = supabase.storage.from(PROFILE_IMAGES_BUCKET);
    const oldFileName = getOwnedProfileImagePath(
      profile.avatar_url,
      user.id,
      storage.getPublicUrl("").data.publicUrl,
    );
    const finalizedImage = await uploadManagedImage(supabase, {
      ownerId: user.id,
      bucketId: PROFILE_IMAGES_BUCKET,
      file: validation.file,
    });
    const fileName = finalizedImage.object_path;
    const publicUrl = finalizedImage.canonical_url;

    // A failed/unknown DB response cannot prove that this upload is detached.
    imageCleanup = undefined;
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
      if (updateError) {
        console.error("Profile image update failed:", updateError);
      } else {
        imageCleanup = getImageCleanup(fileName);
      }
      return NextResponse.json(
        {
          error: updateError
            ? "프로필 이미지 변경 상태를 확인하지 못했습니다. 새로고침하여 확인해 주세요. 저장소 파일은 삭제하지 않았습니다."
            : "프로필 이미지가 변경되었거나 프로필을 찾을 수 없습니다. 새로고침하여 확인해 주세요. 업로드 파일의 실제 삭제는 보류되었습니다.",
          imageCleanup,
        },
        { status: updateError ? 500 : 409 },
      );
    }
    imageCleanup = getImageCleanup(
      oldFileName !== fileName ? oldFileName : null,
    );

    return NextResponse.json({ url: publicUrl, imageCleanup });
  } catch (error) {
    console.error("Profile image upload failed:", error);
    if (error instanceof ManagedImageUploadError) {
      imageCleanup =
        error.uploadState === "confirmed"
          ? {
              status: "deferred",
              count: 1,
              reason: "managed_finalization_unconfirmed",
            }
          : error.uploadState === "unknown"
            ? undefined
            : getImageCleanup(null);
      return NextResponse.json(
        {
          error:
            "관리 이미지 업로드를 완료하지 못했습니다. " +
            (error.uploadState === "confirmed"
              ? "업로드가 확인된 파일의 준비 상태를 확인하지 못했습니다. 파일 정리는 보류 중입니다. "
              : error.uploadState === "unknown"
                ? "파일의 업로드 상태를 확인하지 못했습니다. "
                : "업로드를 시작하지 않았습니다. ") +
            "저장소 파일은 삭제하지 않았습니다. 다시 시도해주세요.",
          imageCleanup,
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        error:
          "프로필 이미지 변경 상태를 확인하지 못했습니다. 새로고침하여 확인해 주세요. " +
          (imageCleanup?.status === "deferred"
            ? "업로드 파일의 실제 삭제는 보류되었습니다."
            : "저장소 파일은 삭제하지 않았습니다."),
        imageCleanup,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  let imageCleanup: ReturnType<typeof getImageCleanup> | undefined =
    getImageCleanup(null);
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다.", imageCleanup },
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
        { error: "프로필 정보를 가져오지 못했습니다.", imageCleanup },
        { status: 500 },
      );
    }
    if (!profile) {
      return NextResponse.json(
        { error: "프로필을 찾을 수 없습니다.", imageCleanup },
        { status: 404 },
      );
    }

    const storage = supabase.storage.from(PROFILE_IMAGES_BUCKET);
    const fileName = getOwnedProfileImagePath(
      profile.avatar_url,
      user.id,
      storage.getPublicUrl("").data.publicUrl,
    );

    // Do not report a cleanup outcome until the reference mutation is known.
    imageCleanup = undefined;
    // 프로필 참조만 해제하며 저장소 파일은 삭제하지 않습니다.
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
      } else {
        imageCleanup = getImageCleanup(null);
      }
      return NextResponse.json(
        {
          error: updateError
            ? "프로필 이미지 연결 해제 상태를 확인하지 못했습니다. 새로고침하여 확인해 주세요. 저장소 파일은 삭제하지 않았습니다."
            : "프로필 이미지가 변경되었거나 프로필을 찾을 수 없습니다. 새로고침하여 확인해 주세요.",
          imageCleanup,
        },
        { status: updateError ? 500 : 409 },
      );
    }
    return NextResponse.json({
      success: true,
      imageCleanup: getImageCleanup(fileName),
    });
  } catch (error) {
    console.error("Profile image removal failed:", error);
    return NextResponse.json(
      {
        error:
          "프로필 이미지 연결 해제 상태를 확인하지 못했습니다. 새로고침하여 확인해 주세요. 저장소 파일은 삭제하지 않았습니다.",
        imageCleanup,
      },
      { status: 500 },
    );
  }
}

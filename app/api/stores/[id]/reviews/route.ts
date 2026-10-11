import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import {
  getReviewImageCleanup,
  REVIEW_IMAGES_BUCKET,
  validateReviewImageUrls,
  verifyNewReviewImages,
} from "@/lib/review-images";
import { NextRequest, NextResponse } from "next/server";

function parseStoreId(id: string): number | null {
  const value = Number(id);
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(value) ? value : null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = parseStoreId(id);

  if (storeId === null) {
    return NextResponse.json(
      { error: "올바르지 않은 가게 ID입니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = createRouteHandlerSupabaseClient(request);

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

    const userId = user.id;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "올바른 JSON 요청이 필요합니다." },
        { status: 400 },
      );
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json(
        { error: "올바른 리뷰 요청이 필요합니다." },
        { status: 400 },
      );
    }
    const {
      rating,
      content,
      imageUrls,
      keywords = [],
      atmosphere = [],
      detailedRatings = {},
      menus = [],
    } = payload as Record<string, unknown>;

    // 유효성 검사
    if (
      typeof rating !== "number" ||
      !Number.isFinite(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return NextResponse.json(
        { error: "평점은 1에서 5 사이의 값이어야 합니다." },
        { status: 400 },
      );
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "리뷰 내용을 입력해주세요." },
        { status: 400 },
      );
    }

    if (
      imageUrls !== undefined &&
      (!isStringArray(imageUrls) || imageUrls.length > 5)
    ) {
      return NextResponse.json(
        { error: "이미지는 URL 문자열로 최대 5개까지 첨부할 수 있습니다." },
        { status: 400 },
      );
    }
    if (
      !isStringArray(keywords) ||
      !isStringArray(atmosphere) ||
      !isStringArray(menus) ||
      !detailedRatings ||
      typeof detailedRatings !== "object" ||
      Array.isArray(detailedRatings) ||
      Object.values(detailedRatings).some(
        (value) =>
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 1 ||
          value > 5,
      )
    ) {
      return NextResponse.json(
        { error: "올바른 리뷰 상세 정보가 필요합니다." },
        { status: 400 },
      );
    }

    // 가게 존재 확인
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { error: "해당 가게를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // 이미 리뷰를 작성했는지 확인 + 최근 작성 시간 체크
    const { data: existingReview, error: checkError } = await supabase
      .from("reviews")
      .select("id, created_at, updated_at, image_urls, detailed_ratings")
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    const storage = supabase.storage.from(REVIEW_IMAGES_BUCKET);
    const { data: bucketUrl } = storage.getPublicUrl("");
    const validatedImages = validateReviewImageUrls(
      imageUrls === undefined ? (existingReview?.image_urls ?? []) : imageUrls,
      userId,
      bucketUrl.publicUrl,
      existingReview?.image_urls,
    );
    if (!validatedImages.valid) {
      return NextResponse.json(
        { error: "본인이 업로드한 리뷰 이미지만 첨부할 수 있습니다." },
        { status: 400 },
      );
    }
    if (
      !(await verifyNewReviewImages(
        validatedImages.imageUrls,
        existingReview?.image_urls,
        userId,
        bucketUrl.publicUrl,
        storage,
      ))
    ) {
      return NextResponse.json(
        {
          error:
            "업로드한 리뷰 이미지를 확인할 수 없습니다. 다시 시도해주세요.",
        },
        { status: 400 },
      );
    }

    // 시간 기반 제한: 새 리뷰 작성만 제한 (수정은 자유)
    if (!existingReview) {
      // 새 리뷰 작성 시에만 시간 제한 확인
      // 이 사용자가 다른 가게에서 최근에 리뷰를 작성했는지 확인
      const { data: recentReviews, error: recentCheckError } = await supabase
        .from("reviews")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentCheckError) {
        throw recentCheckError;
      }

      if (recentReviews && recentReviews.length > 0) {
        const lastReviewTime = new Date(recentReviews[0].created_at);
        const timeDiff = Date.now() - lastReviewTime.getTime();
        const cooldownTime = 10 * 60 * 1000; // 10분

        if (timeDiff < cooldownTime) {
          const remainingMinutes = Math.ceil(
            (cooldownTime - timeDiff) / (60 * 1000),
          );
          return NextResponse.json(
            {
              error: `새 리뷰 작성은 ${remainingMinutes}분 후에 가능합니다.`,
              remainingTime: remainingMinutes,
            },
            { status: 429 },
          );
        }
      }
    }

    let reviewResponse;

    if (existingReview) {
      const previousUpdateTime = Date.parse(existingReview.updated_at);
      if (!Number.isFinite(previousUpdateTime)) {
        return NextResponse.json(
          { error: "리뷰가 변경되었습니다. 새로고침 후 다시 시도해주세요." },
          { status: 409 },
        );
      }
      // 기존 리뷰 업데이트
      const { data, error } = await supabase
        .from("reviews")
        .update({
          rating,
          content,
          image_urls: validatedImages.imageUrls,
          ...(Object.hasOwn(payload, "keywords") ? { keywords } : {}),
          ...(Object.hasOwn(payload, "atmosphere") ? { atmosphere } : {}),
          ...(Object.hasOwn(payload, "detailedRatings")
            ? {
                detailed_ratings: {
                  ...(existingReview.detailed_ratings &&
                  typeof existingReview.detailed_ratings === "object" &&
                  !Array.isArray(existingReview.detailed_ratings)
                    ? existingReview.detailed_ratings
                    : {}),
                  ...(detailedRatings as Record<string, number>),
                },
              }
            : {}),
          ...(Object.hasOwn(payload, "menus") ? { menus } : {}),
          updated_at: new Date(
            Math.max(Date.now(), previousUpdateTime + 1),
          ).toISOString(),
        })
        .eq("id", existingReview.id)
        .eq("store_id", storeId)
        .eq("user_id", userId)
        .eq("updated_at", existingReview.updated_at)
        .select(
          `
          *,
          profiles:profiles(username, avatar_url)
        `,
        )
        .maybeSingle();

      if (error) {
        throw error;
      }
      if (!data) {
        return NextResponse.json(
          { error: "리뷰가 변경되었습니다. 새로고침 후 다시 시도해주세요." },
          { status: 409 },
        );
      }

      reviewResponse = {
        success: true,
        message: "리뷰가 업데이트되었습니다.",
        review: {
          id: data.id,
          rating: data.rating,
          content: data.content,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          user: {
            id: data.user_id,
            username: data.profiles?.username ?? "사용자",
            avatar_url: data.profiles?.avatar_url ?? null,
          },
        },
        imageCleanup: getReviewImageCleanup(
          existingReview.image_urls,
          data.image_urls,
          userId,
          bucketUrl.publicUrl,
        ),
      };
    } else {
      // 새 리뷰 생성
      const { data, error } = await supabase
        .from("reviews")
        .insert({
          user_id: userId,
          store_id: storeId,
          rating,
          content,
          image_urls: validatedImages.imageUrls,
          keywords,
          atmosphere,
          detailed_ratings: detailedRatings as Record<string, number>,
          menus,
        })
        .select(
          `
          *,
          profiles:profiles(username, avatar_url)
        `,
        )
        .single();

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json(
            {
              error:
                "리뷰가 이미 등록되었습니다. 새로고침 후 다시 시도해주세요.",
            },
            { status: 409 },
          );
        }
        throw error;
      }
      if (!data) {
        throw new Error("Review insert returned no persisted row");
      }

      reviewResponse = {
        success: true,
        message: "리뷰가 등록되었습니다.",
        review: {
          id: data.id,
          rating: data.rating,
          content: data.content,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          user: {
            id: data.user_id,
            username: data.profiles?.username ?? "사용자",
            avatar_url: data.profiles?.avatar_url ?? null,
          },
        },
      };
    }

    return NextResponse.json(reviewResponse);
  } catch (error) {
    console.error("리뷰 작성 오류:", error);
    return NextResponse.json(
      { error: "리뷰 등록 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = parseStoreId(id);

  if (storeId === null) {
    return NextResponse.json(
      { error: "올바르지 않은 가게 ID입니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = createRouteHandlerSupabaseClient(request);

    // 현재 로그인한 사용자 확인 (좋아요 상태 조회용)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // 리뷰 조회 - profiles 테이블 조인으로 실제 사용자명과 아바타 가져오기
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select(
        `
        *,
        profiles:profiles!inner(username, avatar_url)
      `,
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // 각 리뷰의 좋아요 수를 별도로 조회
    const reviewIds = reviews.map((r) => r.id);
    const { data: likeCounts, error: likeError } = await supabase
      .from("review_likes")
      .select("review_id, user_id")
      .in("review_id", reviewIds);

    if (likeError) {
      console.warn("좋아요 수 조회 오류:", likeError);
    }

    // 리뷰별 좋아요 수 계산 및 현재 사용자 좋아요 상태 확인
    const likeCountMap = new Map<number, number>();
    const userLikedSet = new Set<number>();

    if (likeCounts) {
      likeCounts.forEach((like) => {
        const count = likeCountMap.get(like.review_id) || 0;
        likeCountMap.set(like.review_id, count + 1);

        // 현재 사용자가 좋아요한 리뷰 체크
        if (user && like.user_id === user.id) {
          userLikedSet.add(like.review_id);
        }
      });
    }

    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      content: review.content,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      userId: review.user_id,
      imageUrls: review.image_urls || [],
      keywords: review.keywords || [],
      atmosphere: review.atmosphere || [],
      detailedRatings: review.detailed_ratings || {},
      menus: review.menus || [],
      likeCount: likeCountMap.get(review.id) || 0,
      isLikedByUser: userLikedSet.has(review.id),
      user: {
        id: review.user_id,
        username: review.profiles.username,
        avatar_url: review.profiles.avatar_url,
      },
    }));

    return NextResponse.json({
      reviews: formattedReviews,
      totalReviews: reviews.length,
    });
  } catch (error) {
    console.error("리뷰 조회 오류:", error);
    return NextResponse.json(
      { error: "리뷰 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = parseStoreId(id);

  if (storeId === null) {
    return NextResponse.json(
      { error: "올바르지 않은 가게 ID입니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = createRouteHandlerSupabaseClient(request);

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

    const userId = user.id;

    const { data: existingReview, error: checkError } = await supabase
      .from("reviews")
      .select("id, updated_at, image_urls")
      .eq("user_id", userId)
      .eq("store_id", storeId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }
    if (!existingReview) {
      return NextResponse.json({
        success: true,
        message: "리뷰가 삭제되었습니다.",
      });
    }

    const { data: bucketUrl } = supabase.storage
      .from(REVIEW_IMAGES_BUCKET)
      .getPublicUrl("");

    // 읽은 버전만 삭제합니다. 동시 수정이나 RLS로 삭제되지 않으면 성공으로 처리하지 않습니다.
    const { data: deletedReview, error: deleteError } = await supabase
      .from("reviews")
      .delete()
      .eq("id", existingReview.id)
      .eq("user_id", userId)
      .eq("store_id", storeId)
      .eq("updated_at", existingReview.updated_at)
      .select("id, image_urls")
      .maybeSingle();

    if (deleteError) {
      throw deleteError;
    }
    if (!deletedReview) {
      return NextResponse.json(
        { error: "리뷰가 변경되었습니다. 새로고침 후 다시 시도해주세요." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "리뷰가 삭제되었습니다.",
      imageCleanup: getReviewImageCleanup(
        deletedReview.image_urls,
        [],
        userId,
        bucketUrl.publicUrl,
      ),
    });
  } catch (error) {
    console.error("리뷰 삭제 오류:", error);
    return NextResponse.json(
      { error: "리뷰 삭제 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { StoreFromDb, ReviewFromDb } from "@/types/store";

interface FormattedStore {
  id: number;
  name: string;
  address: string;
  description: string | null;
  position: {
    lat: number;
    lng: number;
    x: number;
    y: number;
  };
  categories: string[];
  rating: {
    naver: number;
    kakao: number;
  };
  refillItems: string[] | null;
  openHours: string | null;
  price: string | null;
  imageUrls: string[] | null;
  reviews: Array<{
    id: number;
    rating: number;
    content: string;
    createdAt: string;
    user: {
      id: string;
      username: string;
    };
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const storeId = parseInt(params.id);

  if (isNaN(storeId)) {
    return NextResponse.json(
      { error: "올바르지 않은 가게 ID입니다." },
      { status: 400 }
    );
  }

  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // 가게 정보 조회
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select(
        `
        *,
        categories:store_categories(
          category:categories(name)
        )
      `
      )
      .eq("id", storeId)
      .single();

    if (storeError) {
      throw storeError;
    }

    // 리뷰 조회
    const { data: reviews, error: reviewsError } = await supabase
      .from("reviews")
      .select(
        `
        *,
        profiles:profiles(username)
      `
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (reviewsError) {
      throw reviewsError;
    }

    // 카테고리 배열 추출
    const categories = store.categories.map(
      (item: { category: { name: string } }) => item.category.name
    );

    // 응답 데이터 가공
    const formattedStore: FormattedStore = {
      id: store.id,
      name: store.name,
      address: store.address,
      description: store.description,
      position: {
        lat: store.position_lat,
        lng: store.position_lng,
        x: store.position_x,
        y: store.position_y,
      },
      categories,
      rating: {
        naver: store.naver_rating || 0,
        kakao: store.kakao_rating || 0,
      },
      refillItems: store.refill_items || [],
      openHours: store.open_hours,
      price: store.price,
      imageUrls: store.image_urls || [],
      reviews: reviews.map((review: ReviewFromDb) => ({
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.created_at,
        user: {
          id: review.user_id,
          username: review.profiles.username,
        },
      })),
    };

    return NextResponse.json(formattedStore);
  } catch (error: any) {
    console.error("가게 상세 정보 조회 오류:", error);
    const errorMessage =
      error?.message || "가게 정보를 불러오는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

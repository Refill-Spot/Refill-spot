import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { categories, maxDistance, minRating, latitude, longitude } =
      await request.json();

    // 필터링 조건 구성
    const whereClause: any = {};

    // 카테고리 필터
    if (categories && categories.length > 0) {
      whereClause.categories = {
        some: {
          name: {
            in: categories,
          },
        },
      };
    }

    // 평점 필터
    if (minRating && minRating > 0) {
      whereClause.naverRating = {
        gte: minRating,
      };
    }

    // 위치 기반 필터링 (거리)
    if (latitude && longitude && maxDistance) {
      // PostGIS 쿼리로 변경 필요
      const stores = await prisma.$queryRaw`
        SELECT 
          s.*,
          ST_Distance(
            ST_MakePoint(s."positionLng", s."positionLat")::geography,
            ST_MakePoint(${Number(longitude)}, ${Number(latitude)})::geography
          ) as distance
        FROM "stores" s
        JOIN "_CategoryToStore" cts ON s.id = cts."B"
        JOIN "categories" c ON c.id = cts."A"
        WHERE ST_DWithin(
          ST_MakePoint(s."positionLng", s."positionLat")::geography,
          ST_MakePoint(${Number(longitude)}, ${Number(latitude)})::geography,
          ${Number(maxDistance) * 1000}
        )
        ${minRating ? `AND s."naverRating" >= ${minRating}` : ""}
        ${
          categories && categories.length > 0
            ? `AND c.name IN (${categories.map((c) => `'${c}'`).join(",")})`
            : ""
        }
        ORDER BY distance
      `;

      // 응답 데이터 가공
      const formattedStores = stores.map((store) => ({
        id: store.id,
        name: store.name,
        address: store.address,
        distance: Math.round(store.distance) + "",
        categories: store.categories ? store.categories.map((c) => c.name) : [],
        rating: {
          naver: store.naverRating || 0,
          kakao: store.kakaoRating || 0,
        },
        position: {
          lat: store.positionLat,
          lng: store.positionLng,
          x: store.positionX,
          y: store.positionY,
        },
        refillItems: store.refillItems || [],
        description: store.description,
        openHours: store.openHours,
        price: store.price,
      }));

      return NextResponse.json(formattedStores);
    } else {
      // 일반 필터링 (PostGIS 사용 안 함)
      const stores = await prisma.store.findMany({
        where: whereClause,
        include: {
          categories: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      // 응답 데이터 가공
      const formattedStores = stores.map((store) => ({
        id: store.id,
        name: store.name,
        address: store.address,
        distance: store.distance || undefined,
        categories: store.categories.map((c) => c.name),
        rating: {
          naver: store.naverRating || 0,
          kakao: store.kakaoRating || 0,
        },
        position: {
          lat: store.positionLat,
          lng: store.positionLng,
          x: store.positionX,
          y: store.positionY,
        },
        refillItems: store.refillItems || [],
        description: store.description,
        openHours: store.openHours,
        price: store.price,
      }));

      return NextResponse.json(formattedStores);
    }
  } catch (error) {
    console.error("가게 필터링 오류:", error);
    return NextResponse.json(
      { error: "가게 필터링 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

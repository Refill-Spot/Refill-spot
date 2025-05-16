import { Metadata, ResolvingMetadata } from "next";
import { getStoreById } from "@/lib/stores";
import StoreDetails from "@/components/store-details";

// 동적 메타데이터 생성 함수
export async function generateMetadata(
  { params }: { params: { id: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  // 가게 정보 가져오기
  const storeData = await getStoreById(parseInt(params.id));

  // 부모 메타데이터 가져오기
  const previousImages = (await parent).openGraph?.images || [];

  if (!storeData) {
    return {
      title: "가게를 찾을 수 없음 - Refill Spot",
      description: "요청하신 무한리필 가게 정보를 찾을 수 없습니다.",
    };
  }

  // 카테고리 목록 문자열
  const categoryText = storeData.categories.join(", ");

  return {
    title: `${storeData.name} - Refill Spot`,
    description: `${
      storeData.description || storeData.name
    }. ${categoryText}. ${
      storeData.address
    }에 위치한 무한리필 맛집을 확인하세요.`,
    keywords: [
      ...storeData.categories,
      "무한리필",
      "맛집",
      storeData.name,
      "리필스팟",
    ],
    openGraph: {
      title: `${storeData.name} - Refill Spot 무한리필 맛집`,
      description: `${storeData.description || storeData.name}. ${
        storeData.address
      }에 위치한 무한리필 맛집입니다.`,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(
            storeData.name
          )}&category=${encodeURIComponent(categoryText)}`,
          width: 1200,
          height: 630,
          alt: `${storeData.name} 이미지`,
        },
        ...previousImages,
      ],
      type: "website",
      locale: "ko_KR",
    },
  };
}

// 페이지 컴포넌트
export default function StorePage({ params }: { params: { id: string } }) {
  return <StoreDetails storeId={parseInt(params.id)} />;
}

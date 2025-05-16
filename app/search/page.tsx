import { Metadata } from "next";
import ClientSearchPage from "@/components/client-search-page";

export const metadata: Metadata = {
  title: "가게 검색 - Refill Spot",
  description:
    "가까운 무한리필 가게를 검색하고 필터링하여 찾아보세요. 위치 기반 검색, 카테고리별 필터링 등 다양한 기능을 제공합니다.",
  keywords: ["무한리필", "맛집", "검색", "필터", "지도", "음식점"],
  openGraph: {
    title: "무한리필 가게 검색 - Refill Spot",
    description:
      "내 주변 무한리필 맛집을 찾아보세요. 가격, 평점, 거리별 필터링이 가능합니다.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function SearchPage() {
  return <ClientSearchPage />;
}

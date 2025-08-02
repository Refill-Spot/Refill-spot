import { MetadataRoute } from "next";
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Refill-spot - 무한리필 가게 찾기",
    short_name: "Refill-spot",
    description: "주변의 무한리필 가게를 쉽게 찾아보세요",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#f97316",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    screenshots: [
      {
        src: "/placeholder.jpg",
        sizes: "390x844",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "모바일 화면 - 가게 목록 및 지도",
      },
      {
        src: "/placeholder.jpg", 
        sizes: "1280x800",
        type: "image/jpeg",
        form_factor: "wide",
        label: "데스크톱 화면 - 가게 검색 및 지도",
      },
    ],
  };
}
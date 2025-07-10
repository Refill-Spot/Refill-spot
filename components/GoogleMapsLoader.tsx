"use client";

import { useEffect } from "react";

interface GoogleMapsLoaderProps {
  children: React.ReactNode;
}

export default function GoogleMapsLoader({ children }: GoogleMapsLoaderProps) {
  useEffect(() => {
    // Google Maps API가 이미 로드되었는지 확인
    if (window.google?.maps) {
      return;
    }

    // Google Maps API 스크립트 로드
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&language=ko&region=KR`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log("Google Maps API 로드 완료");
    };

    script.onerror = () => {
      console.error("Google Maps API 로드 실패");
    };

    document.head.appendChild(script);

    return () => {
      // 컴포넌트 언마운트 시 스크립트 제거
      const existingScript = document.querySelector(
        "script[src*=\"maps.googleapis.com\"]",
      );
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  return <>{children}</>;
}

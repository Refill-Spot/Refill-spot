"use client";

// 지도 API 타입 정의
export type MapProvider = "naver" | "kakao";

// 지도 마커 옵션
export interface MarkerOptions {
  position: { lat: number; lng: number };
  icon?: string | { url: string; size: [number, number] };
  zIndex?: number;
  clickable?: boolean;
  title?: string;
  visible?: boolean;
  draggable?: boolean;
}

// 클러스터링 옵션
export interface ClusteringOptions {
  minClusterSize?: number;
  maxZoom?: number;
  gridSize?: number;
  disableClickZoom?: boolean;
  averageCenter?: boolean;
  styles?: any[]; // 클러스터 스타일
}

// 네이버 지도 클러스터링 설정
export function setupNaverClustering(
  window: any,
  map: any,
  markers: any[],
  options: ClusteringOptions = {},
) {
  if (
    !window.naver?.maps?.MarkerClustering
  ) {
    console.error("네이버 맵 클러스터링 모듈이 로드되지 않았습니다.");
    return null;
  }

  // 클러스터 스타일 정의
  const htmlMarker1 = {
    content: `
      <div style="cursor:pointer;width:40px;height:40px;line-height:42px;font-size:10px;color:white;text-align:center;
      font-weight:bold;background:rgba(255,87,34,0.9);border-radius:20px;"></div>
    `,
    size: new window.naver.maps.Size(40, 40),
    anchor: new window.naver.maps.Point(20, 20),
  };

  const htmlMarker2 = {
    content: `
      <div style="cursor:pointer;width:50px;height:50px;line-height:52px;font-size:12px;color:white;text-align:center;
      font-weight:bold;background:rgba(255,87,34,0.9);border-radius:25px;"></div>
    `,
    size: new window.naver.maps.Size(50, 50),
    anchor: new window.naver.maps.Point(25, 25),
  };

  const htmlMarker3 = {
    content: `
      <div style="cursor:pointer;width:60px;height:60px;line-height:62px;font-size:14px;color:white;text-align:center;
      font-weight:bold;background:rgba(255,87,34,0.9);border-radius:30px;"></div>
    `,
    size: new window.naver.maps.Size(60, 60),
    anchor: new window.naver.maps.Point(30, 30),
  };

  // 기본 옵션
  const defaultOptions = {
    minClusterSize: 2,
    maxZoom: 16,
    gridSize: 120,
    icons: [htmlMarker1, htmlMarker2, htmlMarker3],
    indexGenerator: [10, 30, 100],
    disableClickZoom: false,
    stylingFunction: (clusterMarker: any, count: number) => {
      clusterMarker.getElement().querySelector("div").textContent = count;
    },
  };

  // 사용자 옵션과 기본 옵션 병합
  const clusterOptions = { ...defaultOptions, ...options, map, markers };

  // 클러스터 생성
  return new window.naver.maps.MarkerClustering(clusterOptions);
}

// 카카오 지도 클러스터링 설정
export function setupKakaoClustering(
  window: any,
  map: any,
  markers: any[],
  options: ClusteringOptions = {},
) {
  if (
    !window.kakao?.maps?.MarkerClusterer
  ) {
    console.error("카카오 맵 클러스터링 모듈이 로드되지 않았습니다.");
    return null;
  }

  // 기본 옵션
  const defaultOptions = {
    averageCenter: true,
    minClusterSize: 2,
    gridSize: 120,
    disableClickZoom: false,
    styles: [
      {
        width: "40px",
        height: "40px",
        background: "rgba(255,87,34,0.9)",
        color: "#fff",
        borderRadius: "20px",
        textAlign: "center",
        lineHeight: "40px",
        fontSize: "12px",
        fontWeight: "bold",
      },
      {
        width: "50px",
        height: "50px",
        background: "rgba(255,87,34,0.9)",
        color: "#fff",
        borderRadius: "25px",
        textAlign: "center",
        lineHeight: "50px",
        fontSize: "14px",
        fontWeight: "bold",
      },
      {
        width: "60px",
        height: "60px",
        background: "rgba(255,87,34,0.9)",
        color: "#fff",
        borderRadius: "30px",
        textAlign: "center",
        lineHeight: "60px",
        fontSize: "16px",
        fontWeight: "bold",
      },
    ],
  };

  // 사용자 옵션과 기본 옵션 병합
  const clusterOptions = { ...defaultOptions, ...options };

  // 클러스터 생성
  const clusterer = new window.kakao.maps.MarkerClusterer(clusterOptions);

  // 마커 추가
  clusterer.addMarkers(markers);

  return clusterer;
}

// 지도 API에 따른 클러스터링 설정
export function setupClustering(
  provider: MapProvider,
  window: any,
  map: any,
  markers: any[],
  options?: ClusteringOptions,
) {
  if (provider === "naver") {
    return setupNaverClustering(window, map, markers, options);
  } else if (provider === "kakao") {
    return setupKakaoClustering(window, map, markers, options);
  }

  return null;
}

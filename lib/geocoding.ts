// 인기 지역 (한국 주요 지역)
export const POPULAR_LOCATIONS = [
  { name: "강남역", address: "서울특별시 강남구 강남대로 지하 396" },
  { name: "홍대입구역", address: "서울특별시 마포구 양화로 지하 188" },
  { name: "명동역", address: "서울특별시 중구 명동2가" },
  { name: "신촌역", address: "서울특별시 서대문구 신촌로" },
  { name: "이태원역", address: "서울특별시 용산구 이태원로" },
  { name: "건대입구역", address: "서울특별시 광진구 능동로" },
  { name: "잠실역", address: "서울특별시 송파구 올림픽로" },
  { name: "여의도역", address: "서울특별시 영등포구 여의공원로" },
];

export type PopularLocation = (typeof POPULAR_LOCATIONS)[number];

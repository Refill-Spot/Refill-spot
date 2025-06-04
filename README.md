# Refill Spot - 무한리필 식당 찾기

## 🎯 프로젝트 소개 (Introduction)

"무한리필" 식당은 맛있는 음식을 마음껏 즐길 수 있어 많은 사람에게 사랑받지만, 원하는 조건의 무한리필 가게를 찾거나 다양한 가게 정보를 한눈에 비교하기는 어려울 때가 많습니다. **Refill Spot**은 이러한 불편함을 해결하고자 탄생했습니다.

이 애플리케이션은 사용자가 자신의 위치 주변이나 특정 지역의 다양한 무한리필 식당 정보를 손쉽게 검색하고, 가격, 메뉴, 운영 시간, 사용자 평점 등 상세 정보를 확인하여 합리적인 선택을 할 수 있도록 돕는 것을 목표로 합니다. 더 이상 여러 웹사이트나 앱을 탐색할 필요 없이, Refill Spot 하나로 원하는 무한리필 맛집을 발견해 보세요!

## ✨ 주요 기능 (Features)

Refill Spot은 다음과 같은 편리한 기능들을 제공하여 최적의 무한리필 식당을 찾는 경험을 선사합니다.

*   **📍 주변 가게 스마트 검색:**
    *   **GPS 기반 추천:** 스마트폰의 GPS 기능을 이용하여 현재 위치에서 가장 가까운 무한리필 가게들을 즉시 찾아줍니다.
    *   **수동 위치 설정:** 원하는 지역명(예: "강남역", "홍대입구")을 입력하거나 지도에서 직접 위치를 선택하여 해당 지역의 가게들을 검색할 수 있습니다.
    *   **거리 정보 제공:** 검색된 가게까지의 대략적인 거리 정보를 제공합니다.

*   **🔎 맞춤형 가게 검색 및 필터링:**
    *   **통합 검색:** 가게 이름, 주소 또는 대표 메뉴 키워드(예: "삼겹살", "초밥")로 빠르게 검색할 수 있습니다.
    *   **(향후 추가 예정) 상세 필터:** 가격대, 음식 종류(한식, 중식, 일식 등), 특정 리필 항목(예: 음료, 사이드 메뉴) 등의 필터를 적용하여 더욱 정확하게 원하는 가게를 찾을 수 있도록 지원할 예정입니다.

*   **💾 사용자 위치 및 설정 저장:**
    *   **최근 검색 위치 기억:** 사용자가 마지막으로 검색했거나 설정한 위치를 브라우저에 안전하게 저장하여, 앱 재방문 시 동일한 지역의 정보를 바로 확인할 수 있습니다.
    *   **(향후 추가 예정) 지도 설정 저장:** 사용자가 선호하는 지도 축척 및 유형 설정을 저장하여 개인화된 사용 경험을 제공할 예정입니다.

*   **👤 사용자 인증 및 개인화:**
    *   **간편 가입/로그인:** 이메일과 비밀번호를 사용하거나, Google 또는 Kakao 소셜 계정을 통해 몇 번의 클릭만으로 간편하게 가입하고 로그인할 수 있습니다.
    *   **계정 혜택:** 로그인한 사용자는 즐겨찾기, 프로필 관리 등 개인화된 서비스를 이용할 수 있습니다.
    *   **보안:** 안전한 비밀번호 재설정 기능을 제공하여 계정 보안을 유지합니다.

*   **⭐ 즐겨찾기 기능:**
    *   **나만의 맛집 리스트:** 마음에 드는 가게를 발견하면 즐겨찾기에 추가하여 언제든지 쉽게 다시 찾아볼 수 있습니다.
    *   **간편 관리:** 프로필 페이지에서 즐겨찾기 목록을 확인하고, 필요 없는 가게는 목록에서 손쉽게 제거할 수 있습니다.

*   **📝 프로필 관리:**
    *   **정보 업데이트:** 사용자의 닉네임 등 개인 정보를 프로필 페이지에서 직접 수정하고 관리할 수 있습니다.
    *   **(향후 추가 예정) 활동 내역:** 작성한 리뷰나 평가 내역을 모아볼 수 있는 기능을 추가할 예정입니다.

*   **🗺️ 상세한 가게 정보 및 지도 연동:**
    *   **종합 정보:** 각 가게의 주소, 전화번호, 운영 시간, 평균 가격대, 제공되는 리필 항목, 사용자 평점 및 리뷰 등 상세 정보를 제공합니다.
    *   **지도 표시:** Google Maps 및 Naver Maps와 연동하여 가게 위치를 지도에서 직관적으로 확인하고, 길 찾기 기능을 바로 이용할 수 있습니다.
    *   **이미지 갤러리:** 가게의 분위기나 음식 사진을 미리 볼 수 있도록 이미지 갤러리를 제공합니다.

## 🛠️ 기술 스택 (Tech Stack)

Refill Spot은 다음과 같은 현대적이고 효율적인 기술들을 활용하여 개발되었습니다. 각 기술은 프로젝트의 특정 요구사항을 만족시키기 위해 신중하게 선택되었습니다.

*   **프레임워크/라이브러리 (Frameworks/Libraries):**
    *   **[Next.js](https://nextjs.org/) (with Turbopack):** React 기반 프레임워크로, 서버 사이드 렌더링(SSR) 및 정적 사이트 생성(SSG)을 지원하여 초기 로딩 속도 개선과 SEO 최적화에 기여합니다. Turbopack을 사용하여 개발 서버의 빌드 속도를 향상했습니다.
    *   **[React](https://reactjs.org/):** 컴포넌트 기반 아키텍처를 통해 재사용 가능하고 관리하기 쉬운 사용자 인터페이스(UI)를 구축합니다.
    *   **[Tailwind CSS](https://tailwindcss.com/):** 유틸리티 우선 CSS 프레임워크로, 빠르고 일관된 UI 디자인 시스템을 구축하며 커스터마이징이 용이합니다.
    *   **[Prisma](https://www.prisma.io/):** 타입 안전한 Node.js 및 TypeScript ORM으로, 데이터베이스 스키마 관리, 마이그레이션, 쿼리 작성을 용이하게 합니다. PostgreSQL과의 연동에 사용됩니다.
    *   **[Supabase](https://supabase.io/):** 오픈소스 Firebase 대체제로, 사용자 인증(Auth), 데이터베이스(PostgreSQL), 스토리지 등 백엔드 기능을 간편하게 구축할 수 있도록 지원합니다.
    *   **[React Hook Form](https://react-hook-form.com/):** 성능이 우수하고 사용하기 쉬운 폼 관리 라이브러리로, 사용자 입력 처리 및 유효성 검사를 효율적으로 구현합니다.
    *   **[Zod](https://zod.dev/):** TypeScript 우선 스키마 선언 및 유효성 검사 라이브러리로, 데이터의 안정성을 높이고 예상치 못한 오류를 방지합니다.
    *   **[Shadcn/ui](https://ui.shadcn.com/) & [Radix UI](https://www.radix-ui.com/):** 접근성을 고려한 고품질 UI 컴포넌트 라이브러리입니다. Shadcn/ui는 Radix UI를 기반으로 하며, Tailwind CSS와 완벽하게 통합되어 스타일링이 용이합니다.
    *   **[Lucide React](https://lucide.dev/):** 가볍고 일관된 디자인의 SVG 아이콘 라이브러리로, 애플리케이션의 시각적 완성도를 높입니다.
    *   **[Axios](https://axios-http.com/):** Promise 기반 HTTP 클라이언트로, 외부 API와의 통신에 사용될 수 있습니다. (현재 프로젝트에서는 `fetch` API와 함께 사용될 가능성이 있습니다.)
    *   **[Zustand](https://zustand-demo.pmnd.rs/):** 가볍고 간편한 React 상태 관리 라이브러리로, 복잡한 상태 로직을 효과적으로 관리합니다.

*   **언어 (Language):**
    *   **[TypeScript](https://www.typescriptlang.org/):** JavaScript에 정적 타입을 추가한 언어로, 코드의 안정성과 가독성을 높이며 대규모 애플리케이션 개발에 적합합니다.

*   **지도 (Maps):**
    *   **Google Maps API:** `@react-google-places-autocomplete` (장소 자동 완성) 및 `GoogleMapsLoader.tsx` (지도 로딩)를 통해 Google 지도를 통합하고, 사용자에게 익숙한 지도 인터페이스와 장소 검색 기능을 제공합니다.
    *   **Naver Maps API:** 국내 사용자에게 친숙한 네이버 지도를 통해 위치 기반 서비스 및 가게 정보 시각화를 제공합니다. 마커 클러스터링 등 고급 기능을 활용합니다.

*   **개발 도구 (Dev Tools):**
    *   **PNPM:** 빠르고 효율적인 디스크 공간 사용을 특징으로 하는 패키지 매니저입니다.
    *   **ESLint:** 코드 스타일을 일관되게 유지하고 잠재적인 오류를 사전에 발견하여 코드 품질을 향상합니다.

*   **데이터베이스 (Database):**
    *   **PostgreSQL:** 강력하고 안정적인 오픈소스 관계형 데이터베이스입니다. Supabase를 통해 관리되거나 Vercel Postgres와 같은 호스팅 서비스를 통해 운영될 수 있으며, Prisma ORM과 함께 사용됩니다.

## 🚀 시작하기 (Getting Started)

이 프로젝트를 로컬 환경에서 실행하려면 다음 단계를 따르세요.

**1. 레포지토리 클론 (Clone Repository):**

```bash
git clone https://your-repository-url.git # 실제 레포지토리 URL로 변경해주세요.
cd project-directory-name # 실제 프로젝트 디렉토리 이름으로 변경해주세요.
```

**2. 패키지 설치 (Install Packages):**

[PNPM](https://pnpm.io/)을 사용하여 의존성을 설치합니다. PNPM이 설치되어 있지 않다면, [공식 문서](https://pnpm.io/installation)를 참고하여 먼저 설치해주세요.

```bash
pnpm install
```

**3. 환경 변수 설정 (Setup Environment Variables):**

프로젝트 루트에 `.env.local` 파일을 생성하고, 제공된 `.env.sample` 파일을 참고하여 다음 환경 변수들을 설정합니다.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_project_anon_key
# SUPABASE_SERVICE_ROLE_KEY=your_supabase_project_service_role_key (서버 측 로직에 필요한 경우)

# Naver Maps API
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=your_naver_maps_api_client_id
# NAVER_CLIENT_SECRET=your_naver_maps_api_client_secret (서버 사이드에서 네이버 API를 직접 호출하는 경우)

# Google Maps API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Kakao Login API
NEXT_PUBLIC_KAKAO_CLIENT_ID=your_kakao_login_client_id
# 또는 KAKAO_REST_API_KEY, KAKAO_JAVASCRIPT_KEY 등 카카오 설정에 따라 필요한 키
```

*   **Supabase URL 및 Anon Key:** Supabase 프로젝트 대시보드의 "Project Settings" > "API" 섹션에서 확인할 수 있습니다.
*   **Naver Maps Client ID:** [네이버 클라우드 플랫폼](https://www.ncloud.com/)에서 애플리케이션 등록 후 발급받을 수 있습니다.
*   **Google Maps API Key:** [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성 및 Maps JavaScript API 사용 설정을 통해 발급받아야 합니다.
*   **Kakao Client ID:** [카카오 개발자 센터](https://developers.kakao.com/)에서 애플리케이션 등록 후 발급받을 수 있습니다.

**4. 데이터베이스 마이그레이션 (Database Migration):**

Prisma를 사용하여 데이터베이스 스키마를 마이그레이션합니다. 이 명령어는 `prisma/schema.prisma` 파일의 내용을 바탕으로 데이터베이스를 설정합니다.

```bash
pnpm prisma migrate dev
```

(만약 초기 데이터(seed)가 필요하다면, `prisma/seed.ts` (또는 `.js`) 파일을 작성 또는 확인하고 다음 명령어를 실행하세요: `pnpm prisma db seed`)

**5. 개발 서버 실행 (Run Development Server):**

```bash
pnpm dev
```

애플리케이션은 기본적으로 `http://localhost:3000` 에서 실행됩니다.

**6. 빌드 및 프로덕션 실행 (Build and Run for Production):**

```bash
pnpm build   # 프로덕션용으로 애플리케이션 빌드
pnpm start   # 빌드된 애플리케이션 실행
```

## 📂 프로젝트 구조 (Project Structure)

프로젝트의 주요 디렉토리 및 파일은 다음과 같은 역할을 수행합니다. 체계적인 구조를 통해 코드의 유지보수성과 확장성을 높이고자 했습니다.

```
.
├── app/                      # Next.js App Router: 애플리케이션의 라우팅, UI 렌더링 및 API 로직 담당
│   ├── (main)/               # 공통 레이아웃을 사용하는 페이지 그룹 (예시)
│   │   ├── page.tsx          # 웹사이트의 메인 랜딩 페이지 (가게 목록 및 지도 표시)
│   │   └── layout.tsx        # (main) 그룹 내 페이지들의 공통 UI 셸 (예: 헤더, 푸터)
│   ├── api/                  # 백엔드 API 엔드포인트 정의
│   │   └── stores/           # 가게 정보 관련 API (목록 조회, 상세 정보 등)
│   │       └── route.ts      # /api/stores 엔드포인트의 GET 요청 처리 로직
│   ├── auth/                 # 사용자 인증 관련 페이지 및 로직
│   │   ├── callback/         # OAuth 인증 후 리디렉션되는 콜백 처리 라우트
│   │   └── login/page.tsx    # 로그인 및 회원가입 UI 페이지
│   ├── store/                # 특정 가게의 상세 정보를 보여주는 페이지
│   │   └── [id]/page.tsx     # 동적 라우트: /store/가게ID 형태의 URL 처리
│   ├── profile/page.tsx      # 사용자 프로필 정보 확인 및 수정 페이지
│   ├── favorites/page.tsx    # 사용자가 즐겨찾기한 가게 목록 페이지
│   ├── layout.tsx            # 모든 페이지에 적용되는 최상위 루트 레이아웃 (폰트, 테마 프로바이더 등 설정)
│   └── globals.css           # 전역적으로 적용되는 기본 CSS 스타일
├── components/               # 애플리케이션 전반에서 사용되는 재사용 가능한 UI 컴포넌트
│   ├── ui/                   # Shadcn/ui를 통해 생성된 기본 UI 요소 (버튼, 카드, 입력 필드 등)
│   ├── header.tsx            # 페이지 상단에 위치하는 헤더 (로고, 검색창, 사용자 메뉴 등)
│   ├── sidebar.tsx           # 검색 필터 또는 추가 메뉴를 위한 사이드바 (필요시 사용)
│   ├── store-list.tsx        # 가게 목록을 아이템 형태로 표시하는 컴포넌트
│   ├── store-item.tsx        # 가게 목록 내 개별 가게 아이템 컴포넌트
│   ├── store-details.tsx     # 가게의 상세 정보를 표시하는 컴포넌트
│   ├── naver-map.tsx         # Naver 지도를 렌더링하고 상호작용하는 핵심 컴포넌트
│   ├── google-map.tsx        # Google 지도를 렌더링하고 상호작용하는 컴포넌트 (또는 GoogleMapsLoader)
│   └── skeleton-loader.tsx   # 데이터 로딩 중 표시되는 스켈레톤 UI 컴포넌트
├── contexts/                 # React Context API를 사용한 전역 상태 관리
│   └── AuthContext.tsx       # 사용자 인증 상태(로그인 여부, 사용자 정보)를 관리하는 컨텍스트
├── hooks/                    # 재사용 가능한 커스텀 React Hooks
│   ├── use-stores.ts         # 가게 데이터 fetching 및 상태 관리 관련 훅
│   ├── use-map-view.ts       # 지도 화면 제어 관련 로직을 담은 훅
│   └── use-toast.ts          # 사용자 알림(토스트 메시지)을 쉽게 사용할 수 있도록 하는 훅
├── lib/                      # 애플리케이션 전반에서 사용되는 유틸리티 함수, API 클라이언트, 공통 로직
│   ├── supabase/             # Supabase 클라이언트 초기화 및 관련 헬퍼 함수 (client.ts, server.ts 등)
│   ├── api-response.ts       # API 응답 포맷을 일관되게 관리하기 위한 유틸리티
│   ├── stores.ts             # 가게 데이터 가공 및 필터링 등 관련 유틸리티 함수
│   ├── location-storage.ts   # 사용자의 위치 정보를 브라우저 저장소에 저장하고 불러오는 로직
│   └── utils.ts              # 기타 범용 유틸리티 함수 (날짜 포맷팅, 문자열 처리 등)
├── prisma/                   # Prisma ORM 관련 파일
│   ├── schema.prisma         # 데이터베이스 테이블 구조, 관계, 필드 타입을 정의하는 스키마 파일
│   └── migrations/           # 데이터베이스 스키마 변경 이력을 관리하는 마이그레이션 파일들
├── public/                   # 정적 파일 (이미지, 아이콘, 폰트 등)이 위치하는 디렉토리
├── styles/                   # 전역 스타일 및 Tailwind CSS 관련 설정 (분리된 경우)
├── types/                    # 애플리케이션에서 사용되는 TypeScript 타입 정의
│   ├── index.d.ts            # 전역적 또는 모듈 없는 라이브러리 타입 선언
│   ├── store.ts              # 가게 데이터 관련 타입 (Store, Review 등)
│   └── supabase.ts           # Supabase 데이터베이스 자동 생성 타입을 확장하거나 커스텀한 타입
├── .env.sample               # 필요한 환경 변수 목록을 보여주는 샘플 파일. 실제 운영에는 .env.local 사용
├── next.config.mjs           # Next.js 프로젝트의 빌드, 개발 서버, 라우팅 등 고급 설정
├── package.json              # 프로젝트의 이름, 버전, 의존성 패키지 목록 및 실행 스크립트 정의
├── tsconfig.json             # TypeScript 컴파일러 설정 (타입 검사 규칙, 경로 별칭 등)
└── tailwind.config.ts        # Tailwind CSS 설정 (테마, 플러그인, 커스텀 스타일 등)
```

## 📊 데이터 흐름 및 사용자 인터랙션 (Data Flow & User Interaction)

이 섹션에서는 Refill Spot 사용자가 식당을 검색하고 정보를 확인하는 주요 과정을 시각화하여 보여줍니다. 핵심적인 사용자 행동과 시스템 내부의 데이터 처리를 단계별로 나누어 이해를 돕고자 합니다.

### 1. 초기 접속 및 위치 기반 가게 검색 흐름

사용자가 처음 서비스에 접속하거나 위치를 기준으로 가게를 검색할 때의 흐름입니다.

```mermaid
graph TD
    subgraph "사용자 시작"
        A[📱 사용자: Refill Spot 접속]
    end

    subgraph "📍 1단계: 위치 정보 확보"
        A --> B{사용자 위치 확인 방법 결정};
        B -- GPS 우선 --> C[자동: GPS 현재 위치 파악];
        B -- 저장된 위치 --> D[자동: 이전 사용 위치 불러오기];
        B -- 수동 설정/기본값 --> E[수동: 주소 검색 또는 기본 위치 사용];
    end

    subgraph "📡 2단계: 주변 가게 정보 요청 및 응답"
        F[프론트엔드: 위치 좌표 준비]
        C --> F;
        D --> F;
        E --> F;
        F --> G{API 서버에 주변 가게 요청<br>(/api/stores?lat=...&lng=...)};
        G --> H[(Supabase DB)];
        H -- 가게 데이터 목록 --> G;
        G -- JSON 응답 --> I[프론트엔드: 가게 목록 수신];
    end

    subgraph "🖥️ 3단계: 가게 정보 표시"
        I --> J[화면: 가게 목록 및 지도에 마커 표시];
        J -- 사용자가 특정 가게 선택 --> K[화면: 가게 상세 정보 페이지로 이동<br>(/store/:id)];
    end

    style A fill:#FFDEAD,stroke:#333,stroke-width:2px
    style B fill:#E6E6FA,stroke:#333,stroke-width:2px
    style F fill:#ADD8E6,stroke:#333,stroke-width:2px
    style G fill:#ADD8E6,stroke:#333,stroke-width:2px
    style H fill:#FFFACD,stroke:#333,stroke-width:2px
    style I fill:#ADD8E6,stroke:#333,stroke-width:2px
    style J fill:#90EE90,stroke:#333,stroke-width:2px
    style K fill:#90EE90,stroke:#333,stroke-width:2px
```

**흐름 설명:**

1.  **사용자 접속 (`📱`):** 사용자가 Refill Spot 웹사이트에 처음 방문합니다.
2.  **위치 정보 확보 (`📍`):**
    *   애플리케이션은 사용자의 위치를 파악하려 시도합니다.
    *   **우선순위:** GPS > 이전에 저장된 위치 > 사용자의 수동 입력 또는 시스템 기본 위치(예: 강남역).
3.  **주변 가게 정보 요청 (`📡`):**
    *   확보된 위치 좌표를 사용하여, 프론트엔드는 백엔드 API (`/api/stores`)로 주변 가게 목록을 요청합니다.
    *   API 서버는 이 요청을 받아 Supabase 데이터베이스에서 조건에 맞는 가게 정보를 조회합니다.
    *   조회된 가게 목록은 JSON 형태로 프론트엔드에 응답으로 전달됩니다.
4.  **가게 정보 표시 (`🖥️`):**
    *   프론트엔드는 수신된 가게 데이터를 사용자 화면에 목록 형태로 보여주고, 지도(Naver/Google) 위에도 마커로 위치를 표시합니다.
    *   사용자가 목록이나 지도에서 특정 가게를 선택하면, 해당 가게의 상세 정보를 볼 수 있는 페이지로 이동합니다.

### 2. 키워드 검색 흐름

사용자가 검색창에 키워드(가게 이름, 주소 등)를 입력하여 가게를 검색하는 경우의 흐름입니다.

```mermaid
graph TD
    subgraph "사용자 시작"
        L[⌨️ 사용자: 헤더 검색창에 키워드 입력 및 검색 실행]
    end

    subgraph "🔍 1단계: 검색 요청 처리"
        L --> M{검색 요청 API 전달<br>(/api/stores/search?query=...)};
        M --> N[(Supabase DB)];
        N -- 검색 조건에 맞는 가게 데이터 --> M;
        M -- JSON 응답 --> O[프론트엔드: 검색 결과 수신];
    end

    subgraph "🖥️ 2단계: 검색 결과 표시"
        O --> P[화면: 검색된 가게 목록 및 지도에 마커 표시];
        P -- 사용자가 특정 가게 선택 --> Q[화면: 가게 상세 정보 페이지로 이동<br>(/store/:id)];
    end

    style L fill:#FFDEAD,stroke:#333,stroke-width:2px
    style M fill:#ADD8E6,stroke:#333,stroke-width:2px
    style N fill:#FFFACD,stroke:#333,stroke-width:2px
    style O fill:#ADD8E6,stroke:#333,stroke-width:2px
    style P fill:#90EE90,stroke:#333,stroke-width:2px
    style Q fill:#90EE90,stroke:#333,stroke-width:2px
```

**흐름 설명:**

1.  **키워드 입력 (`⌨️`):** 사용자가 헤더의 검색창에 원하는 가게 이름, 주소, 또는 관련 키워드를 입력하고 검색을 실행합니다.
2.  **검색 요청 처리 (`🔍`):**
    *   프론트엔드는 입력된 키워드를 포함하여 백엔드 검색 API (`/api/stores/search` - *API 경로는 예시이며, 실제 구현에 따라 `/api/stores`에 query 파라미터를 사용할 수도 있음*)로 요청을 보냅니다.
    *   API 서버는 데이터베이스에서 해당 키워드와 관련성이 높은 가게 정보를 검색합니다.
    *   검색 결과를 JSON 형태로 프론트엔드에 응답합니다.
3.  **검색 결과 표시 (`🖥️`):**
    *   프론트엔드는 받은 데이터를 화면에 목록 및 지도 마커로 표시합니다.
    *   사용자는 결과 중 하나를 선택하여 상세 페이지로 이동할 수 있습니다.

### 3. 사용자 인증 흐름 (로그인/회원가입)

사용자가 로그인 또는 회원가입을 시도할 때의 상호작용입니다.

```mermaid
graph TD
    subgraph "사용자 시작"
        R[👤 사용자: 로그인 또는 회원가입 시도]
    end

    subgraph "🔐 1단계: 인증 정보 제출"
        R -- 이메일/비밀번호 또는 소셜 로그인 정보 --> S{Supabase Auth API 호출};
    end

    subgraph "🛡️ 2단계: 인증 처리 및 결과 반환"
        S <--> T((Supabase Auth 서비스));
        T -- 인증 성공/실패 결과 --> S;
        S -- 인증 결과 --> U[프론트엔드: 인증 상태 업데이트];
    end

    subgraph "🎉 3단계: 후속 조치"
        U -- 인증 성공 시 --> V[화면: 로그인 상태로 변경, 개인화 기능 활성화 (예: 즐겨찾기)];
        U -- 인증 실패 시 --> W[화면: 오류 메시지 표시];
    end

    style R fill:#FFDEAD,stroke:#333,stroke-width:2px
    style S fill:#ADD8E6,stroke:#333,stroke-width:2px
    style T fill:#FFFACD,stroke:#333,stroke-width:2px
    style U fill:#ADD8E6,stroke:#333,stroke-width:2px
    style V fill:#90EE90,stroke:#333,stroke-width:2px
    style W fill:#FFB6C1,stroke:#333,stroke-width:2px
```

**흐름 설명:**

1.  **인증 시도 (`👤`):** 사용자가 로그인 또는 회원가입 버튼을 클릭하고 필요한 정보를 입력합니다.
2.  **인증 정보 제출 (`🔐`):** 프론트엔드는 사용자가 입력한 정보(이메일/비밀번호) 또는 소셜 로그인 요청을 Supabase Auth API로 전달합니다.
3.  **인증 처리 (`🛡️`):** Supabase Auth 서비스가 제출된 정보를 검증하여 인증을 처리하고, 그 결과를 프론트엔드에 반환합니다.
4.  **후속 조치 (`🎉`):**
    *   **인증 성공 시:** 프론트엔드는 사용자 인증 상태를 업데이트하고, 화면을 로그인된 상태로 변경합니다. 즐겨찾기 같은 개인화된 기능이 활성화될 수 있습니다.
    *   **인증 실패 시:** 사용자에게 적절한 오류 메시지를 표시합니다.

이러한 흐름들은 Refill Spot의 핵심적인 사용자 경험을 구성하며, 각 단계는 사용자가 원하는 정보를 쉽고 빠르게 찾을 수 있도록 설계되었습니다.

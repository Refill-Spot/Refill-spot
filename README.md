# Refill Spot - 무한리필 식당 찾기

주변의 무한리필 식당을 쉽게 찾아보세요! 이 애플리케이션은 사용자가 주변에 있는 무한리필 식당을 검색하고, 정보를 확인할 수 있도록 돕습니다.

## ✨ 주요 기능 (Features)

*   **📍 주변 가게 검색:** 사용자의 현재 위치(GPS) 또는 수동으로 설정한 위치를 기반으로 주변의 무한리필 가게를 찾아줍니다.
*   **🔎 가게 검색:** 가게 이름 또는 주소로 원하는 가게를 검색할 수 있습니다.
*   **💾 사용자 위치 저장:** 마지막으로 사용한 위치를 저장하여 다음 방문 시 빠르게 주변 가게를 탐색할 수 있습니다.
*   **👤 사용자 인증:**
    *   이메일/비밀번호를 이용한 회원가입 및 로그인 기능을 제공합니다.
    *   Google, Kakao 계정을 이용한 소셜 로그인을 지원합니다.
    *   비밀번호 재설정 기능을 제공합니다.
*   **⭐ 즐겨찾기:** 마음에 드는 가게를 즐겨찾기에 추가하고 관리할 수 있습니다. (프로필 페이지에서 접근)
*   **📝 프로필 관리:** 사용자 이름 등 개인 정보를 수정할 수 있습니다.

## 🛠️ 기술 스택 (Tech Stack)

*   **프레임워크/라이브러리 (Frameworks/Libraries):**
    *   [Next.js](https://nextjs.org/) (with Turbopack) - React 프레임워크
    *   [React](https://reactjs.org/) - 사용자 인터페이스 라이브러리
    *   [Tailwind CSS](https://tailwindcss.com/) - CSS 프레임워크
    *   [Prisma](https://www.prisma.io/) - ORM (Database toolkit)
    *   [Supabase](https://supabase.io/) - BaaS (Authentication, Database)
    *   [React Hook Form](https://react-hook-form.com/) - 폼 관리
    *   [Zod](https://zod.dev/) - 데이터 유효성 검사
    *   [Shadcn/ui](https://ui.shadcn.com/) & [Radix UI](https://www.radix-ui.com/) - UI 컴포넌트
    *   [Lucide React](https://lucide.dev/) - 아이콘 라이브러리
    *   [Axios](https://axios-http.com/) - HTTP 클라이언트 (사용 가능성 있음)
    *   [Zustand](https://zustand-demo.pmnd.rs/) - 상태 관리
*   **언어 (Language):**
    *   [TypeScript](https://www.typescriptlang.org/)
*   **지도 (Maps):**
    *   Google Maps API (via `@react-google-places-autocomplete` and `GoogleMapsLoader.tsx`)
    *   Naver Maps API
*   **개발 도구 (Dev Tools):**
    *   PNPM - 패키지 매니저
    *   ESLint - 코드 린터
*   **데이터베이스 (Database):**
    *   PostgreSQL (Supabase 연동 또는 Vercel Postgres)

## 🚀 시작하기 (Getting Started)

이 프로젝트를 로컬 환경에서 실행하려면 다음 단계를 따르세요.

**1. 레포지토리 클론 (Clone Repository):**

```bash
git clone https://your-repository-url.git
cd project-directory-name
```

**2. 패키지 설치 (Install Packages):**

[PNPM](https://pnpm.io/)을 사용하여 의존성을 설치합니다. PNPM이 설치되어 있지 않다면 먼저 설치해주세요.

```bash
pnpm install
```

**3. 환경 변수 설정 (Setup Environment Variables):**

프로젝트 루트에 `.env.local` 파일을 생성하고, `.env.sample` 파일을 참고하여 다음 환경 변수들을 설정합니다.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key (필요한 경우)

# Naver Maps API
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=your_naver_maps_client_id
# NAVER_CLIENT_SECRET=your_naver_client_secret (서버사이드에서 네이버 API를 직접 호출하는 경우)

# Google Maps API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Kakao Login API
NEXT_PUBLIC_KAKAO_CLIENT_ID=your_kakao_client_id
# 또는 KAKAO_REST_API_KEY, KAKAO_JAVASCRIPT_KEY 등 카카오 설정에 따라 필요
```

*   Supabase URL 및 Anon Key는 Supabase 프로젝트 대시보드에서 얻을 수 있습니다.
*   Naver Maps Client ID는 네이버 클라우드 플랫폼에서 발급받을 수 있습니다.
*   Google Maps API Key는 Google Cloud Console에서 발급받아야 합니다.
*   Kakao Client ID (또는 다른 필요한 키)는 카카오 개발자 센터에서 애플리케이션 등록 후 얻을 수 있습니다.

**4. 데이터베이스 마이그레이션 (Database Migration):**

Prisma를 사용하여 데이터베이스 스키마를 마이그레이션합니다.

```bash
pnpm prisma migrate dev
```

(만약 초기 데이터(seed)가 필요하다면, `prisma/seed.ts` (또는 .js) 파일을 확인하고 다음 명령어를 실행하세요: `pnpm prisma db seed`)

**5. 개발 서버 실행 (Run Development Server):**

```bash
pnpm dev
```

애플리케이션은 `http://localhost:3000` 에서 실행됩니다.

**6. 빌드 및 프로덕션 실행 (Build and Run for Production):**

```bash
pnpm build
pnpm start
```

## 📂 프로젝트 구조 (Project Structure)

주요 디렉토리 및 파일 구조는 다음과 같습니다:

```
.
├── app/                      # Next.js App Router: 페이지, 레이아웃, API 라우트
│   ├── (main)/               # 메인 레이아웃 그룹 (예시)
│   │   ├── page.tsx          # 메인 페이지
│   │   └── layout.tsx        # 메인 레이아웃
│   ├── api/                  # API 라우트 핸들러
│   │   └── stores/           # 가게 관련 API
│   ├── auth/                 # 인증 관련 페이지 (로그인, 콜백 등)
│   ├── store/                # 가게 상세 페이지
│   └── ...                   # 기타 페이지 (프로필, 즐겨찾기 등)
├── components/               # 재사용 가능한 UI 컴포넌트
│   ├── ui/                   # Shadcn/ui 기본 컴포넌트
│   ├── header.tsx            # 헤더 컴포넌트
│   ├── sidebar.tsx           # 사이드바 컴포넌트
│   ├── store-list.tsx        # 가게 목록 컴포넌트
│   ├── naver-map.tsx         # 네이버 지도 컴포넌트
│   └── ...
├── contexts/                 # React Context API (예: AuthContext.tsx)
├── hooks/                    # 커스텀 React Hooks
├── lib/                      # 라이브러리, 유틸리티 함수, API 클라이언트
│   ├── supabase/             # Supabase 클라이언트 설정
│   ├── api-utils.ts          # API 관련 유틸리티
│   ├── stores.ts             # 가게 데이터 관련 로직
│   └── ...
├── prisma/                   # Prisma 스키마 및 마이그레이션
│   └── schema.prisma         # 데이터베이스 스키마 정의
├── public/                   # 정적 에셋 (이미지, 폰트 등)
├── styles/                   # 전역 스타일 (예: globals.css)
├── types/                    # TypeScript 타입 정의
├── .env.sample               # 환경 변수 샘플 파일
├── next.config.mjs           # Next.js 설정 파일
├── package.json              # 프로젝트 의존성 및 스크립트
└── tsconfig.json             # TypeScript 설정 파일
```

## 🌐 API 엔드포인트 (API Endpoints)

주요 백엔드 API 엔드포인트는 다음과 같습니다. 모든 API는 `app/api/` 디렉토리 내에 정의되어 있습니다.

*   **`GET /api/stores`**
    *   **설명:** 가게 목록을 조회합니다.
    *   **쿼리 파라미터:**
        *   `lat` (number, 선택): 사용자 위도
        *   `lng` (number, 선택): 사용자 경도
        *   `radius` (number, 선택, 기본값 5km): 검색 반경 (km)
    *   **동작:**
        *   `lat`, `lng` 파라미터가 제공되면, 해당 위치를 기준으로 `radius` 내의 가게들을 검색하여 거리순으로 정렬 후 최대 20개를 반환합니다.
        *   위치 파라미터가 없으면, 전체 가게 목록 중 최대 30개를 ID 순으로 반환합니다.
    *   **응답:** 가게 정보 배열 (ID, 이름, 주소, 좌표, 평점, 카테고리 등 포함)

*   **인증 관련 엔드포인트:**
    *   Supabase Auth Helpers (`@supabase/auth-helpers-nextjs`)를 통해 자동으로 처리되는 인증 관련 라우트들이 있습니다. (예: `/api/auth/callback`, `/api/auth/user` 등) - 이들은 직접적으로 `app/api`에 명시적으로 코드가 없을 수 있습니다.

*(다른 API 엔드포인트는 `app/api/` 디렉토리를 참고하세요.)*

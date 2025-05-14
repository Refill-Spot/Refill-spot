-- 1. PostGIS 확장 활성화
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. 기본 테이블 생성
-- 프로필 테이블 (Supabase Auth와 연동)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 카테고리 테이블
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- 가게 테이블
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  description TEXT,
  position_lat FLOAT NOT NULL,
  position_lng FLOAT NOT NULL,
  position_x FLOAT NOT NULL,
  position_y FLOAT NOT NULL,
  naver_rating FLOAT,
  kakao_rating FLOAT,
  open_hours TEXT,
  price TEXT,
  refill_items TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PostGIS 공간 인덱싱을 위한 geom 컬럼 추가
ALTER TABLE stores ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326);

-- 자동으로 geom 컬럼을 채우는 트리거 함수
CREATE OR REPLACE FUNCTION update_store_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.position_lng, NEW.position_lat), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS update_store_geom_trigger ON stores;
CREATE TRIGGER update_store_geom_trigger
BEFORE INSERT OR UPDATE ON stores
FOR EACH ROW EXECUTE FUNCTION update_store_geom();

-- 기존 데이터에 대해 geom 컬럼 업데이트
UPDATE stores SET geom = ST_SetSRID(ST_MakePoint(position_lng, position_lat), 4326);

-- 공간 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_stores_geom ON stores USING GIST(geom);

-- 가게-카테고리 연결 테이블
CREATE TABLE IF NOT EXISTS store_categories (
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (store_id, category_id)
);

-- 리뷰 테이블
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  rating FLOAT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 즐겨찾기 테이블
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);

-- 3. RPC 함수 생성
-- 반경 내 가게 검색 함수
CREATE OR REPLACE FUNCTION stores_within_radius(lat float, lng float, radius_meters float)
RETURNS TABLE (
  id integer,
  name text,
  address text,
  description text,
  position_lat float,
  position_lng float,
  position_x float,
  position_y float,
  naver_rating float,
  kakao_rating float,
  open_hours text,
  price text,
  refill_items text[],
  created_at timestamptz,
  updated_at timestamptz,
  distance float
) AS $$
  SELECT 
    s.*,
    ST_Distance(
      s.geom::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) as distance
  FROM 
    stores s
  WHERE 
    ST_DWithin(
      s.geom::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_meters
    )
  ORDER BY 
    distance;
$$ LANGUAGE sql STABLE;

-- 필터링 함수 (거리 + 카테고리 + 평점)
CREATE OR REPLACE FUNCTION stores_filter(
  lat float, 
  lng float, 
  max_distance float,
  min_rating float,
  categories_filter text[] DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  name text,
  address text,
  description text,
  position_lat float,
  position_lng float,
  position_x float,
  position_y float,
  naver_rating float,
  kakao_rating float,
  open_hours text,
  price text,
  refill_items text[],
  created_at timestamptz,
  updated_at timestamptz,
  distance float
) AS $$
  SELECT 
    s.*,
    ST_Distance(
      s.geom::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) as distance
  FROM 
    stores s
  WHERE 
    ST_DWithin(
      s.geom::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      max_distance
    )
    AND (min_rating IS NULL OR s.naver_rating >= min_rating)
    AND (
      categories_filter IS NULL 
      OR EXISTS (
        SELECT 1
        FROM store_categories sc
        JOIN categories c ON sc.category_id = c.id
        WHERE sc.store_id = s.id
        AND c.name = ANY(categories_filter)
      )
    )
  ORDER BY 
    distance;
$$ LANGUAGE sql STABLE;

-- 카테고리로 가게 검색
CREATE OR REPLACE FUNCTION stores_by_categories(category_names text[])
RETURNS SETOF stores AS $$
  SELECT DISTINCT s.*
  FROM stores s
  JOIN store_categories sc ON s.id = sc.store_id
  JOIN categories c ON sc.category_id = c.id
  WHERE c.name = ANY(category_names);
$$ LANGUAGE sql STABLE;

-- 4. 기본 카테고리 데이터 삽입
INSERT INTO categories (name) VALUES 
('고기'),
('해산물'),
('양식'),
('한식'),
('중식'),
('일식'),
('디저트'),
('브런치'),
('샐러드'),
('피자'),
('치킨'),
('족발'),
('곱창'),
('스테이크')
ON CONFLICT (name) DO NOTHING;

-- 5. 기본 권한 설정
-- 익명 유저가 사용할 수 있는 RPC 함수 접근 권한 설정
GRANT EXECUTE ON FUNCTION stores_within_radius TO anon, authenticated;
GRANT EXECUTE ON FUNCTION stores_filter TO anon, authenticated;
GRANT EXECUTE ON FUNCTION stores_by_categories TO anon, authenticated;

-- 6. 인증 후 프로필 생성 트리거 설정
-- 사용자가 회원가입하면 자동으로 profiles 테이블에 레코드 생성
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거가 이미 존재하면 삭제 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
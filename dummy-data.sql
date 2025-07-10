-- 더미 데이터 삽입 SQL (init-postgis.sql 스키마 기준)
-- 실행 전에 기존 데이터 삭제 (선택사항)
-- DELETE FROM store_categories;
-- DELETE FROM stores;
-- DELETE FROM categories;

-- 1. 카테고리 데이터 삽입 (init-postgis.sql과 동일한 카테고리 + 추가 카테고리)
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
('스테이크'),
('뷔페'),
('카페'),
('분식'),
('찜닭'),
('파스타'),
('버거')
ON CONFLICT (name) DO NOTHING;

-- 2. 가게 더미 데이터 삽입 (init-postgis.sql 스키마에 맞춤)
INSERT INTO stores (
  name, 
  address, 
  description, 
  position_lat, 
  position_lng, 
  position_x, 
  position_y, 
  naver_rating, 
  kakao_rating, 
  open_hours, 
  price, 
  refill_items,
  image_urls
) VALUES 
-- 강남역 주변 가게들
(
  '무한리필 삼겹살집 강남점',
  '서울시 강남구 테헤란로 123',
  '신선한 삼겹살과 목살을 무한리필로 즐길 수 있는 곳입니다. 밑반찬도 다양하게 제공됩니다.',
  37.498095,
  127.02761,
  127.02761,
  37.498095,
  4.2,
  4.0,
  '11:00 - 22:00 (라스트오더 21:30)',
  '성인 19,900원, 청소년 16,900원, 어린이 12,900원',
  ARRAY['삼겹살', '목살', '밑반찬', '쌈채소', '된장찌개'],
  ARRAY['https://example.com/images/samgyeopsal1.jpg', 'https://example.com/images/samgyeopsal2.jpg']
),
(
  '피자 무한리필 카페 강남',
  '서울시 강남구 강남대로 456',
  '다양한 피자를 무한리필로 즐길 수 있는 카페입니다. 음료와 샐러드도 함께 제공됩니다.',
  37.497095,
  127.02861,
  127.02861,
  37.497095,
  4.5,
  4.3,
  '10:00 - 23:00',
  '성인 16,900원, 청소년 14,900원, 어린이 11,900원',
  ARRAY['피자', '음료', '샐러드', '스프'],
  ARRAY['https://example.com/images/pizza1.jpg', 'https://example.com/images/pizza2.jpg']
),
(
  '해물뷔페 바다향',
  '서울시 강남구 역삼동 789',
  '신선한 해산물을 무한리필로 즐길 수 있는 해물뷔페입니다.',
  37.499095,
  127.03261,
  127.03261,
  37.499095,
  4.1,
  3.9,
  '12:00 - 21:30',
  '성인 29,900원, 청소년 24,900원, 어린이 19,900원',
  ARRAY['새우', '게', '조개', '생선회', '초밥', '튀김'],
  ARRAY['https://example.com/images/seafood1.jpg', 'https://example.com/images/seafood2.jpg']
),
(
  '치킨 무한리필 닭다리집',
  '서울시 강남구 논현동 321',
  '바삭한 치킨을 무한리필로 즐길 수 있습니다. 다양한 소스와 함께 제공됩니다.',
  37.496095,
  127.02461,
  127.02461,
  37.496095,
  4.3,
  4.1,
  '17:00 - 24:00',
  '성인 18,900원, 청소년 15,900원',
  ARRAY['후라이드치킨', '양념치킨', '간장치킨', '치킨무', '피클'],
  ARRAY['https://example.com/images/chicken1.jpg', 'https://example.com/images/chicken2.jpg']
),
(
  '스테이크 하우스 무한',
  '서울시 강남구 삼성동 654',
  '프리미엄 스테이크를 무한리필로 즐길 수 있는 고급 레스토랑입니다.',
  37.500095,
  127.03561,
  127.03561,
  37.500095,
  4.6,
  4.4,
  '11:30 - 22:00',
  '성인 39,900원, 청소년 34,900원',
  ARRAY['안심스테이크', '등심스테이크', '샐러드', '스프', '빵'],
  ARRAY['https://example.com/images/steak1.jpg', 'https://example.com/images/steak2.jpg']
),

-- 홍대 주변 가게들
(
  '파스타 무한리필 이탈리아노',
  '서울시 마포구 홍익로 123',
  '정통 이탈리아 파스타를 무한리필로 즐길 수 있습니다.',
  37.556095,
  126.92261,
  126.92261,
  37.556095,
  4.4,
  4.2,
  '11:00 - 22:00',
  '성인 17,900원, 청소년 14,900원',
  ARRAY['토마토파스타', '크림파스타', '오일파스타', '빵', '샐러드'],
  ARRAY['https://example.com/images/pasta1.jpg', 'https://example.com/images/pasta2.jpg']
),
(
  '족발 무한리필 홍대점',
  '서울시 마포구 와우산로 456',
  '부드러운 족발과 보쌈을 무한리필로 즐길 수 있습니다.',
  37.555095,
  126.92161,
  126.92161,
  37.555095,
  4.0,
  3.8,
  '16:00 - 02:00',
  '성인 22,900원, 청소년 19,900원',
  ARRAY['족발', '보쌈', '막국수', '쌈채소', '마늘'],
  ARRAY['https://example.com/images/jokbal1.jpg', 'https://example.com/images/jokbal2.jpg']
),
(
  '분식 무한리필 떡볶이천국',
  '서울시 마포구 홍대입구역 789',
  '떡볶이, 순대, 튀김을 무한리필로 즐길 수 있는 분식집입니다.',
  37.557095,
  126.92361,
  126.92361,
  37.557095,
  3.9,
  4.0,
  '10:00 - 23:00',
  '성인 12,900원, 청소년 10,900원, 어린이 8,900원',
  ARRAY['떡볶이', '순대', '튀김', '김밥', '라면'],
  ARRAY['https://example.com/images/bunsik1.jpg', 'https://example.com/images/bunsik2.jpg']
),

-- 신촌 주변 가게들
(
  '찜닭 무한리필 신촌점',
  '서울시 서대문구 신촌로 321',
  '매콤달콤한 찜닭을 무한리필로 즐길 수 있습니다.',
  37.559095,
  126.93661,
  126.93661,
  37.559095,
  4.2,
  4.1,
  '11:30 - 22:30',
  '성인 19,900원, 청소년 16,900원',
  ARRAY['찜닭', '떡', '당면', '치즈', '밥'],
  ARRAY['https://example.com/images/jimdak1.jpg', 'https://example.com/images/jimdak2.jpg']
),
(
  '버거 무한리필 아메리칸',
  '서울시 서대문구 연세로 654',
  '수제 버거를 무한리필로 즐길 수 있는 아메리칸 스타일 레스토랑입니다.',
  37.558095,
  126.93561,
  126.93561,
  37.558095,
  4.3,
  4.0,
  '11:00 - 23:00',
  '성인 21,900원, 청소년 18,900원',
  ARRAY['치즈버거', '베이컨버거', '감자튀김', '양파링', '콜라'],
  ARRAY['https://example.com/images/burger1.jpg', 'https://example.com/images/burger2.jpg']
),

-- 명동 주변 가게들
(
  '일식 무한리필 사쿠라',
  '서울시 중구 명동길 123',
  '신선한 초밥과 사시미를 무한리필로 즐길 수 있는 일식당입니다.',
  37.563095,
  126.98261,
  126.98261,
  37.563095,
  4.5,
  4.3,
  '12:00 - 21:30',
  '성인 32,900원, 청소년 27,900원',
  ARRAY['초밥', '사시미', '우동', '된장국', '와사비'],
  ARRAY['https://example.com/images/japanese1.jpg', 'https://example.com/images/japanese2.jpg']
),
(
  '중식 무한리필 차이나타운',
  '서울시 중구 을지로 456',
  '정통 중국요리를 무한리필로 즐길 수 있습니다.',
  37.564095,
  126.98361,
  126.98361,
  37.564095,
  4.1,
  3.9,
  '11:00 - 22:00',
  '성인 24,900원, 청소년 21,900원',
  ARRAY['짜장면', '짬뽕', '탕수육', '군만두', '볶음밥'],
  ARRAY['https://example.com/images/chinese1.jpg', 'https://example.com/images/chinese2.jpg']
),

-- 강북 지역 가게들
(
  '곱창 무한리필 강북점',
  '서울시 강북구 수유동 789',
  '신선한 곱창과 대창을 무한리필로 즐길 수 있습니다.',
  37.638095,
  127.02561,
  127.02561,
  37.638095,
  4.0,
  3.8,
  '17:00 - 01:00',
  '성인 25,900원, 청소년 22,900원',
  ARRAY['곱창', '대창', '막창', '볶음밥', '된장찌개'],
  ARRAY['https://example.com/images/gopchang1.jpg', 'https://example.com/images/gopchang2.jpg']
),
(
  '디저트 무한리필 스위트',
  '서울시 강북구 미아동 321',
  '다양한 케이크와 디저트를 무한리필로 즐길 수 있는 카페입니다.',
  37.639095,
  127.02661,
  127.02661,
  37.639095,
  4.4,
  4.2,
  '10:00 - 22:00',
  '성인 15,900원, 청소년 13,900원, 어린이 11,900원',
  ARRAY['케이크', '마카롱', '쿠키', '커피', '차'],
  ARRAY['https://example.com/images/dessert1.jpg', 'https://example.com/images/dessert2.jpg']
),
(
  '브런치 무한리필 모닝',
  '서울시 강북구 번동 654',
  '건강한 브런치 메뉴를 무한리필로 즐길 수 있습니다.',
  37.640095,
  127.02761,
  127.02761,
  37.640095,
  4.2,
  4.0,
  '08:00 - 15:00',
  '성인 18,900원, 청소년 15,900원',
  ARRAY['팬케이크', '와플', '샐러드', '요거트', '주스'],
  ARRAY['https://example.com/images/brunch1.jpg', 'https://example.com/images/brunch2.jpg']
),

-- 추가 가게들 (더 다양한 지역과 카테고리)
(
  '샐러드 무한리필 그린',
  '서울시 송파구 잠실동 123',
  '신선한 채소와 다양한 토핑으로 만든 샐러드를 무한리필로 즐길 수 있습니다.',
  37.513095,
  127.10061,
  127.10061,
  37.513095,
  4.3,
  4.1,
  '09:00 - 21:00',
  '성인 14,900원, 청소년 12,900원',
  ARRAY['그린샐러드', '시저샐러드', '과일샐러드', '드레싱', '빵'],
  ARRAY['https://example.com/images/salad1.jpg', 'https://example.com/images/salad2.jpg']
),
(
  '카페 무한리필 원두향',
  '서울시 영등포구 여의도동 456',
  '다양한 커피와 디저트를 무한리필로 즐길 수 있는 카페입니다.',
  37.526095,
  126.92461,
  126.92461,
  37.526095,
  4.0,
  3.9,
  '07:00 - 22:00',
  '성인 13,900원, 청소년 11,900원',
  ARRAY['아메리카노', '라떼', '카푸치노', '케이크', '쿠키'],
  ARRAY['https://example.com/images/cafe1.jpg', 'https://example.com/images/cafe2.jpg']
),
(
  '뷔페 무한리필 킹스',
  '서울시 서초구 서초동 789',
  '한식, 양식, 중식, 일식을 모두 즐길 수 있는 종합 뷔페입니다.',
  37.483095,
  127.03261,
  127.03261,
  37.483095,
  4.4,
  4.2,
  '11:30 - 21:30',
  '성인 35,900원, 청소년 29,900원, 어린이 24,900원',
  ARRAY['한식', '양식', '중식', '일식', '디저트', '음료'],
  ARRAY['https://example.com/images/buffet1.jpg', 'https://example.com/images/buffet2.jpg']
);

-- 3. 가게-카테고리 연결 데이터 삽입 (가게 이름으로 조회하여 연결)
-- 무한리필 삼겹살집 강남점 (한식, 고기)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '무한리필 삼겹살집 강남점' 
AND c.name IN ('한식', '고기');

-- 피자 무한리필 카페 강남 (양식, 피자)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '피자 무한리필 카페 강남' 
AND c.name IN ('양식', '피자');

-- 해물뷔페 바다향 (해산물, 뷔페)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '해물뷔페 바다향' 
AND c.name IN ('해산물', '뷔페');

-- 치킨 무한리필 닭다리집 (치킨)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '치킨 무한리필 닭다리집' 
AND c.name = '치킨';

-- 스테이크 하우스 무한 (양식, 스테이크)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '스테이크 하우스 무한' 
AND c.name IN ('양식', '스테이크');

-- 파스타 무한리필 이탈리아노 (양식, 파스타)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '파스타 무한리필 이탈리아노' 
AND c.name IN ('양식', '파스타');

-- 족발 무한리필 홍대점 (한식, 족발)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '족발 무한리필 홍대점' 
AND c.name IN ('한식', '족발');

-- 분식 무한리필 떡볶이천국 (분식)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '분식 무한리필 떡볶이천국' 
AND c.name = '분식';

-- 찜닭 무한리필 신촌점 (한식, 찜닭)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '찜닭 무한리필 신촌점' 
AND c.name IN ('한식', '찜닭');

-- 버거 무한리필 아메리칸 (양식, 버거)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '버거 무한리필 아메리칸' 
AND c.name IN ('양식', '버거');

-- 일식 무한리필 사쿠라 (일식)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '일식 무한리필 사쿠라' 
AND c.name = '일식';

-- 중식 무한리필 차이나타운 (중식)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '중식 무한리필 차이나타운' 
AND c.name = '중식';

-- 곱창 무한리필 강북점 (한식, 곱창)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '곱창 무한리필 강북점' 
AND c.name IN ('한식', '곱창');

-- 디저트 무한리필 스위트 (디저트, 카페)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '디저트 무한리필 스위트' 
AND c.name IN ('디저트', '카페');

-- 브런치 무한리필 모닝 (브런치, 카페)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '브런치 무한리필 모닝' 
AND c.name IN ('브런치', '카페');

-- 샐러드 무한리필 그린 (샐러드)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '샐러드 무한리필 그린' 
AND c.name = '샐러드';

-- 카페 무한리필 원두향 (카페)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '카페 무한리필 원두향' 
AND c.name = '카페';

-- 뷔페 무한리필 킹스 (뷔페, 한식, 양식, 중식, 일식)
INSERT INTO store_categories (store_id, category_id)
SELECT s.id, c.id 
FROM stores s, categories c 
WHERE s.name = '뷔페 무한리필 킹스' 
AND c.name IN ('뷔페', '한식', '양식', '중식', '일식');

-- 4. 샘플 리뷰 데이터 삽입 (선택사항 - 실제 user_id가 있을 때만 사용)
-- INSERT INTO reviews (user_id, store_id, rating, content) VALUES 
-- ('user-uuid-here', 1, 4.5, '삼겹살이 정말 맛있고 무한리필이라 배불리 먹을 수 있어요!'),
-- ('user-uuid-here', 2, 4.0, '피자 종류가 다양하고 맛도 좋습니다. 가격도 합리적이에요.');

-- 5. 확인 쿼리 (선택사항)
-- SELECT 
--   s.id,
--   s.name,
--   s.address,
--   s.price,
--   s.naver_rating,
--   s.kakao_rating,
--   ARRAY_AGG(c.name) as categories
-- FROM stores s
-- LEFT JOIN store_categories sc ON s.id = sc.store_id
-- LEFT JOIN categories c ON sc.category_id = c.id
-- GROUP BY s.id, s.name, s.address, s.price, s.naver_rating, s.kakao_rating
-- ORDER BY s.id; 
begin;

alter table public.stores
  add column naver_place_id text
    constraint stores_naver_place_id_format check (naver_place_id ~ '^[1-9][0-9]*$'),
  add column kakao_place_id text
    constraint stores_kakao_place_id_format check (kakao_place_id ~ '^[1-9][0-9]*$');

comment on column public.stores.naver_place_id is
  'Naver place ID manually verified to identify this store; never a guessed ID.';
comment on column public.stores.kakao_place_id is
  'Kakao place ID manually verified to identify this store; never a guessed ID.';

-- Verified against both public place pages on 2026-10-24:
-- Naver /place/12862730/home and Kakao /17287242.
-- Both identify the Olympic Park branch at 강동대로 143-22, 02-484-4759.
-- Do not attach these IDs if the local store identity has changed.
update public.stores
set naver_place_id = '12862730', kakao_place_id = '17287242'
where id = 1851
  and name = '채선당올림픽공원점'
  and address = '서울특별시 강동구 강동대로 성내동'
  and phone_number = '02-484-4759';

commit;

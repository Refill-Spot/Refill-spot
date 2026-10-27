begin;

comment on column public.stores.naver_place_id is
  'Place ID verified by corroborated identity matching or manual review; never inferred from name alone.';
comment on column public.stores.kakao_place_id is
  'Place ID verified by corroborated identity matching or manual review; never inferred from name alone.';

-- A relocated/renamed store must be matched again; do not keep the old branch link.
create function public.invalidate_changed_store_places()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(new.name, new.address, new.phone_number, new.position_lat, new.position_lng)
    is distinct from
    row(old.name, old.address, old.phone_number, old.position_lat, old.position_lng) then
    new.naver_place_id := null;
    new.kakao_place_id := null;
  end if;
  return new;
end;
$$;

create trigger invalidate_changed_store_places
before update of name, address, phone_number, position_lat, position_lng
on public.stores
for each row execute function public.invalidate_changed_store_places();

commit;

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- Private owner rows serialize admission without a caller-accessible advisory
-- lock or a lock on an unrelated profile. The no-op UPDATE is intentional: it
-- also forces stale REPEATABLE READ/SERIALIZABLE transactions to fail rather
-- than admit against an old count. Rows persist; they are not quota counters.
create table public.managed_image_reservation_owners (
  owner_id uuid primary key
);
alter table public.managed_image_reservation_owners enable row level security;
revoke all on public.managed_image_reservation_owners
  from public, anon, authenticated, service_role;

create index managed_image_uploading_by_owner on public.managed_image_assets (owner_id)
  where state = 'uploading';

-- Existing reservations are counted, never adopted, expired or deleted. Owners
-- already at/above 20 must finalize completed uploads before reserving again.
create or replace function public.reserve_managed_image(p_bucket_id text, p_extension text)
returns table (asset_id uuid, bucket_id text, object_path text, canonical_url text, state text)
language plpgsql security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  candidate_id uuid;
  candidate_path text;
  attempt integer;
begin
  if auth.role() is distinct from 'authenticated' or caller_id is null then
    raise exception 'Authenticated image owner required' using errcode = '42501';
  end if;
  perform public.managed_image_require_active();
  if p_bucket_id is null or p_bucket_id not in ('review-images', 'profile-images')
    or p_extension is null or p_extension not in ('jpg', 'png', 'webp') then
    raise exception 'Unsupported managed image bucket or extension' using errcode = '22023';
  end if;

  insert into public.managed_image_reservation_owners as o (owner_id)
    values (caller_id)
    on conflict (owner_id) do update set owner_id = excluded.owner_id;
  if (select count(*) from public.managed_image_assets as a
      where a.owner_id = caller_id and a.state = 'uploading') >= 20 then
    raise exception 'Outstanding managed image reservation limit reached (20)' using errcode = '54000';
  end if;

  for attempt in 1..10 loop
    candidate_id := pg_catalog.gen_random_uuid();
    candidate_path := caller_id::text || '/managed-' || candidate_id::text || '.' || p_extension;
    if exists (select 1 from public.managed_image_legacy_ids as l where l.asset_id = candidate_id)
      or exists (select 1 from public.managed_image_assets as a where a.asset_id = candidate_id)
      or exists (select 1 from storage.objects as o where o.bucket_id = p_bucket_id and o.name = candidate_path) then
      continue;
    end if;
    return query
      insert into public.managed_image_assets as a (asset_id, owner_id, bucket_id, extension, object_path)
      values (candidate_id, caller_id, p_bucket_id, p_extension, candidate_path)
      returning a.asset_id, a.bucket_id, a.object_path, a.canonical_url, a.state;
    return;
  end loop;
  raise exception 'Could not reserve an unused managed image key';
end;
$function$;

-- CREATE OR REPLACE preserves the existing function identity, owner and grants.
-- No change to finalization, Storage guards or deletion eligibility: uploading
-- remains excluded from cleanup regardless of its age or owner quota.
commit;

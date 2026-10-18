begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- Stage 1: install a DISABLED lifecycle. Migration 006 separately installs the
-- Storage guards under storage.objects owner authority. Only explicit owner
-- activation, after actual Storage completion semantics are verified, enables
-- upload/worker RPCs. Each RPC rechecks the guards; none silently falls back.
-- This project is bound to https://ykztepbfcocxmtotrdbk.supabase.co. No existing
-- object is adopted, and uploading is never deleted on an elapsed-time guess.
do $prerequisites$
declare
  requirement record;
  table_name text;
  id_attribute smallint;
  bucket_attribute smallint;
  name_attribute smallint;
  version_attribute smallint;
begin
  for requirement in
    select * from (values
      ('storage.objects', 'id', 'uuid', true),
      ('storage.objects', 'bucket_id', 'text', false),
      ('storage.objects', 'name', 'text', false),
      ('storage.objects', 'owner', 'uuid', false),
      ('storage.objects', 'owner_id', 'text', false),
      ('storage.objects', 'metadata', 'jsonb', false),
      ('storage.objects', 'version', 'text', false),
      ('storage.objects', 'archived_at', 'timestamptz', false),
      ('storage.objects', 'is_delete_marker', 'boolean', true),
      ('storage.objects', 'is_versioned', 'boolean', true),
      ('storage.buckets', 'id', 'text', true),
      ('storage.buckets', 'versioning_status', 'text', true),
      ('public.profiles', 'id', 'uuid', true),
      ('public.profiles', 'avatar_url', 'text', false),
      ('public.reviews', 'image_urls', 'text[]', false),
      ('public.stores', 'image_urls', 'text[]', false)
    ) as required_columns(relation_name, column_name, type_name, required_not_null)
  loop
    if not exists (
      select 1 from pg_catalog.pg_attribute as a
      where a.attrelid = pg_catalog.to_regclass(requirement.relation_name)
        and a.attname = requirement.column_name
        and a.atttypid = pg_catalog.to_regtype(requirement.type_name)
        and (not requirement.required_not_null or a.attnotnull)
        and a.attnum > 0 and not a.attisdropped
    ) then
      raise exception 'Managed images require verified %.% of type %',
        requirement.relation_name, requirement.column_name, requirement.type_name;
    end if;
  end loop;
  foreach table_name in array array['public.profiles', 'public.reviews', 'public.stores'] loop
    select a.attnum into id_attribute from pg_catalog.pg_attribute as a
    where a.attrelid = pg_catalog.to_regclass(table_name) and a.attname = 'id'
      and a.attnum > 0 and not a.attisdropped;
    if id_attribute is null or not exists (
      select 1 from pg_catalog.pg_constraint as c
      where c.conrelid = pg_catalog.to_regclass(table_name)
        and c.contype = 'p' and c.conkey = array[id_attribute]
    ) then
      raise exception 'Managed image reference tracking requires %.id as its sole primary key', table_name;
    end if;
  end loop;
  select a.attnum into id_attribute from pg_catalog.pg_attribute as a
    where a.attrelid = 'storage.objects'::pg_catalog.regclass and a.attname = 'id' and a.attnotnull;
  select a.attnum into bucket_attribute from pg_catalog.pg_attribute as a
    where a.attrelid = 'storage.objects'::pg_catalog.regclass and a.attname = 'bucket_id';
  select a.attnum into name_attribute from pg_catalog.pg_attribute as a
    where a.attrelid = 'storage.objects'::pg_catalog.regclass and a.attname = 'name';
  select a.attnum into version_attribute from pg_catalog.pg_attribute as a
    where a.attrelid = 'storage.objects'::pg_catalog.regclass and a.attname = 'version';
  if id_attribute is null or not exists (
    select 1 from pg_catalog.pg_index as i
    where i.indrelid = 'storage.objects'::pg_catalog.regclass
      and i.indisunique and i.indisvalid and i.indisready and i.indimmediate and i.indpred is null
      and i.indnkeyatts = 1 and i.indkey[0] = id_attribute
  ) then
    raise exception 'Storage object id uniqueness is unverified';
  end if;
  -- Verified current-version Storage schema, not unconditional bucket/name
  -- uniqueness: history may share a path, but only one current row and one
  -- unversioned row may do so. A version token alone does NOT mean versioning.
  for requirement in select * from (values
    (2, '(archived_at IS NULL)', false),
    (2, '(NOT is_versioned)', false),
    (3, null::text, true)
  ) as indexes(key_count, predicate, nulls_not_distinct)
  loop
    if not exists (
      select 1 from pg_catalog.pg_index as i
      where i.indrelid = 'storage.objects'::pg_catalog.regclass
        and i.indisunique and i.indisvalid and i.indisready and i.indimmediate
        and i.indexprs is null and i.indnkeyatts = requirement.key_count
        and i.indnatts = requirement.key_count
        and i.indkey[0] = bucket_attribute and i.indkey[1] = name_attribute
        and (requirement.key_count = 2 or i.indkey[2] = version_attribute)
        and i.indcollation[1] = 'pg_catalog."C"'::pg_catalog.regcollation
        and i.indnullsnotdistinct = requirement.nulls_not_distinct
        and pg_catalog.pg_get_expr(i.indpred, i.indrelid) is not distinct from requirement.predicate
    ) then
      raise exception 'Storage current/unversioned/version uniqueness is unverified';
    end if;
  end loop;
  if (select count(distinct b.id) from storage.buckets as b
    where b.id in ('review-images', 'profile-images') and b.versioning_status = 'DISABLED') <> 2 then
    raise exception 'Both managed image buckets must have versioning DISABLED';
  end if;
  if pg_catalog.to_regprocedure('auth.uid()') is null
    or pg_catalog.to_regprocedure('auth.role()') is null
    or pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()') is null then
    raise exception 'Managed images require auth.uid(), auth.role(), and gen_random_uuid()';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class as c
    where c.oid = 'storage.objects'::pg_catalog.regclass and c.relrowsecurity
  ) then
    raise exception 'Managed images require enabled RLS on storage.objects';
  end if;
end;
$prerequisites$;

-- Drain source and metadata writes before pinning legacy names and installing
-- reference triggers. Lock/statement timeouts roll back the entire installation.
lock table public.profiles, public.reviews, public.stores, storage.objects
  in share row exclusive mode;

-- Decode ASCII percent escapes once only to detect aliases. This is NOT a URL
-- normalizer: only a literal canonical_url is attachable. Detect every reserved
-- filename candidate, including traversal, alternate routes and query aliases.
create function public.managed_image_candidate_ids(p_url text)
returns setof uuid
language plpgsql immutable
set search_path = ''
as $function$
declare
  decoded_url text := '';
  position integer := 1;
  hex_pair text;
  byte_value integer;
  match_parts text[];
begin
  if p_url is null then return; end if;
  -- Browsers strip literal TAB/LF/CR before parsing. Normalize discovery only;
  -- reference triggers still compare the untouched original URL exactly.
  p_url := pg_catalog.translate(p_url, E'\t\n\r', '');
  while position <= pg_catalog.length(p_url) loop
    hex_pair := pg_catalog.substr(p_url, position + 1, 2);
    if pg_catalog.substr(p_url, position, 1) = '%'
      and hex_pair ~ '^[0-9A-Fa-f]{2}$' then
      byte_value := pg_catalog.get_byte(pg_catalog.decode(hex_pair, 'hex'), 0);
      if byte_value between 1 and 127 then
        decoded_url := decoded_url || pg_catalog.chr(byte_value);
      else
        decoded_url := decoded_url || pg_catalog.substr(p_url, position, 3);
      end if;
      position := position + 3;
    else
      decoded_url := decoded_url || pg_catalog.substr(p_url, position, 1);
      position := position + 1;
    end if;
  end loop;
  for match_parts in
    select pg_catalog.regexp_matches(decoded_url,
      'managed-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpg|png|webp)', 'gi')
  loop
    return next match_parts[1]::pg_catalog.uuid;
  end loop;
end;
$function$;

-- Pin pre-cutover UUIDs rather than adopting objects. Include dangling legacy
-- URLs and aliases as well as existing Storage names. Reserved UUIDs cannot
-- collide with these pins; unrelated legacy filenames remain unchanged.
create table public.managed_image_legacy_ids (
  asset_id uuid primary key
);
insert into public.managed_image_legacy_ids (asset_id)
select distinct candidates.asset_id
from (
  select o.name as image_url from storage.objects as o
  union all select p.avatar_url from public.profiles as p
  union all select u.image_url from public.reviews as r
    cross join lateral pg_catalog.unnest(r.image_urls) as u(image_url)
  union all select u.image_url from public.stores as s
    cross join lateral pg_catalog.unnest(s.image_urls) as u(image_url)
) as legacy
cross join lateral public.managed_image_candidate_ids(legacy.image_url) as candidates(asset_id);

create table public.managed_image_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  activated_at timestamptz
);
insert into public.managed_image_control (singleton) values (true);

create table public.managed_image_assets (
  asset_id uuid primary key,
  owner_id uuid not null,
  bucket_id text not null check (bucket_id in ('review-images', 'profile-images')),
  extension text not null check (extension in ('jpg', 'png', 'webp')),
  object_path text not null,
  canonical_url text generated always as (
    'https://ykztepbfcocxmtotrdbk.supabase.co/storage/v1/object/public/'
      || bucket_id || '/' || object_path
  ) stored,
  protocol_version smallint not null default 1 check (protocol_version = 1),
  state text not null default 'uploading'
    check (state in ('uploading', 'ready', 'deleting', 'deleted')),
  storage_object_id uuid,
  ref_count bigint not null default 0 check (ref_count >= 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  ready_at timestamptz,
  cleanup_after timestamptz,
  deleting_at timestamptz,
  deleted_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  retry_after timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text check (pg_catalog.length(last_error) <= 1000),
  unique (bucket_id, object_path),
  unique (canonical_url),
  check (object_path = owner_id::text || '/managed-' || asset_id::text || '.' || extension),
  check (asset_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  check (
    (state = 'uploading' and storage_object_id is null and ready_at is null
      and ref_count = 0 and cleanup_after is null and deleting_at is null
      and deleted_at is null and lease_token is null and lease_expires_at is null)
    or (state = 'ready' and storage_object_id is not null and ready_at is not null
      and ((ref_count = 0 and cleanup_after is not null) or (ref_count > 0 and cleanup_after is null))
      and deleting_at is null and deleted_at is null
      and lease_token is null and lease_expires_at is null)
    or (state = 'deleting' and storage_object_id is not null and ready_at is not null
      and ref_count = 0 and cleanup_after is null and deleting_at is not null and deleted_at is null
      and ((lease_token is null and lease_expires_at is null)
        or (lease_token is not null and lease_expires_at is not null)))
    or (state = 'deleted' and storage_object_id is not null and ready_at is not null
      and ref_count = 0 and cleanup_after is null and deleting_at is not null and deleted_at is not null
      and lease_token is not null and lease_expires_at is null and retry_after is null)
  )
);
create index managed_image_deletion_candidates on public.managed_image_assets (asset_id)
  where state in ('ready', 'deleting') and ref_count = 0;

create table public.managed_image_references (
  asset_id uuid not null references public.managed_image_assets (asset_id) on delete restrict,
  source_table text not null check (source_table in ('public.profiles', 'public.reviews', 'public.stores')),
  source_id text not null check (source_id <> ''),
  primary key (asset_id, source_table, source_id)
);

alter table public.managed_image_control enable row level security;
alter table public.managed_image_legacy_ids enable row level security;
alter table public.managed_image_assets enable row level security;
alter table public.managed_image_references enable row level security;
revoke all on public.managed_image_control, public.managed_image_legacy_ids,
  public.managed_image_assets, public.managed_image_references
  from public, anon, authenticated, service_role;

create function public.managed_image_protect_asset()
returns trigger
language plpgsql security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Managed asset identities and tombstones cannot be deleted';
  end if;
  if tg_op = 'INSERT' then
    if new.state <> 'uploading' or exists (
      select 1 from public.managed_image_legacy_ids as l where l.asset_id = new.asset_id
    ) then
      raise exception 'Managed assets must start as new, non-legacy upload reservations';
    end if;
    return new;
  end if;
  if row(new.asset_id, new.owner_id, new.bucket_id, new.extension, new.object_path,
      new.protocol_version, new.created_at)
    is distinct from row(old.asset_id, old.owner_id, old.bucket_id, old.extension, old.object_path,
      old.protocol_version, old.created_at) then
    raise exception 'Managed asset provenance and keys are immutable';
  end if;
  if (old.storage_object_id is not null and new.storage_object_id is distinct from old.storage_object_id)
    or (old.ready_at is not null and new.ready_at is distinct from old.ready_at)
    or (old.deleting_at is not null and new.deleting_at is distinct from old.deleting_at)
    or (old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at) then
    raise exception 'Managed asset object identity and lifecycle timestamps are immutable';
  end if;
  if new.state <> old.state and not (
    (old.state = 'uploading' and new.state = 'ready')
    or (old.state = 'ready' and new.state = 'deleting')
    or (old.state = 'deleting' and new.state = 'deleted')
  ) then
    raise exception 'Managed asset deletion fences are irreversible';
  end if;
  return new;
end;
$function$;
create trigger managed_image_asset_provenance
  before insert or update or delete on public.managed_image_assets
  for each row execute function public.managed_image_protect_asset();
alter table public.managed_image_assets enable always trigger managed_image_asset_provenance;

create function public.managed_image_forbid_truncate()
returns trigger
language plpgsql security definer
set search_path = ''
as $function$
begin
  raise exception 'TRUNCATE would bypass managed image references or durable tombstones; use DELETE';
end;
$function$;
create trigger managed_image_assets_no_truncate before truncate on public.managed_image_assets
  for each statement execute function public.managed_image_forbid_truncate();
create trigger managed_image_references_no_truncate before truncate on public.managed_image_references
  for each statement execute function public.managed_image_forbid_truncate();
create trigger managed_image_legacy_no_truncate before truncate on public.managed_image_legacy_ids
  for each statement execute function public.managed_image_forbid_truncate();

create function public.managed_image_track_references()
returns trigger
language plpgsql security definer
set search_path = ''
as $function$
declare
  old_urls text[] := array[]::text[];
  new_urls text[] := array[]::text[];
  old_source_id text;
  new_source_id text;
  source_name text := tg_table_schema || '.' || tg_table_name;
  candidate_id uuid;
  asset public.managed_image_assets%rowtype;
  old_has boolean;
  new_has boolean;
  ledger_has boolean;
  affected integer;
begin
  if source_name not in ('public.profiles', 'public.reviews', 'public.stores') then
    raise exception 'Unsupported managed image reference sink';
  end if;
  if tg_op <> 'INSERT' then
    old_source_id := old.id::text;
    if tg_table_name = 'profiles' then old_urls := array[old.avatar_url];
    else old_urls := coalesce(old.image_urls, array[]::text[]); end if;
  end if;
  if tg_op <> 'DELETE' then
    new_source_id := new.id::text;
    if tg_table_name = 'profiles' then new_urls := array[new.avatar_url];
    else new_urls := coalesce(new.image_urls, array[]::text[]); end if;
  end if;

  -- Lock every involved asset in UUID order, including unchanged references.
  -- The locking lookup predicates ONLY on immutable asset_id. READ COMMITTED
  -- FOR UPDATE follows a concurrently updated tuple and returns current state
  -- and count (EvalPlanQual), even when the invoking DML snapshot is stale.
  -- Multi-row/multi-statement deadlocks remain ordinary retryable SQL errors;
  -- no bypass is allowed and an aborted transaction rolls all counts back.
  for candidate_id in
    select distinct c.asset_id
    from pg_catalog.unnest(old_urls || new_urls) as u(image_url)
    cross join lateral public.managed_image_candidate_ids(u.image_url) as c(asset_id)
    order by c.asset_id
  loop
    select a.* into asset from public.managed_image_assets as a
      where a.asset_id = candidate_id for update;
    if not found then
      if not exists (
        select 1 from public.managed_image_legacy_ids as l where l.asset_id = candidate_id
      ) then
        raise exception 'Managed image URL has no reservation';
      end if;
      continue;
    end if;
    if exists (
      select 1 from pg_catalog.unnest(new_urls) as u(image_url)
      cross join lateral public.managed_image_candidate_ids(u.image_url) as c(asset_id)
      where c.asset_id = candidate_id and u.image_url <> asset.canonical_url
    ) then
      raise exception 'Managed image references must use the exact project canonical URL';
    end if;
    old_has := coalesce(asset.canonical_url = any(old_urls), false);
    new_has := coalesce(asset.canonical_url = any(new_urls), false);
    select exists (
      select 1 from public.managed_image_references as r
      where r.asset_id = candidate_id and r.source_table = source_name
        and r.source_id = old_source_id
    ) into ledger_has;
    if old_has is distinct from ledger_has then
      raise exception 'Managed image reference ledger disagrees with the source row';
    end if;
    if (old_has or new_has) and asset.state <> 'ready' then
      raise exception 'Managed image is not attachable: %', asset.state;
    end if;
    if old_has and (not new_has or old_source_id is distinct from new_source_id) then
      delete from public.managed_image_references as r
      where r.asset_id = candidate_id and r.source_table = source_name and r.source_id = old_source_id;
      get diagnostics affected = row_count;
      if affected <> 1 then raise exception 'Missing managed image reference'; end if;
      update public.managed_image_assets as a
      set ref_count = a.ref_count - 1,
        cleanup_after = case when a.ref_count = 1
          then pg_catalog.clock_timestamp() + interval '1 hour' else null end
      where a.asset_id = candidate_id;
    end if;
    if new_has and (not old_has or old_source_id is distinct from new_source_id) then
      insert into public.managed_image_references (asset_id, source_table, source_id)
        values (candidate_id, source_name, new_source_id);
      update public.managed_image_assets as a
        set ref_count = a.ref_count + 1, cleanup_after = null
        where a.asset_id = candidate_id;
    end if;
  end loop;
  return null;
end;
$function$;

create trigger managed_image_profile_references after insert or update or delete on public.profiles
  for each row execute function public.managed_image_track_references();
create trigger managed_image_review_references after insert or update or delete on public.reviews
  for each row execute function public.managed_image_track_references();
create trigger managed_image_store_references after insert or update or delete on public.stores
  for each row execute function public.managed_image_track_references();
alter table public.profiles enable always trigger managed_image_profile_references;
alter table public.reviews enable always trigger managed_image_review_references;
alter table public.stores enable always trigger managed_image_store_references;
create trigger managed_image_profiles_no_truncate before truncate on public.profiles
  for each statement execute function public.managed_image_forbid_truncate();
create trigger managed_image_reviews_no_truncate before truncate on public.reviews
  for each statement execute function public.managed_image_forbid_truncate();
create trigger managed_image_stores_no_truncate before truncate on public.stores
  for each statement execute function public.managed_image_forbid_truncate();
revoke truncate on public.profiles, public.reviews, public.stores
  from public, anon, authenticated, service_role;

create function public.reserve_managed_image(p_bucket_id text, p_extension text)
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

create function public.finalize_managed_image(p_asset_id uuid)
returns table (asset_id uuid, bucket_id text, object_path text, canonical_url text, state text, storage_object_id uuid)
language plpgsql security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  asset public.managed_image_assets%rowtype;
  stored_object storage.objects%rowtype;
  expected_mime text;
  completed_at timestamptz;
begin
  if auth.role() is distinct from 'authenticated' or caller_id is null then
    raise exception 'Authenticated image owner required' using errcode = '42501';
  end if;
  perform public.managed_image_require_active();
  select a.* into asset from public.managed_image_assets as a where a.asset_id = p_asset_id for update;
  if not found or asset.owner_id <> caller_id then
    raise exception 'Managed image reservation not owned by caller' using errcode = '42501';
  end if;
  if asset.state not in ('uploading', 'ready') then
    raise exception 'Managed image cannot be finalized after its deletion fence';
  end if;
  begin
    select o.* into strict stored_object from storage.objects as o
      where o.bucket_id = asset.bucket_id and o.name = asset.object_path
        and o.archived_at is null and o.is_delete_marker is false and o.is_versioned is false
      for key share;
  exception when no_data_found or too_many_rows then
    raise exception 'Storage current unversioned non-delete-marker object is unverified';
  end;
  if stored_object.id is null
    or stored_object.owner_id is distinct from caller_id::text
    or (stored_object.owner is not null and stored_object.owner <> caller_id) then
    raise exception 'Storage object identity, path, or authoritative owner_id is unverified';
  end if;
  expected_mime := case asset.extension
    when 'jpg' then 'image/jpeg' when 'png' then 'image/png' when 'webp' then 'image/webp' end;
  -- These runtime metadata VALUES are a strict completed-object contract, not
  -- facts inferred from column types. Missing fields fail without a fallback.
  if pg_catalog.jsonb_typeof(stored_object.metadata) is distinct from 'object'
    or stored_object.metadata ->> 'mimetype' is distinct from expected_mime
    or pg_catalog.jsonb_typeof(stored_object.metadata -> 'size') is distinct from 'number' then
    raise exception 'Storage completed-object mimetype/size metadata is unverified';
  end if;
  if (stored_object.metadata ->> 'size')::pg_catalog.numeric <= 0
    or (stored_object.metadata ->> 'size')::pg_catalog.numeric > 5242880
    or (stored_object.metadata ->> 'size')::pg_catalog.numeric
      <> pg_catalog.trunc((stored_object.metadata ->> 'size')::pg_catalog.numeric) then
    raise exception 'Storage completed-object size is invalid';
  end if;
  if asset.state = 'ready' then
    if stored_object.id is distinct from asset.storage_object_id then
      raise exception 'Finalized Storage object identity changed';
    end if;
  else
    completed_at := pg_catalog.clock_timestamp();
    update public.managed_image_assets as a
    set state = 'ready', storage_object_id = stored_object.id,
      ready_at = completed_at, cleanup_after = completed_at + interval '1 hour'
    where a.asset_id = p_asset_id;
  end if;
  return query select a.asset_id, a.bucket_id, a.object_path, a.canonical_url, a.state, a.storage_object_id
    from public.managed_image_assets as a where a.asset_id = p_asset_id;
end;
$function$;

create function public.claim_managed_image_deletions(p_limit integer default 20)
returns table (asset_id uuid, bucket_id text, object_path text, canonical_url text,
  storage_object_id uuid, lease_token uuid, lease_expires_at timestamptz, attempt_count integer)
language plpgsql security definer
set search_path = ''
as $function$
declare
  asset public.managed_image_assets%rowtype;
  claimed_at timestamptz := pg_catalog.clock_timestamp();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required for managed image deletion claims' using errcode = '42501';
  end if;
  perform public.managed_image_require_active();
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Managed image claim limit must be between 1 and 100' using errcode = '22023';
  end if;
  -- uploading is NEVER eligible. A DB deadline or expired client lease cannot
  -- fence an unknown physical Storage operation. The uploader must finalize
  -- only after its non-upsert Storage upload has actually completed.
  for asset in
    select a.* from public.managed_image_assets as a
    where (a.state = 'ready' and a.ref_count = 0 and a.cleanup_after <= claimed_at)
      or (a.state = 'deleting' and coalesce(a.retry_after, claimed_at) <= claimed_at
        and (a.lease_expires_at is null or a.lease_expires_at <= claimed_at))
    order by a.asset_id limit p_limit for update skip locked
  loop
    -- The locked current tuple, not a snapshot-only SELECT, is authoritative.
    -- Attachment and claim both serialize on THIS SAME asset row.
    if asset.ref_count <> 0 or not (
      (asset.state = 'ready' and asset.cleanup_after <= claimed_at)
      or (asset.state = 'deleting' and coalesce(asset.retry_after, claimed_at) <= claimed_at
        and (asset.lease_expires_at is null or asset.lease_expires_at <= claimed_at))
    ) then continue; end if;
    if exists (select 1 from public.managed_image_references as r where r.asset_id = asset.asset_id) then
      raise exception 'Managed image zero-reference counter disagrees with ledger';
    end if;
    return query update public.managed_image_assets as a
    set state = 'deleting', cleanup_after = null,
      deleting_at = coalesce(a.deleting_at, claimed_at),
      lease_token = pg_catalog.gen_random_uuid(), lease_expires_at = pg_catalog.clock_timestamp() + interval '5 minutes',
      retry_after = null, attempt_count = a.attempt_count + 1, last_error = null
    where a.asset_id = asset.asset_id
    returning a.asset_id, a.bucket_id, a.object_path, a.canonical_url,
      a.storage_object_id, a.lease_token, a.lease_expires_at, a.attempt_count;
  end loop;
end;
$function$;

create function public.acknowledge_managed_image_deletion(
  p_asset_id uuid, p_lease_token uuid, p_deleted boolean, p_error text default null
)
returns table (asset_id uuid, state text, retry_after timestamptz)
language plpgsql security definer
set search_path = ''
as $function$
declare
  asset public.managed_image_assets%rowtype;
  acknowledged_at timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required for managed image deletion acknowledgements' using errcode = '42501';
  end if;
  perform public.managed_image_require_active();
  if p_deleted is null or p_lease_token is null then
    raise exception 'Deletion result and lease token required' using errcode = '22023';
  end if;
  select a.* into asset from public.managed_image_assets as a where a.asset_id = p_asset_id for update;
  if not found then raise exception 'Unknown managed image'; end if;
  -- Default-path info can return NoSuchKey for a delete marker while archived
  -- payloads still exist. Never turn that response into a physical-deletion
  -- acknowledgement. This is a veto, NOT proof that Storage removed a file.
  if p_deleted and exists (
    select 1 from storage.objects as o
    where o.bucket_id = asset.bucket_id and o.name = asset.object_path
      and (o.archived_at is not null or o.is_delete_marker is distinct from false
        or o.is_versioned is distinct from false)
  ) then
    raise exception 'Storage archived/versioned/delete-marker metadata prevents deletion acknowledgement';
  end if;
  acknowledged_at := pg_catalog.clock_timestamp();
  if asset.state = 'deleted' and p_deleted and asset.lease_token = p_lease_token then
    return query select a.asset_id, a.state, a.retry_after
      from public.managed_image_assets as a where a.asset_id = p_asset_id;
    return;
  end if;
  if asset.state <> 'deleting' or asset.lease_token is distinct from p_lease_token
    or asset.lease_expires_at is null or asset.lease_expires_at <= acknowledged_at then
    raise exception 'Managed image deletion lease is stale or expired';
  end if;
  if p_deleted then
    -- Keep the successful token for idempotent acknowledgement of a lost HTTP
    -- response. This permanent tombstone NEVER returns to ready or uploading.
    -- Physical removal happens via Storage API, never metadata DELETE in SQL.
    update public.managed_image_assets as a
    set state = 'deleted', deleted_at = acknowledged_at,
      lease_expires_at = null, retry_after = null, last_error = null
    where a.asset_id = p_asset_id;
  else
    update public.managed_image_assets as a
    set lease_token = null, lease_expires_at = null,
      retry_after = acknowledged_at + interval '5 minutes',
      last_error = pg_catalog.left(coalesce(p_error, 'storage_delete_failed'), 1000)
    where a.asset_id = p_asset_id;
  end if;
  return query select a.asset_id, a.state, a.retry_after
    from public.managed_image_assets as a where a.asset_id = p_asset_id;
end;
$function$;

create function public.managed_image_is_storage_path(p_bucket_id text, p_name text)
returns boolean
language sql immutable
set search_path = ''
as $function$
  select coalesce(p_bucket_id in ('review-images', 'profile-images')
    and p_name ~* '(^|/)managed-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)(/|$)', false);
$function$;

create function public.managed_image_storage_insert_allowed(
  p_bucket_id text, p_name text, p_owner_id text, p_owner uuid
)
returns boolean
language plpgsql security definer
set search_path = ''
as $function$
declare
  asset public.managed_image_assets%rowtype;
  caller_id uuid := auth.uid();
begin
  if not public.managed_image_is_storage_path(p_bucket_id, p_name) then return true; end if;
  select a.* into asset from public.managed_image_assets as a
    where a.bucket_id = p_bucket_id and a.object_path = p_name for update;
  if not found then return false; end if;
  return auth.role() = 'authenticated' and caller_id is not null
    and asset.state = 'uploading' and asset.owner_id = caller_id
    and p_owner_id = caller_id::text and (p_owner is null or p_owner = caller_id);
end;
$function$;

create function public.managed_image_storage_mutation_allowed(p_bucket_id text, p_name text)
returns boolean
language plpgsql security definer
set search_path = ''
as $function$
declare
  asset public.managed_image_assets%rowtype;
begin
  if not public.managed_image_is_storage_path(p_bucket_id, p_name) then return true; end if;
  -- Acquire the same asset lock, even for a denial. UPDATE guards check both
  -- old and new paths, so a rename cannot escape the managed deletion fence.
  select a.* into asset from public.managed_image_assets as a
    where a.bucket_id = p_bucket_id and a.object_path = p_name for update;
  if found then return auth.role() = 'service_role'; end if;
  -- Prefix-shaped pre-cutover objects remain legacy; preserve their previous
  -- mutation permissions. New unreserved prefix-shaped destinations are denied.
  return exists (
    select 1 from public.managed_image_candidate_ids(p_name) as c(asset_id)
    join public.managed_image_legacy_ids as l on l.asset_id = c.asset_id
  );
end;
$function$;

-- Compare exact restrictive policy expressions/roles/commands and enabled
-- source triggers, not merely names. Revoking or weakening a guard after an
-- earlier activation therefore stops every new upload/finalize/claim/ack RPC.
create function public.managed_image_verify_guards()
returns void
language plpgsql security definer
set search_path = ''
as $function$
declare
  expected record;
begin
  -- Hold both bucket configurations stable through each RPC. This does not
  -- change bucket settings and cannot fence the worker's intervening HTTP calls;
  -- claim AND acknowledgement must independently verify DISABLED semantics.
  perform b.id from storage.buckets as b
    where b.id in ('review-images', 'profile-images') order by b.id for share;
  if (select count(distinct b.id) from storage.buckets as b
    where b.id in ('review-images', 'profile-images') and b.versioning_status = 'DISABLED') <> 2 then
    raise exception 'Both managed image buckets must have versioning DISABLED';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class as c
    where c.oid = 'storage.objects'::pg_catalog.regclass and c.relrowsecurity
  ) then raise exception 'Storage RLS is not enabled'; end if;
  for expected in select * from (values
    ('managed_images_insert_guard', 'a', null::text,
      'public.managed_image_storage_insert_allowed(bucket_id,name,owner_id,owner)'),
    ('managed_images_update_guard', 'w',
      'public.managed_image_storage_mutation_allowed(bucket_id,name)',
      'public.managed_image_storage_mutation_allowed(bucket_id,name)'),
    ('managed_images_delete_guard', 'd',
      'public.managed_image_storage_mutation_allowed(bucket_id,name)', null::text)
  ) as policies(policy_name, command_name, using_expression, check_expression)
  loop
    if not exists (
      select 1 from pg_catalog.pg_policy as p
      where p.polrelid = 'storage.objects'::pg_catalog.regclass
        and p.polname = expected.policy_name and p.polcmd::text = expected.command_name
        and not p.polpermissive and p.polroles = array[0::pg_catalog.oid]
        and pg_catalog.replace(pg_catalog.pg_get_expr(p.polqual, p.polrelid), ' ', '')
          is not distinct from expected.using_expression
        and pg_catalog.replace(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), ' ', '')
          is not distinct from expected.check_expression
    ) then raise exception 'Missing or altered restrictive Storage guard: %', expected.policy_name; end if;
  end loop;
  for expected in select * from (values
    ('public.profiles', 'managed_image_profile_references'),
    ('public.reviews', 'managed_image_review_references'),
    ('public.stores', 'managed_image_store_references')
  ) as sinks(relation_name, trigger_name)
  loop
    if not exists (
      select 1 from pg_catalog.pg_trigger as t
      where t.tgrelid = pg_catalog.to_regclass(expected.relation_name)
        and t.tgname = expected.trigger_name and t.tgenabled = 'A' and t.tgtype = 29
        and t.tgfoid = 'public.managed_image_track_references()'::pg_catalog.regprocedure
    ) then raise exception 'Missing or altered managed image reference trigger: %', expected.trigger_name; end if;
  end loop;
end;
$function$;

create function public.managed_image_require_active()
returns void
language plpgsql security definer
set search_path = ''
as $function$
begin
  if not exists (select 1 from public.managed_image_control as c where c.singleton and c.enabled) then
    raise exception 'Managed image lifecycle is installed but not activated';
  end if;
  perform public.managed_image_verify_guards();
end;
$function$;

-- Administrative SQL only, never granted to API roles. A true argument attests
-- verified physical Storage completion semantics, not a DB proof of them.
create function public.activate_managed_image_lifecycle(p_storage_completion_verified boolean)
returns void
language plpgsql security definer
set search_path = ''
as $function$
begin
  if p_storage_completion_verified is distinct from true then
    raise exception 'Storage completed-upload semantics must be verified before activation';
  end if;
  perform public.managed_image_verify_guards();
  update public.managed_image_control as c
    set enabled = true, activated_at = coalesce(c.activated_at, pg_catalog.clock_timestamp())
    where c.singleton;
  if not found then raise exception 'Missing managed image activation control'; end if;
end;
$function$;

revoke all on function public.managed_image_candidate_ids(text),
  public.managed_image_protect_asset(), public.managed_image_forbid_truncate(),
  public.managed_image_track_references(), public.managed_image_is_storage_path(text, text),
  public.managed_image_storage_insert_allowed(text, text, text, uuid),
  public.managed_image_storage_mutation_allowed(text, text),
  public.reserve_managed_image(text, text), public.finalize_managed_image(uuid),
  public.claim_managed_image_deletions(integer),
  public.acknowledge_managed_image_deletion(uuid, uuid, boolean, text),
  public.managed_image_verify_guards(), public.managed_image_require_active(),
  public.activate_managed_image_lifecycle(boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_managed_image(text, text),
  public.finalize_managed_image(uuid) to authenticated;
grant execute on function public.claim_managed_image_deletions(integer),
  public.acknowledge_managed_image_deletion(uuid, uuid, boolean, text) to service_role;
grant execute on function public.managed_image_storage_insert_allowed(text, text, text, uuid),
  public.managed_image_storage_mutation_allowed(text, text) to anon, authenticated, service_role;

commit;

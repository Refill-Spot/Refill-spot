begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- Apply only while disabled. This change prevents NEW signed-upload
-- capabilities; it cannot revoke tokens issued before installation. Before
-- explicit owner activation, audit existing managed assets and verify all
-- previously issued capabilities have expired or been invalidated. Handle any
-- affected test asset separately; do not adopt, claim or delete existing rows.
-- cleanup_after = 'infinity' alone is not permanent quarantine: reference
-- removal can replace it with an ordinary cleanup deadline.
-- Independently verify pre-issued capability safety: documented token expiry
-- or an SDK transition is not evidence that an old token can no longer mutate
-- Storage. Keep affected test assets separately excluded from cleanup.
do $prerequisites$
begin
  perform c.singleton from public.managed_image_control as c
    where c.singleton and not c.enabled for update;
  if not found then
    raise exception 'Managed image lifecycle must be disabled before installing the upload operation guard';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc as p
    where p.oid = pg_catalog.to_regprocedure('storage.allow_only_operation(text)')
      and p.prokind = 'f' and p.prorettype = 'pg_catalog.bool'::pg_catalog.regtype
      and not p.proretset
  ) then
    raise exception 'Managed images require storage.allow_only_operation(text) returning boolean';
  end if;
end;
$prerequisites$;

-- Keep the existing function identity, ownership, grants and restrictive policy
-- calls. Their owners remain the trusted administrative boundary; inspecting
-- function source text is not an authoritative hardening/version registry.
create or replace function public.managed_image_storage_insert_allowed(
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
  -- Signing a URL performs an INSERT permission check without completing an
  -- upload. A minted capability can later bypass these RLS mutation fences.
  -- Accept only the normalized standard upload API operation, never signing,
  -- signed-token upload, an absent operation, or an auth.role() bypass.
  if storage.allow_only_operation('object.upload') is distinct from true then return false; end if;
  return auth.role() = 'authenticated' and caller_id is not null
    and asset.state = 'uploading' and asset.owner_id = caller_id
    and p_owner_id = caller_id::text and (p_owner is null or p_owner = caller_id);
end;
$function$;

commit;

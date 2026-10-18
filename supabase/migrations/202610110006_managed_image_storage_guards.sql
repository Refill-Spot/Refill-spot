-- Stage 2: requires storage.objects owner authority. Normal project postgres
-- may lack it; SQL MUST fail visibly, never skip these statements. An official
-- owner-authorized policy UI may instead create the exact AS RESTRICTIVE,
-- TO PUBLIC definitions below. A permissive lookalike fails core verification.
-- Existing permissive policies still determine ordinary bucket access: these
-- guards only restrict the managed namespace and never grant access themselves.
-- Keep the lifecycle disabled until real Storage completion/signed-upload/
-- overwrite/move/recreation behavior is verified with designated test accounts.
-- Only then may the owner of the administrative function explicitly execute:
--   select public.activate_managed_image_lifecycle(true);
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

create policy managed_images_insert_guard on storage.objects as restrictive
  for insert to public with check (
    public.managed_image_storage_insert_allowed(bucket_id, name, owner_id, owner)
  );
create policy managed_images_update_guard on storage.objects as restrictive
  for update to public using (
    public.managed_image_storage_mutation_allowed(bucket_id, name)
  ) with check (
    public.managed_image_storage_mutation_allowed(bucket_id, name)
  );
create policy managed_images_delete_guard on storage.objects as restrictive
  for delete to public using (
    public.managed_image_storage_mutation_allowed(bucket_id, name)
  );

commit;

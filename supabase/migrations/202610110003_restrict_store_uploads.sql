begin;

-- The existing INSERT condition restricts the bucket but was granted to PUBLIC.
-- Preserve authenticated uploads used by the application; deny anonymous ones.
alter policy "Service role upload z465cc_0" on storage.objects to authenticated;

commit;

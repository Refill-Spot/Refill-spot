begin;

-- Apply after profile administrator columns are protected. Public submission
-- uses INSERT-only; deploy the matching API before reopening the contact form.
alter table public.contacts enable row level security;
revoke all privileges on table public.contacts from anon, authenticated;
grant insert (type, name, email, phone, store_name, store_address, message, status)
  on table public.contacts to anon, authenticated;
grant select, update, delete on table public.contacts to authenticated;
grant usage on sequence public.contacts_id_seq to anon, authenticated;

create policy contacts_public_submission on public.contacts
  for insert to anon, authenticated
  with check (status = 'pending');

create policy contacts_admin_read on public.contacts
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and (p.is_admin = true or p.role = 'admin')
  ));

create policy contacts_admin_update on public.contacts
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and (p.is_admin = true or p.role = 'admin')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and (p.is_admin = true or p.role = 'admin')
  ));

create policy contacts_admin_delete on public.contacts
  for delete to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and (p.is_admin = true or p.role = 'admin')
  ));

commit;

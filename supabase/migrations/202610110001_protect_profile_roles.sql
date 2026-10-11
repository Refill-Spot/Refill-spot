begin;

-- RLS already restricts profile writes to auth.uid() = id. Column grants must
-- also prevent clients from assigning themselves administrator privileges.
revoke all privileges on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant insert (id, username, avatar_url, bio, updated_at)
  on table public.profiles to authenticated;
grant update (username, avatar_url, bio, updated_at)
  on table public.profiles to authenticated;

commit;

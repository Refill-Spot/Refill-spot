begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- No existing duplicate user/store groups were found in the read-only audit.
-- Abort without deleting data if a concurrent duplicate was inserted.
alter table public.reviews
  add constraint reviews_user_store_unique unique (user_id, store_id);

commit;

-- Per-IP, per-hour rate limiting for the generate-captions function.
--
-- Apply with:  supabase db push
--
-- One row per (ip, hour). bump_rate_limit() atomically increments the counter
-- and returns the new value, so two concurrent requests can't both slip under
-- the limit (a plain count-then-insert would race).

create table if not exists public.rate_limit (
  ip           text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (ip, window_start)
);

-- The table is only ever touched by the edge function via the service role,
-- which bypasses RLS. Enabling RLS with no policies denies everyone else —
-- the anon/public keys cannot read or write it.
alter table public.rate_limit enable row level security;

-- Atomically bump the current hour's counter for an IP and return the new count.
-- security definer so it runs with the function owner's rights regardless of
-- the caller's role.
create or replace function public.bump_rate_limit(client_ip text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket    timestamptz := date_trunc('hour', now());
  new_count integer;
begin
  insert into public.rate_limit (ip, window_start, count)
  values (client_ip, bucket, 1)
  on conflict (ip, window_start)
  do update set count = public.rate_limit.count + 1
  returning count into new_count;

  -- Opportunistic cleanup so the table doesn't grow unbounded. Cheap: bounded
  -- by the number of distinct IPs seen in the last couple of hours.
  delete from public.rate_limit where window_start < now() - interval '2 hours';

  return new_count;
end;
$$;

-- RoadDash: shared per-minute rate limits and a length limit on profile names.

-- ── Per-minute rate limits (server only) ────────────────────────────────────

-- One row per caller and bucket ('ai:u:<user id>', 'content:ip:<address>'…):
-- the start of the current window and the requests counted in it. Every
-- server instance counts in the same row, so the limit holds however many
-- instances run. No policies: only the server (secret key) reaches it.
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

alter table public.rate_limits enable row level security;

-- Counts one request. Returns 0 when it is allowed, otherwise the seconds
-- until the window ends (for Retry-After). The upsert locks the row, so
-- concurrent requests are counted one by one.
create function public.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval := make_interval(secs => p_window_seconds);
  v_start timestamptz;
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_now, 1)
  on conflict (key) do update
     set window_start = case when r.window_start <= v_now - v_window then v_now else r.window_start end,
         hits = case when r.window_start <= v_now - v_window then 1 else r.hits + 1 end
  returning window_start, hits into v_start, v_hits;

  if v_hits <= p_limit then
    return 0;
  end if;
  return greatest(1, ceil(extract(epoch from (v_start + v_window - v_now)))::integer);
end;
$$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ── Profile names ───────────────────────────────────────────────────────────

-- Names come from the sign-up form or Google: keep them to 80 characters.
update public.profiles set name = left(name, 80) where char_length(name) > 80;
alter table public.profiles add constraint profiles_name_length check (char_length(name) <= 80);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      80
    )
  );
  return new;
end;
$$;

-- Users may change their own name, nothing else (not the id or the dates).
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;

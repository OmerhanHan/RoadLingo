-- RoadDash: accounts, plans and daily usage.
--
-- Row Level Security is on for every table. Users can read their own rows;
-- subscriptions, payments and usage are written only by the server (secret
-- key), so a client can never grant itself a plan or reset its counters.

-- ── Profiles ────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- A profile row for every new account (email sign-up or Google).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Subscriptions and payments (server writes only) ─────────────────────────

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null default 'free' check (plan_id in ('free', 'pro', 'exam')),
  cycle text not null default 'monthly' check (cycle in ('monthly', 'yearly', 'once')),
  status text not null default 'active' check (status in ('active', 'canceled')),
  -- Renewal date (Pro) or pass end (Sınav Paketi).
  current_period_end timestamptz,
  provider text not null default 'demo',
  card_brand text,
  card_last4 text,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users read their own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null,
  cycle text not null,
  amount_try integer not null check (amount_try >= 0),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  provider text not null default 'demo',
  provider_ref text,
  card_last4 text,
  created_at timestamptz not null default now()
);

create index payments_user_created on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

create policy "Users read their own payments"
  on public.payments for select to authenticated
  using ((select auth.uid()) = user_id);

-- ── Daily usage (server writes only) ────────────────────────────────────────

-- subject: 'u:<user id>' for signed-in users, 'ip:<address>' otherwise.
-- day: UTC date, so counters reset at 03:00 Turkey time.
-- kind: a plan limit (scoring, chat, generation) or an internal budget
-- (ttsChars, topics).
create table public.usage_daily (
  subject text not null,
  day date not null,
  kind text not null,
  used integer not null default 0 check (used >= 0),
  primary key (subject, day, kind)
);

alter table public.usage_daily enable row level security;

create policy "Users read their own usage"
  on public.usage_daily for select to authenticated
  using (subject = 'u:' || (select auth.uid())::text);

-- Adds p_amount if it still fits under p_limit. Returns false (and counts
-- nothing) otherwise. The conditional UPDATE locks the row, so concurrent
-- requests cannot both slip past the limit.
create function public.consume_usage(
  p_subject text,
  p_day date,
  p_kind text,
  p_amount integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usage_daily (subject, day, kind, used)
  values (p_subject, p_day, p_kind, 0)
  on conflict (subject, day, kind) do nothing;

  update public.usage_daily
     set used = used + p_amount
   where subject = p_subject
     and day = p_day
     and kind = p_kind
     and used + p_amount <= p_limit;

  return found;
end;
$$;

-- Gives back a use (e.g. the AI call failed and nothing was delivered).
create function public.refund_usage(
  p_subject text,
  p_day date,
  p_kind text,
  p_amount integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usage_daily
     set used = greatest(0, used - p_amount)
   where subject = p_subject
     and day = p_day
     and kind = p_kind;
$$;

revoke execute on function public.consume_usage(text, date, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.refund_usage(text, date, text, integer) from public, anon, authenticated;
grant execute on function public.consume_usage(text, date, text, integer, integer) to service_role;
grant execute on function public.refund_usage(text, date, text, integer) to service_role;

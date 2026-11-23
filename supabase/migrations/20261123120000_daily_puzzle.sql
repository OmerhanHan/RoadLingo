-- RoadDash: Günün Bulmacası (the daily word puzzle), nicknames for its
-- leaderboard.
--
-- Everyone gets the same word on the same day (Europe/Istanbul). The word
-- never leaves the server until the player has finished: the browser sends
-- hint requests and guesses, the server checks them, computes the score and
-- writes the play. Users can read their own plays; only the server writes.

-- ── Nicknames ───────────────────────────────────────────────────────────────

-- Shown on the leaderboard instead of the name. Set through the API (it
-- checks words that are not allowed), so there is no update grant for it.
-- Players without one appear as "Oyuncu 1234".
alter table public.profiles
  add column nickname text check (
    nickname is null or nickname ~ '^[A-Za-z0-9ÇĞİÖŞÜçğıöşü_.]{3,20}$'
  );

create unique index profiles_nickname_unique on public.profiles (lower(nickname)) where nickname is not null;

-- ── Plays ───────────────────────────────────────────────────────────────────

create table public.daily_puzzle_plays (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The puzzle's day in Europe/Istanbul.
  day date not null,
  puzzle_id text not null check (char_length(puzzle_id) <= 40),
  status text not null default 'playing' check (status in ('playing', 'solved', 'failed')),
  hints_used smallint not null default 0 check (hints_used between 0 and 3),
  -- Wrong guesses, in order (lowercase words).
  guesses jsonb not null default '[]' check (jsonb_typeof(guesses) = 'array' and jsonb_array_length(guesses) <= 5),
  -- Bumped on every change; the server updates only the version it read, so
  -- two requests at once cannot both spend the same guess.
  moves smallint not null default 0,
  score smallint not null default 0 check (score between 0 and 100),
  -- Days solved in a row, counting this one (0 when failed).
  streak smallint not null default 0 check (streak >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (user_id, day)
);

create index daily_puzzle_plays_board on public.daily_puzzle_plays (day, score desc) where status = 'solved';

alter table public.daily_puzzle_plays enable row level security;

create policy "Users read their own puzzle plays"
  on public.daily_puzzle_plays for select to authenticated
  using ((select auth.uid()) = user_id);

-- ── Leaderboard ─────────────────────────────────────────────────────────────

-- Solved plays of a day: higher score first, then the faster solve. Returns
-- the top p_limit and the given user's own row. Server only (it returns
-- user ids, which the API turns into "me" and never sends out).
create function public.daily_puzzle_board(p_day date, p_user_id uuid, p_limit integer default 20)
returns table (rank bigint, user_id uuid, nickname text, score smallint, seconds integer, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      p.user_id,
      pr.nickname,
      p.score,
      greatest(0, extract(epoch from (p.finished_at - p.started_at)))::integer as seconds,
      rank() over (order by p.score desc, p.finished_at - p.started_at) as rank,
      count(*) over () as total
    from public.daily_puzzle_plays p
    left join public.profiles pr on pr.id = p.user_id
    where p.day = p_day and p.status = 'solved'
  )
  select r.rank, r.user_id, r.nickname, r.score, r.seconds, r.total
  from ranked r
  where r.rank <= least(greatest(p_limit, 1), 100) or r.user_id = p_user_id
  order by r.rank, r.seconds
$$;

revoke all on function public.daily_puzzle_board(date, uuid, integer) from public, anon, authenticated;
grant execute on function public.daily_puzzle_board(date, uuid, integer) to service_role;

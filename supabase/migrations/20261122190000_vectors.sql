-- RoadDash: vector infrastructure (pgvector) and the first vectors, one per writing.
--
-- Rules (see TODO.md, section 3):
-- * Vectors are a search index, not the data: the text stays in writings.
-- * Every vector comes from the same model at the same size
--   (nomic-embed-text, 256 dimensions). Changing the model means
--   recomputing all of them; the model column records which one made each.
-- * Vectors are written by the server in the background; a writing without
--   a vector is simply waiting for one.
-- * They are deleted with the writing or the account (on delete cascade):
--   a vector made from a user's text is personal data too.

create extension if not exists vector with schema extensions;

create table public.writing_embeddings (
  writing_id uuid primary key references public.writings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  model text not null,
  embedding extensions.vector(256) not null,
  created_at timestamptz not null default now()
);

-- Searches stay inside one user's writings (tens to hundreds of rows), where
-- an exact scan through this index beats an approximate (HNSW) index. The
-- library (section 5) will need HNSW; its chunks are searched across all books.
create index writing_embeddings_user on public.writing_embeddings (user_id);

-- No policies: only the server (secret key) reads or writes vectors.
alter table public.writing_embeddings enable row level security;

-- The user's writings closest in meaning to one of their writings.
-- similarity: 1 = same meaning, 0 = unrelated (cosine).
create function public.similar_writings(
  p_user_id uuid,
  p_writing_id uuid,
  p_count integer default 5
)
returns table (writing_id uuid, similarity double precision)
language sql
stable
set search_path = ''
as $$
  select e.writing_id, 1 - (e.embedding operator(extensions.<=>) q.embedding) as similarity
    from public.writing_embeddings e,
         (select embedding from public.writing_embeddings
           where writing_id = p_writing_id and user_id = p_user_id) q
   where e.user_id = p_user_id
     and e.writing_id <> p_writing_id
   order by e.embedding operator(extensions.<=>) q.embedding
   limit least(greatest(p_count, 1), 20);
$$;

-- Writings still waiting for a vector, oldest first (background catch-up).
create function public.writings_missing_embedding(p_limit integer default 10)
returns table (id uuid)
language sql
stable
set search_path = ''
as $$
  select w.id
    from public.writings w
   where not exists (select 1 from public.writing_embeddings e where e.writing_id = w.id)
   order by w.created_at
   limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function public.similar_writings(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.writings_missing_embedding(integer) from public, anon, authenticated;
grant execute on function public.similar_writings(uuid, uuid, integer) to service_role;
grant execute on function public.writings_missing_embedding(integer) to service_role;

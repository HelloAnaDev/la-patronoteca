-- La Patronoteca — esquema completo de base de datos, seguridad y almacenamiento.
-- Cómo usarlo: Supabase -> tu proyecto -> SQL Editor -> pegar todo este archivo -> Run.
-- Se puede volver a ejecutar sin duplicar datos (usa "if not exists" / "on conflict").

create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- Normaliza un texto para comparar etiquetas sin importar mayúsculas/tildes.
create or replace function public.normalize_tag(txt text)
returns text
language sql
immutable
as $$
  select upper(unaccent(trim(txt)));
$$;

-- =========================================================
-- TABLAS
-- =========================================================

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('tecnica', 'producto')),
  name text not null, -- normalizado (MAYÚS, sin tildes), para comparar
  display_name text not null, -- como se muestra
  status text not null default 'approved' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  unique (category, name)
);

create table if not exists public.patterns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  author_name text not null,
  author_email text not null,
  short_description text not null,
  long_description text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  pattern_paths text[] not null, -- el/los archivo(s) del patrón en sí: PDF y/o imágenes
  cover_image_path text,
  gallery_paths text[] not null default '{}',
  ai_flag_detected boolean not null default false,
  ai_flag_signature text,
  ai_disclosed boolean not null default false,
  virustotal_status text not null default 'not_analyzed' check (virustotal_status in ('not_analyzed', 'analyzing', 'clean', 'flagged')),
  virustotal_result jsonb, -- array con el resultado de VirusTotal de cada archivo analizado
  rejected_reason text,
  ip_address text,
  original_source text -- credito opcional a quien creo el patron originalmente
);

create table if not exists public.pattern_tags (
  pattern_id uuid not null references public.patterns(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (pattern_id, tag_id)
);

create table if not exists public.community_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  display_name text not null,
  network text not null check (network in ('instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'etsy', 'otra')),
  url text not null,
  submitter_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  ip_address text
);

create table if not exists public.blocked_identities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('email', 'ip')),
  value text not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (type, value)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pattern_id uuid references public.patterns(id) on delete cascade,
  message text not null,
  reporter_email text,
  resolved boolean not null default false
);

-- Etiqueta "OTROS" fija en ambas categorías, para casos raros.
insert into public.tags (category, name, display_name, status)
values
  ('tecnica', 'OTROS', 'Otros', 'approved'),
  ('producto', 'OTROS', 'Otros', 'approved')
on conflict (category, name) do nothing;

-- =========================================================
-- SEGURIDAD (RLS)
-- =========================================================

alter table public.tags enable row level security;
alter table public.patterns enable row level security;
alter table public.pattern_tags enable row level security;
alter table public.community_links enable row level security;
alter table public.blocked_identities enable row level security;
alter table public.reports enable row level security;

-- Cualquiera puede LEER etiquetas aprobadas (para buscador y formulario de subida).
drop policy if exists "tags: lectura publica de aprobadas" on public.tags;
create policy "tags: lectura publica de aprobadas" on public.tags
  for select to anon, authenticated
  using (status = 'approved');

-- Cualquiera puede LEER patrones aprobados.
drop policy if exists "patterns: lectura publica de aprobados" on public.patterns;
create policy "patterns: lectura publica de aprobados" on public.patterns
  for select to anon, authenticated
  using (status = 'approved');

-- Cualquiera puede LEER las etiquetas de un patrón aprobado.
drop policy if exists "pattern_tags: lectura publica" on public.pattern_tags;
create policy "pattern_tags: lectura publica" on public.pattern_tags
  for select to anon, authenticated
  using (exists (
    select 1 from public.patterns p
    where p.id = pattern_tags.pattern_id and p.status = 'approved'
  ));

-- Cualquiera puede LEER enlaces de comunidad aprobados.
drop policy if exists "community_links: lectura publica de aprobados" on public.community_links;
create policy "community_links: lectura publica de aprobados" on public.community_links
  for select to anon, authenticated
  using (status = 'approved');

-- blocked_identities y reports: sin acceso público alguno (solo las Edge Functions,
-- que usan la service role key y saltan RLS por completo).

-- No se crean políticas de INSERT/UPDATE/DELETE para anon/authenticated a propósito:
-- toda escritura (subir patrón, subir red social, moderar, denunciar) pasa por
-- las Edge Functions, que validan, controlan IP/bloqueos y usan la service role key.

-- =========================================================
-- ALMACENAMIENTO (Storage)
-- =========================================================

insert into storage.buckets (id, name, public)
values ('pending-uploads', 'pending-uploads', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('published', 'published', true)
on conflict (id) do nothing;

-- Nadie puede leer/listar el bucket de pendientes salvo la service role (Edge Functions).
drop policy if exists "pending-uploads: sin lectura publica" on storage.objects;

-- Cualquiera puede SUBIR un archivo al bucket de pendientes (para el formulario de subida).
drop policy if exists "pending-uploads: subida publica" on storage.objects;
create policy "pending-uploads: subida publica" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'pending-uploads');

-- Cualquiera puede LEER el bucket de publicados (patrones ya aceptados).
drop policy if exists "published: lectura publica" on storage.objects;
create policy "published: lectura publica" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'published');

-- Nadie (anon/authenticated) puede escribir directamente en "published";
-- solo lo hace la Edge Function moderate-pattern con la service role key.

-- =========================================================
-- CORAZONES, EXPERIENCIAS Y COMENTARIOS
-- =========================================================

alter table public.patterns add column if not exists hearts_count integer not null default 0;
alter table public.patterns add column if not exists good_experience_count integer not null default 0;
alter table public.patterns add column if not exists bad_experience_count integer not null default 0;
alter table public.patterns add column if not exists comments_count integer not null default 0;

-- Favoritos: un corazón por cuenta (usuario logueado) y patrón.
-- ip_address se conserva por compatibilidad con corazones antiguos anónimos,
-- pero ya no se usa para nuevos votos.
create table if not exists public.pattern_hearts (
  pattern_id uuid not null references public.patterns(id) on delete cascade,
  ip_address text,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists pattern_hearts_pattern_user_key on public.pattern_hearts(pattern_id, user_id) where user_id is not null;

-- Una valoración de experiencia por IP y patrón (se puede cambiar de opinión).
create table if not exists public.pattern_experiences (
  pattern_id uuid not null references public.patterns(id) on delete cascade,
  ip_address text not null,
  rating text not null check (rating in ('good', 'bad')),
  created_at timestamptz not null default now(),
  primary key (pattern_id, ip_address)
);

-- Incrementa/decrementa un contador del patrón de forma segura (evita
-- condiciones de carrera de un simple "leer y volver a escribir").
create or replace function public.increment_pattern_counter(p_pattern_id uuid, p_column text, p_delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_column = 'hearts_count' then
    update public.patterns set hearts_count = greatest(0, hearts_count + p_delta) where id = p_pattern_id;
  elsif p_column = 'good_experience_count' then
    update public.patterns set good_experience_count = greatest(0, good_experience_count + p_delta) where id = p_pattern_id;
  elsif p_column = 'bad_experience_count' then
    update public.patterns set bad_experience_count = greatest(0, bad_experience_count + p_delta) where id = p_pattern_id;
  elsif p_column = 'comments_count' then
    update public.patterns set comments_count = greatest(0, comments_count + p_delta) where id = p_pattern_id;
  end if;
end;
$$;

-- Favoritos por cuenta: da o quita el corazón de forma atómica.
create or replace function public.toggle_pattern_heart(p_pattern_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count int;
begin
  insert into public.pattern_hearts (pattern_id, user_id) values (p_pattern_id, p_user_id)
  on conflict (pattern_id, user_id) where user_id is not null do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.patterns set hearts_count = hearts_count + 1 where id = p_pattern_id;
    return 'added';
  else
    delete from public.pattern_hearts where pattern_id = p_pattern_id and user_id = p_user_id;
    update public.patterns set hearts_count = greatest(0, hearts_count - 1) where id = p_pattern_id;
    return 'removed';
  end if;
end;
$$;

-- Una valoración de experiencia por IP y patrón (se puede cambiar de opinión).
create or replace function public.toggle_pattern_experience(p_pattern_id uuid, p_ip text, p_rating text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count int;
  existing_rating text;
begin
  insert into public.pattern_experiences (pattern_id, ip_address, rating)
  values (p_pattern_id, p_ip, p_rating)
  on conflict (pattern_id, ip_address) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    if p_rating = 'good' then
      update public.patterns set good_experience_count = good_experience_count + 1 where id = p_pattern_id;
    else
      update public.patterns set bad_experience_count = bad_experience_count + 1 where id = p_pattern_id;
    end if;
    return 'added';
  end if;

  select rating into existing_rating from public.pattern_experiences where pattern_id = p_pattern_id and ip_address = p_ip for update;

  if existing_rating = p_rating then
    delete from public.pattern_experiences where pattern_id = p_pattern_id and ip_address = p_ip;
    if p_rating = 'good' then
      update public.patterns set good_experience_count = greatest(0, good_experience_count - 1) where id = p_pattern_id;
    else
      update public.patterns set bad_experience_count = greatest(0, bad_experience_count - 1) where id = p_pattern_id;
    end if;
    return 'removed';
  else
    update public.pattern_experiences set rating = p_rating where pattern_id = p_pattern_id and ip_address = p_ip;
    if p_rating = 'good' then
      update public.patterns set good_experience_count = good_experience_count + 1, bad_experience_count = greatest(0, bad_experience_count - 1) where id = p_pattern_id;
    else
      update public.patterns set bad_experience_count = bad_experience_count + 1, good_experience_count = greatest(0, good_experience_count - 1) where id = p_pattern_id;
    end if;
    return 'changed';
  end if;
end;
$$;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  pattern_id uuid not null references public.patterns(id) on delete cascade,
  alias text not null,
  message text not null,
  image_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  ip_address text
);

alter table public.pattern_hearts enable row level security;
alter table public.pattern_experiences enable row level security;
alter table public.comments enable row level security;

-- pattern_hearts y pattern_experiences: sin política pública (solo las Edge
-- Functions, con la service role key, leen/escriben ahí).

drop policy if exists "comments: lectura publica de aprobados" on public.comments;
create policy "comments: lectura publica de aprobados" on public.comments
  for select to anon, authenticated
  using (status = 'approved');

-- Phase 5: profil kandidat hasil pembacaan CV. TIDAK menyimpan file/teks CV, nama, kontak, atau alamat.
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  education jsonb not null default '[]',           -- [{level, rank, field, fields[]}]
  experience jsonb not null default '[]',          -- [{title, months, kind: work|internship, health}]
  skills jsonb not null default '[]',              -- [{id, source}] id = konsep di js/ontology.js
  preferred_locations text[] not null default '{}',
  preferred_titles text[] not null default '{}',
  work_months integer not null default 0,
  internship_months integer not null default 0,
  parser_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
create policy "profil_baca_sendiri" on public.user_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profil_tambah_sendiri" on public.user_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profil_ubah_sendiri" on public.user_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profil_hapus_sendiri" on public.user_profiles for delete to authenticated using ((select auth.uid()) = user_id);
create trigger user_profiles_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();

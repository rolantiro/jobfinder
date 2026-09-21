-- Phase 8 (peluncuran): 9 lowongan contoh fiktif dari Phase 2 disembunyikan dari publik, TIDAK dihapus.
-- Untuk menampilkannya lagi: update public.jobs set is_sample = false where is_sample;
alter table public.jobs add column if not exists is_sample boolean not null default false;
update public.jobs set is_sample = true where source_url is null and id between 1 and 9;
drop policy if exists "jobs_public_read" on public.jobs;
create policy "jobs_public_read" on public.jobs for select to anon, authenticated using (not is_sample);

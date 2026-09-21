-- Phase 7: lowongan tersimpan per pengguna. Hanya pemilik yang bisa melihat, menambah, dan menghapus barisnya.
create table public.saved_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);
create index saved_jobs_job_id_idx on public.saved_jobs (job_id);
alter table public.saved_jobs enable row level security;
create policy "simpan_baca_sendiri" on public.saved_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy "simpan_tambah_sendiri" on public.saved_jobs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "simpan_hapus_sendiri" on public.saved_jobs for delete to authenticated using ((select auth.uid()) = user_id);

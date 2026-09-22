-- Phase "Tambah dari Gambar": izinkan SATU pengguna (ditandai admin) menambah lowongan langsung dari browser.
-- is_admin TIDAK bisa diubah lewat aplikasi (hanya lewat SQL/dashboard Supabase), supaya pengguna tidak bisa menjadikan dirinya admin sendiri.
alter table public.user_profiles add column if not exists is_admin boolean not null default false;

-- Kunci kolom is_admin: pengguna biasa hanya boleh mengubah kolom profilnya sendiri, bukan is_admin.
revoke update on public.user_profiles from authenticated;
grant update (education, experience, skills, preferred_locations, preferred_titles, work_months, internship_months, parser_version)
  on public.user_profiles to authenticated;

-- Lowongan hanya boleh ditambah/diubah/dihapus oleh pengguna yang profilnya ditandai is_admin = true.
create policy "jobs_admin_insert" on public.jobs for insert to authenticated
  with check (exists (select 1 from public.user_profiles p where p.user_id = (select auth.uid()) and p.is_admin));
create policy "jobs_admin_update" on public.jobs for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.user_id = (select auth.uid()) and p.is_admin))
  with check (exists (select 1 from public.user_profiles p where p.user_id = (select auth.uid()) and p.is_admin));
create policy "jobs_admin_delete" on public.jobs for delete to authenticated
  using (exists (select 1 from public.user_profiles p where p.user_id = (select auth.uid()) and p.is_admin));

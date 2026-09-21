-- Phase 3: kunci deduplikasi (hash judul+perusahaan+kota yang sudah dinormalisasi).
alter table public.jobs add column if not exists dedupe_key text;
create unique index if not exists jobs_dedupe_key_key on public.jobs (dedupe_key);

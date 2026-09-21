# JobFinder

Agregator lowongan kerja bidang kesehatan (rekam medis, administrasi rumah sakit, pendaftaran, dll.) dengan pencocokan berbasis CV.
Situs statis (HTML/CSS/JS tanpa build tool) + Supabase. Semua berjalan di layanan gratis.

## Struktur
| Folder | Isi |
|---|---|
| `index.html`, `css/`, `js/` | Situs. `js/vendor/supabase.js` = supabase-js yang di-host sendiri (lihat `js/vendor/README.txt`) |
| `supabase/` | Migrasi SQL (001-005), sudah diterapkan ke proyek Supabase |
| `ingest/` | Skrip Node untuk memasukkan lowongan dari sumber publik yang legal (lihat komentar di `ingest/run.js`) |
| `scripts/` | `check-secrets.js` (pemindai rahasia), `build-site.js`, `keepalive.js` |
| `tests/` | Uji offline. Jalankan `npm test` |
| `.github/workflows/` | `deploy.yml` (uji + deploy) dan `keepalive.yml` |

## Jalankan lokal
```
python3 -m http.server 8000      # lalu buka http://localhost:8000
npm test                         # semua uji (butuh Node 18+)
```

## Deploy ke GitHub Pages (gratis)
GitHub Pages di paket gratis hanya untuk **repositori publik**, jadi semua berkas di repo bisa dilihat siapa pun.

1. Buat repositori **publik** kosong di GitHub (tanpa README/gitignore bawaan).
2. Di folder proyek ini:
   ```
   git init
   git add .
   git status                     # PASTIKAN ".env" tidak ada dalam daftar
   node scripts/check-secrets.js  # harus "OK"
   git commit -m "JobFinder"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```
3. GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**. Lalu buka tab **Actions**; jika deploy pertama belum jalan, klik "Run workflow" pada "Deploy ke GitHub Pages".
4. Alamat situs: `https://USERNAME.github.io/NAMA-REPO/`
5. **Supabase > Authentication > URL Configuration**: isi *Site URL* dengan alamat di atas, dan tambahkan alamat itu (serta `http://localhost:8000`) ke *Redirect URLs*. Tanpa ini, tautan konfirmasi email mengarah ke alamat yang salah.
6. Uji: buka situs, halaman Cari harus menulis "Sumber data: Supabase". Jika tertulis "dummy lokal", buka Console browser (F12).
7. Tab **Actions > Keepalive Supabase > Run workflow** satu kali untuk memastikan ping berhasil.

Yang dipublikasikan hanya `index.html`, `css/`, dan `js/` (lihat `scripts/build-site.js`). `ingest/`, `tests/`, dan `supabase/` tidak ikut ke situs.

## Keamanan
- `js/config.js` hanya berisi URL dan kunci **publishable** Supabase. Aman di frontend karena akses dibatasi Row Level Security.
- **Jangan pernah** commit `.env`, kunci `service_role`/`sb_secret_...`, atau API key AI. `.env` sudah di `.gitignore`, dan `check-secrets.js` menggagalkan deploy bila menemukan rahasia.
- Kunci `service_role` hanya dipakai skrip `ingest/` di komputer Anda lewat `.env`.
- Jika kunci rahasia sempat ter-commit: anggap bocor, buat ulang kuncinya di Supabase, jangan hanya menghapus commit-nya.

## Pihak ketiga yang dihubungi peramban pengunjung
- **Supabase** (data lowongan, login).
- **Google Fonts** (font; alamat IP pengunjung terlihat oleh Google).
- **cdnjs** (pdf.js dan mammoth, hanya dimuat saat pengguna mengunggah CV PDF/DOCX).
CV dibaca di peramban dan tidak diunggah. Tidak ada analitik.

## Batas dan risiko biaya
- **Supabase gratis**: proyek di-pause bila database tidak aktif ~1 minggu (dipulihkan lewat tombol Restore di dashboard, ada batas waktu pemulihan). `keepalive.yml` mengirim satu kueri ringan tiap 3 hari untuk mencegahnya; GitHub dapat menonaktifkan workflow terjadwal bila repositori lama tanpa aktivitas, dan dokumentasi Supabase tidak menjamin satu kueri cukup. Jaminan penuh hanya lewat paket berbayar.
- Maksimal 2 proyek gratis aktif per akun Supabase.
- Email konfirmasi bawaan Supabase sangat dibatasi jumlah kirimnya. Untuk banyak pengguna perlu SMTP sendiri.
- GitHub Pages: repositori publik, situs kecil ini jauh di bawah batas ukuran/bandwidth (cek batas terbaru di dokumentasi GitHub).

## Data lowongan
- Lowongan contoh fiktif (id 1-9) **disembunyikan** dari publik lewat kolom `is_sample` (`supabase/006_hide_samples.sql`), tidak dihapus. Untuk menampilkannya lagi: `update public.jobs set is_sample = false where is_sample;`
- Data awal berasal dari halaman karier resmi Primaya Hospital (`ingest/data/primaya-2026-09-21.json`), diringkas dengan kata-kata sendiri. Halaman itu tidak bertanggal, jadi lowongan bisa sudah ditutup.
- Menambah data: `node ingest/run.js --json berkas.json` (butuh `.env` dengan `SUPABASE_SERVICE_KEY`) atau `--url` untuk halaman lowongan publik yang mengizinkan robot.
- `DEMO_FALLBACK` di `js/config.js` harus tetap `false` di produksi: bila Supabase tak terjangkau, situs menampilkan pesan galat, bukan data contoh.

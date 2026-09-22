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
- Untuk halaman **indeks** yang menautkan ke halaman detail per posisi (bukan satu halaman berisi semua lowongan), gunakan `--listing <url> --link-pattern "<pola>"`. Sistem menemukan tautan baru sendiri dari halaman indeks itu setiap kali dijalankan — cocok untuk situs yang menambah posisi baru di URL baru setiap saat (seperti RS Pondok Indah). Di `ingest/sources.txt`, tulis baris `LISTING|<url>|<pola>`.
- `DEMO_FALLBACK` di `js/config.js` harus tetap `false` di produksi: bila Supabase tak terjangkau, situs menampilkan pesan galat, bukan data contoh.

## Otomatisasi harian (lowongan baru masuk sendiri)
`.github/workflows/ingest.yml` berjalan setiap hari (04:30 WIB) lewat GitHub Actions, membaca setiap URL di `ingest/sources.txt` dan memasukkan lowongan baru ke Supabase secara otomatis, tanpa n8n (Rp0, tidak perlu server menyala terus).

**Cara mengaktifkan (sekali saja):**
1. Di GitHub: **Settings > Secrets and variables > Actions > New repository secret**, buat secret bernama `SUPABASE_SERVICE_KEY`, isi dengan kunci **service_role** dari dashboard Supabase (**Settings > API Keys**). Jangan pernah menaruh kunci ini di kode atau file yang di-commit.
2. Tanpa langkah 1, workflow akan gagal dengan pesan jelas di tab Actions, bukan diam-diam tidak berjalan.
3. (Opsional) Untuk mengaktifkan AI pada halaman yang tidak punya data terstruktur (JSON-LD), tambahkan secret `AI_PROVIDER` = `gemini`, `GEMINI_API_KEY`, dan `AI_MODEL`. Tanpa ini, hanya halaman dengan markup `JobPosting` (schema.org) yang otomatis terambil.

**Yang perlu diketahui:**
- Hanya sumber di `ingest/sources.txt` yang diambil. Menambah sumber baru berarti menambah baris URL di file itu (halaman karier resmi rumah sakit yang mengizinkan robots.txt, bukan LinkedIn/JobStreet/Glints).
- Belum semua rumah sakit cocok untuk ini: beberapa (RS Hermina, Siloam) memuat lowongan lewat JavaScript sehingga tidak dapat diambil otomatis oleh skrip sederhana; beberapa pengumuman RSUD hanya berupa lampiran PDF tanpa rincian di halamannya. Sumber seperti ini perlu ditambahkan manual atau dilewati.
- Kegagalan pada satu sumber tidak menghentikan sumber lain; lihat riwayatnya di tab **Actions** repositori. Ini berlaku di dua tingkat: satu URL sumber yang gagal tidak menghentikan sumber lain, dan pada mode `--listing`, satu tautan lowongan yang gagal (mis. sudah dihapus) tidak menghentikan tautan lain di halaman indeks yang sama.
- Lowongan yang sudah tidak relevan (skor di bawah 40) atau duplikat otomatis dilewati, bukan dihapus dari sumbernya.


## Tambah lowongan dari gambar (khusus admin)
Di `#/admin`, admin bisa mengunggah foto/screenshot poster lowongan (mis. dari Instagram). Teks dibaca dengan OCR **di browser** (Tesseract.js dari cdnjs, gratis, gambar tidak diunggah ke server mana pun), lalu admin memeriksa/mengedit hasilnya sebelum menyimpan.

**Siapa yang bisa menjadi admin?** Hanya akun yang kolom `is_admin` di tabel `user_profiles` bernilai `true`. Kolom ini **tidak bisa diubah lewat aplikasi** (hak UPDATE atas kolom itu dicabut dari role `authenticated`, lihat `supabase/007_admin_write.sql`) — hanya bisa diubah lewat SQL Editor atau dashboard Supabase oleh Anda sendiri.

**Menjadikan seseorang admin:**
1. Orang itu harus sudah pernah masuk/daftar sekali di situs (halaman Profil), supaya barisnya ada di `user_profiles`.
2. Jalankan di Supabase SQL Editor: `update public.user_profiles set is_admin = true where user_id = (select id from auth.users where email = 'email-mereka@contoh.com');`

**Keterbatasan yang perlu diketahui:**
- Hasil OCR pada poster bergaya (font dekoratif, latar berwarna) sering tidak sempurna. Formulir tetap bisa diisi/diperbaiki manual sepenuhnya walau OCR gagal membaca apa pun.
- Kategori dan skor relevansi hanya tebakan awal dari judul dan teks poster; admin bisa mengubahnya sebelum menyimpan.
- `dedupe_key` dihitung dengan algoritma yang sama persis dengan `ingest/lib.js` (SHA-1 dari judul+perusahaan+lokasi yang dinormalisasi), sehingga lowongan yang sama tidak akan tercatat dua kali meski satu masuk lewat otomatisasi dan satu lewat halaman ini.

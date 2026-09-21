// Data DUMMY untuk Phase 1. Di Phase 2 diganti dengan data dari Supabase (tabel "jobs").
// "match" hanya contoh tampilan; di Phase 5-6 dihitung AI dari CV pengguna.
const CATS = ["Rekam Medis", "Administrasi Rumah Sakit", "Pendaftaran", "Perawat", "Apoteker", "Dokter", "IT", "Marketing", "Finance"];

// Kelompok kata yang dianggap setara saat mencari.
const SYNONYMS = [
  ["rekam medis", "medical record", "medical records", "perekam medis", "petugas rekam medis", "coder", "rme"],
  ["administrasi rumah sakit", "administrasi rs", "hospital admin", "admin rumah sakit"],
  ["pendaftaran", "registrasi", "admisi", "registration", "front office"],
  ["perawat", "nurse", "keperawatan"],
  ["apoteker", "pharmacist", "farmasi"],
  ["dokter", "doctor"],
  ["it", "simrs", "programmer", "developer", "sistem informasi"],
  ["marketing", "pemasaran", "sales"],
  ["finance", "keuangan", "akuntansi", "accounting"]
];

const JOBS = [
  { id: 1, title: "Staff Rekam Medis", company: "RS ABC", location: "Jakarta Selatan", city: "Jakarta", type: "Full Time", mode: "On-site", category: "Rekam Medis", tags: ["rekam medis", "icd-10", "rme"], hours: 2, source: "LinkedIn",
    summary: "Mengelola berkas rekam medis rawat jalan dan rawat inap, memastikan kelengkapan dokumen, dan mendukung pelaporan rumah sakit.",
    req: ["Minimal D3 Rekam Medis", "Memahami ICD-10", "Memahami sistem RME", "Mampu melakukan administrasi pasien"],
    match: { lvl: "high", score: 92, why: ["D3 Rekam Medis", "Pengalaman RME", "ICD-10", "Pengalaman rumah sakit"], gaps: [] } },
  { id: 2, title: "Medical Record Staff", company: "RS XYZ", location: "Bekasi", city: "Bekasi", type: "Full Time", mode: "On-site", category: "Rekam Medis", tags: ["medical record", "filing"], hours: 9, source: "Website RS XYZ",
    summary: "Melakukan filing, assembling, dan retensi berkas rekam medis serta membantu proses audit internal.",
    req: ["Minimal D3 Rekam Medis", "Pengalaman minimal 2 tahun", "Menguasai Microsoft Office"],
    match: { lvl: "high", score: 85, why: ["D3 Rekam Medis", "Pengalaman filing", "Microsoft Office"], gaps: ["Pengalaman minimal 2 tahun: informasi tidak ditemukan"] } },
  { id: 3, title: "Coder Rekam Medis", company: "RS Sehat Sentosa", location: "Jakarta Timur", city: "Jakarta", type: "Kontrak", mode: "On-site", category: "Rekam Medis", tags: ["coder", "icd-10", "icd-9-cm"], hours: 30, source: "Google Search",
    summary: "Melakukan pengkodean diagnosis dan tindakan menggunakan ICD-10 dan ICD-9-CM untuk klaim pasien.",
    req: ["D3 Rekam Medis", "Menguasai ICD-10 dan ICD-9-CM", "Teliti dan disiplin"],
    match: { lvl: "high", score: 90, why: ["D3 Rekam Medis", "ICD-10", "ICD-9-CM"], gaps: [] } },
  { id: 4, title: "Petugas Pendaftaran Pasien", company: "Klinik Pratama Medika", location: "Bandar Lampung", city: "Lampung", type: "Full Time", mode: "On-site", category: "Pendaftaran", tags: ["pendaftaran", "front office"], hours: 52, source: "JobStreet",
    summary: "Melayani pendaftaran pasien baru dan lama, verifikasi data, serta koordinasi dengan poli.",
    req: ["Minimal D3 kesehatan atau SMA sederajat", "Komunikatif dan ramah", "Familiar dengan SIMRS"],
    match: { lvl: "mid", score: 70, why: ["Pengalaman pendaftaran pasien", "Latar belakang kesehatan"], gaps: ["Pengalaman SIMRS: informasi tidak ditemukan"] } },
  { id: 5, title: "Staff Administrasi Rumah Sakit", company: "RS Harapan Bunda", location: "Tangerang", city: "Tangerang", type: "Full Time", mode: "On-site", category: "Administrasi Rumah Sakit", tags: ["administrasi", "rumah sakit"], hours: 75, source: "Glints",
    summary: "Mengelola surat-menyurat, arsip, dan laporan administrasi unit pelayanan.",
    req: ["Minimal D3 semua jurusan", "Menguasai Microsoft Office", "Pengalaman di fasilitas kesehatan menjadi nilai tambah"],
    match: { lvl: "pot", score: 55, why: ["Pengalaman administrasi", "Microsoft Office"], gaps: ["Pengalaman di rumah sakit: informasi tidak ditemukan"] } },
  { id: 6, title: "Admin Data Klaim BPJS", company: "RS Mitra Keluarga Bekasi", location: "Bekasi", city: "Bekasi", type: "Kontrak", mode: "On-site", category: "Administrasi Rumah Sakit", tags: ["klaim", "bpjs", "administrasi"], hours: 120, source: "LinkedIn",
    summary: "Menyiapkan berkas klaim BPJS, memeriksa kelengkapan, dan berkoordinasi dengan tim coder.",
    req: ["D3 Rekam Medis atau Kesehatan", "Memahami INA-CBG", "Teliti dengan angka"],
    match: { lvl: "mid", score: 68, why: ["D3 Rekam Medis", "Pemahaman kode diagnosis"], gaps: ["Pemahaman INA-CBG: informasi tidak ditemukan"] } },
  { id: 7, title: "Perawat Pelaksana", company: "RS Cipta Husada", location: "Jakarta Barat", city: "Jakarta", type: "Full Time", mode: "On-site", category: "Perawat", tags: ["perawat", "nurse"], hours: 200, source: "Website RS Cipta Husada",
    summary: "Memberikan asuhan keperawatan di ruang rawat inap sesuai standar.",
    req: ["D3 atau Ners Keperawatan", "STR aktif", "Bersedia shift"],
    match: { lvl: "low", score: 10, why: [], gaps: ["Kualifikasi keperawatan: informasi tidak ditemukan"] } },
  { id: 8, title: "Staff IT SIMRS", company: "RS Bunda Kasih", location: "Surabaya", city: "Surabaya", type: "Full Time", mode: "On-site", category: "IT", tags: ["simrs", "it support"], hours: 260, source: "Google Search",
    summary: "Mendukung operasional SIMRS, menangani kendala pengguna, dan memelihara jaringan lokal.",
    req: ["D3/S1 Teknik Informatika atau Sistem Informasi", "Memahami basis data", "Pengalaman SIMRS"],
    match: { lvl: "pot", score: 45, why: ["Pengalaman sistem informasi kesehatan"], gaps: ["Latar belakang teknik informatika: informasi tidak ditemukan"] } },
  { id: 9, title: "Health Information Officer (Remote)", company: "Klinik Digital Sehat", location: "Remote, Indonesia", city: "Remote", type: "Part Time", mode: "Remote", category: "Rekam Medis", tags: ["medical records", "health information", "rme"], hours: 500, source: "Glints",
    summary: "Memelihara kualitas data rekam medis elektronik dan menyusun laporan statistik bulanan.",
    req: ["Latar belakang Rekam Medis dan Informasi Kesehatan", "Menguasai Excel", "Memahami statistik kesehatan"],
    match: { lvl: "high", score: 88, why: ["D3 Rekam Medis dan Informasi Kesehatan", "Statistik kesehatan", "RME"], gaps: [] } }
];

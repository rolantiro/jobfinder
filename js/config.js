// Kunci PUBLISHABLE aman ada di frontend karena akses dibatasi RLS (hanya baca).
// JANGAN PERNAH menaruh service_role / secret key di file ini atau di GitHub.
window.JF_CONFIG = {
  SUPABASE_URL: "https://smrrtewmwporecppofkj.supabase.co",
  DEMO_FALLBACK: false,   // true = tampilkan data contoh lokal bila Supabase tak terjangkau (hanya untuk pengembangan)
  SUPABASE_KEY: "sb_publishable_c4s_aLWoHNyWvKwOOVJqkQ_jjSQocHP"
};

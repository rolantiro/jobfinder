// Mengirim satu kueri ringan ke Supabase agar proyek gratis tidak di-pause karena tidak aktif. Dipakai oleh .github/workflows/keepalive.yml
const fs = require("fs"), path = require("path"), w = {};
new Function("window", fs.readFileSync(path.join(__dirname, "../js/config.js"), "utf8"))(w);
const { SUPABASE_URL: u, SUPABASE_KEY: k } = w.JF_CONFIG || {}, delay = +process.env.KEEPALIVE_DELAY_MS || 5000;
if (!u || !k) { console.error("js/config.js belum berisi SUPABASE_URL dan SUPABASE_KEY."); process.exit(1); }
(async () => {
  for (let i = 1; i <= 3; i++) {
    try { const r = await fetch(`${u}/rest/v1/jobs?select=id&limit=1`, { headers: { apikey: k }, signal: AbortSignal.timeout(20000) }); console.log("HTTP", r.status); if (r.ok) return; }
    catch (e) { console.log(`percobaan ${i} gagal: ${e.message}`); }
    await new Promise(r => setTimeout(r, delay * i));
  }
  console.error("Gagal menjangkau Supabase. Proyek mungkin sudah di-pause: buka dashboard Supabase lalu klik Restore.");
  process.exit(1);
})();

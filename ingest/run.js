#!/usr/bin/env node
// Pipeline ingestion. Contoh:
//   node ingest/run.js --url https://situs-rs.co.id/karir/staff-rekam-medis --dry
//   node ingest/run.js --urls-file urls.txt
//   node ingest/run.js --json jobs.json          (array lowongan yang Anda siapkan sendiri)
//   node ingest/run.js --text lowongan.txt --source-url https://... --source-name "Grup Facebook"   (butuh AI)
const fs = require("fs");
try { for (const l of fs.readFileSync(__dirname + "/../.env", "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
const L = require("./lib"), AI = require("./ai");

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const many = n => args.flatMap((x, i) => x === n ? [args[i + 1]] : []);
const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY, MIN = +opt("--min-score", 40);
const DRY = args.includes("--dry") || !KEY || !SB;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

async function existing() {
  if (!KEY || !SB) return [];
  const r = await fetch(`${SB}/rest/v1/jobs?select=title,company,city,source_url,dedupe_key&limit=5000`, { headers: H });
  if (!r.ok) throw new Error("gagal membaca tabel jobs: HTTP " + r.status);
  return r.json();
}
async function insert(row) {
  const r = await fetch(`${SB}/rest/v1/jobs?on_conflict=dedupe_key`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`insert gagal: HTTP ${r.status} ${(await r.text()).slice(0, 150)}`);
}

async function candidates(it) {
  if (it.json) return [{ job: it.json, meta: { source_name: it.json.source_name || "Input manual", source_url: it.json.source_url } }];
  if (it.url) {
    const html = await L.fetchPage(it.url), name = new URL(it.url).hostname.replace(/^www\./, ""), ld = L.jsonLdJobs(html);
    if (ld.length) return ld.map((job, i) => ({ job, meta: { source_name: name, source_url: ld.length > 1 ? `${it.url}#${i + 1}` : it.url } }));
    return [{ raw: L.pageText(html), meta: { source_name: name, source_url: it.url } }];
  }
  return [{ raw: it.text, meta: it.meta }];
}

(async () => {
  const items = [...many("--url"), ...(opt("--urls-file") ? fs.readFileSync(opt("--urls-file"), "utf8").split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#")) : [])].map(url => ({ url }));
  if (opt("--json")) JSON.parse(fs.readFileSync(opt("--json"), "utf8")).forEach(json => items.push({ json }));
  if (opt("--text")) items.push({ text: fs.readFileSync(opt("--text"), "utf8").slice(0, 6000), meta: { source_name: opt("--source-name", "Input manual"), source_url: opt("--source-url") } });
  if (!items.length) return console.log("Tidak ada input. Lihat komentar di atas file ini untuk contoh perintah.");

  const pool = await existing(), stat = { baru: 0, duplikat: 0, ditolak: 0, gagal: 0 };
  console.log(DRY ? "MODE DRY-RUN: tidak menulis ke database.\n" : "Menulis ke Supabase.\n");
  for (const it of items) {
    const label = it.url || (it.json && it.json.title) || "teks";
    try {
      for (const c of await candidates(it)) {
        let job = c.job;
        if (c.raw) {
          if (!AI.enabled()) throw new Error("halaman tanpa data terstruktur: set AI_PROVIDER di .env atau pakai --json");
          const ai = await AI.extract(c.raw, c.meta);
          await L.sleep(+process.env.AI_DELAY_MS || 7000); // hormati batas request per menit free tier
          if (!ai || ai.is_job_posting === false) { stat.ditolak++; console.log("✗ bukan lowongan:", label); continue; }
          job = ai;
        }
        const row = L.finalize(job, c.meta);
        if (row.ai_relevance_score < MIN) { stat.ditolak++; console.log(`✗ kurang relevan (${row.ai_relevance_score}): ${row.title}`); continue; }
        const dup = L.findDuplicate(row, pool);
        if (dup) { stat.duplikat++; console.log(`≈ duplikat (${dup}): ${row.title}`); continue; }
        if (!DRY) await insert(row);
        pool.push(row); stat.baru++;
        console.log(`✓ ${DRY ? "akan ditambahkan" : "ditambahkan"}: ${row.title} | ${row.company} | ${row.city || "-"} | ${row.category} | skor ${row.ai_relevance_score}`);
      }
    } catch (e) { stat.gagal++; console.log(`⚠ ${label}: ${e.message}`); }
  }
  console.log("\nRingkasan:", stat);
})();

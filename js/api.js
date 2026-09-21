// Lapisan data: Supabase bila tersedia, jika tidak (atau gagal) memakai data dummy lokal (js/data.js).
const LOCAL = JOBS;
const cfg = window.JF_CONFIG || {};
const sb = cfg.SUPABASE_URL && cfg.SUPABASE_KEY && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY) : null;

// Kecocokan dihitung di browser oleh js/matcher.js bila pengguna punya profil CV.
const norm = r => ({ id: r.id, title: r.title, company: r.company, location: r.location, city: r.city, type: r.employment_type, mode: r.work_mode,
  category: r.category, tags: r.tags || [], hours: (Date.now() - new Date(r.discovered_date)) / 36e5, source: r.source_name,
  summary: r.description, req: r.requirements || [], url: r.source_url, match: null });

const FIELD = { city: "city", category: "category", type: "employment_type", mode: "work_mode", source: "source_name" };

function localJobs(f) {
  return LOCAL.filter(j => Object.keys(FIELD).every(k => !f[k] || j[k] === f[k]) && (!f.hours || j.hours <= f.hours)).slice(0, f.limit || 100);
}

// f: { terms, city, category, type, mode, source, hours, limit }. Kata kunci dipersempit di server (ilike),
// lalu disaring lagi di browser (app.js: kw) agar kata pendek seperti "it" tidak cocok sembarangan.
async function apiJobs(f = {}) {
  if (!sb) return { rows: localJobs(f), src: "dummy lokal" };
  try {
    let q = sb.from("jobs").select("*");
    if (f.terms && f.terms.length) {
      const t = f.terms.map(x => x.replace(/[,()%*"\\]/g, " ").trim()).filter(Boolean);
      q = q.or(t.flatMap(x => [`title.ilike.%${x}%`, `category.ilike.%${x}%`, `tags.cs.{"${x}"}`]).join(","));
    }
    Object.keys(FIELD).forEach(k => { if (f[k]) q = q.eq(FIELD[k], f[k]); });
    if (f.hours) q = q.gte("discovered_date", new Date(Date.now() - f.hours * 36e5).toISOString());
    const { data, error } = await q.order("discovered_date", { ascending: false }).limit(f.limit || 100);
    if (error) throw error;
    return { rows: data.map(norm), src: "Supabase" };
  } catch (e) {
    console.warn("Supabase gagal, memakai data dummy:", e);
    return cfg.DEMO_FALLBACK ? { rows: localJobs(f), src: "dummy lokal (Supabase tidak terjangkau)" } : { rows: [], src: "error" };   // produksi: jangan tampilkan data contoh sebagai lowongan nyata
  }
}

async function apiJob(id) {
  if (sb) {
    try {
      const { data, error } = await sb.from("jobs").select("*").eq("id", +id).maybeSingle();
      if (error) throw error;
      return data ? norm(data) : null;
    } catch (e) { console.warn("Supabase gagal, memakai data dummy:", e); }
  }
  return !sb || cfg.DEMO_FALLBACK ? LOCAL.find(j => j.id === +id) || null : null;
}

// Fungsi inti Phase 3: pengambilan halaman yang patuh robots.txt, ekstraksi JSON-LD, klasifikasi, deduplikasi.
const crypto = require("crypto");
const UA = process.env.BOT_UA || "JobFinderBot/0.1";
// Situs yang ToS-nya umumnya melarang pengambilan otomatis. Diblokir secara default.
const BLOCKED = ["linkedin.com", "jobstreet.co.id", "jobstreet.com", "glints.com", "seek.com"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isBlocked = url => { const h = new URL(url).hostname.toLowerCase(); return BLOCKED.some(d => h === d || h.endsWith("." + d)); };

// ---- robots.txt (aturan terpanjang menang; Allow menang jika seri) ----
function robotsAllows(txt, path, ua = UA) {
  const token = ua.split(/[\/ ]/)[0].toLowerCase(), groups = []; let cur = null, prevUA = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim(), i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim();
    if (k === "user-agent") { if (!prevUA) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); prevUA = true; }
    else { prevUA = false; if (cur && (k === "allow" || k === "disallow")) cur.rules.push([k, v]); }
  }
  let g = groups.filter(x => x.agents.some(a => a !== "*" && token.includes(a)));
  if (!g.length) g = groups.filter(x => x.agents.includes("*"));
  let best = null;
  for (const [k, v] of g.flatMap(x => x.rules)) {
    if (!v) continue;
    const end = v.endsWith("$"), body = end ? v.slice(0, -1) : v;
    const re = new RegExp("^" + body.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + (end ? "$" : ""));
    if (re.test(path) && (!best || body.length > best.len || (body.length === best.len && k === "allow"))) best = { len: body.length, allow: k === "allow" };
  }
  return best ? best.allow : true;
}

async function get(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,text/plain" }, signal: AbortSignal.timeout(15000), redirect: "follow" });
  if (isBlocked(r.url)) throw new Error("dialihkan ke domain yang diblokir");
  return r;
}

async function fetchPage(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error("hanya http/https");
  if (isBlocked(url)) throw new Error(`${u.hostname} diblokir: ToS situs ini umumnya melarang pengambilan otomatis. Salin teks lowongannya lalu pakai --text.`);
  const rb = await get(u.origin + "/robots.txt");
  if (rb.ok) { if (!robotsAllows(await rb.text(), u.pathname + u.search)) throw new Error("dilarang oleh robots.txt"); }
  else if (![404, 410].includes(rb.status)) throw new Error(`robots.txt tidak bisa dibaca (${rb.status}), dilewati demi keamanan`);
  await sleep(1500); // jeda sopan antar permintaan
  const r = await get(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  if (!/html|text/.test(r.headers.get("content-type") || "")) throw new Error("bukan halaman HTML");
  return (await r.text()).slice(0, 1500000);
}

// ---- teks & JSON-LD (schema.org/JobPosting) ----
const decode = s => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
const text = h => { let s = String(h || ""); for (let i = 0; i < 2; i++) s = decode(s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")); return s.replace(/\s+/g, " ").trim(); };
const pageText = html => text(html).slice(0, 6000);
const EMP = { FULL_TIME: "Full Time", PART_TIME: "Part Time", CONTRACTOR: "Kontrak", TEMPORARY: "Kontrak", INTERN: "Magang" };

function fromJsonLd(o) {
  const loc = [].concat(o.jobLocation || [])[0] || {}, a = loc.address || {}, addr = typeof a === "string" ? { addressLocality: a } : a;
  const org = o.hiringOrganization, sal = (o.baseSalary && o.baseSalary.value) || {};
  const reqs = [o.qualifications, o.skills, o.educationRequirements, o.experienceRequirements].map(x => typeof x === "string" ? x : x && x.description)
    .filter(Boolean).flatMap(x => text(x).split(/[;•]+/)).map(s => s.trim()).filter(Boolean);
  return { title: text(o.title), company: text(typeof org === "string" ? org : org && org.name), location: [addr.addressLocality, addr.addressRegion].filter(Boolean).join(", "),
    city: addr.addressLocality || "", description: text(o.description).slice(0, 600), requirements: reqs.slice(0, 10), posted_date: o.datePosted || null,
    employment_type: EMP[[].concat(o.employmentType || [])[0]] || null, work_mode: o.jobLocationType === "TELECOMMUTE" ? "Remote" : "On-site",
    salary_min: Number(sal.minValue) || null, salary_max: Number(sal.maxValue) || null };
}

function jsonLdJobs(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let d; try { d = JSON.parse(m[1].trim()); } catch { continue; }
    const walk = n => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === "object") { if ([].concat(n["@type"] || []).includes("JobPosting")) out.push(n); walk(n["@graph"]); } };
    walk(d);
  }
  return out.map(fromJsonLd);
}

// ---- klasifikasi berbasis aturan (tanpa AI) ----
const RULES = [["Rekam Medis", /rekam medi[sk]|medical record|perekam|coder|health information|informasi kesehatan/i], ["Pendaftaran", /pendaftaran|registrasi|admisi|admission|registration|front office/i],
  ["Administrasi Rumah Sakit", /administrasi|admin\b|klaim|bpjs|sekretaris/i], ["Perawat", /perawat|nurse|keperawatan|bidan/i], ["Apoteker", /apoteker|farmasi|pharmac/i],
  ["Dokter", /\bdokter\b|doctor|physician/i], ["IT", /\bit\b|simrs|programmer|developer|sistem informasi/i], ["Marketing", /marketing|pemasaran|sales/i], ["Finance", /finance|keuangan|akuntan|accounting/i]];
const HEALTH = /rumah sakit|\brs\b|rsu|klinik|puskesmas|hospital|clinic|kesehatan|medis|health|farmasi|laboratorium/i;
const CORE = ["Rekam Medis", "Pendaftaran", "Administrasi Rumah Sakit"];
function classify(j) {
  const t = j.title || "", hit = RULES.find(([, re]) => re.test(t)), cat = hit ? hit[0] : "Lainnya";
  const ctx = `${t} ${j.company || ""} ${(j.description || "").slice(0, 500)}`;
  return { category: cat, score: Math.min(100, (hit ? 35 : 10) + (HEALTH.test(ctx) ? 55 : 0) + (CORE.includes(cat) ? 10 : 0)) };
}

// ---- rapikan + validasi (data dari web/AI dianggap tidak tepercaya) ----
const cut = (v, n) => v == null || v === "" ? null : String(v).slice(0, n);
const date = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };
const url = v => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
const TAGS = ["icd-10", "icd-9", "rme", "simrs", "bpjs", "filing", "coder", "ina-cbg"];
function finalize(j, meta) {
  const c = classify(j), blob = `${j.title} ${j.description || ""} ${(j.requirements || []).join(" ")}`.toLowerCase();
  const cat = j.category && j.category !== "Lainnya" ? j.category : c.category, rel = Number(j.relevance_score);
  const row = { title: cut(j.title, 200), company: cut(j.company, 200), location: cut(j.location, 200), city: cut(j.city, 100), description: cut(j.description, 800),
    requirements: (Array.isArray(j.requirements) ? j.requirements : []).slice(0, 12).map(x => cut(x, 200)).filter(Boolean), source_name: cut(meta.source_name, 100),
    source_url: url(meta.source_url || j.source_url), posted_date: date(j.posted_date), category: cut(cat, 60), salary_min: Number(j.salary_min) || null, salary_max: Number(j.salary_max) || null,
    employment_type: cut(j.employment_type, 40), work_mode: cut(j.work_mode, 40), tags: [...new Set([cat.toLowerCase(), ...TAGS.filter(t => blob.includes(t))])],
    ai_relevance_score: Number.isFinite(rel) ? Math.max(0, Math.min(100, Math.round(rel))) : c.score };
  if (!row.title || !row.company) throw new Error("judul atau perusahaan kosong");
  row.dedupe_key = dedupeKey(row);
  return row;
}

// ---- deduplikasi ----
const clean = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/rumah sakit|\brsu\b|\brsud\b/g, "rs").replace(/\b(pt|cv|tbk)\b/g, " ").replace(/\s+/g, " ").trim();
const dedupeKey = j => crypto.createHash("sha1").update(`${clean(j.title)}|${clean(j.company)}|${clean(j.city || j.location)}`).digest("hex").slice(0, 32);
const tokens = j => new Set(`${clean(j.title)} ${clean(j.company)}`.split(" ").filter(Boolean));
const jaccard = (a, b) => { let n = 0; a.forEach(x => b.has(x) && n++); return n / (a.size + b.size - n || 1); };
// Mengembalikan alasan duplikat, atau null bila lowongan baru. pool = baris yang sudah ada di DB + yang sudah diproses.
function findDuplicate(row, pool, th = 0.8) {
  const t = tokens(row), c = clean(row.city);
  for (const p of pool) {
    if (p.dedupe_key && p.dedupe_key === row.dedupe_key) return "kunci sama";
    if (row.source_url && p.source_url === row.source_url) return "tautan sama";
    if ((!c || !p.city || clean(p.city) === c) && jaccard(t, tokens(p)) >= th) return "mirip: " + p.title + " (" + p.company + ")";
  }
  return null;
}

module.exports = { UA, sleep, isBlocked, robotsAllows, fetchPage, jsonLdJobs, pageText, classify, finalize, dedupeKey, findDuplicate };

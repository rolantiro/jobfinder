// Mesin matching CV <-> lowongan. Deterministik, dapat dijelaskan, tanpa API luar.
// Bukan pencocokan kata kunci: setiap lowongan dianalisis (posisi, persyaratan, konsep) lalu dibandingkan dengan profil.
(function (g) {
  const O = g.JFO || require("./ontology");
  const lc = s => String(s || "").toLowerCase(), clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ST = { met: 1, partial: 0.5, no: 0 };
  const W = { role: 25, edu: 20, skills: 20, exp: 10, reqs: 15, loc: 10 };   // dimensi tanpa data dikeluarkan lalu bobot dinormalkan
  const dur = x => x < 1 ? `${Math.round(x * 30)} hari` : `${String(Math.round(x * 10) / 10).replace(".", ",")} bulan`;
  const ids = a => a.map(id => O.CON[id].label).join(", ");

  function prep(p) {
    const c = new Set(), f = new Set(), ex = p.experience || [], edu = p.education || [];
    (p.skills || []).forEach(s => { c.add(s.id); (O.IMPL_C[s.id] || []).forEach(x => c.add(x)); });
    edu.forEach(e => (e.fields || []).forEach(x => { f.add(x); (O.IMPL_F[x] || []).forEach(y => f.add(y)); }));
    const sum = (k, h) => ex.filter(e => e.kind === k && (!h || e.health)).reduce((a, e) => a + e.months, 0);
    return { ...p, education: edu, experience: ex, _c: c, _f: f, maxLevel: Math.max(0, ...edu.map(e => e.rank)), hasExp: ex.length > 0,
      work: sum("work"), intern: sum("internship"), healthWork: sum("work", 1), healthIntern: sum("internship", 1) };
  }
  const eduLabel = c => { const e = [...c.education].sort((x, y) => y.rank - x.rank)[0]; return e.rank <= 1 ? "SMA/SMK" : `${e.level} ${e.field}`.trim(); };   // jenjang tertinggi saja

  // Satu baris persyaratan -> jenis + isi terstruktur
  function parseReq(text) {
    const l = lc(text), lv = O.levels(l), fields = O.scan(l, O.EDU_TABLE), cons = O.scan(l, O.C_TABLE);
    const yrs = l.match(/(\d+)\s*\+?\s*(?:tahun|thn|years?|yrs?)/);
    const r = { text, kind: "other", levels: lv, fields, anyField: /semua jurusan|segala jurusan|semua bidang|all majors/.test(l), certs: cons.filter(x => O.CON[x].kind === "cert"),
      skills: cons.filter(x => O.CON[x].kind !== "cert"), optional: /nilai tambah|diutamakan|menjadi plus|preferred|lebih disukai/.test(l) };
    if ((yrs && /pengalaman|experience|berpengalaman/.test(l)) || /^\s*pengalaman/.test(l)) { r.kind = "exp"; r.years = yrs ? +yrs[1] : 0; }
    else if (lv.length || (fields.length && /pendidikan|lulusan|latar belakang|jurusan/.test(l))) r.kind = "edu";
    else if (r.certs.length) r.kind = "cert";
    else if (r.skills.length) r.kind = "skill";
    return r;
  }

  function evalReq(r, c) {
    if (r.kind === "edu") {
      if (!c.education.length) return { st: "unknown", note: "pendidikan tidak ditemukan di CV" };
      const min = r.levels.length ? Math.min(...r.levels) : 0, lvOK = c.maxLevel >= min;
      const fOK = r.anyField || !r.fields.length || min === 1 || r.fields.some(f => c._f.has(f));
      return lvOK && fOK ? { st: "met", note: eduLabel(c) } : { st: "no", note: `pendidikan di CV: ${eduLabel(c)}`, fieldFail: !fOK };
    }
    if (r.kind === "exp") {
      if (!c.hasExp) return { st: "unknown", note: "pengalaman tidak ditemukan di CV" };
      if (!r.years) return c.healthWork ? { st: "met", note: "" } : c.healthIntern ? { st: "partial", note: "" } : { st: "no", note: "belum ditemukan di CV" };
      const need = r.years * 12, im = c.intern ? ` dan ±${dur(c.intern)} PKL/magang` : "";
      return c.work >= need ? { st: "met", note: `±${dur(c.work)} pengalaman kerja` }
        : { st: c.work >= need / 2 ? "partial" : "no", note: `CV menunjukkan ±${dur(c.work)} pengalaman kerja${im}` };
    }
    if (r.kind === "cert") { const miss = r.certs.filter(x => !c._c.has(x)); return miss.length ? { st: "no", note: "belum ditemukan di CV" } : { st: "met", note: "" }; }
    if (r.kind === "skill") {
      const hit = r.skills.filter(x => c._c.has(x)), miss = r.skills.filter(x => !c._c.has(x)), soft = r.skills.every(x => O.CON[x].kind === "soft");
      if (!miss.length) return { st: "met", note: "" };
      if (soft) return { st: "unknown", note: "" };
      return { st: hit.length ? "partial" : "no", note: `belum ditemukan di CV: ${ids(miss)}` };
    }
    return { st: "unknown", note: "" };
  }

  function analyze(j) {
    const reqLines = j.req || j.requirements || [], reqs = reqLines.map(parseReq);
    const concepts = new Set(O.scan([j.title, j.summary || j.description, ...reqLines].join(" . "), O.C_TABLE).filter(x => O.CON[x].kind !== "soft"));
    let fam = O.titleFamily(j.title);
    if (!fam) { const best = O.FAM.map(f => [f, f.core.filter(x => concepts.has(x)).length]).sort((a, b) => b[1] - a[1])[0]; if (best && best[1] >= 2) fam = best[0]; }
    return { reqs, concepts, fam };
  }

  function affinity(c, F) {
    const edu = Math.max(0, ...Object.entries(F.edu).map(([f, w]) => c._f.has(f) ? w : 0));
    const cov = clamp(F.core.filter(x => c._c.has(x)).length / Math.max(2, Math.ceil(F.core.length / 2)));
    const th = c.experience.some(e => F.title.test(lc(e.title))) ? 1 : 0;
    return clamp(0.45 * edu + 0.35 * cov + 0.2 * th);
  }

  function match(profile, job) {
    if (!profile) return null;
    const c = prep(profile), a = analyze(job), F = a.fam;
    const req = a.reqs.map(r => ({ r, ...evalReq(r, c) }));
    const famCov = F ? clamp(F.core.filter(x => c._c.has(x)).length / Math.max(2, Math.ceil(F.core.length / 2))) : 0;
    const jc = [...a.concepts], hits = jc.filter(x => c._c.has(x)), hitRatio = jc.length ? hits.length / jc.length : 0;
    const aff = F ? affinity(c, F) : 0.55 * hitRatio;
    const eduR = req.filter(x => x.r.kind === "edu" && x.st !== "unknown");
    const yr = a.reqs.find(r => r.kind === "exp" && r.years), ind = c.healthWork ? 1 : c.healthIntern ? 0.6 : 0;
    const rq = req.filter(x => ["exp", "cert", "skill"].includes(x.r.kind) && x.st !== "unknown"), wt = x => (x.r.kind === "skill" ? 1 : 1.5) * (x.r.optional ? 0.5 : 1);
    const locs = (c.preferred_locations || []).map(lc), city = lc(job.city), locOK = locs.length ? (job.mode === "Remote" || locs.some(x => city.includes(x) || lc(job.location).includes(x))) : null;
    const d = {
      role: aff,
      edu: eduR.length ? eduR.reduce((s, x) => s + ST[x.st], 0) / eduR.length : (c.education.length && F ? Math.max(0, ...Object.entries(F.edu).map(([f, w]) => c._f.has(f) ? w : 0)) : null),
      skills: jc.length ? 0.6 * hitRatio + 0.4 * famCov : (F ? famCov : null),
      exp: c.hasExp ? (yr ? 0.5 * ind + 0.5 * clamp(c.work / (yr.years * 12)) : ind) : null,
      reqs: rq.length ? rq.reduce((s, x) => s + wt(x) * ST[x.st], 0) / rq.reduce((s, x) => s + wt(x), 0) : null,
      loc: locOK === null ? null : locOK ? 1 : 0
    };
    let ws = 0, tot = 0; for (const k in W) if (d[k] != null) { ws += W[k]; tot += W[k] * d[k]; }
    let score = Math.round(ws ? tot / ws * 100 : 0), cap = 100; const gates = [];

    if (F && F.licensed && !Object.entries(F.edu).some(([f, w]) => w === 1 && c._f.has(f))) {
      cap = Math.min(cap, 30);
      gates.push(`Posisi ${F.label.toLowerCase()} membutuhkan pendidikan/STR khusus yang tidak tercantum di CV. Kesamaan lingkungan kerja (rumah sakit) saja tidak cukup.`);
    }
    if (aff < 0.25 && !gates.length) { cap = Math.min(cap, 34); gates.push("Latar belakang dan skill di CV kurang selaras dengan posisi ini."); }
    if (eduR.some(x => x.st === "no" && x.fieldFail)) { cap = Math.min(cap, 54); gates.push("Bidang pendidikan yang diminta berbeda dengan pendidikan di CV."); }
    score = Math.min(score, cap);
    if (aff < 0.75) score = Math.min(score, 71);   // 'Sangat Relevan' hanya untuk posisi yang benar-benar dekat
    const lvl = score >= 72 && aff >= 0.75 ? "high" : score >= 52 ? "mid" : score >= 35 ? "pot" : "low";

    const why = [], gaps = [...gates];
    if (lvl !== "low") {
      if (F && aff >= 0.5) why.push(`Posisi ${F.label.toLowerCase()} selaras dengan latar belakang Anda`);
      eduR.filter(x => x.st === "met").slice(0, 1).forEach(x => why.push(`Pendidikan sesuai (${x.note})`));
      if (hits.length) why.push(`Skill sesuai: ${ids(hits)}`);
      if (c.healthWork) why.push(`Memiliki pengalaman kerja di bidang kesehatan (±${dur(c.healthWork)})`);
      else if (c.healthIntern) why.push(`Memiliki pengalaman PKL/magang di bidang kesehatan (±${dur(c.healthIntern)})`);
      if (locOK) why.push(job.mode === "Remote" ? "Lowongan remote" : "Lokasi sesuai preferensi Anda");
    }
    let soft = 0;
    req.forEach(x => {
      if (x.r.optional) return;
      if (x.st === "no") gaps.push(`${x.r.text}: ${x.note}`);
      else if (x.st === "unknown" && ["edu", "exp", "cert"].includes(x.r.kind)) gaps.push(`${x.r.text}: informasi tidak ditemukan di CV`);
      else if (x.st === "unknown") soft++;
    });
    const missSk = jc.filter(x => !c._c.has(x) && !req.some(q => q.r.skills.includes(x)));
    if (lvl !== "low" && missSk.length) gaps.push(`Disebut di lowongan tetapi belum ada di CV: ${ids(missSk)}`);
    return { score, lvl, aff, why, gaps, gates, family: F ? F.label : null, dims: d,
      notes: soft ? [`${soft} persyaratan lain (mis. sikap kerja) tidak dapat diverifikasi dari CV`] : [], locKnown: locOK !== null };
  }

  const rank = (profile, jobs) => jobs.map(j => ({ j, m: match(profile, j) })).sort((a, b) => b.m.score - a.m.score || (a.j.hours || 0) - (b.j.hours || 0));
  const api = { match, rank, analyze, parseReq, prep, dur };
  if (typeof module !== "undefined") module.exports = api; else g.JFM = api;
})(typeof window !== "undefined" ? window : globalThis);

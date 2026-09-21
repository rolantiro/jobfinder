// Membaca teks CV menjadi profil kandidat. Berjalan di browser (dan Node untuk uji). CV tidak dikirim ke server.
(function (g) {
  const O = g.JFO || require("./ontology");
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
  const HEAD = [["edu", /^(riwayat\s+)?(pendidikan|education)/],
    ["intern", /^(pengalaman\s+)?(pkl|magang|praktik\s+kerja|praktek\s+kerja|internship|on[\s-]the[\s-]job)/], ["org", /^(pengalaman\s+)?(organisasi|kepanitiaan)|^organization/],
    ["exp", /^(pengalaman\s+(kerja|profesional)|pengalaman$|riwayat\s+(pekerjaan|kerja)|work\s+experience|professional\s+experience|employment)/], ["project", /^(project|proyek)/],
    ["skill", /^(keahlian|skills?|kemampuan|kompetensi|keterampilan|soft\s*skills?|hard\s*skills?|software)/], ["cert", /^(sertifi\w+|pelatihan|training|certification|kursus)/],
    ["other", /^(profil|ringkasan|summary|tentang|data\s+pribadi|kontak|contact|referensi|bahasa|languages?|penghargaan|prestasi)/]];
  const M = "(jan|feb|mar|apr|mei|may|jun|jul|agu|agt|aug|sep|okt|oct|nov|des|dec)[a-z]*\\.?";
  const RANGE = new RegExp(`(?:${M}\\s+)?((?:19|20)\\d\\d)\\s*(?:-|–|—|s\\/d|sd|to|sampai|hingga)\\s*(?:(?:${M}\\s+)?((?:19|20)\\d\\d)|(sekarang|saat ini|present|now))`, "i");
  const INTERN = /pkl|magang|praktik|praktek|internship|on[\s-]the[\s-]job/i;
  const SRC = { pengalaman: 4, pelatihan: 3, skill: 2, proyek: 1.5, pendidikan: 1, cv: 0 };
  const SECSRC = { exp: "pengalaman", intern: "pengalaman", cert: "pelatihan", skill: "skill", project: "proyek", edu: "pendidikan" };

  const D = "(\\d{1,2})", Y = "((?:19|20)\\d\\d)", SEP = "\\s*(?:-|–|—|s\\/d|sd)\\s*";
  const R_TWO = new RegExp(`${D}\\s+${M}${SEP}${D}\\s+${M}\\s+${Y}`, "i");   // 01 Okt - 31 Des 2025
  const R_ONE = new RegExp(`${D}${SEP}${D}\\s+${M}\\s+${Y}`, "i");            // 04 - 15 September 2023
  const mo = d => Math.max(0.1, Math.round(d / 30 * 10) / 10);
  // Mengembalikan { text, months } (months bisa pecahan untuk PKL singkat) atau null.
  function parseRange(ln, now) {
    let m = ln.match(R_TWO);
    if (m) { const y = +m[5]; return { text: m[0], months: mo((Date.UTC(y, MON[m[4].toLowerCase()] - 1, +m[3]) - Date.UTC(y, MON[m[2].toLowerCase()] - 1, +m[1])) / 864e5 + 1) }; }
    m = ln.match(R_ONE); if (m) return { text: m[0], months: mo(+m[2] - +m[1] + 1) };
    m = ln.match(RANGE);
    if (m) {
      const sy = +m[2], sm = m[1] ? MON[m[1].toLowerCase()] : 6, ey = m[5] ? now.getFullYear() : +m[4], em = m[5] ? now.getMonth() + 1 : m[3] ? MON[m[3].toLowerCase()] : 6;
      return { text: m[0], months: Math.max(1, (ey * 12 + em) - (sy * 12 + sm) + (m[1] && (m[3] || m[5]) ? 1 : 0)) };
    }
    return null;
  }

  function parseCV(raw, now = new Date()) {
    const lines = String(raw || "").replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\r/g, "").split("\n").map(s => s.replace(/\s+/g, " ").trim());
    const sec = []; let cur = "other", hasExpHead = false;
    lines.forEach((ln, i) => {
      const [pre, ...rest] = ln.split(":"), h = pre.toLowerCase().replace(/^[\s•\-–]+|[\s•\-–]+$/g, "");
      const hit = h && h.length < 45 ? HEAD.find(([, re]) => re.test(h)) : null;
      if (hit && (rest.length || !/[,;]/.test(ln))) { cur = hit[0]; if (cur === "exp" || cur === "intern") hasExpHead = true; lines[i] = rest.join(":").trim(); }
      sec.push(cur);
    });

    // Pendidikan: bagian "Pendidikan" + ringkasan/profil (mis. "lulusan D3 ..."), karena gelar sering hanya tertulis di sana
    const education = [], warnings = [];
    const addEdu = (ln, nxt, strict) => {
      const lv = O.levels(ln); if (!ln || !lv.length) return;
      const own = O.scan(ln, O.EDU_TABLE), fields = own.length ? own : O.scan(nxt, O.EDU_TABLE), rank = Math.max(...lv);
      if (strict && (!fields.length || rank < 2)) return;
      const tok = ln.match(/\b(d[\s-]?(?:iii|iv|ii|[1-4])|diploma\s*\w+|s[\s-]?[1-3]|sman|smkn|sma|smk|sarjana|magister|ners)\b/i);
      const e = { level: tok ? tok[0].toUpperCase().replace(/[\s-]/g, "") : "", rank, fields, field: fields.length ? fields.map(f => O.EDUM[f].label).join(" / ") : rank <= 1 ? "SMA/SMK" : "bidang tidak dikenali" };
      if (!education.some(x => x.rank === e.rank && x.field === e.field)) education.push(e);
    };
    lines.forEach((ln, i) => {
      const nxt = lines[i + 1] && !O.levels(lines[i + 1]).length ? lines[i + 1] : "";
      if (sec[i] === "edu") { addEdu(ln, nxt, false); if (/semester\s*\d+/i.test(ln)) warnings.push("Pendidikan menyebut 'Semester …'. Pastikan status kelulusan tertulis jelas di CV."); }
      else if (sec[i] === "other") addEdu(ln, nxt, true);
    });

    // Pengalaman kerja dan PKL/magang (rentang tanggal di bagian pendidikan/organisasi/sertifikat tidak dihitung)
    const experience = [];
    lines.forEach((ln, i) => {
      const r = parseRange(ln, now); if (!r) return;
      const ok = sec[i] === "exp" || sec[i] === "intern" || (!hasExpHead && sec[i] === "other" && !/universitas|politeknik|institut|akademi|sekolah|sma|smk|\bd[\s-]?[1-4]\b|\bs[\s-]?[1-3]\b/i.test(ln));
      if (!ok) return;
      let title = ln.replace(r.text, " ").replace(/[|,()\-–—:]+/g, " ").replace(/\s+/g, " ").trim().split(/\.(?=[A-Z])/).pop();
      if (title.length < 3) title = [...lines.slice(Math.max(0, i - 2), i)].reverse().find(x => x && !parseRange(x, now)) || "Pengalaman";
      const win = [lines[i - 1], ln, lines[i + 1]].join(" "), vol = /sukarela|volunteer|relawan/i.test(ln);
      experience.push({ title: title.slice(0, 80), months: r.months, kind: !vol && (sec[i] === "intern" || INTERN.test(win)) ? "internship" : "work", health: O.HEALTH.test(win) });
    });

    // Skill/software/sertifikasi: dicari per baris agar sumbernya (pengalaman/skill/pelatihan) diketahui
    const found = {};
    lines.forEach((ln, i) => {
      if (!ln) return;
      const source = SECSRC[sec[i]] || "cv";
      O.scan(ln, O.C_TABLE).forEach(id => { if (!found[id] || SRC[source] > SRC[found[id]]) found[id] = source; });
    });
    const skills = Object.entries(found).map(([id, source]) => ({ id, label: O.CON[id].label, kind: O.CON[id].kind, source }));
    const sum = k => Math.round(experience.filter(e => e.kind === k).reduce((a, e) => a + e.months, 0) * 10) / 10;
    return { education, experience, skills, work_months: sum("work"), internship_months: sum("internship"), preferred_locations: [], preferred_titles: [], parser_version: 1, warnings };
  }

  // ---- Hanya browser: ekstraksi teks dari file (pustaka dimuat saat dibutuhkan) ----
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/", MAMMOTH = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
  const loadScript = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Gagal memuat pustaka pembaca file. Tempel teks CV secara manual.")); document.head.appendChild(s); });
  async function fileToText(f) {
    if (f.size > 5 * 1024 * 1024) throw new Error("File terlalu besar (maksimal 5 MB).");
    const n = f.name.toLowerCase(); let t = "";
    if (/\.(txt|md)$/.test(n)) t = await f.text();
    else if (n.endsWith(".pdf")) {
      if (!window.pdfjsLib) await loadScript(PDFJS + "pdf.min.js");
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
      const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      for (let p = 1; p <= pdf.numPages; p++) { let y = null; for (const it of (await (await pdf.getPage(p)).getTextContent()).items) { const yy = it.transform[5]; if (y !== null && Math.abs(yy - y) > 3) t += "\n"; t += it.str + " "; y = yy; } t += "\n"; }
    } else if (n.endsWith(".docx")) { if (!window.mammoth) await loadScript(MAMMOTH); t = (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value; }
    else throw new Error("Format belum didukung. Gunakan PDF, DOCX, TXT, atau tempel teks CV.");
    if (t.replace(/\s/g, "").length < 80) throw new Error("Teks CV tidak terbaca (mungkin PDF hasil scan/gambar). Tempel teks CV secara manual.");
    return t;
  }
  const api = { parseCV, fileToText };
  if (typeof module !== "undefined") module.exports = api; else g.JFCV = api;
})(typeof window !== "undefined" ? window : globalThis);

// Draf email lamaran. HANYA memakai fakta dari profil kandidat (hasil CV); tidak memakai AI dan tidak mengirim email.
(function (g) {
  const O = g.JFO || require("./ontology"), M = g.JFM || require("./matcher");
  const lc = s => String(s || "").toLowerCase();
  const list = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " dan " + a[a.length - 1];
  const NUM = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
  const FAC = [["rumah sakit", /rumah sakit|\brsud\b|\brsu\b|\brs\b/i], ["puskesmas", /puskesmas/i], ["klinik", /klinik/i]];
  const facilities = es => [...new Set(es.flatMap(e => FAC.filter(([, re]) => re.test(e.title)).map(([n]) => n)))];
  const roleOf = t => { const r = String(t).split(/\b(?:rumah sakit|rsud|rsu|puskesmas|klinik|pt|cv)\b/i)[0].replace(/[\s,;:\-–]+$/, "").trim(); return r.length >= 3 ? lc(r) : ""; };
  const lab = id => O.CON[id].label.replace(/ \/.*$/, "");

  // Fakta yang boleh dipakai di email + dasarnya di CV
  function facts(profile, job) {
    const c = M.prep(profile), a = M.analyze(job), claims = [], exp = [];
    const top = [...c.education].sort((x, y) => y.rank - x.rank)[0];
    const edu = top ? (top.rank <= 1 ? "SMA/SMK" : `${top.level} ${top.field}`.trim()) : null;
    if (edu) claims.push(`Pendidikan: ${edu}`);
    const pkl = c.experience.filter(e => e.kind === "internship"), work = c.experience.filter(e => e.kind === "work");
    if (pkl.length) {
      const f = facilities(pkl), h = pkl.every(e => e.health);
      exp.push(`pengalaman praktik kerja lapangan di ${NUM[pkl.length] || pkl.length} ${h ? "fasilitas kesehatan" : "tempat"}${f.length ? ` (${list(f)})` : ""}`);
      claims.push(`Praktik kerja lapangan: ${pkl.length} tempat`);
    }
    work.slice(0, 2).forEach(e => {
      const r = roleOf(e.title), f = facilities([e])[0], m = Math.round(e.months);
      exp.push(`pengalaman${r ? " sebagai " + r : " kerja"}${f ? " di " + f : ""}${m >= 1 ? ` selama sekitar ${m} bulan` : ""}`);
      claims.push(`Pengalaman kerja: ${e.title}`);
    });
    // Skill: hanya yang tertulis eksplisit di CV DAN relevan dengan lowongan
    const own = new Map((profile.skills || []).map(s => [s.id, s])), ok = id => own.has(id) && !["soft", "cert"].includes(O.CON[id].kind);
    let ids = [...a.concepts].filter(ok);
    if (ids.length < 2 && a.fam) ids = [...new Set([...ids, ...a.fam.core.filter(ok)])];
    ids = ids.slice(0, 5);
    const byExp = ids.filter(id => own.get(id).source === "pengalaman"), rest = ids.filter(id => !byExp.includes(id));
    if (ids.length) claims.push(`Skill (tertulis di CV): ${ids.map(lab).join(", ")}`);
    return { edu, exp, byExp: byExp.map(lab), rest: rest.map(lab), claims };
  }

  function compose(profile, job, o = {}) {
    const f = facts(profile, job), m = M.match(profile, job), given = (o.name || "").trim(), name = given || "[Nama Lengkap]", contact = (o.contact || "").trim();
    const { title, company: co } = job, src = job.source ? ` di ${job.source}` : "", sig = name + (contact ? "\n" + contact : "");
    const subject = `Lamaran ${title} — ${name}`, fit = m.lvl !== "low";
    const para = a => a.filter(Boolean).join(" ");
    const formal = [`Yth. Bapak/Ibu Tim Rekrutmen\n${co}`, "Dengan hormat,",
      `Saya ${name}, bermaksud melamar posisi ${title} di ${co} sesuai informasi lowongan yang saya temukan${src}.`,
      para([f.edu && `Saya berlatar belakang pendidikan ${f.edu}.`, f.exp.length && `Saya memiliki ${list(f.exp)}.`,
        f.byExp.length && `Dalam kegiatan tersebut, saya memiliki pengalaman dan pemahaman terkait ${list(f.byExp)}.`,
        f.rest.length && `Saya juga memiliki pengetahuan dan kemampuan di bidang ${list(f.rest)}.`, fit && `Latar belakang tersebut sejalan dengan kebutuhan posisi ${title}.`]),
      `Bersama email ini saya lampirkan CV sebagai bahan pertimbangan. Saya bersedia mengikuti proses seleksi selanjutnya dan berharap dapat berkontribusi di ${co}.`,
      `Hormat saya,\n${sig}`].filter(x => x && x.trim()).join("\n\n");
    const natural = [`Halo Bapak/Ibu tim rekrutmen ${co},`,
      `Perkenalkan, saya ${name}. Saya tertarik dengan lowongan ${title} yang saya lihat${src}, dan ingin mengirimkan lamaran.`,
      para([f.edu && `Latar belakang pendidikan saya ${f.edu}.`, f.exp.length && `Saya punya ${list(f.exp)}.`,
        f.byExp.length && `Pengalaman itu mencakup ${list(f.byExp)}.`, f.rest.length && `Saya juga memiliki pengetahuan dasar di ${list(f.rest)}.`]),
      "CV saya lampirkan pada email ini. Terima kasih atas waktunya, dan saya senang bisa berdiskusi lebih lanjut jika ada kesempatan.",
      `Salam,\n${sig}`].filter(x => x && x.trim()).join("\n\n");

    const warnings = [];
    if (!given) warnings.push("Isi nama lengkap Anda lalu klik Buat draf. Saat ini draf memakai [Nama Lengkap].");
    if (m.lvl === "low") warnings.push("Kecocokan lowongan ini rendah menurut CV Anda. Pertimbangkan dulu apakah Anda tetap ingin melamar.");
    if (!f.edu && !f.exp.length && !f.byExp.length && !f.rest.length) warnings.push("Profil CV Anda belum memuat informasi yang cukup untuk draf yang bermakna. Periksa halaman CV.");
    return { formal: { subject, body: formal }, natural: { subject, body: natural }, claims: f.claims, notClaimed: m.gaps.slice(m.gates.length), level: m.lvl, warnings };
  }
  const api = { compose, facts };
  if (typeof module !== "undefined") module.exports = api; else g.JFE = api;
})(typeof window !== "undefined" ? window : globalThis);

// Uji offline: node tests/matcher.test.js
const assert = require("assert"), fs = require("fs"), path = require("path");
const { parseCV } = require("../js/cv"), M = require("../js/matcher");
const JOBS = new Function(fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8") + ";return JOBS;")();
const profile = parseCV(fs.readFileSync(path.join(__dirname, "fixtures/cv-contoh.txt"), "utf8"), new Date("2026-09-21"));
const by = id => M.match(profile, JOBS.find(j => j.id === id));
const show = (id) => { const m = by(id); console.log(`#${id} ${JOBS.find(j => j.id === id).title}: ${m.lvl} ${m.score} aff=${m.aff.toFixed(2)}`); return m; };
const m = Object.fromEntries(JOBS.map(j => [j.id, show(j.id)]));

// 1) Kasus dari spesifikasi
assert.equal(m[1].lvl, "high", "Staff Rekam Medis harus sangat relevan");
assert.equal(m[3].lvl, "high", "Medical Record Coder harus sangat relevan");
assert.ok(["high", "mid"].includes(m[2].lvl), "Medical Record Staff relevan walau minta 2 tahun");
assert.ok(m[2].gaps.some(g => /2 tahun/.test(g) && /6 bulan/.test(g)), "kekurangan pengalaman 2 tahun harus dijelaskan, tanpa mengarang");
assert.ok(["high", "mid"].includes(m[4].lvl), "Pendaftaran relevan karena pengalaman pendaftaran");
assert.ok(["mid", "pot"].includes(m[5].lvl), "Administrasi RS dapat relevan");
assert.equal(m[7].lvl, "low", "Perawat tidak relevan");
assert.ok(/pendidikan\/STR/.test(m[7].gaps[0]) && /rumah sakit/.test(m[7].gaps[0]), "alasan Perawat menyebut kualifikasi, bukan sekadar lokasi kerja");
assert.ok(["low", "pot"].includes(m[8].lvl), "IT SIMRS tidak sangat relevan untuk lulusan RMIK");
assert.equal(m[9].lvl, "high");

// 2) Bukan sekadar keyword
const J = o => ({ summary: "", req: [], ...o });
const stuffed = M.match(profile, J({ title: "Sales Executive", summary: "Butuh paham ICD-10 dan RME", req: ["Memahami ICD-10 dan RME"] }));
assert.equal(stuffed.lvl, "low", "kata kunci di persyaratan tidak menyelamatkan posisi yang tidak selaras");
const cleaning = M.match(profile, J({ title: "Cleaning Service Rumah Sakit", company: "RS ABC", req: ["Sehat jasmani"] }));
assert.equal(cleaning.lvl, "low", "sama-sama rumah sakit bukan alasan relevan");
const semantic = M.match(profile, J({ title: "Staff Data Pasien", req: ["Memahami ICD-10", "Mampu melakukan administrasi pasien"] }));
assert.ok(["mid", "high"].includes(semantic.lvl), "judul tak dikenal tetap relevan bila persyaratan sesuai: " + semantic.lvl);

// 3) Tidak mengarang: CV tanpa pengalaman
const noExp = { ...profile, experience: [], work_months: 0 };
const g = M.match(noExp, JOBS[1]).gaps.join(" ");
assert.ok(/informasi tidak ditemukan/.test(g), "tanpa data pengalaman -> 'informasi tidak ditemukan'");
// 4) Profil perawat memang relevan untuk Perawat (gerbang tidak menolak semua)
const nurse = parseCV("PENDIDIKAN\nD3 Keperawatan 2020 - 2023\nKEAHLIAN\nAsuhan keperawatan, BLS, STR aktif\n", new Date("2026-09-21"));
assert.ok(["high", "mid"].includes(M.match(nurse, JOBS.find(j => j.id === 7)).lvl), "perawat sungguhan cocok dengan lowongan Perawat");
assert.equal(M.match(nurse, JOBS[0]).lvl === "high", false, "perawat bukan sangat relevan untuk Staff Rekam Medis");
assert.equal(M.match(null, JOBS[0]), null);
// Ejaan "Rekam Medik" (umum di lowongan asli) harus dikenali sama seperti "Rekam Medis"
const medik = M.match(profile, { title: "Rekam Medik", summary: "", req: ["Lulusan D3/S1 Rekam Medik/ Informasi Kesehatan", "Mampu mengoperasikan MS Office"] });
assert.equal(medik.lvl, "high", "'Rekam Medik' dikenali: " + medik.lvl);
console.log("Semua uji matcher lolos.");

// Uji offline: node tests/email.test.js
const assert = require("assert"), fs = require("fs"), path = require("path");
const { parseCV } = require("../js/cv"), E = require("../js/email");
const JOBS = new Function(fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8") + ";return JOBS;")();
const P = parseCV(fs.readFileSync(path.join(__dirname, "fixtures/cv-contoh.txt"), "utf8"), new Date("2026-09-21"));
const job = id => JOBS.find(j => j.id === id);

const r = E.compose(P, job(1), { name: "Nama Uji" });
assert.equal(r.formal.subject, "Lamaran Staff Rekam Medis — Nama Uji");
for (const v of [r.formal.body, r.natural.body]) {
  assert.ok(/RS ABC/.test(v) && /Staff Rekam Medis/.test(v) && /D3 Rekam Medis dan Informasi Kesehatan/.test(v) && /ICD-10/.test(v), "memuat lowongan, pendidikan, dan skill dari CV");
  assert.ok(!/tahun|S1|Ners|STR|SIMRS/.test(v), "tidak mengklaim yang tidak ada di CV");
  assert.ok(/praktik kerja lapangan/.test(v) && /petugas pendaftaran pasien di klinik/.test(v), "pengalaman berasal dari CV");
}
assert.ok(/^Yth\./.test(r.formal.body) && /^Halo/.test(r.natural.body) && r.formal.body !== r.natural.body, "dua versi berbeda");
assert.ok(!r.warnings.length, "nama terisi dan kecocokan baik -> tanpa peringatan");

const noName = E.compose(P, job(1), {});
assert.ok(/\[Nama Lengkap\]/.test(noName.formal.body) && noName.warnings.some(w => /nama/i.test(w)));

// Klaim 2 tahun tidak dibuat; kekurangan dicatat tetapi tidak disebut di email
const r2 = E.compose(P, job(2), { name: "X" });
assert.ok(!/2 tahun|dua tahun/.test(r2.formal.body) && r2.notClaimed.some(g => /2 tahun/.test(g)));

// Lowongan tidak sesuai: tetap ada draf, tetapi diberi peringatan dan tanpa klaim keperawatan
const r7 = E.compose(P, job(7), { name: "X" });
assert.ok(r7.warnings.some(w => /rendah/.test(w)) && !/keperawatan|STR|Sejalan|sejalan/.test(r7.formal.body.replace(/Perawat Pelaksana/g, "")), "lowongan Perawat: peringatan, tanpa klaim");

// Profil kosong tidak membuat draf mengarang
const empty = E.compose({ education: [], experience: [], skills: [] }, job(1), { name: "X" });
assert.ok(empty.warnings.some(w => /belum memuat/.test(w)) && !/pendidikan|pengalaman|kemampuan/.test(empty.formal.body.replace(/Latar belakang tersebut/g, "")), "tanpa data -> tanpa klaim");
console.log("Semua uji email lolos.");

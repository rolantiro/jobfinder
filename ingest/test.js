// Uji offline (tanpa jaringan): node ingest/test.js
const assert = require("assert"), L = require("./lib");
const robots = "User-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$\n\nUser-agent: jobfinderbot\nDisallow: /karir/rahasia";
assert.equal(L.robotsAllows(robots, "/private/x", "JobFinderBot/0.1"), true, "grup khusus bot menggantikan grup *");
assert.equal(L.robotsAllows(robots, "/karir/rahasia/1", "JobFinderBot/0.1"), false);
assert.equal(L.robotsAllows(robots, "/private/x", "Lain/1"), false);
assert.equal(L.robotsAllows(robots, "/private/ok", "Lain/1"), true, "aturan terpanjang menang");
assert.equal(L.robotsAllows(robots, "/a/b.pdf", "Lain/1"), false);
assert.equal(L.robotsAllows("", "/apa-saja"), true);
assert.equal(L.isBlocked("https://id.linkedin.com/jobs/view/1"), true);
assert.equal(L.isBlocked("https://www.glints.com/id/opportunities/x"), true);
assert.equal(L.isBlocked("https://rsabc.co.id/karir"), false);

const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Staff Rekam Medis",
"description":"&lt;p&gt;Mengelola berkas &amp;amp; filing&lt;/p&gt;","datePosted":"2026-09-18","employmentType":"FULL_TIME",
"hiringOrganization":{"@type":"Organization","name":"RS ABC"},"jobLocation":{"address":{"addressLocality":"Jakarta Selatan","addressRegion":"DKI Jakarta"}},
"qualifications":"Minimal D3 Rekam Medis; Memahami ICD-10"}</script></html>`;
const [j] = L.jsonLdJobs(html);
assert.equal(j.title, "Staff Rekam Medis"); assert.equal(j.company, "RS ABC"); assert.equal(j.employment_type, "Full Time");
assert.deepEqual(j.requirements, ["Minimal D3 Rekam Medis", "Memahami ICD-10"]); assert.ok(!/[<>]/.test(j.description));

const a = L.finalize(j, { source_name: "rsabc.co.id", source_url: "https://rsabc.co.id/karir/1" });
assert.equal(a.category, "Rekam Medis"); assert.ok(a.ai_relevance_score >= 90); assert.ok(a.tags.includes("icd-10"));
assert.equal(L.classify({ title: "Rekam Medik", company: "RS X" }).category, "Rekam Medis", "ejaan Rekam Medik");
assert.equal(L.classify({ title: "Admission dan Kasir", company: "RS X" }).category, "Pendaftaran");
assert.equal(L.classify({ title: "Perawat Pelaksana", company: "RS Cipta" }).category, "Perawat");
assert.ok(L.classify({ title: "Sales Executive", company: "PT Maju Jaya" }).score < 40, "marketing non-kesehatan disaring");
assert.throws(() => L.finalize({ title: "", company: "X" }, {}));
assert.equal(L.finalize({ title: "Staff", company: "RS X", source_url: "javascript:alert(1)" }, {}).source_url, null);

const b = L.finalize({ title: "Staff Rekam Medis!", company: "Rumah Sakit ABC", city: "Jakarta Selatan" }, { source_name: "lain" });
assert.equal(a.dedupe_key, b.dedupe_key, "RS ABC = Rumah Sakit ABC");
assert.match(L.findDuplicate(b, [a]), /kunci sama/);
const c = L.finalize({ title: "Medical Record Staff", company: "RS XYZ", city: "Bekasi" }, {});
assert.equal(L.findDuplicate(c, [a]), null);
assert.match(L.findDuplicate(L.finalize({ title: "Staff Rekam Medis Senior", company: "RS ABC", city: "Jakarta Selatan" }, {}), [{ title: "Staff Rekam Medis", company: "RS ABC", city: "Jakarta Selatan" }]) || "", /mirip/);
console.log("Semua uji lolos.");

// ---- discoverLinks: HTML nyata dari halaman indeks karier RS Pondok Indah (diambil 22 Sep 2026) ----
const listingHtml = `<html><body>
<a href="https://www.rspondokindah.co.id/career-detail/dokter-umum">Dokter Umum</a>
<a href="https://www.rspondokindah.co.id/career-detail/perawat-umum">Perawat Umum</a>
<a href="https://www.rspondokindah.co.id/career-detail/apoteker">Apoteker</a>
<a href="/id/pages/about">Tentang Kami</a>
<a href="https://www.facebook.com/RumahSakitPondokIndah">Facebook</a>
<a href="https://www.rspondokindah.co.id/id/career#atas">Kembali ke atas</a>
</body></html>`;
const found = L.discoverLinks(listingHtml, "https://www.rspondokindah.co.id/id/career", /career-detail\//);
assert.equal(found.length, 3, "hanya tautan career-detail/ yang cocok pola");
assert.ok(found.includes("https://www.rspondokindah.co.id/career-detail/dokter-umum"));
assert.ok(!found.some(u => u.includes("facebook.com")), "domain luar (Facebook) tidak ikut, meski bukan domain terblokir");
assert.ok(!found.some(u => u.includes("about") || u.includes("#atas")), "tautan navigasi dan #fragment tidak ikut");
const noPattern = L.discoverLinks(listingHtml, "https://www.rspondokindah.co.id/id/career", null);
assert.equal(noPattern.length, 4, "tanpa pola: semua tautan domain sendiri, minus duplikat/fragment");
console.log("Semua uji discoverLinks lolos.");

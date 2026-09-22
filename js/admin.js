// Halaman khusus admin: baca poster lowongan (foto/screenshot, mis. dari Instagram) dengan OCR di browser (gratis,
// tidak ada gambar yang diunggah ke server mana pun), lalu admin memeriksa/mengedit hasilnya sebelum disimpan.
// Menulis ke tabel jobs hanya berhasil jika akun yang login ditandai is_admin=true di database (lihat supabase/007).
(function (g) {
  const O = g.JFO;
  const TESS = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js";
  const loadScript = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Gagal memuat pustaka OCR.")); document.head.appendChild(s); });

  // Sama dengan clean() di ingest/lib.js. Jika salah satu diubah, ubah juga yang lain agar dedupe_key tetap konsisten
  // antara lowongan yang masuk lewat otomatisasi (ingest/) dan yang ditambah manual lewat halaman ini.
  const clean = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/rumah sakit|\brsu\b|\brsud\b/g, "rs").replace(/\b(pt|cv|tbk)\b/g, " ").replace(/\s+/g, " ").trim();
  async function dedupeKey(title, company, cityOrLoc) {
    const text = `${clean(title)}|${clean(company)}|${clean(cityOrLoc)}`;
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }

  const CATS = { medical_records: "Rekam Medis", registration: "Pendaftaran", hospital_admin: "Administrasi Rumah Sakit",
    nursing: "Perawat", pharmacy: "Apoteker", doctor: "Dokter", it: "IT", finance: "Finance", marketing: "Marketing" };
  // Menebak kategori dan skor relevansi dari judul + teks poster, memakai ontologi yang sama dengan mesin pencocokan CV (js/ontology.js).
  function guess(title, text) {
    const fam = O.titleFamily(title);
    const core = fam ? O.scan(text, O.C_TABLE).filter(id => fam.core.includes(id)).length : 0;
    const health = O.HEALTH.test(`${title} ${text}`);
    const score = Math.min(100, (fam ? 40 : 10) + (health ? 40 : 0) + Math.min(20, core * 7));
    return { category: fam ? CATS[fam.id] || "Lainnya" : "Lainnya", score };
  }

  async function ocr(file, onProgress) {
    if (!window.Tesseract) await loadScript(TESS);
    const { data } = await Tesseract.recognize(file, "ind+eng", { logger: m => { if (m.status === "recognizing text") onProgress(Math.round(m.progress * 100)); } });
    return data.text;
  }

  g.JFAdmin = { dedupeKey, guess, ocr, CATS };
})(window);

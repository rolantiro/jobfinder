// JobFinder Phase 1: router hash sederhana + pencarian di data dummy (js/data.js).
const $ = s => document.querySelector(s);
const app = () => $("#app");
const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LV = { high: ["Sangat Relevan", "g"], mid: ["Relevan", "b"], pot: ["Berpotensi Relevan", "y"], low: ["Relevansi Rendah", "r"] };
const ago = h => h < 1 ? "Baru saja" : h < 24 ? Math.round(h) + " jam lalu" : Math.floor(h / 24) + " hari lalu";
const uniq = (l, k) => [...new Set(l.map(j => j[k]))].sort();
let PROFILE = null;   // profil kandidat (dari akun atau perangkat); null = belum ada CV
const withMatch = rows => { rows.forEach(j => j.match = PROFILE ? JFM.match(PROFILE, j) : null); return rows; };

// ---------- Pencarian ----------
const has = (t, x) => x.length <= 3 ? new RegExp("\\b" + x + "\\b").test(t) : t.includes(x);

function expand(q) {
  q = q.toLowerCase().trim();
  if (!q) return [];
  const terms = new Set([q]);
  SYNONYMS.forEach(g => {
    if (g.some(x => q === x || (x.length > 3 && q.includes(x)) || (q.length > 3 && x.includes(q)))) g.forEach(x => terms.add(x));
  });
  return [...terms];
}

// 3 = cocok di judul, 1 = cocok di kategori/tag, 0 = tidak cocok. Deskripsi sengaja tidak dipakai
// agar "Perawat" tidak muncul untuk "Rekam Medis" hanya karena menyebut rekam medis.
function kw(j, terms) {
  const title = j.title.toLowerCase(), other = (j.category + " " + j.tags.join(" ")).toLowerCase();
  let s = 0;
  terms.forEach(x => { if (has(title, x)) s = Math.max(s, 3); else if (has(other, x)) s = Math.max(s, 1); });
  return s;
}

// ---------- Komponen ----------
const saveBtn = id => `<button class="btn ghost" data-save="${id}" aria-pressed="${JFS.has(id)}">${JFS.has(id) ? "Tersimpan" : "Simpan"}</button>`;

function card(j) {
  const m = j.match, l = m && LV[m.lvl], ul = a => `<ul>${a.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`;
  return `<article class="card">
    ${l ? `<span class="badge ${l[1]}">${l[0]}</span>` : ""}
    <h3><a href="#/job/${j.id}">${esc(j.title)}</a></h3>
    <p class="co">${esc(j.company)}</p>
    <p class="meta">${esc(j.location)}</p>
    <p class="meta">${esc(j.type)}, ${esc(j.mode)}</p>
    <p class="meta">Ditemukan ${ago(j.hours)}. Sumber: ${esc(j.source)}</p>
    ${m && m.why.length ? `<div class="why"><b>Cocok karena:</b>${ul(m.why.slice(0, 4))}</div>` : ""}
    ${m && m.gaps.length ? `<div class="gap"><b>${m.lvl === "low" ? "Mengapa kurang sesuai" : "Belum sesuai atau belum terlihat di CV"}:</b>${ul(m.gaps.slice(0, m.lvl === "low" ? 1 : 2))}</div>` : ""}
    <div class="acts"><a class="btn" href="#/job/${j.id}">Lihat Lowongan</a><a class="btn ghost" href="#/email?job=${j.id}">Buat Email Lamaran</a>${saveBtn(j.id)}</div>
  </article>`;
}

const sel = (id, label, opts) => `<select id="f-${id}" aria-label="${label}"><option value="">${label}</option>${opts.map(o => `<option>${esc(o)}</option>`).join("")}</select>`;

// ---------- Halaman ----------
async function home() {
  const all = withMatch((await apiJobs({ limit: 200 })).rows), rows = [...all].sort((a, b) => a.hours - b.hours).slice(0, 4);
  const top = PROFILE ? [...all].filter(j => j.match.lvl !== "low").sort((a, b) => b.match.score - a.match.score).slice(0, 4) : [];
  const mbox = PROFILE ? `<section class="wrap"><h2>Paling sesuai untuk Anda</h2>${top.length ? `<div class="grid">${top.map(card).join("")}</div>` : "<p>Belum ada lowongan yang cocok dengan profil Anda saat ini.</p>"}</section>`
    : `<section class="wrap"><p class="nudge">Unggah CV untuk melihat lowongan yang paling sesuai dengan profil Anda. <a href="#/cv">Unggah CV</a></p></section>`;
  app().innerHTML = `<section class="hero">
    <h1>Temukan Lowongan Kerja Tanpa Harus Buka Banyak Situs.</h1>
    <form class="sb" id="hf"><input id="hq" placeholder='Cari lowongan: "Rekam Medis"' aria-label="Cari lowongan"><button class="btn">Cari</button></form>
    <div class="chips">${CATS.map(c => `<a href="#/search?q=${encodeURIComponent(c)}">${c}</a>`).join("")}</div>
  </section>
  ${mbox}
  <section class="wrap"><h2>Lowongan terbaru</h2>
    ${rows.length ? `<div class="grid">${rows.map(card).join("")}</div>` : "<p>Belum ada lowongan yang dapat ditampilkan. Coba lagi beberapa saat.</p>"}
  </section>`;
  $("#hf").onsubmit = e => { e.preventDefault(); location.hash = "#/search?q=" + encodeURIComponent($("#hq").value); };
}

async function search(P) {
  const first = await apiJobs({}), all = first.rows;
  if (first.src === "error") { app().innerHTML = `<section class="wrap"><h1>Cari lowongan</h1><p class="gap">Data lowongan sedang tidak dapat dimuat. Coba lagi beberapa saat.</p></section>`; return; }
  app().innerHTML = `<section class="wrap">
    <form class="sb" id="sf"><input id="q" value="${esc(P.get("q") || "")}" placeholder='Cari lowongan: "Rekam Medis"' aria-label="Cari lowongan"><button class="btn">Cari</button></form>
    <div class="filters">
      ${sel("city", "Semua lokasi", uniq(all, "city"))}${sel("category", "Semua kategori", uniq(all, "category"))}
      ${sel("type", "Semua tipe pekerjaan", uniq(all, "type"))}${sel("mode", "On-site atau remote", uniq(all, "mode"))}${sel("source", "Semua sumber", uniq(all, "source"))}
      <select id="f-date" aria-label="Tanggal posting"><option value="0">Kapan saja</option><option value="24">24 jam terakhir</option><option value="168">7 hari terakhir</option><option value="720">30 hari terakhir</option></select>
      <select id="sort" aria-label="Urutkan"><option value="new">Urutkan: Terbaru</option><option value="rel">Urutkan: Relevansi</option><option value="loc">Urutkan: Lokasi</option></select>
    </div>
    ${PROFILE ? `<label class="tog"><input type="checkbox" id="cv" checked> Gunakan CV saya untuk mengurutkan lowongan</label>` : `<p class="nudge">Unggah CV untuk mengurutkan berdasarkan kecocokan. <a href="#/cv">Unggah CV</a></p>`}
    <p id="cnt" class="meta" aria-live="polite"></p>
    <div id="res" class="grid"></div>
    <p class="note" id="src"></p>
  </section>`;

  let seq = 0;
  const upd = async () => {
    const my = ++seq, terms = expand($("#q").value), g = k => $("#f-" + k).value, dh = +$("#f-date").value;
    const { rows, src } = await apiJobs({ terms, city: g("city"), category: g("category"), type: g("type"), mode: g("mode"), source: g("source"), hours: dh });
    if (my !== seq || !$("#res")) return; // abaikan respons lama atau halaman yang sudah ditinggalkan
    if (src === "error") { $("#cnt").textContent = ""; $("#res").innerHTML = `<p class="gap">Data lowongan sedang tidak dapat dimuat. Coba lagi beberapa saat.</p>`; $("#src").textContent = ""; return; }
    withMatch(rows);
    const useCV = PROFILE && $("#cv").checked, sc = x => x.j.match ? x.j.match.score : 0;
    const r = rows.map(j => ({ j, k: kw(j, terms) })).filter(({ k }) => !terms.length || k > 0);
    const s = $("#sort").value;
    r.sort(s === "new" ? (a, b) => a.j.hours - b.j.hours
      : s === "loc" ? (a, b) => (a.j.location || "").localeCompare(b.j.location || "")
      : (a, b) => useCV ? sc(b) - sc(a) || b.k - a.k : b.k - a.k || a.j.hours - b.j.hours);
    $("#cnt").textContent = r.length + " lowongan ditemukan";
    $("#src").textContent = "Sumber data: " + src + "." + (PROFILE ? " Skor kecocokan adalah estimasi dari CV Anda, bukan jaminan." : "");
    $("#res").innerHTML = r.length ? r.map(x => card(x.j)).join("") : `<p>Tidak ada lowongan yang cocok. Coba kata kunci lain atau kurangi filter.</p>`;
  };
  let tm;
  const later = () => { clearTimeout(tm); tm = setTimeout(upd, 250); };
  $("#sf").onsubmit = e => { e.preventDefault(); upd(); };
  $("#q").oninput = later;
  app().querySelectorAll("select").forEach(s => s.onchange = upd);
  if (PROFILE) { $("#cv").onchange = upd; $("#sort").value = "rel"; }
  upd();
}

async function detail(id) {
  const j = await apiJob(id);
  if (!j) return notFound();
  j.match = PROFILE ? JFM.match(PROFILE, j) : null;
  const m = j.match, l = m && LV[m.lvl];
  app().innerHTML = `<section class="wrap narrow">
    <a href="#/search" class="back">Kembali ke hasil pencarian</a>
    ${l ? `<span class="badge ${l[1]}">${l[0]}</span>` : ""}
    <h1>${esc(j.title)}</h1>
    <p class="co">${esc(j.company)}</p>
    <div class="facts">
      <div><small>Lokasi</small>${esc(j.location)}</div><div><small>Tipe</small>${esc(j.type)}</div>
      <div><small>Mode kerja</small>${esc(j.mode)}</div><div><small>Ditemukan</small>${ago(j.hours)}</div>
      <div><small>Kategori</small>${esc(j.category)}</div><div><small>Sumber</small>${esc(j.source)}</div>
    </div>
    <h2>Ringkasan pekerjaan</h2><p>${esc(j.summary)}</p>
    <h2>Persyaratan utama</h2><ul>${j.req.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    ${matchBlock(m)}
    <div class="acts">
      ${safeUrl(j.url) ? `<a class="btn" href="${esc(safeUrl(j.url))}" target="_blank" rel="noopener noreferrer">Lihat Lowongan Asli</a>` : ""}
      <a class="btn ghost" href="#/email?job=${j.id}">Buat Email Lamaran</a>
      ${saveBtn(j.id)}
    </div>
  </section>`;
}

function about() {
  app().innerHTML = `<section class="wrap narrow"><h1>Tentang JobFinder</h1>
    <p>JobFinder mengumpulkan lowongan kerja bidang kesehatan (rekam medis, administrasi rumah sakit, pendaftaran, dan terkait) dalam satu tempat, lalu mencocokkannya dengan CV Anda.</p>
    <h2>Sumber lowongan</h2><p>Lowongan diambil dari sumber publik yang boleh diakses secara legal, misalnya halaman karier resmi rumah sakit, dan selalu menautkan ke sumber aslinya. <b>Periksa lowongan di sumber asli sebelum melamar</b>: lowongan bisa sudah ditutup dan keabsahannya tidak dapat kami jamin. Waspadai rekrutmen yang meminta biaya.</p>
    <h2>Kecocokan dengan CV</h2><p>Skor dan alasan kecocokan adalah estimasi dari isi CV dan deskripsi lowongan, bukan jaminan Anda memenuhi persyaratan. Sistem tidak menganggap Anda memiliki skill atau pengalaman yang tidak tertulis di CV.</p>
    <h2>Privasi</h2><ul>
      <li>CV dibaca di browser Anda. File dan teks CV tidak diunggah dan tidak disimpan.</li>
      <li>Yang disimpan hanya ringkasan profil (pendidikan, skill, durasi pengalaman), preferensi, dan lowongan tersimpan: di perangkat Anda, dan di akun jika Anda masuk.</li>
      <li>Nama, kontak, dan alamat tidak disimpan. Draf email lamaran dibuat di browser dan tidak pernah dikirim otomatis.</li>
      <li>Anda dapat menghapus profil dan lowongan tersimpan kapan saja di halaman <a href="#/profile">Profil</a>.</li>
      <li>Pihak ketiga: Supabase (data dan login), Google Fonts, dan cdnjs (hanya saat membaca CV PDF/DOCX). Tanpa analitik dan iklan.</li></ul></section>`;
}

function notFound() {
  app().innerHTML = `<section class="wrap narrow"><h1>Halaman tidak ditemukan</h1><a class="btn" href="#/">Kembali ke beranda</a></section>`;
}


const DIM = { role: "Kesesuaian posisi", edu: "Pendidikan", skills: "Skill", exp: "Pengalaman", reqs: "Persyaratan", loc: "Lokasi" };
function matchBlock(m) {
  const head = `<h2>Kecocokan dengan profil Anda</h2>`, ul = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  if (!m) return head + `<p class="nudge">Unggah CV untuk melihat seberapa cocok lowongan ini. <a href="#/cv">Unggah CV</a></p>`;
  return head + `<div class="why">
    ${m.why.length ? `<b>Cocok karena:</b>${ul(m.why)}` : ""}
    ${m.gaps.length ? `<b>${m.lvl === "low" ? "Mengapa kurang sesuai" : "Persyaratan yang belum terpenuhi atau tidak ditemukan di CV"}:</b>${ul(m.gaps)}` : ""}
    ${m.notes.map(n => `<p class="note">${esc(n)}</p>`).join("")}
    <div class="dims">${Object.entries(DIM).map(([k, t]) => m.dims[k] == null ? `<div class="dim"><span>${t}</span><em>Informasi tidak ditemukan</em></div>` : `<div class="dim"><span>${t}</span><i style="--v:${Math.round(m.dims[k] * 100)}%"></i></div>`).join("")}</div>
    <p class="note">Estimasi dari isi CV dan deskripsi lowongan; tidak menjamin Anda memenuhi persyaratan. Sistem tidak menganggap Anda memiliki skill atau pengalaman yang tidak tertulis di CV.</p></div>`;
}

async function cvPage() {
  app().innerHTML = `<section class="wrap narrow"><h1>CV dan profil kandidat</h1>
    <p class="note">CV dibaca langsung di browser Anda. File dan teks CV tidak diunggah dan tidak disimpan; yang disimpan hanya ringkasan profil (pendidikan, skill, lama pengalaman).</p>
    <div class="box"><label>Unggah CV (PDF, DOCX, atau TXT)<input type="file" id="cvf" accept=".pdf,.docx,.txt,.md"></label>
      <label>atau tempel teks CV<textarea id="cvt" rows="6"></textarea></label>
      <div class="acts"><button class="btn" id="cvgo">Baca CV</button></div><p id="cvmsg" class="note" aria-live="polite"></p></div>
    <div id="prof"></div><div id="acct" class="box"></div></section>`;
  const msg = t => { $("#cvmsg").textContent = t; };
  const list = v => v.split(",").map(x => x.trim()).filter(Boolean);
  const draw = () => {
    const p = PROFILE; if (!p) { $("#prof").innerHTML = ""; return; }
    $("#prof").innerHTML = `<h2>Profil hasil pembacaan</h2><p class="note">Periksa hasilnya dan hapus yang salah. Sistem hanya memakai yang tertera di sini.</p>
      ${(p.warnings || []).map(w => `<p class="gap">${esc(w)}</p>`).join("")}
      <h3>Pendidikan</h3>${p.education.length ? `<ul>${p.education.map(e => `<li>${esc((e.level + " " + e.field).trim())}</li>`).join("")}</ul>` : "<p>Informasi tidak ditemukan</p>"}
      <h3>Pengalaman</h3>${p.experience.length ? `<ul>${p.experience.map(e => `<li>${esc(e.title)}: sekitar ${JFM.dur(e.months)} (${e.kind === "work" ? "kerja" : "PKL/magang"})</li>`).join("")}</ul>` : "<p>Informasi tidak ditemukan</p>"}
      <h3>Skill dan sertifikasi</h3><div class="chips2">${p.skills.map(s => `<span class="chip">${esc(s.label)}<small>${esc(s.source)}</small><button data-rm="${esc(s.id)}" aria-label="Hapus ${esc(s.label)}">×</button></span>`).join("") || "<p>Informasi tidak ditemukan</p>"}</div>
      <h3>Preferensi</h3><label>Lokasi (pisahkan dengan koma)<input id="pl" value="${esc(p.preferred_locations.join(", "))}" placeholder="Jakarta, Bekasi"></label>
      <label>Posisi yang diminati<input id="pt" value="${esc(p.preferred_titles.join(", "))}" placeholder="Rekam Medis, Pendaftaran"></label>
      <div class="acts"><button class="btn" id="sv">Simpan profil</button><button class="btn ghost" id="dl">Hapus profil</button></div>`;
    $("#prof").querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { PROFILE.skills = PROFILE.skills.filter(s => s.id !== b.dataset.rm); draw(); });
    $("#sv").onclick = async () => {
      PROFILE.preferred_locations = list($("#pl").value); PROFILE.preferred_titles = list($("#pt").value);
      try { msg("Profil tersimpan di " + (await JFP.save(PROFILE) === "akun" ? "akun Anda." : "perangkat ini. Masuk (di bawah) untuk menyimpan ke akun.")); } catch (e) { msg("Gagal menyimpan: " + e.message); }
    };
    $("#dl").onclick = async () => { if (!confirm("Hapus profil dari perangkat ini dan dari akun Anda?")) return; try { await JFP.remove(); PROFILE = null; draw(); msg("Profil dihapus."); } catch (e) { msg("Gagal menghapus: " + e.message); } };
  };
  const acct = () => acctBox($("#acct"), t => { draw(); acct(); msg(t); });
  $("#cvgo").onclick = async () => {
    try {
      msg("Membaca CV…"); const f = $("#cvf").files[0], t = f ? await JFCV.fileToText(f) : $("#cvt").value;
      if (t.replace(/\s/g, "").length < 80) throw new Error("Teks CV kosong atau terlalu pendek.");
      const p = JFCV.parseCV(t); if (PROFILE) { p.preferred_locations = PROFILE.preferred_locations || []; p.preferred_titles = PROFILE.preferred_titles || []; }
      PROFILE = p; $("#cvt").value = ""; draw(); msg("CV terbaca. Periksa profil di bawah, lalu klik Simpan profil.");
    } catch (e) { msg(e.message); }
  };
  draw(); acct();
}

// Kotak masuk/daftar/keluar yang dipakai halaman CV dan Profil. onChange(pesan) dipanggil setelah status akun berubah.
async function acctBox(host, onChange) {
  const u = await JFP.user(), q = x => host.querySelector(x), am = t => { const e = q("#am"); if (e) e.textContent = t; };
  host.innerHTML = !JFP.enabled() ? `<p class="note">Supabase tidak tersedia; data hanya disimpan di perangkat ini.</p>`
    : u ? `<p>Masuk sebagai <b>${esc(u.email)}</b>. Profil dan lowongan tersimpan ada di akun Anda.</p><div class="acts"><button class="btn ghost" id="so">Keluar</button></div>`
    : `<h3>Masuk atau daftar (opsional)</h3><input id="em" type="email" placeholder="Email" autocomplete="email"><input id="pw" type="password" placeholder="Password (minimal 6 karakter)" autocomplete="current-password">
       <div class="acts"><button class="btn" id="si">Masuk</button><button class="btn ghost" id="su">Daftar</button></div><p id="am" class="note" aria-live="polite"></p>`;
  if (u) q("#so").onclick = async () => { await JFP.signOut(); JFS.clearLocal(); PROFILE = null; onChange("Anda keluar. Data di perangkat ini dihapus."); };
  else if (JFP.enabled()) {
    const cred = () => [q("#em").value.trim(), q("#pw").value];
    const done = async () => { const r = await JFP.load(); if (r.from === "akun") PROFILE = r.profile; await JFS.sync(); onChange(r.from === "akun" ? "Data dari akun Anda dimuat." : "Berhasil masuk. Simpan profil agar tersimpan di akun."); };
    q("#si").onclick = async () => { const { error } = await JFP.signIn(...cred()); error ? am(error.message) : done(); };
    q("#su").onclick = async () => { const { data, error } = await JFP.signUp(...cred()); if (error) am(error.message); else if (data.session) done(); else am("Cek email Anda untuk konfirmasi, lalu masuk."); };
  }
}

async function savedPage() {
  const ids = JFS.all(), u = await JFP.user(), rows = withMatch((await apiJobs({ limit: 500 })).rows).filter(j => ids.includes(j.id));
  rows.sort((a, b) => PROFILE ? b.match.score - a.match.score : a.hours - b.hours);
  app().innerHTML = `<section class="wrap"><h1>Lowongan tersimpan</h1>
    <p class="note">${u ? "Tersimpan di akun Anda." : 'Tersimpan di perangkat ini. Masuk lewat halaman <a href="#/profile">Profil</a> agar tersimpan di akun dan bisa dibuka dari perangkat lain.'}</p>
    <div id="saved-list" class="grid">${rows.length ? rows.map(card).join("") : "<p>Belum ada lowongan tersimpan. Klik Simpan pada lowongan yang menarik.</p>"}</div></section>`;
}

function profilePage() {
  const p = PROFILE, msg = t => { $("#pm").textContent = t; };
  app().innerHTML = `<section class="wrap narrow"><h1>Profil</h1><div id="pacct" class="box"></div>
    <h2>Profil kandidat</h2>${p ? `<ul><li>Pendidikan: ${esc(p.education.map(e => (e.level + " " + e.field).trim()).join("; ") || "informasi tidak ditemukan")}</li><li>${p.skills.length} skill dan ${p.experience.length} pengalaman terbaca dari CV</li></ul>
      <div class="box"><label>Lokasi yang diminati (pisahkan dengan koma)<input type="text" id="pl" value="${esc(p.preferred_locations.join(", "))}" placeholder="Jakarta, Bekasi"></label>
        <label>Posisi yang diminati<input type="text" id="pt" value="${esc(p.preferred_titles.join(", "))}" placeholder="Rekam Medis, Pendaftaran"></label>
        <div class="acts"><button class="btn" id="ps">Simpan preferensi</button><a class="btn ghost" href="#/cv">Perbarui CV</a></div><p id="pm" class="note" aria-live="polite"></p></div>`
      : `<p class="nudge">Belum ada profil. <a href="#/cv">Unggah CV</a> untuk membuatnya.</p><p id="pm" class="note"></p>`}
    <h2>Lowongan tersimpan</h2><p>${JFS.count()} lowongan. <a href="#/saved">Lihat</a></p>
    <h2>Data Anda</h2><p class="note">Yang disimpan: ringkasan profil (pendidikan, skill, durasi pengalaman), preferensi, dan daftar lowongan tersimpan. File dan teks CV, nama, kontak, dan alamat tidak disimpan.</p>
    <div class="acts"><button class="btn ghost" id="pd">Hapus profil dan lowongan tersimpan</button></div></section>`;
  acctBox($("#pacct"), () => profilePage());
  const list = v => v.split(",").map(x => x.trim()).filter(Boolean);
  if (p) $("#ps").onclick = async () => { PROFILE.preferred_locations = list($("#pl").value); PROFILE.preferred_titles = list($("#pt").value); try { msg("Preferensi tersimpan di " + (await JFP.save(PROFILE) === "akun" ? "akun Anda." : "perangkat ini.")); } catch (e) { msg("Gagal menyimpan: " + e.message); } };
  $("#pd").onclick = async () => { if (!confirm("Hapus profil dan semua lowongan tersimpan dari perangkat ini dan dari akun Anda? Akun login tidak ikut terhapus.")) return; try { await JFP.remove(); await JFS.clear(); PROFILE = null; profilePage(); } catch (e) { msg("Gagal menghapus: " + e.message); } };
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-save]"); if (!b) return;
  b.disabled = true;
  try {
    const on = await JFS.toggle(b.dataset.save); b.textContent = on ? "Tersimpan" : "Simpan"; b.setAttribute("aria-pressed", on);
    const list = b.closest("#saved-list"); if (list && !on) { b.closest(".card").remove(); if (!list.children.length) list.innerHTML = "<p>Belum ada lowongan tersimpan.</p>"; }
  } catch (err) { alert("Gagal menyimpan: " + err.message); }
  b.disabled = false;
});

let EM = { name: "", contact: "" };   // hanya di memori selama sesi; tidak disimpan
async function emailPage(P) {
  if (!PROFILE) { app().innerHTML = `<section class="wrap narrow"><h1>Email lamaran</h1><p class="nudge">Draf email dibuat dari profil CV Anda supaya hanya memuat hal yang benar-benar ada di CV. <a href="#/cv">Unggah CV dulu</a>.</p></section>`; return; }
  const jobs = (await apiJobs({ limit: 200 })).rows, pre = P.get("job") ? await apiJob(P.get("job")) : null;
  app().innerHTML = `<section class="wrap narrow"><h1>Email lamaran</h1>
    <p class="note">Draf dibuat dari profil CV Anda dan tidak pernah dikirim otomatis. Anda menyunting, menyalin, lalu mengirimnya sendiri.</p>
    <div class="box"><label>Lowongan<select id="ej">${jobs.map(j => `<option value="${j.id}">${esc(j.title)} - ${esc(j.company)}</option>`).join("")}</select></label>
      <label>Nama lengkap<input type="text" id="en" value="${esc(EM.name)}" autocomplete="name"></label>
      <label>Kontak untuk tanda tangan (opsional, mis. nomor telepon)<input type="text" id="ec" value="${esc(EM.contact)}"></label>
      <div class="acts"><button class="btn" id="eg">Buat draf</button></div></div><div id="eo"></div></section>`;
  if (pre) $("#ej").value = pre.id;
  const draw = () => {
    EM = { name: $("#en").value, contact: $("#ec").value };
    const j = jobs.find(x => x.id === +$("#ej").value); if (!j) return;
    const r = JFE.compose(PROFILE, j, EM), ul = a => a.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p>Tidak ada.</p>";
    const ver = k => `<div class="ver" id="v-${k}"><label>Subjek<input type="text" class="es" value="${esc(r[k].subject)}"></label><label>Isi email<textarea class="eb" rows="14">${esc(r[k].body)}</textarea></label>
      <div class="acts"><button class="btn" data-act="copy">Salin</button><button class="btn ghost" data-act="dl">Unduh .txt</button><button class="btn ghost" data-act="mail">Buka di aplikasi email</button></div></div>`;
    $("#eo").innerHTML = `${r.warnings.map(w => `<p class="gap">${esc(w)}</p>`).join("")}
      <div class="tabs"><button class="tab on" data-t="formal">Versi formal</button><button class="tab" data-t="natural">Versi natural</button></div>${ver("formal")}${ver("natural")}
      <p id="emsg" class="note" aria-live="polite"></p><p class="note">Pengingat: lampirkan CV Anda sendiri saat mengirim, dan periksa setiap kalimat sebelum dikirim.</p>
      <h2>Dasar dari CV</h2>${ul(r.claims)}<h2>Tidak disebut karena belum ada di CV</h2>${ul(r.notClaimed)}`;
    $("#v-natural").hidden = true;
    $("#eo").querySelectorAll(".tab").forEach(b => b.onclick = () => { $("#eo").querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === b)); ["formal", "natural"].forEach(k => { $("#v-" + k).hidden = k !== b.dataset.t; }); });
    ["formal", "natural"].forEach(k => {
      const box = $("#v-" + k), subj = () => box.querySelector(".es").value, body = () => box.querySelector(".eb").value;
      box.querySelector("[data-act=copy]").onclick = async () => {
        try { await navigator.clipboard.writeText(subj() + "\n\n" + body()); $("#emsg").textContent = "Draf disalin."; }
        catch { box.querySelector(".eb").select(); $("#emsg").textContent = document.execCommand("copy") ? "Draf disalin." : "Teks sudah terpilih; salin manual (Ctrl+C)."; }
      };
      box.querySelector("[data-act=dl]").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([subj() + "\n\n" + body()], { type: "text/plain;charset=utf-8" })); a.download = "lamaran-" + k + ".txt"; a.click(); URL.revokeObjectURL(a.href); };
      box.querySelector("[data-act=mail]").onclick = () => { location.href = "mailto:?subject=" + encodeURIComponent(subj()) + "&body=" + encodeURIComponent(body()); };
    });
  };
  $("#eg").onclick = draw; $("#ej").onchange = draw; draw();
}

async function initApp() { if (typeof sb !== "undefined" && sb) { JFP.init(sb); JFS.init(sb); } PROFILE = (await JFP.load()).profile; await JFS.load(); }


async function adminPage() {
  const u = await JFP.user();
  if (!u) { app().innerHTML = `<section class="wrap narrow"><h1>Tambah Lowongan dari Gambar</h1><p class="nudge">Halaman ini khusus admin. <a href="#/profile">Masuk dulu</a> di halaman Profil.</p></section>`; return; }
  let admin = false;
  try { const { data, error } = await sb.from("user_profiles").select("is_admin").eq("user_id", u.id).maybeSingle(); if (error) throw error; admin = !!(data && data.is_admin); } catch (e) { console.warn(e); }
  if (!admin) { app().innerHTML = `<section class="wrap narrow"><h1>Tambah Lowongan dari Gambar</h1><p class="gap">Akun ${esc(u.email)} bukan admin. Fitur ini dikunci supaya pengunjung lain tidak bisa menambah lowongan palsu ke situs publik.</p></section>`; return; }

  app().innerHTML = `<section class="wrap narrow"><h1>Tambah Lowongan dari Gambar</h1>
    <p class="note">Unggah foto atau screenshot poster lowongan (mis. dari Instagram). Teksnya dibaca di browser Anda (OCR), gambar tidak diunggah ke server mana pun. Hasil OCR sering tidak sempurna untuk poster bergambar — periksa dan perbaiki sebelum menyimpan.</p>
    <div class="box"><label>Gambar poster lowongan<input type="file" id="af" accept="image/*"></label>
      <div class="acts"><button class="btn" id="ago">Baca teks dari gambar</button></div>
      <p id="amsg" class="note" aria-live="polite"></p><progress id="aprog" max="100" value="0" style="width:100%;display:none"></progress></div>
    <div id="aform"></div></section>`;

  const msg = t => { $("#amsg").textContent = t; };
  const draw = (text) => {
    const g = guessFrom(text);
    $("#aform").innerHTML = `<div class="box">
      <label>Judul posisi<input type="text" id="ft" value="${esc(g.title)}"></label>
      <label>Nama perusahaan/rumah sakit<input type="text" id="fc" value="${esc(g.company)}"></label>
      <label>Lokasi<input type="text" id="fl" value="${esc(g.location)}"></label>
      <label>Kategori<select id="fcat">${Object.values(JFAdmin.CATS).concat("Lainnya").map(c => `<option ${c === g.category ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <label>Ringkasan / persyaratan (satu per baris untuk persyaratan)<textarea id="fd" rows="6">${esc(text)}</textarea></label>
      <label>Sumber (dari mana Anda mendapat poster ini)<input type="text" id="fs" value="Instagram" placeholder="mis. Instagram @namaRS"></label>
      <label>Skor relevansi perkiraan: <b>${g.score}</b> ${g.score < 40 ? "(di bawah 40: mungkin bukan bidang kesehatan/rekam medis, periksa lagi)" : ""}</label>
      <div class="acts"><button class="btn" id="asave">Simpan lowongan</button></div></div>`;
    $("#asave").onclick = async () => {
      const title = $("#ft").value.trim(), company = $("#fc").value.trim(), location = $("#fl").value.trim();
      if (!title || !company) return msg("Judul dan nama perusahaan wajib diisi.");
      msg("Menyimpan…");
      try {
        const lines = $("#fd").value.split("\n").map(x => x.trim()).filter(Boolean);
        const row = { title, company, location, city: location, description: lines.join(" "), requirements: lines.slice(0, 15),
          category: $("#fcat").value, source_name: $("#fs").value.trim() || "Instagram", work_mode: "On-site",
          ai_relevance_score: g.score, tags: [$("#fcat").value.toLowerCase()],
          dedupe_key: await JFAdmin.dedupeKey(title, company, location) };
        const { error } = await sb.from("jobs").insert(row);
        if (error) throw error;
        msg("Tersimpan. Lowongan sudah tampil di situs.");
      } catch (e) { msg("Gagal menyimpan: " + e.message + (/duplicate|unique/i.test(e.message) ? " (kemungkinan lowongan ini sudah ada)" : "")); }
    };
  };
  const guessFrom = text => {
    const first = (text.split("\n").map(x => x.trim()).find(Boolean) || "").slice(0, 100);
    const g = JFAdmin.guess(first, text);
    return { title: first, company: "", location: "", category: g.category, score: g.score };
  };
  draw("");

  $("#ago").onclick = async () => {
    const f = $("#af").files[0]; if (!f) return msg("Pilih gambar dulu.");
    $("#aprog").style.display = ""; $("#aprog").value = 0; msg("Membaca gambar (bisa memakan waktu beberapa detik)…");
    try {
      const text = await JFAdmin.ocr(f, p => { $("#aprog").value = p; msg("Membaca gambar… " + p + "%"); });
      $("#aprog").style.display = "none";
      if (!text.trim()) { msg("Tidak ada teks yang terbaca. Coba foto lebih jelas, atau isi form di bawah secara manual."); return; }
      draw(text); msg("Selesai membaca. Periksa dan perbaiki hasilnya sebelum menyimpan — OCR sering salah baca font poster.");
    } catch (e) { $("#aprog").style.display = "none"; msg("Gagal membaca gambar: " + e.message); }
  };
}

// ---------- Router ----------
function route() {
  const [p, qs] = location.hash.slice(1).split("?"), P = new URLSearchParams(qs || ""), a = (p || "/").split("/").filter(Boolean);
  window.scrollTo(0, 0);
  app().innerHTML = `<section class="wrap"><p class="note" role="status">Memuat…</p></section>`;   // klien Supabase mencoba ulang saat gangguan (bisa beberapa detik)
  $("#nav").classList.remove("open"); $("#mb").setAttribute("aria-expanded", "false");
  if (!a.length) home();
  else if (a[0] === "search") search(P);
  else if (a[0] === "job") detail(a[1]);
  else if (a[0] === "about") about();
  else if (a[0] === "cv") cvPage();
  else if (a[0] === "admin") adminPage();
  else if (a[0] === "email") emailPage(P);
  else if (a[0] === "saved") savedPage();
  else if (a[0] === "profile") profilePage();
  else notFound();
}
$("#mb").onclick = () => { const o = $("#nav").classList.toggle("open"); $("#mb").setAttribute("aria-expanded", o); };
window.addEventListener("hashchange", route);
initApp().catch(console.warn).finally(route);

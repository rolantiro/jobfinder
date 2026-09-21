// Ontologi: konsep (skill/software/sertifikasi), bidang pendidikan, dan keluarga posisi.
// Dipakai bersama oleh pembaca CV dan matcher. Menambah sinonim di sini langsung memperbaiki keduanya.
(function (g) {
  // [id, label, jenis, [alias huruf kecil]]
  const CONCEPTS = [
    ["icd10", "ICD-10", "skill", ["icd-10", "icd10", "icd 10"]],
    ["icd9cm", "ICD-9-CM", "skill", ["icd-9-cm", "icd9cm", "icd-9", "icd 9", "icd9"]],
    ["rme", "Rekam Medis Elektronik (RME)", "skill", ["rekam medis elektronik", "rme", "emr", "electronic medical record", "electronic health record", "rekam kesehatan elektronik", "rke"]],
    ["simrs", "SIMRS", "skill", ["simrs", "sistem informasi manajemen rumah sakit", "sistem informasi rumah sakit", "sirs", "hospital information system"]],
    ["audit_rm", "Audit rekam medis", "skill", ["audit rekam medis", "audit rekam medik", "audit medis", "audit pendokumentasian", "audit kesehatan", "medical record audit", "analisis kuantitatif", "analisis kualitatif"]],
    ["filing", "Filing / penyimpanan berkas", "skill", ["filing", "assembling", "retensi", "penyimpanan berkas", "pengarsipan berkas", "penjajaran"]],
    ["pendaftaran", "Pendaftaran pasien", "skill", ["pendaftaran pasien", "pendaftaran", "registrasi pasien", "admisi", "patient registration", "front office", "tpp", "tempat pendaftaran pasien"]],
    ["admin", "Administrasi", "skill", ["administrasi pasien", "administrasi", "surat-menyurat", "surat menyurat", "korespondensi", "arsip"]],
    ["statistik", "Statistik kesehatan", "skill", ["statistik kesehatan", "statistik rumah sakit", "health statistics", "indikator pelayanan", "laporan rl", "sensus harian", "statistik"]],
    ["klaim", "Klaim BPJS / INA-CBG", "skill", ["klaim bpjs", "ina-cbg", "inacbg", "casemix", "verifikasi klaim", "klaim"]],
    ["msoffice", "Microsoft Office", "software", ["microsoft office", "ms office", "microsoft excel", "ms excel", "excel", "microsoft word", "ms word", "powerpoint", "google sheets"]],
    ["gis", "GIS (QGIS/ArcGIS)", "software", ["qgis", "arcgis", "sistem informasi geografis", "gis", "sig"]],
    ["basis_data", "Basis data", "skill", ["basis data", "database", "sql", "mysql"]],
    ["jaringan", "Jaringan komputer", "skill", ["jaringan", "networking", "mikrotik", "cisco"]],
    ["asuhan_kep", "Asuhan keperawatan", "skill", ["asuhan keperawatan", "tindakan keperawatan", "perawatan pasien", "bls", "btcls", "acls"]],
    ["komunikasi", "Komunikasi", "soft", ["komunikasi", "komunikatif", "communication", "ramah"]],
    ["teliti", "Ketelitian", "soft", ["teliti", "ketelitian", "detail oriented", "detail-oriented"]],
    ["disiplin", "Disiplin", "soft", ["disiplin"]],
    ["kerja_tim", "Kerja tim", "soft", ["kerja tim", "berkolaborasi", "kolaborasi", "teamwork", "team work"]],
    ["tanggung_jawab", "Tanggung jawab", "soft", ["bertanggung jawab", "tanggung jawab"]],
    ["str", "STR aktif", "cert", ["str", "surat tanda registrasi"]]
  ];
  const EDU = [
    ["rekam_medis", "Rekam Medis dan Informasi Kesehatan", "edu", ["manajemen informasi kesehatan", "informasi kesehatan", "rekam medis", "rekam medik", "rmik", "perekam medis", "perekam medik"]],
    ["keperawatan", "Keperawatan", "edu", ["keperawatan", "ners", "nursing"]],
    ["farmasi", "Farmasi", "edu", ["farmasi", "apoteker", "pharmacy"]],
    ["kedokteran", "Kedokteran", "edu", ["kedokteran", "dokter umum", "medicine"]],
    ["ti", "Teknik Informatika / Sistem Informasi", "edu", ["teknik informatika", "sistem informasi", "ilmu komputer", "informatika", "teknologi informasi", "teknik komputer"]],
    ["ekonomi", "Ekonomi / Manajemen / Akuntansi", "edu", ["ekonomi", "manajemen", "akuntansi", "keuangan", "bisnis"]],
    ["kesehatan_umum", "Kesehatan", "edu", ["kesehatan masyarakat", "analis kesehatan", "kebidanan", "kesmas", "gizi", "kesehatan"]]
  ];
  const CON = {}, EDUM = {};
  CONCEPTS.forEach(([id, label, kind]) => CON[id] = { label, kind });
  EDU.forEach(([id, label]) => EDUM[id] = { label });
  const IMPL_C = { pendaftaran: ["admin"], filing: ["admin"], klaim: ["admin"] };   // punya X berarti juga punya Y
  const IMPL_F = { rekam_medis: ["kesehatan_umum"], keperawatan: ["kesehatan_umum"], farmasi: ["kesehatan_umum"], kedokteran: ["kesehatan_umum"] };
  const HEALTH = /rumah sakit|\brs\b|\brsu\b|\brsud\b|klinik|puskesmas|hospital|clinic|kesehatan|medis|health|farmasi|laboratorium/i;

  // Keluarga posisi. edu = bobot kesesuaian pendidikan; core = konsep inti posisi; licensed = butuh pendidikan/STR khusus.
  const FAM = [
    { id: "nursing", label: "Keperawatan", licensed: true, title: /perawat|nurse|keperawatan|\bners\b|bidan/, core: ["asuhan_kep", "str"], edu: { keperawatan: 1 } },
    { id: "pharmacy", label: "Kefarmasian", licensed: true, title: /apoteker|farmasi|pharmac/, core: ["str"], edu: { farmasi: 1 } },
    { id: "doctor", label: "Kedokteran", licensed: true, title: /\bdokter\b|doctor|physician/, core: ["str"], edu: { kedokteran: 1 } },
    { id: "medical_records", label: "Rekam medis dan informasi kesehatan", title: /rekam medi[sk]|medical records?|perekam|health information|coder|coding|informasi kesehatan/, core: ["icd10", "icd9cm", "rme", "filing", "audit_rm", "statistik"], edu: { rekam_medis: 1, kesehatan_umum: 0.4 } },
    { id: "registration", label: "Pendaftaran pasien", title: /pendaftaran|registrasi|admisi|admission|registration|front office|\btpp\b/, core: ["pendaftaran", "rme", "simrs", "komunikasi"], edu: { rekam_medis: 0.6, kesehatan_umum: 0.5, ekonomi: 0.3 } },
    { id: "hospital_admin", label: "Administrasi rumah sakit", title: /administrasi|\badmin\b|klaim|verifikator|sekretaris/, core: ["admin", "msoffice", "klaim", "pendaftaran"], edu: { rekam_medis: 0.6, kesehatan_umum: 0.5, ekonomi: 0.6 } },
    { id: "it", label: "Teknologi informasi", title: /\bit\b|simrs|programmer|developer|sistem informasi|jaringan|software|teknisi/, core: ["simrs", "basis_data", "jaringan"], edu: { ti: 1 } },
    { id: "finance", label: "Keuangan", title: /finance|keuangan|akuntan|accounting|kasir|billing/, core: ["msoffice"], edu: { ekonomi: 1 } },
    { id: "marketing", label: "Pemasaran", title: /marketing|pemasaran|sales|humas/, core: ["komunikasi"], edu: { ekonomi: 0.6 } }
  ];
  const titleFamily = t => FAM.find(f => f.title.test(String(t || "").toLowerCase())) || null;

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mk = list => list.flatMap(x => x[3].map(a => [a, x[0]])).sort((p, q) => q[0].length - p[0].length)
    .map(([a, id]) => [new RegExp("(?<![a-z0-9])" + esc(a) + "(?![a-z0-9])", "g"), id]);
  const C_TABLE = mk(CONCEPTS), EDU_TABLE = mk(EDU);
  // Mencari konsep dalam teks. Alias terpanjang diproses dulu dan bagian yang cocok dihapus (tidak tumpang tindih).
  function scan(text, tbl) {
    let s = String(text || "").toLowerCase(); const out = [];
    for (const [re, id] of tbl) { let hit = false; s = s.replace(re, m => { hit = true; return " ".repeat(m.length); }); if (hit && !out.includes(id)) out.push(id); }
    return out;
  }
  const LV = [[/(?<![a-z0-9])(s[\s-]?3|doktor)(?![a-z0-9])/, 6], [/(?<![a-z0-9])(s[\s-]?2|magister)(?![a-z0-9])/, 5],
    [/(?<![a-z0-9])(s[\s-]?1|sarjana|d[\s-]?4|d[\s-]?iv|diploma\s*(4|iv)|ners)(?![a-z0-9])/, 4], [/(?<![a-z0-9])(d[\s-]?3|d[\s-]?iii|diploma\s*(3|iii))(?![a-z0-9])/, 3],
    [/(?<![a-z0-9])(d[\s-]?2|d[\s-]?ii|diploma\s*(2|ii))(?![a-z0-9])/, 2], [/(?<![a-z0-9])(d[\s-]?1|diploma\s*(1|i))(?![a-z0-9])/, 1.5],
    [/(?<![a-z0-9])(sman|smkn|sma|smk|sederajat)(?![a-z0-9])/, 1]];
  const levels = s => { s = String(s || "").toLowerCase(); return LV.filter(([re]) => re.test(s)).map(([, r]) => r); };

  const api = { CON, EDUM, C_TABLE, EDU_TABLE, IMPL_C, IMPL_F, HEALTH, FAM, titleFamily, scan, levels };
  if (typeof module !== "undefined") module.exports = api; else g.JFO = api;
})(typeof window !== "undefined" ? window : globalThis);

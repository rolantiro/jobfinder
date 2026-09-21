// Pemindai rahasia sederhana untuk dijalankan sebelum commit dan di CI: node scripts/check-secrets.js [folder]
// Gagal (exit 1) bila menemukan kunci rahasia. Nilai rahasia tidak pernah dicetak.
const fs = require("fs"), path = require("path");
const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const SKIP = new Set([".git", "node_modules", "_site", "vendor"]);   // vendor = pustaka pihak ketiga
const TEXT = /\.(js|json|html|css|md|sql|ya?ml|txt|example)$/;
const RULES = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{16,}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{30,}/],
  ["GitHub token (fine-grained)", /github_pat_[A-Za-z0-9_]{20,}/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["Nilai SUPABASE_SERVICE_KEY / GEMINI_API_KEY terisi", /(?:SUPABASE_SERVICE_KEY|GEMINI_API_KEY)[ \t]*[=:][ \t]*["']?[A-Za-z0-9._-]{12,}/]
];
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;   // kunci anon boleh; service_role tidak
const bad = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name), rel = path.relative(root, p);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p); continue; }
    if (e.name === ".env") { if (process.env.CI) bad.push([rel, 0, "File .env ikut ter-commit"]); continue; }   // lokal: .env di-ignore git
    if (!TEXT.test(e.name) || fs.statSync(p).size > 2e6) continue;
    fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      for (const [name, re] of RULES) if (re.test(line)) bad.push([rel, i + 1, name]);
      for (const m of line.matchAll(JWT)) { try { if (JSON.parse(Buffer.from(m[1], "base64url").toString()).role === "service_role") bad.push([rel, i + 1, "JWT service_role"]); } catch {} }
    });
  }
})(root);
if (bad.length) { console.error("RAHASIA TERDETEKSI (nilai disembunyikan):"); bad.forEach(([f, l, n]) => console.error(`  ${f}${l ? ":" + l : ""}  ${n}`)); process.exit(1); }
console.log("OK: tidak ada rahasia terdeteksi.");

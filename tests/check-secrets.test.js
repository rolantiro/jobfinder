// Uji offline pemindai rahasia: node tests/check-secrets.test.js
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path"), { spawnSync } = require("child_process");
const script = path.join(__dirname, "../scripts/check-secrets.js"), b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = role => [b64({ alg: "HS256", typ: "JWT" }), b64({ role, ref: "abc" }), "x".repeat(24)].join(".");
const run = (files, env = {}) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "jf-")); for (const [n, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, n)), { recursive: true }); fs.writeFileSync(path.join(d, n), c); }
  const r = spawnSync("node", [script, d], { encoding: "utf8", env: { ...process.env, CI: "", ...env } }); fs.rmSync(d, { recursive: true, force: true }); return r;
};
assert.equal(run({ "js/config.js": 'window.JF_CONFIG={SUPABASE_KEY:"sb_publishable_' + "a".repeat(30) + '"};' }).status, 0, "kunci publishable boleh");
assert.equal(run({ "a.js": 'const k="' + jwt("anon") + '";' }).status, 0, "kunci anon boleh");
assert.equal(run({ ".env.example": "SUPABASE_SERVICE_KEY=\nGEMINI_API_KEY=\n" }).status, 0, "contoh .env kosong boleh");
const r1 = run({ "a.js": 'const k="' + jwt("service_role") + '";' }); assert.equal(r1.status, 1, "service_role harus ditolak"); assert.ok(!r1.stderr.includes("xxxxxxxx"), "nilai tidak dicetak");
assert.equal(run({ "b.md": "kunci: sb_secret_" + "z".repeat(24) }).status, 1, "sb_secret harus ditolak");
assert.equal(run({ "c.txt": "GEMINI_API_KEY=" + "q".repeat(20) }).status, 1, "nilai API key terisi harus ditolak");
assert.equal(run({ "d.md": "token: github_pat_" + "B".repeat(30) }).status, 1, "token GitHub fine-grained harus ditolak");
assert.equal(run({ ".env": "X=1" }, { CI: "true" }).status, 1, ".env ter-commit di CI harus ditolak");
assert.equal(run({ ".env": "X=1" }).status, 0, ".env lokal (di-ignore git) tidak dianggap masalah");
console.log("Semua uji check-secrets lolos.");

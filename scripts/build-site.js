// Menyusun folder _site berisi HANYA berkas web (bukan ingest/, tests/, supabase/, scripts/). Jalankan: node scripts/build-site.js
const fs = require("fs"), path = require("path"), root = path.join(__dirname, ".."), out = path.join(root, "_site");
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
for (const f of ["index.html", "css", "js"]) fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });
console.log("_site siap:", fs.readdirSync(out).join(", "));

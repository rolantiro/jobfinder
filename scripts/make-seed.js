// Membuat supabase/002_seed.sql dari js/data.js. Jalankan: node scripts/make-seed.js
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/data.js", "utf8") + "\nmodule.exports={JOBS};";
const m = { exports: {} }; new Function("module", src)(m);
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const arr = a => "array[" + a.map(q).join(",") + "]::text[]";
const rows = m.exports.JOBS.map(j =>
  `(${q(j.title)},${q(j.company)},${q(j.location)},${q(j.city)},${q(j.summary)},${arr(j.req)},${q(j.source)},now() - interval '${Math.round(j.hours * 60)} minutes',${q(j.category)},${q(j.type)},${q(j.mode)},${arr(j.tags)},${j.match.score})`);
const sql = `-- Data dummy. Dijalankan pada tabel kosong agar id 1..9 sesuai js/data.js.\ninsert into public.jobs (title,company,location,city,description,requirements,source_name,discovered_date,category,employment_type,work_mode,tags,ai_relevance_score) values\n${rows.join(",\n")};\n`;
fs.writeFileSync(__dirname + "/../supabase/002_seed.sql", sql);
console.log(sql);

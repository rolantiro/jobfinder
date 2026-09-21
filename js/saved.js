// Lowongan tersimpan: di perangkat (localStorage) dan, bila masuk, di Supabase (tabel saved_jobs, dikunci RLS per pengguna).
(function (g) {
  const KEY = "jf_saved_v1"; let sb = null, ids = new Set();
  const loc = { get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }, set(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {} } };
  async function load() {
    ids = new Set(loc.get()); const u = await g.JFP.user();
    if (u) { try { const { data, error } = await sb.from("saved_jobs").select("job_id").eq("user_id", u.id); if (error) throw error; ids = new Set(data.map(r => r.job_id)); loc.set([...ids]); } catch (e) { console.warn("Gagal memuat lowongan tersimpan:", e); } }
    return ids;
  }
  async function toggle(id) {
    id = +id; const on = !ids.has(id); on ? ids.add(id) : ids.delete(id); loc.set([...ids]);
    const u = await g.JFP.user(); if (!u) return on;
    const { error } = on ? await sb.from("saved_jobs").upsert({ user_id: u.id, job_id: id }, { onConflict: "user_id,job_id", ignoreDuplicates: true })
      : await sb.from("saved_jobs").delete().eq("user_id", u.id).eq("job_id", id);
    if (error) { on ? ids.delete(id) : ids.add(id); loc.set([...ids]); throw error; }   // kembalikan bila gagal
    return on;
  }
  // Setelah masuk: gabungkan simpanan lokal ke akun, lalu muat ulang dari akun
  async function sync() {
    const u = await g.JFP.user(); if (!u) return;
    const local = loc.get();
    if (local.length) { const { error } = await sb.from("saved_jobs").upsert(local.map(job_id => ({ user_id: u.id, job_id })), { onConflict: "user_id,job_id", ignoreDuplicates: true }); if (error) console.warn("Sinkron simpanan:", error.message); }
    await load();
  }
  async function clear() { ids = new Set(); loc.set([]); const u = await g.JFP.user(); if (u) { const { error } = await sb.from("saved_jobs").delete().eq("user_id", u.id); if (error) throw error; } }
  g.JFS = { init: c => { sb = c; }, load, toggle, sync, clear, clearLocal: () => { ids = new Set(); loc.set([]); }, has: id => ids.has(+id), all: () => [...ids], count: () => ids.size };
})(window);

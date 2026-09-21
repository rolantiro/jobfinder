// Penyimpanan profil kandidat: di perangkat (localStorage) dan, bila masuk, di Supabase (tabel user_profiles, dikunci RLS per pengguna).
// Yang disimpan hanya ringkasan terstruktur; tidak ada file/teks CV, nama, kontak, atau alamat.
(function (g) {
  const KEY = "jf_profile_v1", O = g.JFO; let sb = null;
  const local = { get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }, set(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }, del() { try { localStorage.removeItem(KEY); } catch {} } };
  const fromRow = r => ({ education: r.education || [], experience: r.experience || [], preferred_locations: r.preferred_locations || [], preferred_titles: r.preferred_titles || [],
    skills: (r.skills || []).filter(s => O.CON[s.id]).map(s => ({ id: s.id, source: s.source, label: O.CON[s.id].label, kind: O.CON[s.id].kind })), work_months: r.work_months, internship_months: r.internship_months, parser_version: r.parser_version });
  const toRow = (p, uid) => ({ user_id: uid, education: p.education.map(({ level, rank, field, fields }) => ({ level, rank, field, fields })),
    experience: p.experience.map(({ title, months, kind, health }) => ({ title, months, kind, health })), skills: p.skills.map(({ id, source }) => ({ id, source })),
    preferred_locations: p.preferred_locations || [], preferred_titles: p.preferred_titles || [], work_months: Math.round(p.work_months || 0), internship_months: Math.round(p.internship_months || 0), parser_version: 1 });
  async function user() { if (!sb) return null; try { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; } catch { return null; } }
  async function load() {
    const u = await user();
    if (u) { try { const { data, error } = await sb.from("user_profiles").select("*").eq("user_id", u.id).maybeSingle(); if (error) throw error; if (data) { const p = fromRow(data); local.set(p); return { profile: p, from: "akun" }; } } catch (e) { console.warn("Gagal memuat profil akun:", e); } }
    const p = local.get(); return { profile: p, from: p ? "perangkat" : null };
  }
  async function save(p) {
    local.set(p); const u = await user(); if (!u) return "perangkat";
    const { error } = await sb.from("user_profiles").upsert(toRow(p, u.id), { onConflict: "user_id" }); if (error) throw error; return "akun";
  }
  async function remove() { local.del(); const u = await user(); if (u) { const { error } = await sb.from("user_profiles").delete().eq("user_id", u.id); if (error) throw error; } }
  g.JFP = { init: c => { sb = c; }, enabled: () => !!sb, user, load, save, remove,
    signIn: (email, password) => sb.auth.signInWithPassword({ email, password }), signUp: (email, password) => sb.auth.signUp({ email, password }),
    signOut: async () => { local.del(); await sb.auth.signOut(); } };   // hapus salinan lokal agar tidak tertinggal di perangkat bersama
})(window);

// Test-Attrappe für window.supabase (nur für lokale Ansichtstests, wird nicht ausgeliefert)
(function () {
  const ls = { get: k => JSON.parse(localStorage.getItem('mock_' + k) || 'null'), set: (k, v) => localStorage.setItem('mock_' + k, JSON.stringify(v)) };
  const db = ls.get('db') || { profile: [], klassen: [{ id: 'k1', code: 'ZDS-ZPJTD', name: 'ZDS Fachschule 2026', lehrer_id: 'u-admin', aktiv: true }], fragen: [], lernstand: [], tests: [], test_ergebnisse: [], simulationen: [], users: [] };
  const save = () => ls.set('db', db);
  const users = db.users;
  if (!users.length) { users.push({ id: 'u-admin', email: 'tr@rcc-online.com', password: 'admin123' }); db.profile.push({ id: 'u-admin', rolle: 'admin', spitzname: 'Thomas', klasse_id: null }); }
  let listeners = [];
  const session = () => { const u = ls.get('session'); return u ? { user: u } : null; };
  const emit = ev => listeners.forEach(f => f(ev, session()));
  function q(table) {
    let rows = () => db[table] || [];
    const f = []; let ord = null, lim = null, single = false, op = 'select', payload = null;
    const api = {
      select() { return api; }, eq(c, v) { f.push(r => r[c] === v); return api; }, order(c, o) { ord = [c, o?.ascending !== false]; return api; }, limit(n) { lim = n; return api; },
      maybeSingle() { single = true; return api; },
      insert(p) { op = 'insert'; payload = [].concat(p); return api; }, upsert(p) { op = 'upsert'; payload = [].concat(p); return api; }, update(p) { op = 'update'; payload = p; return api; },
      then(res, rej) {
        try {
          const uid = session()?.user?.id;
          if (op === 'insert' || op === 'upsert') {
            for (const r of payload) {
              const x = { id: r.id || Math.random().toString(36).slice(2), created_at: new Date().toISOString(), ...r };
              if (table === 'lernstand') { const i = db.lernstand.findIndex(y => y.user_id === x.user_id && y.frage_id === x.frage_id); i >= 0 ? db.lernstand[i] = x : db.lernstand.push(x); }
              else { const i = db[table].findIndex(y => y.id === x.id); i >= 0 && op === 'upsert' ? db[table][i] = { ...db[table][i], ...x } : db[table].push(x); }
            }
            save(); return Promise.resolve({ data: null, error: null }).then(res, rej);
          }
          if (op === 'update') { rows().filter(r => f.every(g => g(r))).forEach(r => Object.assign(r, payload)); save(); return Promise.resolve({ data: null, error: null }).then(res, rej); }
          let out = rows().filter(r => f.every(g => g(r)));
          if (table === 'lernstand' || table === 'simulationen' || table === 'test_ergebnisse') out = out.filter(r => r.user_id === uid);
          if (table === 'fragen') out = out.filter(r => r.aktiv !== false);
          if (ord) out = out.slice().sort((a, b) => (a[ord[0]] > b[ord[0]] ? 1 : -1) * (ord[1] ? 1 : -1));
          if (lim) out = out.slice(0, lim);
          return Promise.resolve({ data: single ? (out[0] || null) : out, error: null }).then(res, rej);
        } catch (e) { return Promise.resolve({ data: null, error: { message: e.message } }).then(res, rej); }
      },
    };
    return api;
  }
  window.supabase = {
    createClient() {
      return {
        from: q,
        rpc: async (fn, a) => {
          if (fn === 'klasse_pruefen') return { data: db.klassen.find(k => k.code === a.p_code.toUpperCase())?.name || null, error: null };
          if (fn === 'klassen_fortschritt') return { data: db.profile.filter(p => p.klasse_id === a.p_klasse).map(p => ({ spitzname: p.spitzname, bearbeitet: 12, sicher: 4, quote: 71 })), error: null };
          if (fn === 'test_auswertung') return { data: db.test_ergebnisse.filter(e => e.test_id === a.p_test).map(e => ({ ...e, spitzname: db.profile.find(p => p.id === e.user_id)?.spitzname })), error: null };
          return { data: null, error: null };
        },
        auth: {
          onAuthStateChange(fn) { listeners.push(fn); setTimeout(() => fn('INITIAL_SESSION', session()), 0); return { data: { subscription: { unsubscribe() { } } } }; },
          async signInWithPassword({ email, password }) { const u = users.find(x => x.email === email && x.password === password); if (!u) return { error: { message: 'Invalid login credentials' } }; ls.set('session', { id: u.id, email }); emit('SIGNED_IN'); return { error: null }; },
          async signUp({ email, password, options }) { if (users.find(x => x.email === email)) return { error: { message: 'User already registered' } }; const id = 'u-' + Math.random().toString(36).slice(2); users.push({ id, email, password }); const k = db.klassen.find(k => k.code === options.data.klassencode); db.profile.push({ id, rolle: 'schueler', spitzname: options.data.spitzname, klasse_id: k?.id }); save(); return { error: null }; },
          async signOut() { ls.set('session', null); emit('SIGNED_OUT'); return {}; },
        },
      };
    },
  };
})();

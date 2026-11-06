// RCC Lerntrainer – Demo-Backend (ersetzt Supabase in der Einzeldatei-Demo).
// Alle Daten liegen nur im localStorage dieses Browsers. Zugriffsregeln wie in supabase/01_schema.sql nachgebildet.
(function () {
  const K = 'demo_db_v1';
  const ls = { get: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
  const slug = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const DOM = 'schueler.rcc-online.com', CODE = 'DEMO-2026';
  const tage = n => new Date(Date.now() - n * 864e5).toISOString();
  function seed() {
    const fr = (window.__FRAGEN || []).map(q => ({ ...q, aktiv: true }));
    const gp = fr.filter(q => q.status === 'geprueft');
    let r = 7; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const users = [{ id: 'u-admin', email: 'betreiber@demo.de', password: 'demo1234' }, { id: 'u-lehrer', email: 'lehrkraft@demo.de', password: 'demo1234' }];
    const profile = [{ id: 'u-admin', rolle: 'admin', spitzname: 'Betreiber (Demo)', klasse_id: null }, { id: 'u-lehrer', rolle: 'lehrer', spitzname: 'Lehrkraft (Demo)', klasse_id: null }];
    const SCH = ['Anna Becker', 'Jonas Klein', 'Lea Schmitz', 'Tim Wagner', 'Sara Yilmaz'];
    const lernstand = [];
    SCH.forEach((n, i) => {
      const id = 's' + i; users.push({ id, email: `${slug(n)}.${slug(CODE)}@${DOM}`, password: `rcc-1234-${CODE}` });
      profile.push({ id, rolle: 'schueler', spitzname: n, klasse_id: 'k-demo' });
      const anz = [140, 90, 210, 50, 120][i];
      for (let j = 0; j < anz; j++) { const q = gp[Math.floor(rnd() * gp.length)]; if (lernstand.find(x => x.user_id === id && x.frage_id === q.id)) continue; const ri = Math.floor(rnd() * 4), fa = Math.floor(rnd() * 2); lernstand.push({ user_id: id, frage_id: q.id, fach: Math.min(5, ri + (fa ? 0 : 1)), richtig: ri, falsch: fa, zuletzt: tage(Math.floor(rnd() * 20)) }); }
    });
    const tq = gp.filter(q => q.thema === 'Gelatine' || q.thema === 'Pektin').slice(0, 10);
    const test = { id: 't-demo', code: 'DEMO01', klasse_id: 'k-demo', titel: 'Kurztest Gelatine und Pektin', frage_ids: tq.map(q => q.id), zeit_min: 10, aktiv: true, ersteller: 'u-lehrer', created_at: tage(2) };
    const erg = SCH.slice(0, 4).map((n, i) => { const ant = Object.fromEntries(tq.map((q, j) => [q.id, (j + i) % 4 === 0 && j < 6 ? 'X' : q.loesung])); return { id: 'e' + i, test_id: 't-demo', user_id: 's' + i, antworten: ant, richtig: tq.filter(q => ant[q.id] === q.loesung).length, gesamt: tq.length, abgegeben_at: tage(2) }; });
    return { users, profile, klassen: [{ id: 'k-demo', code: CODE, name: 'Demo-Klasse 2026', lehrer_id: 'u-lehrer', aktiv: true, created_at: tage(30) }], fragen: fr, lernstand, tests: [test], test_ergebnisse: erg, simulationen: [] };
  }
  let db = ls.get(K); if (!db) { db = seed(); ls.set(K, db); }
  const save = () => ls.set(K, db);
  let listeners = [];
  const session = () => { const u = ls.get('demo_session'); return u ? { user: u } : null; };
  const emit = ev => listeners.forEach(f => f(ev, session()));
  const me = () => { const u = session()?.user; return u ? db.profile.find(p => p.id === u.id) || { id: u.id, rolle: 'schueler' } : null; };
  const lehrerVon = k => { const p = me(); if (!p) return false; if (p.rolle === 'admin') return true; return db.klassen.some(x => x.id === k && x.lehrer_id === p.id); };
  // Lesefilter wie Row Level Security
  function sicht(table, rows) {
    const p = me(); if (!p) return table === 'fragen' ? [] : [];
    const admin = p.rolle === 'admin';
    switch (table) {
      case 'profile': return rows.filter(r => r.id === p.id || admin || (r.klasse_id && lehrerVon(r.klasse_id)));
      case 'klassen': return rows.filter(r => admin || r.lehrer_id === p.id || r.id === p.klasse_id);
      case 'fragen': return rows.filter(r => admin || r.aktiv !== false);
      case 'lernstand': case 'simulationen': return rows.filter(r => r.user_id === p.id);
      case 'tests': return rows.filter(r => admin || lehrerVon(r.klasse_id) || r.klasse_id === p.klasse_id);
      case 'test_ergebnisse': return rows.filter(r => r.user_id === p.id || admin || lehrerVon(db.tests.find(t => t.id === r.test_id)?.klasse_id));
      default: return rows;
    }
  }
  function q(table) {
    const f = []; let ord = null, lim = null, single = false, op = 'select', payload = null;
    const api = {
      select() { return api; }, eq(c, v) { f.push(r => r[c] === v); return api; }, in(c, v) { f.push(r => v.includes(r[c])); return api; },
      order(c, o) { ord = [c, o?.ascending !== false]; return api; }, limit(n) { lim = n; return api; }, maybeSingle() { single = true; return api; }, single() { single = true; return api; },
      insert(p) { op = 'insert'; payload = [].concat(p); return api; }, upsert(p) { op = 'upsert'; payload = [].concat(p); return api; }, update(p) { op = 'update'; payload = p; return api; }, delete() { op = 'delete'; return api; },
      then(res, rej) {
        try {
          db[table] = db[table] || [];
          if (op === 'insert' || op === 'upsert') {
            for (const r of payload) {
              const x = { id: r.id || Math.random().toString(36).slice(2), created_at: new Date().toISOString(), ...r };
              if (table === 'lernstand') { const i = db.lernstand.findIndex(y => y.user_id === x.user_id && y.frage_id === x.frage_id); i >= 0 ? db.lernstand[i] = x : db.lernstand.push(x); continue; }
              if (table === 'test_ergebnisse' && db.test_ergebnisse.some(y => y.test_id === x.test_id && y.user_id === x.user_id)) return Promise.resolve({ data: null, error: { message: 'duplicate key value violates unique constraint' } }).then(res, rej);
              const i = db[table].findIndex(y => y.id === x.id);
              if (i >= 0 && op === 'upsert') db[table][i] = { ...db[table][i], ...x }; else db[table].push(x);
            }
            save(); return Promise.resolve({ data: null, error: null }).then(res, rej);
          }
          if (op === 'update') { sicht(table, db[table]).filter(r => f.every(g => g(r))).forEach(r => Object.assign(r, payload)); save(); return Promise.resolve({ data: null, error: null }).then(res, rej); }
          if (op === 'delete') { const weg = new Set(sicht(table, db[table]).filter(r => f.every(g => g(r)))); db[table] = db[table].filter(r => !weg.has(r)); save(); return Promise.resolve({ data: null, error: null }).then(res, rej); }
          let out = sicht(table, db[table]).filter(r => f.every(g => g(r)));
          if (ord) out = out.slice().sort((a, b) => (a[ord[0]] > b[ord[0]] ? 1 : a[ord[0]] < b[ord[0]] ? -1 : 0) * (ord[1] ? 1 : -1));
          if (lim) out = out.slice(0, lim);
          return Promise.resolve({ data: single ? (out[0] || null) : JSON.parse(JSON.stringify(out)), error: null }).then(res, rej);
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
          if (fn === 'klasse_pruefen') return { data: db.klassen.find(k => k.code === String(a.p_code).toUpperCase())?.name || null, error: null };
          if (fn === 'klassen_fortschritt') {
            if (!lehrerVon(a.p_klasse)) return { data: [], error: null };
            return { data: db.profile.filter(p => p.klasse_id === a.p_klasse && p.rolle === 'schueler').map(p => { const l = db.lernstand.filter(x => x.user_id === p.id); const ri = l.reduce((s, x) => s + x.richtig, 0), fa = l.reduce((s, x) => s + x.falsch, 0); return { id: p.id, spitzname: p.spitzname, bearbeitet: l.length, sicher: l.filter(x => x.fach >= 3).length, quote: ri + fa ? Math.round(100 * ri / (ri + fa)) : null, zuletzt: l.map(x => x.zuletzt).sort().pop() || null }; }).sort((x, y) => x.spitzname.localeCompare(y.spitzname)), error: null };
          }
          if (fn === 'test_auswertung') { const t = db.tests.find(t => t.id === a.p_test); if (!t || !lehrerVon(t.klasse_id)) return { data: [], error: null }; return { data: db.test_ergebnisse.filter(e => e.test_id === a.p_test).map(e => ({ ...e, spitzname: db.profile.find(p => p.id === e.user_id)?.spitzname })), error: null }; }
          if (fn === 'pin_zuruecksetzen') { const p = db.profile.find(x => x.id === a.p_user); if (!p || !lehrerVon(p.klasse_id)) return { data: null, error: { message: 'Keine Berechtigung' } }; const k = db.klassen.find(x => x.id === p.klasse_id); const pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); db.users.find(u => u.id === a.p_user).password = `rcc-${pin}-${k.code}`; save(); return { data: pin, error: null }; }
          return { data: null, error: null };
        },
        auth: {
          onAuthStateChange(fn) { listeners.push(fn); setTimeout(() => fn('INITIAL_SESSION', session()), 0); return { data: { subscription: { unsubscribe() { } } } }; },
          async signInWithPassword({ email, password }) { const u = db.users.find(x => x.email === email && x.password === password); if (!u) return { error: { message: 'Invalid login credentials' } }; ls.set('demo_session', { id: u.id, email }); emit('SIGNED_IN'); return { error: null }; },
          async signUp({ email, password, options }) {
            if (db.users.find(x => x.email === email)) return { error: { message: 'User already registered' } };
            const code = options?.data?.klassencode; const k = db.klassen.find(k => k.code === code);
            if (code && !k) return { error: { message: 'Database error saving new user: Klassencode unbekannt' } };
            const id = 'u-' + Math.random().toString(36).slice(2); db.users.push({ id, email, password });
            db.profile.push({ id, rolle: 'schueler', spitzname: options?.data?.spitzname || email.split('@')[0], klasse_id: k?.id || null }); save(); return { error: null };
          },
          async signOut() { ls.set('demo_session', null); emit('SIGNED_OUT'); return { error: null }; },
        },
      };
    },
  };
  window.__demoReset = () => { try { Object.keys(localStorage).forEach(k => localStorage.removeItem(k)); } catch { } location.hash = ''; location.reload(); };
})();

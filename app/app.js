const { createClient } = window.supabase;
import { SUPABASE_URL, SUPABASE_KEY, SCHUELER_DOMAIN, APP_VERSION } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const L = 'ABCDE';
const ORDER = ['Rohstoffe', 'Schokolade', 'Konfekt', 'Zuckerwaren', 'Dauerbackwaren', 'Recht', 'Allgemein'];
const bord = b => { const i = ORDER.indexOf(b); return i < 0 ? 99 : i; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clean = f => f.replace(/\s*Kennzeichnen Sie (die|das|den) (richtige|falsche|zutreffende)[^!?.]*[!.]?/i, '').trim();
const hinweis = f => /falsche|nicht zutreffend|ist falsch|nicht um/i.test(f) ? 'Gesucht ist die falsche Aussage' : 'Eine Antwort ist richtig';
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const randCode = (n = 5) => { const z = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; const a = crypto.getRandomValues(new Uint32Array(n)); for (const x of a) s += z[x % z.length]; return s; };
const slug = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let S = { user: null, profil: null, klasse: null, fragen: [], lern: {}, sel: new Set(store.get('sel', [])), nurGeprueft: store.get('nurGeprueft', true) };

/* ---------------- Daten ---------------- */
async function ladeFragen() {
  const cache = store.get('fragen', null);
  if (cache) S.fragen = cache;
  const { data, error } = await sb.from('fragen').select('id,bereich,thema,frage,optionen,loesung,status,hinweis').eq('aktiv', true).order('id');
  if (!error && data?.length) { S.fragen = data; store.set('fragen', data); }
}
async function ladeLernstand() {
  const { data, error } = await sb.from('lernstand').select('frage_id,fach,richtig,falsch,zuletzt');
  if (!error) { S.lern = {}; data.forEach(r => S.lern[r.frage_id] = r); store.set('lern', S.lern); }
  else S.lern = store.get('lern', {});
}
async function verbuche(q, ok) {
  const s = S.lern[q.id] || { frage_id: q.id, fach: 0, richtig: 0, falsch: 0 };
  ok ? (s.richtig++, s.fach = Math.min(5, s.fach + 1)) : (s.falsch++, s.fach = 1);
  s.zuletzt = new Date().toISOString(); S.lern[q.id] = s; store.set('lern', S.lern);
  const row = { user_id: S.user.id, frage_id: q.id, fach: s.fach, richtig: s.richtig, falsch: s.falsch, zuletzt: s.zuletzt };
  const { error } = await sb.from('lernstand').upsert(row);
  if (error) { const qq = store.get('queue', {}); qq[q.id] = row; store.set('queue', qq); }
}
async function flushQueue() {
  const qq = store.get('queue', {}); const rows = Object.values(qq);
  if (!rows.length || !S.user) return;
  const { error } = await sb.from('lernstand').upsert(rows.filter(r => r.user_id === S.user.id));
  if (!error) store.set('queue', {});
}
const geprueft = q => q.status === 'geprueft';
const auswahl = () => S.fragen.filter(q => (S.sel.size === 0 || S.sel.has(q.bereich + '|' + q.thema)) && (!S.nurGeprueft || geprueft(q)));

/* ---------------- Anmeldung ---------------- */
// Klassencode tolerant einlesen: Kleinschreibung, Leerzeichen, fehlender Bindestrich (zdszpjtd → ZDS-ZPJTD)
const normCode = c => { c = String(c || '').toUpperCase().replace(/[\s_]/g, ''); if (!c.includes('-') && /^[A-Z]{3}[A-Z0-9]{5}$/.test(c)) c = c.slice(0, 3) + '-' + c.slice(3); return c; };
const einladeLink = code => location.origin + location.pathname + '?k=' + encodeURIComponent(code);
// Einladungslink ?k=CODE: Code merken, Adresse bereinigen
(() => { try { const k = new URLSearchParams(location.search).get('k'); if (k) { store.set('lastcode', normCode(k)); store.set('logintab', 'schueler'); history.replaceState(null, '', location.pathname + location.hash); } } catch { } })();
function schuelerZugang(code, nick, pin) {
  code = normCode(code);
  return { code, email: `${slug(nick)}.${slug(code)}@${SCHUELER_DOMAIN}`, password: `rcc-${pin}-${code}` };
}
function loginView(tab = store.get('logintab', 'schueler')) {
  setNav([]);
  $('#wer').innerHTML = '';
  $('#view').innerHTML = `<div class="login-wrap"><div class="login-marke">
    <p class="eyebrow">RCC Lerntrainer</p>
    <h2 class="hero-titel">Süßwarentechnologie üben – Frage für Frage.</h2>
    <ul class="vorteile"><li><img class="vicon" src="icons/lu_check_aktiv.svg" alt="">über 500 geprüfte Prüfungsfragen</li><li><img class="vicon" src="icons/lu_check_aktiv.svg" alt="">Lernkartei: Schwächen kommen zuerst</li><li><img class="vicon" src="icons/lu_check_aktiv.svg" alt="">Prüfungssimulation und Tests der Lehrkraft</li></ul>
    <p class="klein">Bereitgestellt von RCC Consulting GmbH – technische Beratung für die Süßwarenindustrie.</p>
  </div><div class="login">
    <h3>Anmelden</h3>
    <div class="tabs"><button class="btn ${tab === 'schueler' ? '' : 'sek'}" data-t="schueler">Schüler</button><button class="btn ${tab === 'lehrer' ? '' : 'sek'}" data-t="lehrer">Lehrkraft</button></div>
    ${tab === 'schueler' ? `
      ${store.get('lastcode', '') ? `<div class="klassefix" id="klassefix"><span>Klasse</span><b id="kname">${esc(store.get('lastcode', ''))}</b><button type="button" class="linkbtn" id="kaendern">ändern</button></div>` : ''}
      <label class="feld" id="codefeld"${store.get('lastcode', '') ? ' hidden' : ''}>Klassencode<input id="code" autocomplete="off" autocapitalize="characters" placeholder="z. B. ZDS-7KQ2M" value="${esc(store.get('lastcode', ''))}"></label>
      <label class="feld">Name<input id="nick" autocomplete="name" autocapitalize="words" maxlength="40" placeholder="am besten Vor- und Nachname" value="${esc(store.get('lastnick', ''))}"></label>
      <label class="feld">PIN (4 Ziffern)<input id="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password"></label>
      <div class="actions" style="margin:0"><button class="btn" id="anmelden">Anmelden</button><button class="btn sek" id="neu">Neu registrieren</button></div>
      <p class="hint">Name und PIN sind dein Zugang – PIN gut merken. Mit Vor- und Nachnamen weiß deine Lehrkraft, wer du bist. Sie sieht deinen Namen und deinen Lernfortschritt. PIN vergessen? Die Lehrkraft kann sie zurücksetzen.</p>`
      : `
      <label class="feld">E-Mail<input id="mail" type="email" autocomplete="username"></label>
      <label class="feld">Passwort<input id="pw" type="password" autocomplete="current-password"></label>
      <div class="actions" style="margin:0"><button class="btn" id="lanmelden">Anmelden</button></div>
      <p class="hint">Zugänge für Lehrkräfte vergibt RCC Consulting.</p>`}
    <p class="fehlermeldung" id="err" role="alert"></p></div></div>`;
  $$('.tabs button').forEach(b => b.onclick = () => { store.set('logintab', b.dataset.t); loginView(b.dataset.t); });
  const err = m => { $('#err').textContent = m; };
  if (tab === 'schueler') {
    if ($('#kaendern')) {
      $('#kaendern').onclick = () => { $('#klassefix').remove(); $('#codefeld').hidden = false; $('#code').focus(); $('#code').select(); };
      sb.rpc('klasse_pruefen', { p_code: normCode(store.get('lastcode', '')) }).then(({ data }) => { if (data && $('#kname')) $('#kname').textContent = data; });
    }
    const werte = (neu = false) => {
      const code = $('#code').value, nick = $('#nick').value.trim().replace(/\s+/g, ' '), pin = $('#pin').value.trim();
      if (!code.trim()) return err('Bitte Klassencode eingeben.');
      if (!/^[\p{L}0-9 '._-]{3,40}$/u.test(nick)) return err('Name: 3–40 Zeichen, Buchstaben, Ziffern, Leerzeichen oder Bindestrich.');
      if (!/^\d{4}$/.test(pin)) return err('Die PIN hat genau 4 Ziffern.');
      store.set('lastcode', normCode(code)); store.set('lastnick', nick);
      return { nick, ...schuelerZugang(code, nick, pin) };
    };
    $('#anmelden').onclick = async () => {
      const w = werte(); if (!w) return; err('');
      const { error } = await sb.auth.signInWithPassword({ email: w.email, password: w.password });
      if (error) err('Anmeldung fehlgeschlagen. Stimmen Klassencode, Name und PIN? Neu hier? Dann „Neu registrieren“. PIN vergessen? Lehrkraft fragen.');
    };
    $('#neu').onclick = async () => {
      const w = werte(true); if (!w) return; err('');
      const { data: kname, error: e1 } = await sb.rpc('klasse_pruefen', { p_code: w.code });
      if (e1) return err('Keine Verbindung zum Server. Bitte später erneut versuchen.');
      if (!kname) return err('Diesen Klassencode gibt es nicht. Bitte bei der Lehrkraft nachfragen.');
      const { error } = await sb.auth.signUp({ email: w.email, password: w.password, options: { data: { klassencode: w.code, spitzname: w.nick } } });
      if (error) return err(/registered|exists/i.test(error.message) ? 'Diesen Namen gibt es in der Klasse schon. Schon registriert? Dann „Anmelden“. Sonst bitte die Lehrkraft fragen.' : 'Registrierung fehlgeschlagen: ' + error.message);
      const { error: e2 } = await sb.auth.signInWithPassword({ email: w.email, password: w.password });
      if (e2) err('Konto angelegt, Anmeldung fehlgeschlagen: ' + e2.message);
    };
  } else {
    $('#lanmelden').onclick = async () => {
      err('');
      const { error } = await sb.auth.signInWithPassword({ email: $('#mail').value.trim(), password: $('#pw').value });
      if (error) err('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.');
    };
  }
}

/* ---------------- Rahmen ---------------- */
function rolle() { return S.profil?.rolle || 'schueler'; }
const ICON = { start: 'target', lernen: 'book-open', pruefung: 'hourglass', tests: 'circle-check', fortschritt: 'trending-up', klassen: 'users', testbau: 'circle-plus', fragen: 'circle-help' };
const BICON = { Rohstoffe: 'wheat', Schokolade: 'bean', Konfekt: 'candy', Zuckerwaren: 'lollipop', Dauerbackwaren: 'cookie', Recht: 'scale', Allgemein: 'shield-check' };
const icon = (k, v = 'navy') => ICON[k] ? `<img src="icons/lu_${ICON[k]}_${v}.svg" alt="" aria-hidden="true">` : '';
function views() {
  const v = [['start', 'Start'], ['lernen', 'Lernen'], ['pruefung', 'Prüfung'], ['tests', 'Tests'], ['fortschritt', 'Fortschritt']];
  if (rolle() === 'lehrer' || rolle() === 'admin') v.push(['klassen', 'Klassen'], ['testbau', 'Tests erstellen']);
  if (rolle() === 'admin') v.push(['fragen', 'Fragen prüfen']);
  return v;
}
function setNav(v) {
  $('#nav').innerHTML = v.map(([k, t]) => `<a href="#${k}" data-v="${k}">${icon(k)}<span>${t}</span></a>`).join('');
  const b = v.filter(([k]) => ['start', 'lernen', 'pruefung', 'tests', 'fortschritt'].includes(k));
  $('#bnav').innerHTML = b.map(([k, t]) => `<a href="#${k}" data-v="${k}">${icon(k)}<span>${t}</span></a>`).join('');
  $('#bnav').hidden = !v.length; document.body.classList.toggle('mit-bnav', !!v.length);
}
function wer() {
  $('#wer').innerHTML = `<span>${esc(S.profil?.spitzname || '')}${S.klasse ? ' · ' + esc(S.klasse.name) : ''}${rolle() !== 'schueler' ? ' · ' + (rolle() === 'admin' ? 'Betreiber' : 'Lehrkraft') : ''}</span><button id="abmelden">Abmelden</button>`;
  $('#abmelden').onclick = async e => {
    // Abmelden muss immer klappen – auch wenn der Server nicht antwortet oder einen Fehler meldet.
    e.currentTarget.disabled = true; e.currentTarget.textContent = 'Abmelden …';
    try {
      const r = await Promise.race([sb.auth.signOut({ scope: 'local' }), new Promise(ok => setTimeout(() => ok({ error: 'Zeitüberschreitung' }), 3000))]);
      if (r?.error) console.warn('Abmelden (Server):', r.error);
    } catch (x) { console.warn('Abmelden:', x); }
    try { Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k)); } catch { }
    store.set('fragen', null); store.set('lern', {});
    location.hash = ''; location.reload();
  };
}
function themenSpalte(onChange, mitFilter = true) {
  const g = {}; S.fragen.filter(q => !S.nurGeprueft || geprueft(q)).forEach(q => { (g[q.bereich] ??= {}); g[q.bereich][q.thema] = (g[q.bereich][q.thema] || 0) + 1; });
  const el = document.createElement('div'); el.className = 'themen-inhalt';
  Object.keys(g).sort((a, b) => bord(a) - bord(b)).forEach(b => {
    const ts = Object.keys(g[b]).sort(), all = ts.every(t => S.sel.has(b + '|' + t)), sum = ts.reduce((a, t) => a + g[b][t], 0);
    const d = document.createElement('div'); d.className = 'bereich';
    d.innerHTML = `<button type="button" aria-pressed="${all}"><span>${esc(b)}</span><span style="font-size:14px;color:var(--text-2)">${sum}</span></button><div class="chips"></div>`;
    d.firstElementChild.onclick = () => { ts.forEach(t => all ? S.sel.delete(b + '|' + t) : S.sel.add(b + '|' + t)); store.set('sel', [...S.sel]); onChange(); };
    ts.forEach(t => {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.setAttribute('aria-pressed', S.sel.has(b + '|' + t));
      c.innerHTML = `${esc(t)}<span class="n">${g[b][t]}</span>`;
      c.onclick = () => { const k = b + '|' + t; S.sel.has(k) ? S.sel.delete(k) : S.sel.add(k); store.set('sel', [...S.sel]); onChange(); };
      d.lastElementChild.append(c);
    });
    el.append(d);
  });
  const e = document.createElement('div'); e.className = 'einst';
  e.innerHTML = `${location.hash === '#lernen' || location.hash === '' ? `<label class="zeile">Fragen je Runde <select id="anz">${[5, 10, 20, 30].map(x => `<option ${x == store.get('anz', 10) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>` : ''}${mitFilter && rolle() !== 'schueler' ? `<label class="zeile"><input type="checkbox" id="nurg" ${S.nurGeprueft ? 'checked' : ''}> Nur geprüfte Lösungen</label>` : ''}<span>${S.sel.size ? S.sel.size + ' Themen gewählt' : 'Kein Thema gewählt = alle Themen'}</span>${S.sel.size ? '<button class="chip" id="alleab" type="button">Auswahl aufheben</button>' : ''}`;
  el.append(e);
  if ($('#nurg', el)) $('#nurg', el).onchange = ev => { S.nurGeprueft = ev.target.checked; store.set('nurGeprueft', S.nurGeprueft); onChange(); };
  if ($('#alleab', el)) $('#alleab', el).onclick = () => { S.sel.clear(); store.set('sel', []); onChange(); };
  return el;
}
function themenText() { return S.sel.size ? `${S.sel.size} ${S.sel.size === 1 ? 'Thema' : 'Themen'} gewählt` : 'alle Themen'; }
function rahmen(onChange) {
  const v = $('#view'); v.innerHTML = '';
  const g = document.createElement('div'); g.className = 'grid';
  const a = document.createElement('aside'); a.className = 'themen';
  const d = document.createElement('details'); d.open = matchMedia('(min-width: 781px)').matches || store.get('themenOffen', false);
  d.innerHTML = `<summary><span>Themen</span><span class="wahl">${themenText()}</span></summary>`;
  d.ontoggle = () => { if (!matchMedia('(min-width: 781px)').matches) store.set('themenOffen', d.open); };
  d.append(themenSpalte(onChange)); a.append(d); g.append(a);
  const p = document.createElement('section'); p.className = 'panel'; p.setAttribute('aria-live', 'polite'); g.append(p); v.append(g); return p;
}
const optionenHtml = (q, cls) => `<div class="optlist">${q.optionen.map((o, i) => `<button class="opt ${cls ? cls(L[i]) : ''}" data-l="${L[i]}"><span class="hex">${L[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
const fehlerListe = f => f.length ? `<h2>Falsch beantwortet</h2><div class="liste">${f.map(x => `<div><span class="f">${esc(clean(x.q.frage))}</span><br>Deine Antwort: ${x.l || '–'} · Richtig: ${x.q.loesung} · ${esc(x.q.optionen[L.indexOf(x.q.loesung)])}</div>`).join('')}</div>` : '';

/* ---------------- Start ---------------- */
async function startView() {
  const fs = S.fragen.filter(geprueft), g = {};
  fs.forEach(q => { (g[q.bereich] ??= { n: 0, bea: 0, beh: 0 }); g[q.bereich].n++; const s = S.lern[q.id]; if (s) { g[q.bereich].bea++; if (s.fach >= 3) g[q.bereich].beh++; } });
  const tot = Object.values(g).reduce((a, x) => ({ n: a.n + x.n, bea: a.bea + x.bea, beh: a.beh + x.beh }), { n: 0, bea: 0, beh: 0 });
  const faellig = fs.filter(q => (S.lern[q.id]?.fach ?? 0) < 3).length;
  const name = S.profil?.spitzname || '';
  const h = new Date().getHours(), gruss = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  $('#view').innerHTML = `<section class="start">
    <div class="hero"><div><p class="eyebrow">${gruss}${name ? ', ' + esc(name) : ''}</p><h2 class="hero-titel">${tot.bea ? 'Weiter, wo du aufgehört hast.' : 'Bereit für die erste Runde?'}</h2>
      <p class="hero-text">${tot.beh} von ${tot.n} Fragen sitzen sicher. ${faellig} Fragen warten auf Wiederholung.</p>
      <div class="actions"><a class="btn gross" href="#lernen">${tot.bea ? 'Weiterlernen' : 'Jetzt starten'}</a><a class="btn sek gross hell" href="#pruefung">Prüfung simulieren</a></div></div>
      <div class="hero-ring" aria-label="${Math.round(tot.beh / Math.max(1, tot.n) * 100)} Prozent sicher">${ring(tot.beh / Math.max(1, tot.n))}<span><b>${Math.round(tot.beh / Math.max(1, tot.n) * 100)}%</b>sicher</span></div></div>
    <div id="testhinweis"></div>
    <h2 class="abschnitt">Deine Bereiche</h2>
    <div class="bereiche">${Object.entries(g).sort((a, b) => bord(a[0]) - bord(b[0])).map(([b, x]) => `<button class="bkarte" data-b="${esc(b)}"><span class="hex bhex">${BICON[b] ? `<img src="icons/lu_${BICON[b]}_weiss.svg" alt="">` : esc(b[0])}</span><span class="bname">${esc(b)}</span><span class="bzahl">${x.beh} / ${x.n} sicher · ${Math.round(x.beh / x.n * 100)} %</span><span class="mbar"><i style="width:${x.beh / x.n * 100}%;background:var(--ok)"></i><i style="width:${(x.bea - x.beh) / x.n * 100}%;background:var(--navy)"></i></span></button>`).join('')}</div>
  </section>`;
  $$('.bkarte').forEach(b => b.onclick = () => {
    S.sel = new Set(S.fragen.filter(q => q.bereich === b.dataset.b).map(q => q.bereich + '|' + q.thema)); store.set('sel', [...S.sel]); location.hash = 'lernen';
  });
  if (S.profil?.klasse_id) {
    const { data: tests } = await sb.from('tests').select('id,titel,klasse_id').eq('aktiv', true);
    const { data: erg } = await sb.from('test_ergebnisse').select('test_id');
    const offen = (tests || []).filter(t => t.klasse_id === S.profil.klasse_id && !(erg || []).some(e => e.test_id === t.id));
    if (offen.length && $('#testhinweis')) $('#testhinweis').innerHTML = `<a class="testband" href="#tests"><span class="hex thex">!</span><span><b>${offen.length === 1 ? 'Ein neuer Test' : offen.length + ' neue Tests'}</b> von deiner Lehrkraft: ${esc(offen[0].titel)}${offen.length > 1 ? ' …' : ''}</span><span class="pfeil">›</span></a>`;
  }
}
function ring(anteil) {
  const r = 52, u = 2 * Math.PI * r, d = Math.max(0, Math.min(1, anteil)) * u;
  return `<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="10"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="#D9822B" stroke-width="10" stroke-linecap="round" stroke-dasharray="${d} ${u}" transform="rotate(-90 60 60)"/></svg>`;
}

/* ---------------- Lernen ---------------- */
let runde = null;
function lernenStart() {
  const n = +store.get('anz', 10);
  const p = shuffle(auswahl()).sort((a, b) => ((S.lern[a.id]?.fach) ?? 0) - ((S.lern[b.id]?.fach) ?? 0));
  runde = { qs: p.slice(0, n), k: 0, ok: 0, log: [] }; lernenRender();
}
function lernenRender() {
  const r = runde, p = rahmen(lernenStart);
  if (!r.qs.length) { p.innerHTML = '<h2>Keine Fragen</h2><p class="leer">Für diese Auswahl gibt es keine Fragen. Bitte andere Themen wählen.</p>'; return; }
  if (r.k >= r.qs.length) return lernenEnde(p);
  const q = r.qs[r.k], fach = S.lern[q.id]?.fach ?? 0;
  p.innerHTML = `<div class="meta"><span>Frage ${r.k + 1} von ${r.qs.length}</span><span>Fach ${fach} von 5 · ${r.ok} richtig</span></div><div class="bar"><i style="width:${r.k / r.qs.length * 100}%"></i></div>
  <div class="fkarte"><div class="thema">${esc(q.bereich)} · ${esc(q.thema)}</div><div class="frage">${esc(clean(q.frage))}</div><p class="hint">${hinweis(q.frage)}</p>${optionenHtml(q)}<div id="fb"></div></div>`;
  const anz = $('#anz'); if (anz) anz.onchange = e => { store.set('anz', +e.target.value); lernenStart(); };
  $$('.opt', p).forEach(b => b.onclick = () => {
    const ok = b.dataset.l === q.loesung;
    $$('.opt', p).forEach(x => { x.disabled = true; if (x.dataset.l === q.loesung) x.classList.add('richtig'); else if (x === b) x.classList.add('falsch'); });
    verbuche(q, ok); if (ok) r.ok++; r.log.push({ q, l: b.dataset.l, ok });
    $('#fb', p).innerHTML = `<div class="rueck ${ok ? 'gut' : 'schlecht'}"><strong>${ok ? 'Richtig!' : 'Leider falsch.'}</strong> <span>${ok ? (fach + 1 >= 3 ? 'Diese Frage sitzt.' : 'Weiter so.') : 'Richtig ist ' + q.loesung + '. Die Frage kommt bald wieder.'}</span>${geprueft(q) ? '' : ' <span class="tag">Lösung noch in Prüfung</span>'}</div><div class="weiter-leiste"><button class="btn gross" id="weiter">${r.k + 1 < r.qs.length ? 'Nächste Frage' : 'Auswertung'}</button></div>`;
    $('#weiter', p).onclick = () => { r.k++; lernenRender(); window.scrollTo(0, 0); }; $('#weiter', p).focus({ preventScroll: true });
    $('.rueck', p).scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
function lernenEnde(p) {
  const r = runde, pc = Math.round(r.ok / r.qs.length * 100);
  p.innerHTML = `<h2>Auswertung der Runde</h2><div class="ergebnis"><span class="hex ${pc >= 80 ? 'gut' : pc < 50 ? 'schlecht' : ''}">${pc}%</span><div><div class="frage" style="margin:0">${r.ok} von ${r.qs.length} richtig</div><p class="hint">Falsch beantwortete Fragen kommen in der nächsten Runde zuerst.</p></div></div>${fehlerListe(r.log.filter(x => !x.ok))}<div class="actions"><button class="btn" id="neu">Neue Runde</button></div>`;
  $('#neu', p).onclick = lernenStart;
}

/* ---------------- Prüfungsdurchlauf (Simulation und Tests) ---------------- */
let pr = null, uhr = null;
function durchlauf(qs, minuten, titel, onAbgabe) {
  clearInterval(uhr);
  pr = { qs, a: {}, k: 0, ende: minuten ? Date.now() + minuten * 60000 : 0, titel, onAbgabe };
  durchlaufRender();
  if (minuten) uhr = setInterval(() => {
    if (!pr) return clearInterval(uhr);
    const rest = pr.ende - Date.now(); const u = $('#uhr');
    if (rest <= 0) { clearInterval(uhr); return abgabe(); }
    if (u) { u.textContent = fmt(rest); u.classList.toggle('knapp', rest < 60000); }
  }, 1000);
}
function durchlaufRender() {
  const q = pr.qs[pr.k], a = pr.a[q.id], offen = pr.qs.filter(x => !pr.a[x.id]).length;
  $('#view').innerHTML = `<section class="panel" aria-live="polite"><div class="meta"><span>${esc(pr.titel)} · Frage ${pr.k + 1} von ${pr.qs.length} · ${pr.qs.length - offen} beantwortet</span><span class="uhr" id="uhr">${pr.ende ? fmt(pr.ende - Date.now()) : ''}</span></div>
  <div class="thema">${esc(q.bereich)} · ${esc(q.thema)}</div><div class="frage">${esc(clean(q.frage))}</div><p class="hint">${hinweis(q.frage)}</p>${optionenHtml(q, l => l === a ? 'gewaehlt' : '')}
  <div class="actions"><button class="btn sek" id="zur" ${pr.k ? '' : 'disabled'}>Zurück</button><button class="btn sek" id="vor" ${pr.k + 1 < pr.qs.length ? '' : 'disabled'}>Weiter</button><span style="flex:1"></span><span id="abg"><button class="btn" id="abgabe">Abgeben</button></span></div>
  <div class="navgrid">${pr.qs.map((x, i) => `<button class="${pr.a[x.id] ? 'beantwortet' : ''} ${i === pr.k ? 'aktiv' : ''}" data-i="${i}" aria-label="Frage ${i + 1}">${i + 1}</button>`).join('')}</div></section>`;
  $$('.opt').forEach(b => b.onclick = () => { pr.a[q.id] = b.dataset.l; if (pr.k + 1 < pr.qs.length) pr.k++; durchlaufRender(); });
  $('#zur').onclick = () => { pr.k--; durchlaufRender(); }; $('#vor').onclick = () => { pr.k++; durchlaufRender(); };
  $$('.navgrid button').forEach(b => b.onclick = () => { pr.k = +b.dataset.i; durchlaufRender(); });
  $('#abgabe').onclick = () => {
    if (!offen) return abgabe();
    $('#abg').innerHTML = `<span style="font-size:14px">${offen} offen. Trotzdem abgeben? </span><button class="btn" id="ja">Abgeben</button> <button class="btn sek" id="nein">Weiter</button>`;
    $('#ja').onclick = abgabe; $('#nein').onclick = durchlaufRender;
  };
}
async function abgabe() {
  clearInterval(uhr); const r = pr; pr = null; let ok = 0;
  const log = r.qs.map(q => { const g = r.a[q.id] === q.loesung; if (g) ok++; if (r.a[q.id]) verbuche(q, g); return { q, l: r.a[q.id], ok: g }; });
  const pc = Math.round(ok / r.qs.length * 100);
  const th = {}; log.forEach(x => { const k = x.q.bereich + ' · ' + x.q.thema; (th[k] ??= [0, 0]); th[k][1]++; if (x.ok) th[k][0]++; });
  let meldung = '';
  try { await r.onAbgabe?.(r, ok); } catch (e) { meldung = `<p class="fehlermeldung">Ergebnis konnte nicht gespeichert werden: ${esc(e.message || e)}</p>`; }
  $('#view').innerHTML = `<section class="panel"><h2>${esc(r.titel)} – Ergebnis</h2>${meldung}<div class="ergebnis"><span class="hex ${pc >= 50 ? 'gut' : 'schlecht'}">${pc}%</span><div><div class="frage" style="margin:0">${pc >= 50 ? 'Bestanden' : 'Nicht bestanden'} · ${ok} von ${r.qs.length} richtig</div><p class="hint">Bestanden ab 50 %</p></div></div>
  <h2>Nach Thema</h2><div class="tbl"><table><thead><tr><th>Thema</th><th>Richtig</th><th>Quote</th></tr></thead><tbody>${Object.entries(th).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).map(([k, [a, n]]) => `<tr><td>${esc(k)}</td><td>${a} / ${n}</td><td>${Math.round(a / n * 100)} %</td></tr>`).join('')}</tbody></table></div>
  <div style="margin-top:18px">${fehlerListe(log.filter(x => !x.ok))}</div><div class="actions"><a class="btn" href="#lernen" style="text-decoration:none">Weiter lernen</a></div></section>`;
}

/* ---------------- Prüfungssimulation ---------------- */
function pruefungStart() {
  clearInterval(uhr); pr = null;
  const cfg = store.get('prcfg', { n: 25, min: 45 }), p = rahmen(pruefungStart), verf = auswahl().length;
  p.innerHTML = `<div class="karte" style="max-width:620px"><h3 style="margin:0">Prüfungssimulation</h3>
  <p class="hint" style="margin:0">Zufällige Fragen aus der Themenauswahl, ohne Rückmeldung bis zur Abgabe. Bestanden ab 50 %.</p>
  <div class="actions" style="margin:0"><label class="feld">Fragen<select id="n">${[10, 25, 50].map(x => `<option ${x == cfg.n ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
  <label class="feld">Zeit<select id="min">${[[0, 'ohne Zeitlimit'], [10, '10 min'], [20, '20 min'], [45, '45 min'], [90, '90 min']].map(([v, t]) => `<option value="${v}" ${v == cfg.min ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
  <span class="hint" style="margin:0">${verf} Fragen in der Auswahl</span>
  <div class="actions" style="margin:0"><button class="btn" id="go" ${verf ? '' : 'disabled'}>Starten</button></div></div>`;
  $('#go', p).onclick = () => {
    const n = +$('#n', p).value, min = +$('#min', p).value; store.set('prcfg', { n, min });
    durchlauf(shuffle(auswahl()).slice(0, n), min, 'Prüfungssimulation', async (r, ok) => {
      const { error } = await sb.from('simulationen').insert({ user_id: S.user.id, richtig: ok, gesamt: r.qs.length }); if (error) throw error;
    });
  };
}

/* ---------------- Tests (Schüler) ---------------- */
async function testsView() {
  const v = $('#view'); v.innerHTML = '<p class="leer">Lädt …</p>';
  const [{ data: tests, error }, { data: erg }] = await Promise.all([
    sb.from('tests').select('id,code,titel,frage_ids,zeit_min,aktiv,created_at,klasse_id').eq('aktiv', true).order('created_at', { ascending: false }),
    sb.from('test_ergebnisse').select('test_id,richtig,gesamt,abgegeben_at'),
  ]);
  if (error) { v.innerHTML = `<p class="fehlermeldung">Tests konnten nicht geladen werden: ${esc(error.message)}</p>`; return; }
  const meine = (tests || []).filter(t => t.klasse_id === S.profil.klasse_id);
  const done = Object.fromEntries((erg || []).map(e => [e.test_id, e]));
  v.innerHTML = `<h3>Tests deiner Klasse</h3>${!S.profil.klasse_id ? '<p class="leer">Du bist keiner Klasse zugeordnet.</p>' : meine.length ? `<div class="karten">${meine.map(t => {
    const e = done[t.id];
    return `<div class="karte"><div><span class="tag">${t.frage_ids.length} Fragen · ${t.zeit_min ? t.zeit_min + ' min' : 'ohne Zeitlimit'}</span></div><h3 style="margin:0">${esc(t.titel)}</h3>${e ? `<p class="hint" style="margin:0">Abgegeben: ${e.richtig} von ${e.gesamt} richtig (${Math.round(e.richtig / e.gesamt * 100)} %)</p>` : `<button class="btn" data-t="${t.id}">Test starten</button>`}</div>`;
  }).join('')}</div>` : '<p class="leer">Gerade ist kein Test freigeschaltet.</p>'}`;
  $$('[data-t]', v).forEach(b => b.onclick = () => {
    const t = meine.find(x => x.id === b.dataset.t); const byId = Object.fromEntries(S.fragen.map(q => [q.id, q]));
    const qs = t.frage_ids.map(id => byId[id]).filter(Boolean);
    durchlauf(qs, t.zeit_min, t.titel, async (r, ok) => {
      const { error } = await sb.from('test_ergebnisse').insert({ test_id: t.id, user_id: S.user.id, antworten: r.a, richtig: ok, gesamt: r.qs.length }); if (error) throw error;
    });
  });
}

/* ---------------- Fortschritt ---------------- */
async function fortschritt() {
  const fs = S.fragen.filter(q => geprueft(q)), g = {};
  fs.forEach(q => { const k = q.bereich + '|' + q.thema; (g[k] ??= { b: q.bereich, t: q.thema, n: 0, bea: 0, beh: 0, r: 0, f: 0 }); const s = S.lern[q.id]; g[k].n++; if (s) { g[k].bea++; if (s.fach >= 3) g[k].beh++; g[k].r += s.richtig; g[k].f += s.falsch; } });
  const rows = Object.values(g).sort((a, b) => bord(a.b) - bord(b.b) || a.t.localeCompare(b.t));
  const tot = rows.reduce((a, x) => ({ n: a.n + x.n, bea: a.bea + x.bea, beh: a.beh + x.beh, r: a.r + x.r, f: a.f + x.f }), { n: 0, bea: 0, beh: 0, r: 0, f: 0 });
  const { data: sims } = await sb.from('simulationen').select('richtig,gesamt,created_at').order('created_at', { ascending: false }).limit(1);
  let lb = '';
  const body = rows.map(x => { const head = x.b !== lb ? `<tr class="b"><td colspan="5">${esc(x.b)}</td></tr>` : ''; lb = x.b; return head + `<tr><td>${esc(x.t)}</td><td>${x.n}</td><td>${x.bea}</td><td>${x.beh}</td><td><span class="mbar"><i style="width:${x.beh / x.n * 100}%;background:var(--ok)"></i><i style="width:${(x.bea - x.beh) / x.n * 100}%;background:var(--navy)"></i></span></td></tr>`; }).join('');
  $('#view').innerHTML = `<div class="kpis"><div class="kpi"><b>${tot.bea} / ${tot.n}</b><span>Fragen bearbeitet</span></div><div class="kpi"><b>${tot.beh}</b><span>sicher (3× in Folge richtig)</span></div><div class="kpi"><b>${tot.r + tot.f ? Math.round(tot.r / (tot.r + tot.f) * 100) + ' %' : '–'}</b><span>Trefferquote</span></div><div class="kpi"><b>${sims?.[0] ? Math.round(sims[0].richtig / sims[0].gesamt * 100) + ' %' : '–'}</b><span>letzte Prüfungssimulation</span></div></div>
  <h2>Nach Thema</h2><div class="tbl"><table><thead><tr><th>Thema</th><th>Fragen</th><th>bearbeitet</th><th>sicher</th><th>Stand</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

/* ---------------- Klassen (Lehrkraft) ---------------- */
async function klassenView() {
  const v = $('#view'); v.innerHTML = '<p class="leer">Lädt …</p>';
  const { data: kl, error } = await sb.from('klassen').select('id,code,name,aktiv,created_at').order('created_at');
  if (error) { v.innerHTML = `<p class="fehlermeldung">${esc(error.message)}</p>`; return; }
  v.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h3>Klassen</h3><a class="btn klein sek" href="anleitung-lehrkraft.html" target="_blank" rel="noopener">Anleitung für Lehrkräfte</a></div><div class="karte" style="max-width:620px"><h2 style="margin:0">Neue Klasse</h2><div class="actions" style="margin:0"><label class="feld" style="flex:1">Name<input id="kname" placeholder="z. B. ZDS Fachschule 2026/27"></label><button class="btn" id="kneu" style="align-self:flex-end">Anlegen</button></div><p class="fehlermeldung" id="kerr"></p></div>
  <div class="karten" style="margin-top:16px">${(kl || []).map(k => `<div class="karte"><div class="hint" style="margin:0">Klassencode</div><div class="code">${esc(k.code)}</div><h3 style="margin:0">${esc(k.name)}</h3><div class="hint" style="margin:0">Einladungslink – Klassencode ist darin schon enthalten:</div><div class="einladung"><input readonly value="${esc(einladeLink(k.code))}"><button class="btn klein sek" data-link="${esc(einladeLink(k.code))}">Link kopieren</button></div><div class="actions" style="margin:0"><a class="btn klein" href="blatt.html?k=${encodeURIComponent(k.code)}&n=${encodeURIComponent(k.name)}" target="_blank" rel="noopener">Anleitungsblatt drucken</a><button class="btn klein sek" data-k="${k.id}">Fortschritt der Schüler</button></div><div id="kf-${k.id}"></div></div>`).join('') || '<p class="leer">Noch keine Klasse angelegt.</p>'}</div>`;
  $('#kneu').onclick = async () => {
    const name = $('#kname').value.trim(); if (!name) return $('#kerr').textContent = 'Bitte einen Namen eingeben.';
    const { error } = await sb.from('klassen').insert({ name, code: 'ZDS-' + randCode(5), lehrer_id: S.user.id });
    if (error) return $('#kerr').textContent = 'Nicht angelegt: ' + error.message; klassenView();
  };
  $$('[data-link]', v).forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.link); b.textContent = 'Kopiert ✓'; } catch { b.previousElementSibling.select(); b.textContent = 'Strg + C'; } setTimeout(() => b.textContent = 'Link kopieren', 2500); });
  $$('[data-k]', v).forEach(b => b.onclick = async () => {
    const box = $('#kf-' + b.dataset.k); box.innerHTML = '<p class="leer">Lädt …</p>';
    const { data, error } = await sb.rpc('klassen_fortschritt', { p_klasse: b.dataset.k });
    if (error) return box.innerHTML = `<p class="fehlermeldung">${esc(error.message)}</p>`;
    box.innerHTML = data.length ? `<div class="tbl"><table><thead><tr><th>Name</th><th>bearbeitet</th><th>sicher</th><th>Quote</th><th>PIN</th></tr></thead><tbody>${data.map(r => `<tr><td>${esc(r.spitzname)}</td><td>${r.bearbeitet}</td><td>${r.sicher}</td><td>${r.quote ?? '–'} %</td><td>${r.id ? `<button class="btn klein sek" data-pin="${r.id}" data-name="${esc(r.spitzname)}">zurücksetzen</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="leer">Noch keine Schüler registriert.</p>';
    $$('[data-pin]', box).forEach(pb => pb.onclick = async () => {
      if (!pb.dataset.ok) { pb.dataset.ok = '1'; pb.textContent = 'Wirklich? Nochmal klicken'; setTimeout(() => { if (pb.dataset.ok === '1') { delete pb.dataset.ok; pb.textContent = 'zurücksetzen'; } }, 4000); return; }
      pb.dataset.ok = '2'; pb.disabled = true; pb.textContent = '…';
      const { data: pin, error } = await sb.rpc('pin_zuruecksetzen', { p_user: pb.dataset.pin });
      pb.parentElement.innerHTML = error ? `<span class="fehlermeldung">Nicht möglich: ${esc(error.message)}</span>` : `<span class="neupin">Neue PIN: <b>${esc(pin)}</b></span><div class="hint" style="margin:0">Bitte ${esc(pb.dataset.name)} mitteilen.</div>`;
    });
  });
}

/* ---------------- Tests erstellen + Auswertung (Lehrkraft) ---------------- */
async function testbauView() {
  const v = $('#view'); v.innerHTML = '<p class="leer">Lädt …</p>';
  const [{ data: kl }, { data: tests }] = await Promise.all([
    sb.from('klassen').select('id,code,name').order('created_at'),
    sb.from('tests').select('id,code,titel,frage_ids,zeit_min,aktiv,klasse_id,created_at').order('created_at', { ascending: false }),
  ]);
  if (!kl?.length) { v.innerHTML = '<h3>Tests erstellen</h3><p class="leer">Zuerst unter „Klassen“ eine Klasse anlegen.</p>'; return; }
  const kname = Object.fromEntries(kl.map(k => [k.id, k.name]));
  const p = rahmen(testbauView);
  p.innerHTML = `<div class="karte"><h3 style="margin:0">Neuer Test</h3>
    <p class="hint" style="margin:0">Fragen werden zufällig aus den links gewählten Themen gezogen (nur geprüfte Lösungen). Ohne Themenwahl: alle Themen.</p>
    <div class="actions" style="margin:0">
      <label class="feld">Klasse<select id="tk">${kl.map(k => `<option value="${k.id}">${esc(k.name)}</option>`).join('')}</select></label>
      <label class="feld" style="flex:1;min-width:180px">Titel<input id="tt" placeholder="z. B. Test Gelatine & Pektin"></label>
      <label class="feld">Fragen<select id="tn">${[5, 10, 15, 20, 25].map(x => `<option ${x == 10 ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="feld">Zeit<select id="tz">${[[5, '5 min'], [10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min'], [0, 'ohne Limit']].map(([a, b]) => `<option value="${a}" ${a == 10 ? 'selected' : ''}>${b}</option>`).join('')}</select></label></div>
    <span class="hint" style="margin:0">${auswahl().filter(geprueft).length} geprüfte Fragen in der Auswahl</span>
    <div class="actions" style="margin:0"><button class="btn" id="tneu">Test anlegen und freischalten</button></div><p class="fehlermeldung" id="terr"></p></div>
    <h3 style="margin-top:22px">Bisherige Tests</h3>
    <div class="tbl"><table><thead><tr><th>Titel</th><th>Klasse</th><th>Fragen</th><th>Zeit</th><th>Status</th><th></th></tr></thead><tbody>${(tests || []).map(t => `<tr><td>${esc(t.titel)}</td><td>${esc(kname[t.klasse_id] || '')}</td><td>${t.frage_ids.length}</td><td>${t.zeit_min || '–'}</td><td>${t.aktiv ? '<span class="tag ok">freigeschaltet</span>' : '<span class="tag aus">gesperrt</span>'}</td><td style="white-space:nowrap"><button class="btn klein sek" data-aus="${t.id}">Auswertung</button> <button class="btn klein sek" data-tog="${t.id}" data-a="${t.aktiv}">${t.aktiv ? 'Sperren' : 'Freischalten'}</button></td></tr>`).join('') || '<tr><td colspan="6" class="leer">Noch keine Tests.</td></tr>'}</tbody></table></div>
    <div id="auswertung"></div>`;
  $('#tneu', p).onclick = async () => {
    const titel = $('#tt', p).value.trim(); if (!titel) return $('#terr', p).textContent = 'Bitte einen Titel eingeben.';
    const pool = auswahl().filter(geprueft); const n = +$('#tn', p).value;
    if (pool.length < n) return $('#terr', p).textContent = `Nur ${pool.length} Fragen in der Auswahl – bitte mehr Themen wählen oder weniger Fragen.`;
    const { error } = await sb.from('tests').insert({ code: randCode(6), klasse_id: $('#tk', p).value, titel, frage_ids: shuffle(pool).slice(0, n).map(q => q.id), zeit_min: +$('#tz', p).value, erstellt_von: S.user.id });
    if (error) return $('#terr', p).textContent = 'Nicht angelegt: ' + error.message; testbauView();
  };
  $$('[data-tog]', p).forEach(b => b.onclick = async () => { await sb.from('tests').update({ aktiv: b.dataset.a !== 'true' }).eq('id', b.dataset.tog); testbauView(); });
  $$('[data-aus]', p).forEach(b => b.onclick = async () => {
    const t = tests.find(x => x.id === b.dataset.aus), box = $('#auswertung', p); box.innerHTML = '<p class="leer">Lädt …</p>';
    const { data, error } = await sb.rpc('test_auswertung', { p_test: t.id });
    if (error) return box.innerHTML = `<p class="fehlermeldung">${esc(error.message)}</p>`;
    const byId = Object.fromEntries(S.fragen.map(q => [q.id, q]));
    const fq = t.frage_ids.map(id => { const q = byId[id]; const n = data.length; const f = data.filter(d => d.antworten?.[id] !== q?.loesung).length; return { q, f, n }; }).sort((a, b) => b.f - a.f);
    const schnitt = data.length ? Math.round(data.reduce((a, d) => a + d.richtig / d.gesamt, 0) / data.length * 100) : null;
    box.innerHTML = `<h3 style="margin-top:22px">Auswertung: ${esc(t.titel)}</h3><div class="kpis"><div class="kpi"><b>${data.length}</b><span>Abgaben</span></div><div class="kpi"><b>${schnitt ?? '–'}${schnitt != null ? ' %' : ''}</b><span>Durchschnitt</span></div></div>
    <h2>Fragen nach Fehlerquote</h2><div class="tbl"><table><thead><tr><th>Frage</th><th>Lösung</th><th>falsch</th></tr></thead><tbody>${fq.map(x => `<tr><td>${esc(clean(x.q?.frage || ''))}</td><td>${x.q?.loesung} · ${esc(x.q?.optionen[L.indexOf(x.q?.loesung)] || '')}</td><td>${x.n ? Math.round(x.f / x.n * 100) + ' %' : '–'}</td></tr>`).join('')}</tbody></table></div>
    <h2 style="margin-top:16px">Ergebnisse</h2><div class="tbl"><table><thead><tr><th>Name</th><th>richtig</th><th>Quote</th><th>abgegeben</th></tr></thead><tbody>${data.map(d => `<tr><td>${esc(d.spitzname)}</td><td>${d.richtig} / ${d.gesamt}</td><td>${Math.round(d.richtig / d.gesamt * 100)} %</td><td>${new Date(d.abgegeben_at).toLocaleString('de-DE')}</td></tr>`).join('') || '<tr><td colspan="4" class="leer">Noch keine Abgaben.</td></tr>'}</tbody></table></div>`;
    box.scrollIntoView({ behavior: 'smooth' });
  });
}

/* ---------------- Fragen prüfen + Import (Betreiber) ---------------- */
let fIdx = 0, fFilter = 'pruefen';
async function fragenView() {
  const v = $('#view');
  const liste = fFilter === 'pruefen' ? S.fragen.filter(q => !geprueft(q)) : S.fragen;
  if (fIdx >= liste.length) fIdx = Math.max(0, liste.length - 1);
  const q = liste[fIdx];
  v.innerHTML = `<div class="meta"><span>${S.fragen.length} Fragen in der Datenbank · ${S.fragen.filter(x => !geprueft(x)).length} in Prüfung</span><span><label>Anzeigen <select id="ff"><option value="pruefen" ${fFilter === 'pruefen' ? 'selected' : ''}>in Prüfung</option><option value="alle" ${fFilter === 'alle' ? 'selected' : ''}>alle</option></select></label> <button class="btn klein sek" id="imp">Fragen aus fragen.json einspielen</button></span></div><p id="msg" class="hint"></p>
  ${q ? `<div class="meta"><span>${q.id} · ${fIdx + 1} von ${liste.length}</span><span class="tag">${geprueft(q) ? 'geprüft' : 'in Prüfung'}</span></div><div class="thema">${esc(q.bereich)} · ${esc(q.thema)}</div><div class="frage">${esc(q.frage)}</div>${optionenHtml(q, l => l === q.loesung ? 'loesung' : '')}
  ${q.hinweis ? `<div class="box"><strong>Hinweis</strong><div>${esc(q.hinweis)}</div></div>` : ''}
  <div class="box"><strong>Entscheidung</strong><div class="hint" style="margin:6px 0 0">Richtige Antwort anklicken = Lösung setzen und als geprüft markieren.</div><div class="actions"><button class="btn ok" id="ok">Lösung ${q.loesung} bestätigen</button><button class="btn rot" id="aus">Frage deaktivieren</button></div></div>
  <div class="actions"><button class="btn sek" id="zur" ${fIdx ? '' : 'disabled'}>Vorherige</button><button class="btn sek" id="vor" ${fIdx + 1 < liste.length ? '' : 'disabled'}>Nächste</button></div>` : '<p class="leer">Keine Fragen in dieser Ansicht.</p>'}`;
  $('#ff').onchange = e => { fFilter = e.target.value; fIdx = 0; fragenView(); };
  $('#imp').onclick = importFragen;
  if (!q) return;
  const save = async upd => {
    const { error } = await sb.from('fragen').update({ ...upd, updated_at: new Date().toISOString() }).eq('id', q.id);
    if (error) return $('#msg').textContent = 'Nicht gespeichert: ' + error.message;
    await ladeFragen(); if (fFilter === 'alle') fIdx++; fragenView();
  };
  $$('.opt', v).forEach(b => b.onclick = () => save({ loesung: b.dataset.l, status: 'geprueft' }));
  $('#ok').onclick = () => save({ status: 'geprueft' });
  $('#aus').onclick = () => save({ aktiv: false });
  $('#zur').onclick = () => { fIdx--; fragenView(); }; $('#vor').onclick = () => { fIdx++; fragenView(); };
}
async function importFragen() {
  const msg = $('#msg'); msg.textContent = 'Lade fragen.json …';
  const daten = await (await fetch('fragen.json', { cache: 'no-store' })).json();
  for (let i = 0; i < daten.length; i += 100) {
    const teil = daten.slice(i, i + 100).map(q => ({ ...q, aktiv: true, updated_at: new Date().toISOString() }));
    const { error } = await sb.from('fragen').upsert(teil);
    if (error) { msg.textContent = `Fehler bei Fragen ${i + 1}–${i + teil.length}: ${error.message}`; return; }
    msg.textContent = `${Math.min(i + 100, daten.length)} von ${daten.length} eingespielt …`;
  }
  await ladeFragen(); msg.textContent = `Fertig: ${daten.length} Fragen eingespielt.`; fragenView();
}

/* ---------------- Routing ---------------- */
const VIEWS = { start: startView, lernen: lernenStart, pruefung: pruefungStart, tests: testsView, fortschritt, klassen: klassenView, testbau: testbauView, fragen: fragenView };
function route() {
  if (!S.user) return loginView();
  const erlaubt = views().map(x => x[0]);
  let v = location.hash.slice(1); if (!erlaubt.includes(v)) v = 'start';
  if (pr && v !== 'pruefung' && v !== 'tests') { clearInterval(uhr); pr = null; }
  window.scrollTo(0, 0);
  $$('#nav a, #bnav a').forEach(a => a.dataset.v === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  if (!S.fragen.length && !['fragen', 'klassen', 'start'].includes(v)) { $('#view').innerHTML = `<p class="leer">Noch keine Fragen in der Datenbank.${rolle() === 'admin' ? ' Unter „Fragen prüfen“ einspielen.' : ''}</p>`; return; }
  VIEWS[v]();
}
async function start(session) {
  S.user = session?.user || null;
  if (!S.user) { S.profil = null; return route(); }
  $('#view').innerHTML = '<p class="leer">Lädt …</p>';
  const { data: prof } = await sb.from('profile').select('rolle,spitzname,klasse_id').eq('id', S.user.id).maybeSingle();
  S.profil = prof || { rolle: 'schueler' };
  S.klasse = null;
  if (S.profil.klasse_id) { const { data } = await sb.from('klassen').select('name,code').eq('id', S.profil.klasse_id).maybeSingle(); S.klasse = data; }
  if (rolle() === 'schueler') S.nurGeprueft = true;
  await Promise.all([ladeFragen(), ladeLernstand()]); flushQueue();
  setNav(views()); wer(); route();
}
window.addEventListener('hashchange', route);
window.addEventListener('online', () => { $('#offline').hidden = true; flushQueue(); });
window.addEventListener('offline', () => { $('#offline').hidden = false; });
$('#ver').textContent = 'Version ' + APP_VERSION;
let laeuft;
sb.auth.onAuthStateChange((ev, session) => {
  const id = session?.user?.id || null;
  if (ev === 'TOKEN_REFRESHED' || (laeuft === id && ev !== 'SIGNED_OUT')) return;
  laeuft = id; start(session);
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });

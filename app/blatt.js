// Anleitungsblatt je Klasse (A4, druckbar). Aufruf: blatt.html?k=<Klassencode>&n=<Klassenname>
// QR-Code nach RCC-Stylebook Kap. 2 – Festwerte aus „RCC CI/QR-Codes/Werkzeug/qr_rcc.py“ übernommen:
// Ruhezone 4 Module, Module Navy mit Eckradius 0,25, Suchmarken Navy-Rahmen + Navy-Hexagon,
// Link <= 150 Byte: Fehlerkorrektur H, RCC-Bildmarke 10 Module breit.
(function () {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p = new URLSearchParams(location.search);
  const code = String(p.get('k') || '').toUpperCase().trim();
  const name = String(p.get('n') || '').trim().slice(0, 80);
  const ziel = document.getElementById('inhalt');
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
    ziel.innerHTML = '<div class="fehler"><h2>Kein Klassencode angegeben</h2><p>Bitte das Anleitungsblatt in der App unter „Klassen“ bei der gewünschten Klasse öffnen.</p></div>';
    document.querySelector('.leiste').hidden = true; return;
  }
  const link = new URL('./', location.href).href + '?k=' + encodeURIComponent(code);
  const anzeige = new URL('./', location.href).href.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // ---- QR im RCC-Stil ----
  const QZ = 4, DOT = 0.96, MR = 0.25, R_OUT = 0.35, R_IN = 0.2, HEXW = 1.5;
  const lang = new TextEncoder().encode(link).length > 150;
  const LM = lang ? 8 : 10;
  const qr = qrcode(0, lang ? 'Q' : 'H'); qr.addData(link, 'Byte'); qr.make();
  const n = qr.getModuleCount(), N = n + 2 * QZ, c0 = N / 2;
  const F = [[QZ, QZ], [QZ, QZ + n - 7], [QZ + n - 7, QZ]];
  const imFinder = (r, c) => F.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);
  const hexp = (cx, cy, w) => [0, 60, 120, 180, 240, 300].map(a => [cx + w * Math.cos(a * Math.PI / 180), cy + w * Math.sin(a * Math.PI / 180)]);
  const H = hexp(c0, c0, (LM + 1.2) / 2);
  const inHex = (x, y) => { let ein = false; for (let i = 0, j = H.length - 1; i < H.length; j = i++) { const [xi, yi] = H[i], [xj, yj] = H[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ein = !ein; } return ein; };
  const R = DOT / 2; const o = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.isDark(r, c)) continue;
    const rr = r + QZ, cc = c + QZ; if (imFinder(rr, cc)) continue;
    const x = cc + 0.5, y = rr + 0.5; let frei = false;
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (inHex(x + dx / 2, y + dy / 2)) frei = true;
    if (frei) continue;
    o.push(`<rect x="${(x - R).toFixed(3)}" y="${(y - R).toFixed(3)}" width="${DOT}" height="${DOT}" rx="${MR}"/>`);
  }
  const rund = (x, y, w, r) => `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${w - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - 2 * r} a${r},${r} 0 0 1 -${r},-${r} v-${w - 2 * r} a${r},${r} 0 0 1 ${r},-${r} z`;
  for (const [fr, fc] of F) {
    o.push(`<path fill-rule="evenodd" d="${rund(fc, fr, 7, R_OUT)} ${rund(fc + 1, fr + 1, 5, R_IN)}"/>`);
    o.push(`<polygon points="${hexp(fc + 3.5, fr + 3.5, HEXW).map(([a, b]) => a.toFixed(3) + ',' + b.toFixed(3)).join(' ')}"/>`);
  }
  // RCC-Bildmarke (viewBox -4 -4 246 232, wie Logo_RCC_Bildmarke_Farbe.svg)
  const lw = LM * 246 / 238, lh = lw * 232 / 246;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" role="img" aria-label="QR-Code zum Lerntrainer"><rect width="${N}" height="${N}" fill="#FFFFFF"/><g fill="#004D7A">${o.join('')}</g><image href="assets/bildmarke.svg" x="${(c0 - lw / 2).toFixed(3)}" y="${(c0 - lh / 2).toFixed(3)}" width="${lw.toFixed(3)}" height="${lh.toFixed(3)}"/></svg>`;

  ziel.innerHTML = `<div class="seite">
  <div class="kopf"><img src="assets/logo-rcc.svg" alt="RCC Consulting GmbH"><div class="titel"><b>Lerntrainer</b><span>Süßwarentechnologie</span></div></div>
  <p class="eyebrow">${name ? esc(name) : 'Deine Klasse'}</p>
  <h1>So startest du mit dem Lerntrainer</h1>
  <p class="lead">Über 500 Prüfungsfragen zur Süßwarentechnologie – am Handy, Tablet oder PC. Kostenlos und ohne E-Mail-Adresse.</p>
  <div class="zugang">${svg}<div>
    <p class="lbl">Klassencode</p><p class="code">${esc(code)}</p>
    <p class="lbl">Adresse</p><p class="url">${esc(anzeige)}</p>
    <p class="klein">Mit dem QR-Code ist der Klassencode schon eingetragen. Am PC: Adresse eingeben, dann den Klassencode.</p></div></div>
  <ol class="schritte">
    <li><span class="hex">1</span><div><b>QR-Code scannen</b><p>Mit der Handykamera scannen und den Link öffnen. Am PC die Adresse oben eingeben und den Klassencode eintippen.</p></div></li>
    <li><span class="hex">2</span><div><b>Einmalig registrieren</b><p>Vor- und Nachnamen eingeben und eine 4-stellige PIN wählen. Dann auf <b style="display:inline;font-size:inherit">„Neu registrieren“</b> tippen.</p></div></li>
    <li><span class="hex">3</span><div><b>Später: einfach anmelden</b><p>Name und PIN eingeben, „Anmelden“ – fertig. Tipp: Im Browser-Menü „Zum Startbildschirm hinzufügen“, dann liegt der Lerntrainer wie eine App auf dem Handy.</p></div></li>
    <li><span class="hex">4</span><div><b>Lernen</b><p>Bereich antippen und loslegen. Die Lernkartei holt Fragen, die noch nicht sitzen, öfter nach vorn. Unter „Prüfung“ simulierst du eine echte Prüfung, unter „Tests“ findest du die Tests deiner Lehrkraft.</p></div></li>
  </ol>
  <div class="notiz"><p class="k">Mein Zugang</p><div class="feld">PIN</div><div></div><p class="hinweis">Blatt gut aufbewahren. PIN vergessen? Deine Lehrkraft kann sie zurücksetzen.</p></div>
  <div class="fuss"><span>Bereitgestellt von <b>RCC Consulting GmbH</b> · technische Beratung für die Süßwarenindustrie</span><span>www.rcc-online.com</span></div>
</div>`;
  document.title = 'Anleitungsblatt ' + code + ' – RCC Lerntrainer';
  document.getElementById('drucken').onclick = () => window.print();
})();

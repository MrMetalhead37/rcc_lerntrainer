// Baut die Einzeldatei-Demo: node demo/build-demo.js  →  dist/RCC_Lerntrainer_Demo.html
// Alles in einer HTML-Datei (App, Fragen, Schriften, Icons, Demo-Backend). Kein Server, keine Internetverbindung nötig.
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..', 'app'), OUT = path.join(__dirname, '..', 'dist');
const rd = f => fs.readFileSync(path.join(A, f), 'utf8');
const b64 = f => fs.readFileSync(path.join(A, f)).toString('base64');
const LIVE = 'https://lernen.rcc-online.com/';
const ersetze = (s, a, b) => { if (!s.includes(a)) throw new Error('Nicht gefunden: ' + a.slice(0, 80)); return s.split(a).join(b); };

// Bilder (Icons, Logo) als data-URIs
const bilder = {};
for (const d of ['icons', 'assets']) for (const f of fs.readdirSync(path.join(A, d))) if (f.endsWith('.svg')) bilder[`${d}/${f}`] = 'data:image/svg+xml;base64,' + b64(`${d}/${f}`);

let css = rd('styles.css').replace(/url\((fonts\/[^)]+\.woff2)\)/g, (_, f) => `url(data:font/woff2;base64,${b64(f)})`);
css += `
/* Demo-Hinweis */
.demo-band{background:#FFF4E8;border-bottom:1px solid #F0D2B0;color:#2B3640;font:14px/1.45 var(--body,Nunito),Arial,sans-serif;padding:8px 16px}
.demo-band .w{max-width:1100px;margin:0 auto;display:flex;gap:10px 18px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.demo-band b{color:#D9822B}.demo-band code{background:#fff;border:1px solid #F0D2B0;border-radius:4px;padding:0 4px;font-size:13px}
.demo-band button{font:600 13px var(--head,Arial);background:#fff;color:#004D7A;border:1px solid #004D7A;border-radius:6px;padding:4px 10px;cursor:pointer}
.demo-band details summary{cursor:pointer;color:#004D7A;font-weight:600}`;

let js = rd('app.js');
const cfg = rd('config.js');
const ver = cfg.match(/APP_VERSION = '([^']+)'/)[1];
js = ersetze(js, "import { SUPABASE_URL, SUPABASE_KEY, SCHUELER_DOMAIN, APP_VERSION } from './config.js';",
  `const SUPABASE_URL = 'demo', SUPABASE_KEY = 'demo', SCHUELER_DOMAIN = 'schueler.rcc-online.com', APP_VERSION = '${ver} · Demo';`);
js = ersetze(js, "await (await fetch('fragen.json', { cache: 'no-store' })).json()", 'JSON.parse(JSON.stringify(window.__FRAGEN))');
js = ersetze(js, "if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });", '');
js = ersetze(js, 'href="anleitung-lehrkraft.html"', `href="${LIVE}anleitung-lehrkraft.html"`);
js = ersetze(js, 'href="blatt.html?k=', `href="${LIVE}blatt.html?k=`);
js = js.replace(/src="(icons\/[^"]*)"/g, (_, p) => 'src="${__img(`' + p + '`)}"');
js = 'const __img = p => (window.__BILDER[p] || p);\n' + js;
js = js.split('</script>').join('<\\/script>');

let html = rd('index.html');
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '').replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '');
html = ersetze(html, '<link rel="icon" href="assets/bildmarke.svg" type="image/svg+xml">', `<link rel="icon" href="${bilder['assets/bildmarke.svg']}" type="image/svg+xml">`);
html = ersetze(html, '<title>RCC Lerntrainer Süßwarentechnologie</title>', '<title>RCC Lerntrainer – Demo</title>');
html = ersetze(html, '<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`);
html = ersetze(html, 'src="assets/logo-rcc.svg"', `src="${bilder['assets/logo-rcc.svg']}"`);
html = ersetze(html, 'href="datenschutz.html"', `href="${LIVE}datenschutz.html" target="_blank" rel="noopener"`);
html = ersetze(html, '<div id="offline"', `<div class="demo-band"><div class="w"><span><b>Demoversion</b> · läuft ohne Server, alle Eingaben bleiben nur in diesem Browser.</span>
<details><summary>Zugänge zum Ausprobieren</summary><div style="padding:6px 0">Lehrkraft: <code>lehrkraft@demo.de</code> / <code>demo1234</code> · Betreiber (Fragen prüfen): <code>betreiber@demo.de</code> / <code>demo1234</code><br>Schüler: Klassencode <code>DEMO-2026</code>, Name <code>Anna Becker</code>, PIN <code>1234</code> – oder selbst neu registrieren</div></details>
<button type="button" onclick="if(confirm('Demo auf Anfangszustand zurücksetzen?'))__demoReset()">Demo zurücksetzen</button></div></div>
<div id="offline"`);
const pre = `<script>window.__FRAGEN=${JSON.stringify(JSON.parse(rd('fragen.json')))};
window.__BILDER=${JSON.stringify(bilder)};
(function(){var B=window.__BILDER;function fix(el){if(el&&el.tagName==='IMG'){var s=el.getAttribute('src');if(s&&B[s])el.setAttribute('src',B[s]);}}
new MutationObserver(function(ms){ms.forEach(function(m){if(m.type==='attributes')fix(m.target);m.addedNodes&&m.addedNodes.forEach(function(n){if(n.nodeType===1){fix(n);n.querySelectorAll&&n.querySelectorAll('img').forEach(fix);}});});}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
try{if(!localStorage.getItem('lastcode'))localStorage.setItem('lastcode',JSON.stringify('DEMO-2026'));}catch(e){}})();<\/script>
<script>\n${fs.readFileSync(path.join(__dirname, 'demo-backend.js'), 'utf8')}\n<\/script>`;
html = ersetze(html, '<script src="vendor-supabase.js"></script>', pre);
html = ersetze(html, '<script type="module" src="app.js"></script>', `<script type="module">\n${js}\n</script>`);
fs.mkdirSync(OUT, { recursive: true });
const ziel = path.join(OUT, 'RCC_Lerntrainer_Demo.html');
fs.writeFileSync(ziel, html);
console.log(ziel, (html.length / 1024).toFixed(0) + ' KB', Object.keys(bilder).length + ' Bilder');

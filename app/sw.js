// Offline-Fähigkeit: App-Hülle zwischenspeichern; Datenbankzugriffe gehen immer ins Netz.
const CACHE = 'rcc-lerntrainer-v0.5.3';
const HUELLE = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'vendor-supabase.js', 'manifest.webmanifest', 'datenschutz.html',
  'assets/logo-rcc.svg', 'assets/bildmarke.svg', 'assets/icon-256.png',
  'fonts/BarlowSemiCondensed-SemiBold.woff2', 'fonts/BarlowSemiCondensed-Bold.woff2', 'fonts/Nunito-VariableFont_wght.woff2'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(HUELLE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('supabase.co')) return;
  // Netz zuerst (aktuelle Version), bei Offline aus dem Zwischenspeicher
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); if (r.ok) caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});

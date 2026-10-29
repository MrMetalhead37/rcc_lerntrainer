# Einrichtung (einmalig)

## 1 Supabase
1. Dashboard › **SQL Editor** › New query › Inhalt von `supabase/01_schema.sql` einfügen › **Run**. Erwartet: „Success. No rows returned“.
2. **Authentication › Sign In / Providers › Email**: „Confirm email“ **ausschalten** (Schüler-Konten haben keine echte E-Mail). Speichern.
3. **Authentication › Users › Add user › Create new user**: eigene E-Mail + Passwort, „Auto Confirm User“ an.
4. SQL Editor: `select public.rolle_setzen('tr@rcc-online.com', 'admin');` › Run.

## 2 Netlify
1. app.netlify.com › **Add new project › Import an existing project › GitHub** › Repository `rcc_lerntrainer` wählen.
2. Einstellungen übernehmen (Publish directory „app“ kommt aus `netlify.toml`) › **Deploy**.
3. Die Adresse `….netlify.app` öffnen, als Lehrkraft (Betreiber) anmelden › **Fragen prüfen › Fragen aus fragen.json einspielen**.

## 3 Klasse und Test
1. **Klassen › Neue Klasse** › Klassencode notieren.
2. Schüler registrieren sich mit Klassencode, Spitzname, PIN.
3. **Tests erstellen**: Themen links wählen, Titel, Anzahl, Zeit › anlegen.

## 4 Lehrkraft anlegen
Supabase › Authentication › Add user (E-Mail, Startpasswort, Auto Confirm) › SQL: `select public.rolle_setzen('mail@…', 'lehrer');`

## 5 Eigene Adresse (Strato)
Netlify › Domain management › Add domain `lernen.rcc-online.com` › CNAME-Ziel von Netlify bei Strato für die Subdomain eintragen.

## Änderung 02 (29.10.2026)
Im Supabase SQL Editor den kompletten Inhalt von `supabase/02_pin_zuruecksetzen.sql` ausführen (PIN zurücksetzen durch die Lehrkraft).

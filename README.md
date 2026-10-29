# RCC Lerntrainer Süßwarentechnologie

Web-App (installierbar auf Handy und Laptop) zum Üben programmierter Fragen der Süßwarentechnologie.
Betreiber: RCC Consulting GmbH · Pilot mit der ZDS Solingen.

| Teil | Wo |
|---|---|
| App (statisch) | `app/` – ausgeliefert von Netlify (`netlify.toml`) |
| Datenbank + Anmeldung | Supabase-Projekt `geqkmxrcryluqplanyfc` (Frankfurt) |
| Datenbankschema | `supabase/01_schema.sql` |
| Fragenbestand | `app/fragen.json` (Export aus RCC_Fragendatenbank.xlsx), Einspielen in der App unter „Fragen prüfen“ |

Rollen: Schüler (Klassencode + Spitzname + PIN, keine E-Mail) · Lehrkraft · Betreiber (admin).
Einrichtung: siehe `EINRICHTUNG.md`.

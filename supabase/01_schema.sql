-- Hinweis: Nach dieser Datei auch 02_pin_zuruecksetzen.sql ausführen.
-- RCC Lerntrainer – Datenbankschema (Supabase / PostgreSQL)
-- Einmalig im Supabase SQL-Editor ausführen (gesamten Inhalt einfügen, "Run").
-- Kann gefahrlos erneut ausgeführt werden (idempotent).

-- ============ Tabellen ============
create table if not exists public.klassen (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,              -- z. B. ZDS-24A (Großbuchstaben)
  name        text not null,
  lehrer_id   uuid references auth.users(id) on delete set null,
  aktiv       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.profile (
  id          uuid primary key references auth.users(id) on delete cascade,
  rolle       text not null default 'schueler' check (rolle in ('schueler','lehrer','admin')),
  spitzname   text,
  klasse_id   uuid references public.klassen(id) on delete set null,
  kontakt_einwilligung boolean not null default false,   -- für später (freiwillig)
  created_at  timestamptz not null default now()
);

create table if not exists public.fragen (
  id          text primary key,                  -- P0001 …
  bereich     text not null,
  thema       text not null,
  frage       text not null,
  optionen    jsonb not null,                    -- ["A-Text", …, "E-Text"]
  loesung     text not null check (loesung in ('A','B','C','D','E')),
  status      text not null default 'geprueft',  -- geprueft | pruefen
  hinweis     text,
  aktiv       boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists public.lernstand (
  user_id     uuid not null references auth.users(id) on delete cascade,
  frage_id    text not null references public.fragen(id) on delete cascade,
  fach        int  not null default 0,
  richtig     int  not null default 0,
  falsch      int  not null default 0,
  zuletzt     timestamptz not null default now(),
  primary key (user_id, frage_id)
);

create table if not exists public.tests (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  klasse_id   uuid not null references public.klassen(id) on delete cascade,
  titel       text not null,
  frage_ids   text[] not null,
  zeit_min    int not null default 10,
  aktiv       boolean not null default true,
  erstellt_von uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.test_ergebnisse (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references public.tests(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  antworten   jsonb not null,                    -- {"P0001":"C", …}
  richtig     int not null,
  gesamt      int not null,
  abgegeben_at timestamptz not null default now(),
  unique (test_id, user_id)
);

create table if not exists public.simulationen (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  richtig     int not null,
  gesamt      int not null,
  created_at  timestamptz not null default now()
);

-- ============ Hilfsfunktionen ============
create or replace function public.meine_rolle() returns text
language sql stable security definer set search_path = public as $$
  select rolle from public.profile where id = auth.uid()
$$;

create or replace function public.meine_klasse() returns uuid
language sql stable security definer set search_path = public as $$
  select klasse_id from public.profile where id = auth.uid()
$$;

create or replace function public.ist_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select rolle = 'admin' from public.profile where id = auth.uid()), false)
$$;

create or replace function public.ist_lehrer_von(k uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ist_admin() or exists (select 1 from public.klassen where id = k and lehrer_id = auth.uid())
$$;

-- Prüft vor der Registrierung, ob ein Klassencode gültig ist (für die Anmeldemaske)
create or replace function public.klasse_pruefen(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select name from public.klassen where code = upper(trim(p_code)) and aktiv
$$;
grant execute on function public.klasse_pruefen(text) to anon, authenticated;

-- Neues Konto: Profil anlegen. Schüler registrieren sich mit Klassencode + Spitzname (Metadaten).
create or replace function public.neues_konto() returns trigger
language plpgsql security definer set search_path = public as $$
declare k uuid;
begin
  if new.raw_user_meta_data ? 'klassencode' then
    select id into k from public.klassen where code = upper(trim(new.raw_user_meta_data->>'klassencode')) and aktiv;
    if k is null then raise exception 'Klassencode unbekannt'; end if;
    insert into public.profile (id, rolle, spitzname, klasse_id)
      values (new.id, 'schueler', new.raw_user_meta_data->>'spitzname', k);
  else
    -- Konten ohne Klassencode (Lehrkräfte, Betreiber) starten ohne Rechte;
    -- die Rolle vergibt der Betreiber mit rolle_setzen().
    insert into public.profile (id, rolle, spitzname) values (new.id, 'schueler', split_part(new.email,'@',1));
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.neues_konto();

-- Rolle setzen (nur im SQL-Editor durch den Betreiber), z. B.:
--   select public.rolle_setzen('tr@rcc-online.com', 'admin');
create or replace function public.rolle_setzen(p_email text, p_rolle text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profile set rolle = p_rolle
   where id = (select id from auth.users where email = lower(p_email));
end $$;
revoke execute on function public.rolle_setzen(text,text) from public, anon, authenticated;

-- Auswertung eines Tests für die Lehrkraft (ohne Zugriff auf Konten-Daten)
create or replace function public.test_auswertung(p_test uuid)
returns table (spitzname text, richtig int, gesamt int, abgegeben_at timestamptz, antworten jsonb)
language sql stable security definer set search_path = public as $$
  select p.spitzname, e.richtig, e.gesamt, e.abgegeben_at, e.antworten
    from public.test_ergebnisse e
    join public.tests t on t.id = e.test_id
    join public.profile p on p.id = e.user_id
   where e.test_id = p_test and public.ist_lehrer_von(t.klasse_id)
   order by p.spitzname
$$;
grant execute on function public.test_auswertung(uuid) to authenticated;

-- Klassenübersicht für die Lehrkraft: Schüler + Lernfortschritt
create or replace function public.klassen_fortschritt(p_klasse uuid)
returns table (spitzname text, bearbeitet bigint, sicher bigint, quote numeric, zuletzt timestamptz)
language sql stable security definer set search_path = public as $$
  select p.spitzname,
         count(l.frage_id),
         count(l.frage_id) filter (where l.fach >= 3),
         round(100.0 * sum(l.richtig) / nullif(sum(l.richtig + l.falsch),0), 0),
         max(l.zuletzt)
    from public.profile p
    left join public.lernstand l on l.user_id = p.id
   where p.klasse_id = p_klasse and p.rolle = 'schueler' and public.ist_lehrer_von(p_klasse)
   group by p.id, p.spitzname
   order by p.spitzname
$$;
grant execute on function public.klassen_fortschritt(uuid) to authenticated;

-- ============ Zugriffsregeln (Row Level Security) ============
alter table public.klassen          enable row level security;
alter table public.profile          enable row level security;
alter table public.fragen           enable row level security;
alter table public.lernstand        enable row level security;
alter table public.tests            enable row level security;
alter table public.test_ergebnisse  enable row level security;
alter table public.simulationen     enable row level security;

drop policy if exists klassen_lesen on public.klassen;
create policy klassen_lesen on public.klassen for select to authenticated
  using (id = public.meine_klasse() or lehrer_id = auth.uid() or public.ist_admin());
drop policy if exists klassen_anlegen on public.klassen;
create policy klassen_anlegen on public.klassen for insert to authenticated
  with check (public.meine_rolle() in ('lehrer','admin') and lehrer_id = auth.uid());
drop policy if exists klassen_aendern on public.klassen;
create policy klassen_aendern on public.klassen for update to authenticated
  using (lehrer_id = auth.uid() or public.ist_admin());

drop policy if exists profil_lesen on public.profile;
create policy profil_lesen on public.profile for select to authenticated
  using (id = auth.uid() or public.ist_admin());
drop policy if exists profil_aendern on public.profile;  -- Profile ändert nur der Betreiber

drop policy if exists fragen_lesen on public.fragen;
create policy fragen_lesen on public.fragen for select to authenticated using (true);
drop policy if exists fragen_admin on public.fragen;
create policy fragen_admin on public.fragen for all to authenticated
  using (public.ist_admin()) with check (public.ist_admin());

drop policy if exists lernstand_eigen on public.lernstand;
create policy lernstand_eigen on public.lernstand for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists tests_lesen on public.tests;
create policy tests_lesen on public.tests for select to authenticated
  using (klasse_id = public.meine_klasse() or public.ist_lehrer_von(klasse_id));
drop policy if exists tests_anlegen on public.tests;
create policy tests_anlegen on public.tests for insert to authenticated
  with check (public.ist_lehrer_von(klasse_id) and erstellt_von = auth.uid());
drop policy if exists tests_aendern on public.tests;
create policy tests_aendern on public.tests for update to authenticated
  using (public.ist_lehrer_von(klasse_id));
drop policy if exists tests_loeschen on public.tests;
create policy tests_loeschen on public.tests for delete to authenticated
  using (public.ist_lehrer_von(klasse_id));

drop policy if exists ergebnis_eigen_lesen on public.test_ergebnisse;
create policy ergebnis_eigen_lesen on public.test_ergebnisse for select to authenticated
  using (user_id = auth.uid());
drop policy if exists ergebnis_abgeben on public.test_ergebnisse;
create policy ergebnis_abgeben on public.test_ergebnisse for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.tests t where t.id = test_id and t.aktiv and t.klasse_id = public.meine_klasse()));

drop policy if exists simulation_eigen on public.simulationen;
create policy simulation_eigen on public.simulationen for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

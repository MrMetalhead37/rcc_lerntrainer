-- RCC Lerntrainer · Änderung 02 (29.10.2026)
-- 1) Lehrkraft kann die PIN eines Schülers ihrer Klasse zurücksetzen (neue Zufalls-PIN).
-- 2) Klassenübersicht liefert zusätzlich die Konto-ID (für den Button „PIN zurücksetzen“).
-- Einmal komplett im Supabase SQL Editor ausführen. Kann gefahrlos mehrfach ausgeführt werden.

create extension if not exists pgcrypto with schema extensions;

drop function if exists public.klassen_fortschritt(uuid);
create function public.klassen_fortschritt(p_klasse uuid)
returns table (id uuid, spitzname text, bearbeitet bigint, sicher bigint, quote numeric, zuletzt timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.spitzname,
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
revoke all on function public.klassen_fortschritt(uuid) from public, anon;
grant execute on function public.klassen_fortschritt(uuid) to authenticated;

-- Setzt eine neue 4-stellige PIN und gibt sie zurück. Nur Lehrkraft der Klasse oder Betreiber.
-- Das Passwort des Schülerkontos ist 'rcc-<PIN>-<Klassencode>' (wie in app.js, schuelerZugang).
create or replace function public.pin_zuruecksetzen(p_user uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_klasse uuid; v_code text; v_pin text;
begin
  select klasse_id into v_klasse from public.profile where id = p_user and rolle = 'schueler';
  if v_klasse is null then raise exception 'Schüler nicht gefunden'; end if;
  if not public.ist_lehrer_von(v_klasse) then raise exception 'Keine Berechtigung'; end if;
  select upper(code) into v_code from public.klassen where id = v_klasse;
  v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
  update auth.users
     set encrypted_password = extensions.crypt('rcc-' || v_pin || '-' || v_code, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user;
  return v_pin;
end $$;
revoke all on function public.pin_zuruecksetzen(uuid) from public, anon;
grant execute on function public.pin_zuruecksetzen(uuid) to authenticated;

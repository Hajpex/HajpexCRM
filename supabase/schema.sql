-- ============================================================
-- Hajpex CRM — Supabase schema
-- Kör detta i Supabase Dashboard → SQL Editor
-- ============================================================

-- KONTOR (tenants)
create table if not exists public.offices (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  org_nr     text,
  created_at timestamptz default now()
);

-- ANVÄNDARE (utökar auth.users)
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  office_id  uuid references public.offices(id) on delete cascade,
  name       text not null,
  initials   text,
  role       text not null default 'maklare' check (role in ('admin', 'maklare')),
  created_at timestamptz default now()
);

-- KONTAKTER
create table if not exists public.kontakter (
  id           uuid primary key default gen_random_uuid(),
  office_id    uuid not null references public.offices(id) on delete cascade,
  maklare_id   uuid references public.users(id) on delete set null,
  fornamn      text not null default '',
  efternamn    text not null default '',
  telefon      text default '',
  epost        text default '',
  adress       text default '',
  ort          text default '',
  budget_min   bigint default 0,
  budget_max   bigint default 0,
  sok_typer    text[] default '{}',
  sok_omraden  text[] default '{}',
  anteckningar text default '',
  gdpr_godkant timestamptz,
  skapad_at    timestamptz default now(),
  updated_at   timestamptz default now()
);

-- OBJEKT-KOPPLINGAR (spekulant/säljare/köpare per objekt)
create table if not exists public.objekt_kopplingar (
  id              uuid primary key default gen_random_uuid(),
  office_id       uuid not null references public.offices(id) on delete cascade,
  kontakt_id      uuid not null references public.kontakter(id) on delete cascade,
  objekt_slug     text not null,
  relation        text not null check (relation in ('spekulant','säljare','köpare','kontakt')),
  added_at        timestamptz default now(),
  anteckning      text default '',
  intresse        text check (intresse in ('aktiv','budgivare','följer','ej_intresserad')),
  medspekulanter  jsonb default '[]'
);

-- VISNINGAR
create table if not exists public.visningar (
  id           uuid primary key default gen_random_uuid(),
  office_id    uuid not null references public.offices(id) on delete cascade,
  objekt_slug  text not null,
  datum        timestamptz not null,
  sluttid      timestamptz not null,
  typ          text default 'Öppen' check (typ in ('Öppen','Privat','Budvisning')),
  anteckningar text default '',
  deltagare    jsonb default '[]',
  skapad_at    timestamptz default now()
);

-- BUD
create table if not exists public.bud (
  id               uuid primary key default gen_random_uuid(),
  office_id        uuid not null references public.offices(id) on delete cascade,
  objekt_slug      text not null,
  belopp           bigint not null,
  namn             text not null,
  telefon          text default '',
  villkor          text default '',
  tid              timestamptz default now(),
  vinnare          boolean default false,
  dragen_tillbaka  boolean default false,
  dragen_tid       timestamptz
);

-- AKTIVITETER
create table if not exists public.aktiviteter (
  id           uuid primary key default gen_random_uuid(),
  office_id    uuid not null references public.offices(id) on delete cascade,
  kontakt_id   uuid not null references public.kontakter(id) on delete cascade,
  typ          text not null,
  objekt_slug  text,
  tidpunkt     timestamptz default now(),
  beskrivning  text default '',
  belopp       bigint
);

-- INTAGSMÖTEN
create table if not exists public.intagsmoten (
  id                   uuid primary key default gen_random_uuid(),
  office_id            uuid not null references public.offices(id) on delete cascade,
  kontakt_id           uuid not null references public.kontakter(id) on delete cascade,
  maklare_id           uuid references public.users(id) on delete set null,
  adress               text default '',
  postnr               text default '',
  ort                  text default '',
  tidpunkt             timestamptz not null,
  sluttid              timestamptz,
  kalla                text default '',
  anteckningar         text default '',
  status               text default 'Planerat',
  vardering            bigint,
  vardering_kommentar  text default '',
  objekt_slug          text,
  objekt_typ           text,
  skapad_at            timestamptz default now()
);

-- KONTRAKT
create table if not exists public.kontrakt (
  id           uuid primary key default gen_random_uuid(),
  office_id    uuid not null references public.offices(id) on delete cascade,
  objekt_slug  text not null,
  data         jsonb default '{}',
  updated_at   timestamptz default now(),
  unique(office_id, objekt_slug)
);

-- APP_STATE — generisk nyckel/värde-lagring per kontor (molnsynk av lokala stores)
-- En rad per datalager (store_key) per kontor. data = hela listan som JSONB.
create table if not exists public.app_state (
  office_id   uuid not null references public.offices(id) on delete cascade,
  store_key   text not null,
  data        jsonb not null default '[]',
  updated_at  timestamptz default now(),
  primary key (office_id, store_key)
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Varje rad är bara synlig för rätt kontor
-- ============================================================

alter table public.offices          enable row level security;
alter table public.users            enable row level security;
alter table public.kontakter        enable row level security;
alter table public.objekt_kopplingar enable row level security;
alter table public.visningar        enable row level security;
alter table public.bud              enable row level security;
alter table public.aktiviteter      enable row level security;
alter table public.intagsmoten      enable row level security;
alter table public.kontrakt         enable row level security;
alter table public.app_state        enable row level security;

-- Hjälpfunktion: hämta office_id för inloggad användare
-- VIKTIGT: security definer + fast search_path så att den kringgår RLS
-- och INTE används i policyn på users-tabellen (skulle ge oändlig rekursion)
create or replace function public.my_office_id()
returns uuid language sql stable security definer set search_path = public
as $$ select office_id from public.users where id = auth.uid() $$;

-- POLICIES — kontor ser bara sin egen data
create policy "office_isolation" on public.kontakter
  using (office_id = public.my_office_id());

create policy "office_isolation" on public.objekt_kopplingar
  using (office_id = public.my_office_id());

create policy "office_isolation" on public.visningar
  using (office_id = public.my_office_id());

create policy "office_isolation" on public.bud
  using (office_id = public.my_office_id());

create policy "office_isolation" on public.aktiviteter
  using (office_id = public.my_office_id());

create policy "office_isolation" on public.intagsmoten
  using (office_id = public.my_office_id());

create policy "office_isolation" on public.kontrakt
  using (office_id = public.my_office_id());

create policy "office_isolation" on public.app_state
  using (office_id = public.my_office_id())
  with check (office_id = public.my_office_id());

-- users: läs ENDAST din egen rad direkt mot auth.uid().
-- Får INTE använda my_office_id() här — det skulle ge oändlig rekursion
-- (policyn på users anropar en funktion som själv läser från users).
create policy "users_select_self" on public.users
  for select using (id = auth.uid());

create policy "offices_own" on public.offices
  using (id = public.my_office_id());

-- ============================================================
-- TRIGGER: updated_at automatiskt
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_kontakter_updated
  before update on public.kontakter
  for each row execute function public.set_updated_at();

create trigger trg_kontrakt_updated
  before update on public.kontrakt
  for each row execute function public.set_updated_at();

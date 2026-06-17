# HANDOFF — Hajpex CRM

> **Till en ny Claude-session:** Läs hela den här filen först. Den ger dig
> kontexten som annars bara finns i chatten på Max stationära dator. När du
> läst den är du ikapp — fortsätt där "Återstår" beskriver.
>
> **Till Max:** Öppna en ny chatt på claude.ai/code (eller valfri enhet),
> skriv *"Läs HANDOFF.md och fortsätt"*, så är assistenten direkt med på läget.

Senast uppdaterad: 2026-06-17.

---

## Vad är projektet
Hajpex CRM — ett mäklarsystem som ska säljas som SaaS till svenska mäklare
(konkurrent till MSPECS). Byggt med **TanStack Start (SSR via Nitro) + React 19
+ Tailwind v4**. Backend är **Supabase** (Postgres + Auth + RLS + Edge Functions).

Affärsmodell: ingen Stripe/in-app-betalning — fakturering sker via
franchisekontoren. Åtkomst styrs av roller (se nedan).

## Kör lokalt
```
npm install
npm run dev        # startar på http://localhost:8080
```
Kräver `.env` med `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY`.
**`.env` får ALDRIG committas** (innehåller riktiga nycklar). Anon-nyckeln är
en frontend-nyckel skyddad av RLS — den får ligga i hostens env vid deploy.

Testinloggning: `max@test.se` (super_admin / Hajpex).

## Arkitektur — viktiga fakta
- **Supabase-klient** (`src/lib/supabase.ts`): standard `@supabase/supabase-js`
  `createClient` — INTE `@supabase/ssr` (den hängde och fäste inte JWT).
- **Auth** (`src/lib/supabaseAuth.ts`): `signInDetailad` skiljer auth-fel från
  profil/RLS-fel. Inaktiverat konto (`active=false`) spärras vid inloggning.
- **Molnsynk** (`src/lib/cloudSync.ts`): localStorage är fortfarande det
  synkrona läslagret; speglas till Supabase-tabellen `app_state`
  (office_id, store_key, data jsonb). `hydrateFromCloud` körs i `__root.tsx`
  före render. `schedulePush(KEY)` i varje store-write. Ägar-markör
  `hajpex.dataOffice.v1` hindrar dataläckage vid kontorsbyte.
- **Franchise-hierarki** (3 nivåer: franchise → kontor → mäklare). Roller:
  `super_admin` (Hajpex/Max, ser allt) | `franchise_admin` (huvudkontor, ser
  alla sina kontor) | `admin` (kontorsadmin) | `maklare`. RLS-helpers:
  `is_super_admin()`, `my_franchise_id()`, `my_office_ids()`. Allt i
  `supabase/schema.sql`.
- **Kontorsväljare** i `AppShell.tsx` för super/franchise-admin.
- **Admin-sida** `/admin` ("Kontor & personal"): in/aktivera personer.
  "Stäng kontor" syns BARA för super_admin.
- **Skapa mäklare**: Edge Function deployad i Supabase under namnet
  **`quick-handler`** (default-namnet behölls vid deploy). Kod ligger i
  `supabase/functions/quick-handler/`. Appen anropar
  `supabase.functions.invoke("quick-handler", …)`. Verifierad end-to-end.
- **PWA**: `public/manifest.webmanifest` + `icon.svg` + `sw.js`. Installerbar
  på iPad/mobil (lägg till på hemskärmen).

## Vad som är KLART
- Inloggning, molnsynk per kontor, hela kedjan intag→visning→bud→kontrakt
  verifierad mot Supabase.
- Franchise-tier komplett (datamodell, RLS, kontorsväljare, admin-sida,
  skapa/inaktivera mäklare).
- Dashboard: onboarding-bannern borttagen; "+ Ny kontakt" öppnar modal kvar på
  startsidan och går till personen efter sparande; tydligare sökfält.
- "Ring-läge" (ringlista) finns redan på Kontakter-sidan (`kunder.tsx`).

## ÅTERSTÅR (prioriterat — detta är nästa jobb)
1. **Säljare-inkonsekvens (bugg).** Det finns TRE källor för säljare som
   används om vartannat: (a) riktiga kopplade kontakter i `kontaktStore`,
   (b) seed-strängen `o.saljare` i `src/data/objekt.ts`, (c) genererad demodata
   `getDemoSaljare()` i `src/lib/demoKontakter.ts`. Säljare-fliken
   (`SaljareView` i `objekt.$slug.tsx`) faller tillbaka på (c) när ingen riktig
   kontakt finns, medan översikten/Parter använder (a). Därför kan ett objekt
   visa en säljare på ett ställe men inte i fliken. **Fix:** gör säljare till
   EN källa (riktiga kontakter) och ta bort demo-fallbacken. Hänger ihop med
   beslutet om demodata nedan.
2. **Roller: kontorschef vs mäklare.** Kontorschef ska kunna sätta mäklares
   budget, dela ut leads och styra. Vanlig mäklare har standardfunktioner.
   Behöver designas (mappa mot befintlig `admin`-roll eller ny `kontorschef`).
   Ej påbörjad.
3. **Ringlistor på Listor-fliken + ersätt mockdata.** Hela `src/routes/listor.tsx`
   är hårdkodad mockdata (t.ex. "7387 kontakter", påhittade namn). Ska kopplas
   mot riktig data och få ringlist-funktion (återanvänd `RingLage` från
   `kunder.tsx`).

Lägre prio: statistik-fliken (`statistik.tsx`) visar fortfarande demodata;
kontraktflödet (`KontraktView`) är delvis platshållare.

## Öppet PRODUKTBESLUT (fråga Max)
Mycket av appen fylls av **demodata**: `seedDemoKontakter()` skapar fejk-kontakter
för 30+ demo-objekt i `src/data/objekt.ts`, och `listor.tsx` är helt mockad.
Max vill bort från det hårdkodade. Innan punkt 1 och 3 ovan görs ordentligt:
ska demodatan **behållas som tydligt demo-läge** (för säljdemos) eller **tas
bort** så appen bara visar riktig data? Detta styr fixen för både säljare och
Listor.

## Kända småsaker
- Nästlade `<button>` i VisningRow (`objekt.$slug.tsx`) ger hydreringsvarning.
- Två "Tallbacken 7" i seed-datan → slug-krock (`tallbacken-7`).
- Ett testkonto kan ligga kvar i Supabase Auth: `testmaklare.raderas@hajpex-test.se`
  (profilraden raderad, auth-kontot ev. kvar — radera i Dashboard → Authentication).

## Arbetsregler (från Max)
- **Pusha till GitHub i slutet av varje session** utan att fråga.
- **Kör autonomt** — fråga inte om godkännande för vanliga operationer.
- `.env` committas aldrig.

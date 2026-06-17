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
- **Säljare-bugg fixad:** Säljare-fliken (`SaljareView`) visar nu BARA riktiga
  kopplade kontakter + tom-state, ingen genererad demo-fallback. Översikt och
  flik är konsekventa.
- **Listor ombyggd på riktig data:** flikar Kontakter/Intagsmöten/Uppgifter
  drivs av riktiga stores. Ny flik **Ringlistor** med kurerade listor som
  startar ring-läget. `RingLage` exporteras nu från `kunder.tsx` och tar en
  filtrerad lista.
- Nästlade-knappen-buggen i VisningRow fixad (hydrering).
- "Ring-läge" (ringlista) finns på Kontakter-sidan OCH via Listor-fliken.

## ÅTERSTÅR (prioriterat — detta är nästa jobb)
1. **Roller: kontorschef vs mäklare.** Designförslag klart i **`KONTORSCHEF.md`**
   — läs det och ställ frågorna där till Max innan bygge (rör datamodell + RLS).
   Kort: kontorschef = `admin`, får sätta mäklares budget (säljmål) + dela ut
   leads; vanlig mäklare ser bara sitt eget.
2. **Statistik-fliken** (`statistik.tsx`) visar fortfarande demodata — byt mot
   riktiga KPI:er (och utfall mot budget när rollen byggts).
3. **Deploy** för publik/iPad-demo: kräver Max-klick (koppla GitHub + 2 env-vars
   i Vercel). Appen är TanStack Start + Nitro; Supabase-backend funkar direkt.

Lägre prio: kontraktflödet (`KontraktView`) är delvis platshållare.

## OBS — verifieringsgräns
Assistenten får INTE mata in lösenord för att logga in (säkerhetsregel), och hela
appen ligger bakom login. Autonoma ändringar verifieras därför med
`npx tsc --noEmit` (typkoll) + kodgranskning, inte klick i webbläsaren. Be Max
verifiera visuellt, eller gör det när Max redan är inloggad.

## Öppet PRODUKTBESLUT (fråga Max)
Appen fylls fortfarande av **demodata**: `seedDemoKontakter()` skapar
fejk-kontakter för 30+ demo-objekt i `src/data/objekt.ts`. (Listor-fliken är
INTE längre mockad — den drivs nu av riktig data.) Max vill bort från det
hårdkodade. Beslut som behövs: ska demodatan **behållas som tydligt demo-läge**
(för säljdemos) eller **tas bort** så appen bara visar riktig data? Styr
statistik-fliken och hur tomma vyer ser ut.

## Kända småsaker
- Nästlade `<button>` i VisningRow (`objekt.$slug.tsx`) ger hydreringsvarning.
- Två "Tallbacken 7" i seed-datan → slug-krock (`tallbacken-7`).
- Ett testkonto kan ligga kvar i Supabase Auth: `testmaklare.raderas@hajpex-test.se`
  (profilraden raderad, auth-kontot ev. kvar — radera i Dashboard → Authentication).

## Arbetsregler (från Max)
- **Pusha till GitHub i slutet av varje session** utan att fråga.
- **Kör autonomt** — fråga inte om godkännande för vanliga operationer.
- `.env` committas aldrig.

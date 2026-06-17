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
Kräver `.env` med `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` och
`ANTHROPIC_API_KEY` (för AI). **`.env` får ALDRIG committas.** Supabase
anon-nyckeln är en publik frontend-nyckel (RLS-skyddad); ANTHROPIC_API_KEY är
hemlig.

## Deploy (LIVE)
- **Produktion: https://hajpex-crm.vercel.app** (Vercel, projekt `hajpex-crm`,
  scope `Hajpex1`). Auto-deployar vid varje push till `main`.
- **VIKTIGT bygg-fix:** Lovable-configen defaultar nitro-target till Cloudflare
  → gav 404 på Vercel. Löst i `vite.config.ts` med `nitro: { preset: "vercel" }`
  (bygger till `.vercel/output`). Rör inte den raden om du vill behålla Vercel.
- De tre miljövariablerna måste finnas i Vercel → Settings → Environment
  Variables (samma som .env). VITE_*-vars bakas in vid bygget.
- iPad: öppna URL:en i Safari, kan läggas till på hemskärmen (PWA fungerar).

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
- **AI migrerad till Claude:** alla AI-funktioner (`src/lib/ai.functions.ts`)
  låg på Lovable-gatewayen med en nyckel som SAKNADES i miljön → allt var
  trasigt (rumsbeskrivning/bildläsning, annonstext, områdestext, morning brief).
  Omskrivet till Anthropic Claude via `@anthropic-ai/sdk` med vision, modell
  `claude-haiku-4-5`. **KRÄVER `ANTHROPIC_API_KEY` i .env** (Max skapar nyckeln
  på console.anthropic.com och lägger in den; committas aldrig). Tills nyckeln
  finns kastar funktionerna "ANTHROPIC_API_KEY saknas på servern."

## ÅTERSTÅR (prioriterat — detta är nästa jobb)
1. **Roller: kontorschef vs mäklare.** Designförslag klart i **`KONTORSCHEF.md`**
   — läs det och ställ frågorna där till Max innan bygge (rör datamodell + RLS).
   Kort: kontorschef = `admin`, får sätta mäklares budget (säljmål) + dela ut
   leads; vanlig mäklare ser bara sitt eget.
2. **Statistik-fliken** (`statistik.tsx`) visar fortfarande demodata — byt mot
   riktiga KPI:er (och utfall mot budget när rollen byggts).
3. **AI-krediter:** rumsbeskrivaren/AI funkar tekniskt (verifierat mot Claude),
   men Anthropic-kontot behöver krediter (Plans & Billing) innan svar kommer.

4. **Flytta rum-skaparen till objektet + ta bort ur förening-flödet.** Den
   AI-drivna rum-skaparen (foto-uppladdning → Claude beskriver → följdfrågor)
   ligger idag i SKAPA-objekt/förening-flödet (`objekt.nytt.tsx`, "Rum"-Card +
   `RoomCard`-komponent, ~rad 245/694). Max vill ha den på SJÄLVA objektet
   (`objekt.$slug.tsx`, rumsbeskrivnings-platshållaren ~rad 3900 "+ Lägg till
   rum") och bort ur förening-flödet (rum-sektionen "03"). ORDNING: bygg
   objekt-detalj-versionen FÖRST (extrahera RoomCard + state till delad
   komponent, spara per objekt), verifiera visuellt, ta SEN bort ur skapa-
   flödet — annars tappar man funktionen temporärt. Stor UI-refaktor; bör göras
   när Max kan klicka-verifiera (assistenten kan inte logga in).

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

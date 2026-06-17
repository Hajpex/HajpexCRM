# Förslag: Kontorschef-roll (budget + leads)

> Status: **förslag, ej byggt.** Behöver Max OK på riktningen (2-min koll) innan
> bygge, eftersom det rör datamodell + RLS. Se "Frågor till Max" sist.

## Vad Max sa
> "Olika roller som kontorschef — kan sätta folks budget, dela ut leads, den
> styr. En vanlig mäklare har vanliga grejer."

## Rekommenderad modell
Vi har redan roller: `super_admin` (Hajpex), `franchise_admin` (huvudkontor),
`admin` (kontorsadmin), `maklare`. **Kontorschef = `admin` (kontorsadmin)** —
ingen ny roll behövs, vi ger bara `admin` på ett kontor två nya förmågor och
kallar rollen "Kontorschef" i gränssnittet. Franchise_admin och super_admin
ärver allt en kontorschef kan.

Två nya förmågor, båda begränsade till kontorschef+ inom eget kontor (RLS):

### 1. Sätta mäklares budget (säljmål)
- Ny tabell `maklare_budget` (eller fält på `users`): `user_id`, `office_id`,
  `period` (t.ex. "2026" eller "2026-Q3"), `mal_volym` (kr), `mal_affarer` (antal).
- Kontorschef sätter mål per mäklare på admin-sidan. Mäklaren ser sitt eget mål
  på dashboarden/statistik (läs-bara).
- Statistik-fliken visar utfall mot mål (idag visar den demodata — byts samtidigt).

### 2. Dela ut leads
- Idag finns ingen lead-modell (Listor-fliken hade bara mockade "leads").
- Förslag: `kontakter` (eller en `leads`-tabell) får `maklare_id` (tilldelad
  mäklare). Kontorschef ser inkomna/otilldelade leads och tilldelar en mäklare.
- Mäklaren ser sina tilldelade leads i sin lista/på dashboarden.
- "Otilldelade leads" blir en naturlig ringlista (kopplar till det vi byggde).

## Vad mäklaren (vanlig) ser
- Sina egna kontakter/objekt/visningar/bud (som idag).
- Sitt eget budgetmål + utfall (läs-bart).
- Sina tilldelade leads.
- INTE: sätta andras budget, tilldela leads, se andras mål, admin-sidan.

## Berörda ställen i koden
- `supabase/schema.sql` — ny tabell/fält + RLS (kontorschef hanterar inom kontor).
- `src/lib/supabaseAuth.ts` — ev. helper `isKontorschef(user)` (= admin/chef+).
- `src/routes/admin.tsx` — UI för att sätta budget + tilldela leads per mäklare.
- `src/routes/statistik.tsx` — utfall mot mål (ersätt demodata).
- `src/routes/index.tsx` (dashboard) — mäklarens egna mål + tilldelade leads.
- Listor-fliken — "Otilldelade leads" som vy/ringlista.

## Frågor till Max (svara så bygger jag)
1. **Är "kontorschef" = kontorsadmin (admin), eller ska det vara en EGEN nivå**
   under admin (dvs admin/ägare > kontorschef > mäklare)? Rekommenderar = admin.
2. **Budget**: per år, kvartal eller månad? Mål i kr-volym, antal affärer, eller
   båda? Sätts provision också, eller bara säljmål?
3. **Leads**: ska vi bygga en riktig lead-modell nu (egen tabell + källa/status),
   eller räcker det att kunna tilldela en mäklare till en vanlig kontakt?
4. **Demodatan** (öppen fråga sedan tidigare): behåll som demo-läge eller ta bort?
   Påverkar hur statistik och leads ser ut.

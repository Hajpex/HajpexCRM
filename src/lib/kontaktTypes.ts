export type KontaktRelation = "spekulant" | "säljare" | "köpare" | "kontakt";

export type NastaStegTyp = "samtal" | "möte" | "mejl" | "annat";

export type NastaSteg = {
  datum: number;
  text: string;
  typ: NastaStegTyp;
};

export type ObjektKoppling = {
  slug: string;
  relation: KontaktRelation;
  addedAt: number;
  anteckning: string;
};

export type AktivitetTyp =
  | "visning"
  | "bud"
  | "samtal"
  | "kontakt_skapad"
  | "anteckning"
  | "mejl";

export type Aktivitet = {
  id: string;
  typ: AktivitetTyp;
  objektSlug?: string;
  tidpunkt: number;
  beskrivning: string;
  belopp?: number;
};

export type Kontakt = {
  id: string;
  skapadAt: number;
  fornamn: string;
  efternamn: string;
  telefon: string;
  epost: string;
  adress: string;
  ort: string;
  budgetMin: string;
  budgetMax: string;
  sokTyper: string[];
  sokOmraden: string[];
  anteckningar: string;
  gdprGodkant: number | null;
  objektKopplingar: ObjektKoppling[];
  aktiviteter: Aktivitet[];
  nastaSteg?: NastaSteg | null;
};

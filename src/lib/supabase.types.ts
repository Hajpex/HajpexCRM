export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      offices: {
        Row: { id: string; name: string; org_nr: string | null; created_at: string };
        Insert: { id?: string; name: string; org_nr?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["offices"]["Insert"]>;
      };
      users: {
        Row: { id: string; office_id: string; name: string; initials: string | null; role: "admin" | "maklare"; created_at: string };
        Insert: { id: string; office_id: string; name: string; initials?: string | null; role?: "admin" | "maklare"; created_at?: string };
        Update: Partial<Omit<Database["public"]["Tables"]["users"]["Insert"], "id">>;
      };
      kontakter: {
        Row: {
          id: string; office_id: string; maklare_id: string | null;
          fornamn: string; efternamn: string; telefon: string; epost: string;
          adress: string; ort: string; budget_min: number; budget_max: number;
          sok_typer: string[]; sok_omraden: string[]; anteckningar: string;
          gdpr_godkant: string | null; skapad_at: string; updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["kontakter"]["Row"], "id" | "skapad_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["kontakter"]["Insert"]>;
      };
      objekt_kopplingar: {
        Row: {
          id: string; office_id: string; kontakt_id: string; objekt_slug: string;
          relation: "spekulant" | "säljare" | "köpare" | "kontakt";
          added_at: string; anteckning: string;
          intresse: "aktiv" | "budgivare" | "följer" | "ej_intresserad" | null;
          medspekulanter: Json;
        };
        Insert: Omit<Database["public"]["Tables"]["objekt_kopplingar"]["Row"], "id" | "added_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["objekt_kopplingar"]["Insert"]>;
      };
      visningar: {
        Row: {
          id: string; office_id: string; objekt_slug: string;
          datum: string; sluttid: string; typ: string;
          anteckningar: string; deltagare: Json; skapad_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["visningar"]["Row"], "id" | "skapad_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["visningar"]["Insert"]>;
      };
      bud: {
        Row: {
          id: string; office_id: string; objekt_slug: string;
          belopp: number; namn: string; telefon: string; villkor: string;
          tid: string; vinnare: boolean; dragen_tillbaka: boolean; dragen_tid: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["bud"]["Row"], "id" | "tid"> & { id?: string; tid?: string };
        Update: Partial<Database["public"]["Tables"]["bud"]["Insert"]>;
      };
      aktiviteter: {
        Row: {
          id: string; office_id: string; kontakt_id: string;
          typ: string; objekt_slug: string | null; tidpunkt: string;
          beskrivning: string; belopp: number | null;
        };
        Insert: Omit<Database["public"]["Tables"]["aktiviteter"]["Row"], "id" | "tidpunkt"> & { id?: string; tidpunkt?: string };
        Update: Partial<Database["public"]["Tables"]["aktiviteter"]["Insert"]>;
      };
      intagsmoten: {
        Row: {
          id: string; office_id: string; kontakt_id: string; maklare_id: string | null;
          adress: string; postnr: string; ort: string;
          tidpunkt: string; sluttid: string | null; kalla: string;
          anteckningar: string; status: string; vardering: number | null;
          vardering_kommentar: string; objekt_slug: string | null; objekt_typ: string | null;
          skapad_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["intagsmoten"]["Row"], "id" | "skapad_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["intagsmoten"]["Insert"]>;
      };
      kontrakt: {
        Row: { id: string; office_id: string; objekt_slug: string; data: Json; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["kontrakt"]["Row"], "id" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["kontrakt"]["Insert"]>;
      };
    };
  };
};

export type BrfFile = { id: string; name: string; size: number; dataUrl?: string };
export type BrfImage = { id: string; name: string; dataUrl: string };

export type BrfByggnad = {
  id: string;
  namn: string;
  byggar: string;
  gatuadress: string;
  postnummer: string;
  ort: string;
  antalVaningar: string;
  hiss: string; // "Ja" | "Nej" | ""
  hissBeskrivning: string;
  uppvarmning: string;
  tvInternet: string;
  energiklass: string;
  energistatus: string;
  energianvandning: string;
  beskrivning: string;
};

export type BrfKontakt = {
  id: string;
  roll: string;
  fornamn: string;
  efternamn: string;
  foretag: string;
  telefon: string;
  epost: string;
  anteckning: string;
};

export const INGAR_I_AVGIFTEN = [
  "Uppvärmning", "El", "Vatten", "Varmvatten", "Kallvatten",
  "Internet", "IPTV", "IP-Telefoni", "Kabel-TV", "Internet/TV",
  "Garage", "Carport", "Parkeringsplats", "Bostadsrättstillägg", "Laddstolpe",
] as const;

export type Brf = {
  namn: string; orgnr: string; hemsida: string;
  taxering: string; bildades: string;
  antalLgh: string; antalHyres: string; antalLokaler: string;
  pantavgift: string; overlatelseavgift: string; overlataresBetalas: string;
  juridiskPerson: string; markagare: string;
  nettoskuld: string; nettoskuldAr: string;
  allman: string; renoveringar: string; kommandeRenoveringar: string;
  ovrigaUtrymmen: string; tvInternet: string;
  // Strukturerade flikar
  byggnader: BrfByggnad[];
  parkering: string;
  kontakter: BrfKontakt[];
  webbadresser: string;
  // Kostnader
  ingarIAvgiften: string[];
  beskrivningManadsavgift: string;
  beskrivningKostnaderIngar: string;
  // Filer & bilder
  filer: BrfFile[];
  bilder: BrfImage[];
};

export const tomBrf: Brf = {
  namn: "", orgnr: "", hemsida: "",
  taxering: "", bildades: "",
  antalLgh: "", antalHyres: "", antalLokaler: "",
  pantavgift: "", overlatelseavgift: "", overlataresBetalas: "",
  juridiskPerson: "", markagare: "",
  nettoskuld: "", nettoskuldAr: "",
  allman: "", renoveringar: "", kommandeRenoveringar: "",
  ovrigaUtrymmen: "", tvInternet: "",
  byggnader: [], parkering: "", kontakter: [], webbadresser: "",
  ingarIAvgiften: [], beskrivningManadsavgift: "", beskrivningKostnaderIngar: "",
  filer: [], bilder: [],
};
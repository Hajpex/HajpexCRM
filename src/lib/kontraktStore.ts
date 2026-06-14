const KEY = "hajpex.kontrakt.v1";

export type KontraktData = {
  kontraktsdatum: string;
  tilltradesdatum: string;
  slutpris: string;
  handpenning: string;
  handpenningDatum: string;
  kontraktstyp: string;
  besiktningsklausul: string;
  finansieringsvillkor: string;
  ovrigaVillkor: string;
  checkObjektsbeskrivning: boolean;
  checkFragelista: boolean;
  checkBudgivningslista: boolean;
  betaladHandpenning: string;
  betaldatum: string;
  provisionBetaldatum: string;
  deponerasKonto: boolean;
  handpenningKommentar: string;
  signerat: boolean;
};

const EMPTY: KontraktData = {
  kontraktsdatum: "",
  tilltradesdatum: "",
  slutpris: "",
  handpenning: "",
  handpenningDatum: "",
  kontraktstyp: "Köpekontrakt",
  besiktningsklausul: "Nej",
  finansieringsvillkor: "Nej",
  ovrigaVillkor: "",
  checkObjektsbeskrivning: true,
  checkFragelista: true,
  checkBudgivningslista: false,
  betaladHandpenning: "",
  betaldatum: "",
  provisionBetaldatum: "",
  deponerasKonto: true,
  handpenningKommentar: "",
  signerat: false,
};

function read(): Record<string, KontraktData> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return typeof p === "object" && p !== null ? p : {};
  } catch { return {}; }
}

function write(data: Record<string, KontraktData>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

export function getKontrakt(slug: string): KontraktData {
  return { ...EMPTY, ...(read()[slug] ?? {}) };
}

export function saveKontrakt(slug: string, data: Partial<KontraktData>) {
  const all = read();
  all[slug] = { ...EMPTY, ...(all[slug] ?? {}), ...data };
  write(all);
}

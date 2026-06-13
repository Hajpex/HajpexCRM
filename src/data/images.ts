// Curated fake property photos. 1 facade + several interiors per object,
// deterministic per slug so the list thumbnail matches the detail page.

import type { Typ } from "./objekt";

// Apartment-building facades (BRF / Ägarlägenhet)
const APARTMENT_FACADES = [
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1600&q=80",
];

// Detached / villa facades
const HOUSE_FACADES = [
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80",
];

// Smaller / cozier facades for fritidshus, parhus, kedjehus, radhus
const TOWNHOUSE_FACADES = [
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80",
];

// Land / tomt
const TOMT_FACADES = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1444858345224-c0bc0606fc6e?auto=format&fit=crop&w=1600&q=80",
];

const SMALL_INTERIORS = [
  // Compact apartments (≤ ~55 m²)
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1494203484021-3c454daf695d?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1600&q=80",
];

// Medium apartments / mid-size homes (~55–90 m²)
const MEDIUM_INTERIORS = [
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&q=80",
];

// Large interiors (90+ m², villas)
const LARGE_INTERIORS = [
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=1600&q=80",
];

function hashSlug(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function facadePool(typ?: Typ): string[] {
  switch (typ) {
    case "Bostadsrätt":
    case "Ägarlägenhet":
      return APARTMENT_FACADES;
    case "Villa":
    case "Gård":
      return HOUSE_FACADES;
    case "Radhus":
    case "Parhus":
    case "Kedjehus":
    case "Fritidshus":
      return TOWNHOUSE_FACADES;
    case "Tomt":
      return TOMT_FACADES;
    default:
      return HOUSE_FACADES;
  }
}

function interiorPool(typ?: Typ, boarea?: number): string[] {
  if (typ === "Tomt") return []; // no interiors for raw land
  const m2 = boarea ?? 0;
  if (m2 && m2 <= 55) return SMALL_INTERIORS;
  if (m2 && m2 >= 95) return LARGE_INTERIORS;
  if (typ === "Bostadsrätt" || typ === "Ägarlägenhet") return m2 > 75 ? MEDIUM_INTERIORS : SMALL_INTERIORS;
  if (typ === "Villa" || typ === "Gård") return LARGE_INTERIORS;
  return MEDIUM_INTERIORS;
}

// 1 facade + up to 6 interior photos, in a stable order per slug.
// Matches the property type and size when provided.
export function pickImages(slug: string, typ?: Typ, boarea?: number): string[] {
  const h = hashSlug(slug);
  const facades = facadePool(typ);
  const interiors = interiorPool(typ, boarea);
  const facade = facades[h % facades.length];
  if (interiors.length === 0) return [facade];
  const start = h % interiors.length;
  const rotated = [...interiors.slice(start), ...interiors.slice(0, start)];
  return [facade, ...rotated.slice(0, 6)];
}

export function facadeFor(slug: string, typ?: Typ, boarea?: number): string {
  return pickImages(slug, typ, boarea)[0];
}
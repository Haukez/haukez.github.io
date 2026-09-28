// Saison-Design der Kaufseite (docs/specs/2026-09-28-saison-design.md K1–K3). Welches Design gilt, entscheidet der
// Worker (`design` im Katalog, Saisonplan aus Compass); hier steht nur, wie jedes aussieht. Rein, ohne DOM –
// getestet in saison.test.mjs. Standard ist das bisherige Design und setzt keine eigenen Töne (K5).

/**
 * Je Design: Startbild, Alternativtext, Handschrift-Zeile (`zug`, zwei Zeilen), Gruß über dem Satz auf dem Handy,
 * Grundpalette der neutralen Welt (`farben`, wie `WELTEN.neutral`), Töne der Seite (`toene`, nur außerhalb von
 * Standard), Schatten über dem Startbild (RGB) und Ornament (Linienpfad 24 × 24).
 */
export const DESIGNS = {
  standard: {
    name: "Standard",
    bild: "bilder/held_breit.jpg",
    alt: "Wiesenstrauß mit rosa Dahlien und Schmuckkörbchen in einer Keramikkanne auf einem Holztisch",
    zug: ["Mehr", "als Blumen"],
    gruss: "",
    farben: { grund: "#F7F3EC", flaeche: "#EFE8DD", karte: "#FFFDF9", akzent: "#2F4A36", tinte: "#2B2622" },
    themenfarbe: "#2F4A36",
    toene: null,
    ornament: "",
  },
  fruehling: {
    name: "Frühling",
    bild: "bilder/saison/fruehling_breit.jpg",
    alt: "Frühlingsstrauß mit Tulpen, Ranunkeln, Narzissen, Traubenhyazinthen und Kirschzweigen in einer Keramikkanne auf einem Holztisch",
    zug: ["Hallo", "Frühling"],
    gruss: "Frühling in Heide",
    farben: { grund: "#F5F5EE", flaeche: "#E5EBDA", karte: "#FFFEF9", akzent: "#3A5F36", tinte: "#262A22" },
    themenfarbe: "#3A5F36",
    toene: {
      papier: "#F5F5EE", sand: "#E5EBDA", flaeche: "#EDF0E4", linie: "#DEE3D2", gruen: "#3A5F36", "gruen-dunkel": "#2C4A29",
      "gruen-hauch": "#EAF2E6", rose: "#A8475E", "rose-hauch": "#F8E7EB", akzent: "#A8475E", "buehne-schatten": "28 34 30", "buehne-grund": "#3A403A", "buehne-oben": ".4", "buehne-ecke": ".55",
    },
    // Blüte mit fünf Blättern
    ornament: "M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM12 9.5C10 7 10.6 3.5 12 3c1.4.5 2 4 0 6.5M14.4 11.2c1.3-2.9 4.8-3.6 5.8-2.6-.1 1.5-3.1 3.6-5.8 2.6M13.5 14.2c3.1.4 4.6 3.6 4 4.9-1.4.4-4.3-1.6-4-4.9M10.5 14.2c.3 3.3-2.6 5.3-4 4.9-.6-1.3.9-4.5 4-4.9M9.6 11.2C6.9 12.2 3.9 10.1 3.8 8.6c1-1 4.5-.3 5.8 2.6",
  },
  sommer: {
    name: "Sommer",
    bild: "bilder/saison/sommer_breit.jpg",
    alt: "Sommerstrauß mit Sonnenblumen, Rittersporn, Schmuckkörbchen und Weizenähren in einer Keramikkanne auf einem Holztisch, daneben Kirschen",
    zug: ["Sommer", "im Strauß"],
    gruss: "Sommer in Heide",
    farben: { grund: "#FAF4E6", flaeche: "#F2E4C4", karte: "#FFFCF3", akzent: "#2C4F7C", tinte: "#2E2819" },
    themenfarbe: "#2F4A36",
    toene: {
      papier: "#FAF4E6", sand: "#F2E4C4", flaeche: "#F5EBD6", linie: "#E9DCC0", gruen: "#2F4A36", "gruen-dunkel": "#243A2A",
      "gruen-hauch": "#EEF2EC", rose: "#A94F16", "rose-hauch": "#FBEBDD", akzent: "#A94F16", "buehne-schatten": "44 32 18", "buehne-grund": "#4A3822", "buehne-oben": ".45", "buehne-ecke": ".55",
    },
    // Sonne
    ornament: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8",
  },
  herbst: {
    name: "Herbst",
    bild: "bilder/saison/herbst_breit.jpg",
    alt: "Herbststrauß mit orangen und dunkelroten Dahlien, Lampionblumen und Gräsern in einer Keramikkanne, davor kleine Kürbisse und Äpfel auf einem Holztisch",
    zug: ["Goldener", "Herbst"],
    gruss: "Herbst in Heide",
    farben: { grund: "#F6EFE3", flaeche: "#EEDDC6", karte: "#FFFBF4", akzent: "#8A3F18", tinte: "#2E251D" },
    themenfarbe: "#3F4B2A",
    toene: {
      papier: "#F6EFE3", sand: "#EEDDC6", flaeche: "#F1E6D6", linie: "#E6D6C0", gruen: "#3F4B2A", "gruen-dunkel": "#2F3A1F",
      "gruen-hauch": "#EEF0E4", rose: "#9A4119", "rose-hauch": "#F8E8DD", akzent: "#9A4119", "buehne-schatten": "40 26 14", "buehne-grund": "#3B2A1C", "buehne-oben": ".45", "buehne-ecke": ".55",
    },
    // Blatt mit Adern
    ornament: "M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7M9.5 14.5v-3M12 12h3",
  },
  weihnachten: {
    name: "Weihnachten",
    bild: "bilder/saison/weihnachten_breit.jpg",
    alt: "Adventskranz mit vier brennenden Kerzen, Tannenzweigen, Zapfen und Orangenscheiben, dahinter ein Strauß aus roter Amaryllis und weißen Rosen in einer Keramikkanne auf einem Holztisch",
    zug: ["Frohe", "Weihnachtszeit"],
    gruss: "Weihnachtszeit in Heide",
    farben: { grund: "#F5EFE6", flaeche: "#E9DFD0", karte: "#FFFCF7", akzent: "#1F4632", tinte: "#2A221D" },
    themenfarbe: "#1F4632",
    toene: {
      papier: "#F5EFE6", sand: "#E9DFD0", flaeche: "#EEE6DA", linie: "#E2D7C6", gruen: "#1F4632", "gruen-dunkel": "#16352A",
      "gruen-hauch": "#E9F0EA", rose: "#8E2A2E", "rose-hauch": "#F6E6E4", akzent: "#8E2A2E", "buehne-schatten": "24 19 15", "buehne-grund": "#2A211B", "buehne-oben": ".3", "buehne-ecke": ".35",
    },
    // Tannenzweig
    ornament: "M12 3v18M12 7.5 9 5.5M12 7.5l3-2M12 11.5 7.5 8.8M12 11.5l4.5-2.7M12 15.5 6 12M12 15.5l6-3.5",
  },
};

export const DESIGN_IDS = Object.keys(DESIGNS);

/** Hosts, auf denen `?design=` wirkt (K3) – wie `?vorschau=` nur zum Ansehen am eigenen Rechner. */
const LOKAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Welches Design die Seite zeigt: lokal darf `?design=<id>` vorführen, sonst gilt, was der Worker sagt. Unbekanntes oder
 * Fehlendes → Standard (der Worker kann die Seite so nie brechen).
 * @param {unknown} vomWorker `design` aus dem Katalog
 * @param {{ hostname: string, search: string }} ort `location`
 */
export function designWahl(vomWorker, ort) {
  const bekannt = (x) => typeof x === "string" && Object.hasOwn(DESIGNS, x);
  const vorschau = LOKAL.has(ort?.hostname ?? "") ? new URLSearchParams(ort?.search ?? "").get("design") : null;
  if (bekannt(vorschau)) return vorschau;
  return bekannt(vomWorker) ? vomWorker : "standard";
}

export function design(id) {
  return DESIGNS[id] ?? DESIGNS.standard;
}

/** Grenzen wie im Worker (cloudflare/src/services/design.ts) – was länger ist, wird nicht gezeigt. */
export const GRUSS_MAX = 40;
export const ZUG_MAX = 22;
const BILD_PFAD = /^\/shop\/bild\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

/**
 * Eigenes Aussehen des heutigen Kalenderabschnitts aus dem Katalog (`saison`, Spec 2026-09-28-saison-abschnitte K1):
 * Bild nur als Foto des eigenen Workers (`<worker>/shop/bild/<uuid>.jpg`), Texte nur in den Grenzen. Alles andere → null,
 * dann gilt die Vorgabe des Stils. Die Texte setzt app.js immer escaped.
 * @param {unknown} roh `saison` aus dem Katalog
 * @param {string | undefined} worker Adresse des Workers, von dem der Katalog kam
 * @returns {{ name: string | null, bild: string | null, gruss: string | null, zug: string[] | null }}
 */
export function saisonAnpassung(roh, worker) {
  const s = roh && typeof roh === "object" && !Array.isArray(roh) ? roh : {};
  const text = (x, max) => (typeof x === "string" && x.trim() && x.length <= max ? x.trim() : null);
  let bild = null;
  try {
    const u = new URL(String(s.bild ?? ""));
    if (worker && u.origin === new URL(worker).origin && BILD_PFAD.test(u.pathname) && !u.search && !u.hash) bild = u.href;
  } catch {
    bild = null;
  }
  const zug = Array.isArray(s.zug) && s.zug.length >= 1 && s.zug.length <= 2 && s.zug.every((z) => text(z, ZUG_MAX)) ? s.zug.map((z) => z.trim()) : null;
  return { name: text(s.name, 40), bild, gruss: text(s.gruss, GRUSS_MAX), zug };
}

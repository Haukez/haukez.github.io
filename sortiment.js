// Das Sortiment der Kaufseite (docs/specs/2026-09-23-gefuehrte-kaufseite.md § 2, Entscheidungen vom 2026-09-23):
// 5 Gefühle × 3 Größen = 15 Produkte, dazu Ergänzungen. Dieselben Kennungen, Namen und Texte nutzt Compass
// (src-tauri/src/woche.rs). Ohne DOM.

/** Die fünf Gefühle – sie sind die Produkte. Anlass und Absicht färben nur Name, Text und Farbwelt. */
export const GEFUEHLE = [
  // `merkmal`: was Ela bindet, in ihrer Stimme („… würde ich dir diesen Strauß binden: <merkmal>.“)
  { id: "zart", name: "Zart", kurz: "Ruhig und fein", text: "Weiche Töne, leichte Formen, viel Luft zwischen den Blüten.", merkmal: "weiche Töne, leichte Formen und viel Luft zwischen den Blüten" },
  { id: "froehlich", name: "Fröhlich", kurz: "Lebendig und farbenfroh", text: "Warme, helle Farben und runde Blüten – ein Strauß, der gute Laune macht.", merkmal: "warme, helle Farben, runde Blüten und viel Leichtigkeit" },
  { id: "natuerlich", name: "Natürlich", kurz: "Locker und wild", text: "Wie frisch aus dem Garten: Gräser, Zweige und Blüten der Saison, locker gebunden.", merkmal: "Gräser, Zweige und Blüten der Saison, locker wie aus dem Garten" },
  { id: "elegant", name: "Elegant", kurz: "Stilvoll und besonders", text: "Wenige ausgesuchte Sorten, klare Linie, ruhige Farbigkeit.", merkmal: "wenige ausgesuchte Sorten, eine klare Linie und ruhige Farben" },
  { id: "ausdrucksstark", name: "Ausdrucksstark", kurz: "Kräftig und unübersehbar", text: "Satte Farben, große Blüten, ein Strauß mit Haltung.", merkmal: "satte Farben und große Blüten – ein Strauß mit Haltung" },
];
/** Frühere Bezeichnung – die Kennungen der Gefühle stehen in der Metadaten-Spalte `stil`. */
export const STILE = GEFUEHLE;

/**
 * Die Größe der Geste. Kennungen S/M/L bleiben (Stripe-Metadaten, Compass), gezeigt werden die Namen.
 * `satz` ist die Größenhilfe in Worten – Maße erst, wenn Ela sie verlässlich angeben kann (keine erfundenen Zahlen).
 */
export const GROESSEN = [
  { id: "S", name: "Klein", satz: "Ein feiner Gruß" },
  { id: "M", name: "Besonders", satz: "Der klassische Geschenkstrauß" },
  { id: "L", name: "Großzügig", satz: "Ein großer Auftritt" },
];
export const PREISE_STANDARD = { S: 2900, M: 3900, L: 5500 };

/**
 * Ergänzungen („Mach es noch persönlicher") – erst nach dem Strauß. Nur die Grußkarte ist an; die Vase bleibt als
 * spätere Option erhalten (Nutzer 2026-09-23) und erscheint, sobald config.js sie freischaltet.
 */
export const EXTRAS = [
  { id: "karte", name: "Grußkarte", text: "Mit deinem persönlichen Text – den schreibst du an der Kasse.", cent: 300, standard: true },
  { id: "vase", name: "Vase", text: "Passend zu Größe und Stil deines Straußes.", cent: 1200, standard: false },
];

export const SAISON_SATZ = "Saisonal gebunden: Ela wählt Blumen, die in dieser Farb- und Stilwelt gerade schön sind. Die genaue Zusammenstellung variiert leicht.";
/** Was das Foto zeigt (Review 2026-09-23): die Stil- und Farbwelt, nicht genau diese Blumen. */
export const FOTO_SATZ = "Das Foto zeigt die Stil- und Farbwelt. Die genaue Blumenauswahl variiert je nach Saison und Verfügbarkeit.";

/** Preis-IDs der Vorschau – nie echte Stripe-Preise, die Kasse bleibt gesperrt. Nur Buchstaben und Ziffern. */
export const DEMO_PRAEFIX = "price_demo";

export function gefuehl(id) {
  return GEFUEHLE.find((g) => g.id === id) ?? null;
}

export function groesse(id) {
  return GROESSEN.find((g) => g.id === id) ?? null;
}

/** Titel eines Produkts – so heißt es bei Stripe und in Compass: „Fröhlich · Besonders". */
export function produktTitel(gefuehlId, groesseId) {
  return `${gefuehl(gefuehlId)?.name ?? gefuehlId} · ${groesse(groesseId)?.name ?? groesseId}`;
}

/** Welche Ergänzungen die Seite anbietet: aus config.js (`extras: ["karte"]`), sonst die Standard-Auswahl. */
export function aktiveExtras(konfig) {
  const ids = Array.isArray(konfig?.extras) ? konfig.extras : EXTRAS.filter((e) => e.standard).map((e) => e.id);
  return EXTRAS.filter((e) => ids.includes(e.id));
}

/** Die Produkte der Vorschau: 15 Sträuße und die aktiven Ergänzungen, ohne Bild (keine KI-Bilder für Ware). */
export function demoKatalog(preise, extras = aktiveExtras({})) {
  const p = { ...PREISE_STANDARD, ...(preise && typeof preise === "object" ? preise : {}) };
  const straeusse = GEFUEHLE.flatMap((s) =>
    GROESSEN.map((g) => ({
      preis_id: `${DEMO_PRAEFIX}${s.id}${g.id}`,
      name: produktTitel(s.id, g.id),
      beschreibung: `${s.text} ${g.satz}.`,
      bild: null,
      cent: Number.isInteger(p[g.id]) && p[g.id] > 0 ? p[g.id] : PREISE_STANDARD[g.id],
      waehrung: "eur",
      stil: s.id,
      groesse: g.id,
    })),
  );
  const zusatz = extras.map((e) => ({
    preis_id: `${DEMO_PRAEFIX}extra${e.id}`, name: e.name, beschreibung: e.text, bild: null, cent: e.cent, waehrung: "eur",
    stil: "extra", groesse: e.id,
  }));
  return [...straeusse, ...zusatz];
}

/** Ein Strauß im Katalog zu Gefühl und Größe. */
export function finden(artikel, gefuehlId, groesseId) {
  return (artikel ?? []).find((a) => a.stil === gefuehlId && a.groesse === groesseId) ?? null;
}

/** Eine Ergänzung im Katalog. */
export function extraFinden(artikel, extraId) {
  return (artikel ?? []).find((a) => a.stil === "extra" && a.groesse === extraId) ?? null;
}

/**
 * Katalog → Gefühle mit ihren Größen (für „Ich weiß schon, was ich möchte") und „Außerdem" für alles, was weder
 * Strauß des Sortiments noch Ergänzung ist.
 */
export function gruppieren(artikel) {
  const liste = Array.isArray(artikel) ? artikel : [];
  const stile = GEFUEHLE.map((s) => ({
    ...s,
    groessen: GROESSEN.map((g) => finden(liste, s.id, g.id)).filter(Boolean),
  })).filter((s) => s.groessen.length);
  const zugeordnet = new Set(stile.flatMap((s) => s.groessen.map((a) => a.preis_id)));
  return { stile, weitere: liste.filter((a) => !zugeordnet.has(a.preis_id) && a.stil !== "extra") };
}

/** Der kleinste Preis einer Liste. */
export function abPreis(liste) {
  const cent = Math.min(...liste.map((a) => a.cent));
  return Number.isFinite(cent) ? cent : null;
}

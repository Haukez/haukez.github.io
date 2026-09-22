// Die geführte Auswahl der Kaufseite (docs/specs/2026-09-23-gefuehrte-kaufseite.md § 2):
// Anlass → Absicht → Gefühl → Größe der Geste → eine florale Antwort. Ohne DOM, getestet in beratung.test.mjs.
//
// Der Anlass bestimmt Farbwelt, Sprache und welche Gefühle passen; die Absicht schlägt die Größe vor; Gefühl und Größe
// sind das Produkt. Namen und Texte des Ergebnisses sind Sprache, keine eigenen Produkte (Ela pflegt 15, nicht 90).

import { finden, gefuehl, GEFUEHLE, groesse, GROESSEN } from "./sortiment.js";

const ALLE = GEFUEHLE.map((g) => g.id);

/**
 * Die sechs Anlasswelten. `farben`: Grund, Fläche, Akzent, Tinte und Bildtöne für die Zeichnungen.
 * `absichten`: was die Geste leisten soll – `groesse` ist nur ein Vorschlag für Schritt 4.
 * `namen`: der Name der floralen Antwort je Gefühl.
 */
export const ANLAESSE = [
  {
    id: "geburtstag", titel: "Geburtstag", fuer: "einen besonderen Geburtstag",
    farbworte: "Apricot, Koralle und Buttergelb mit frischem Grün",
    farben: { grund: "#fbf4ec", flaeche: "#fdebd9", akzent: "#d9774f", tinte: "#3a2c24", bild: ["#f2a77f", "#ef8a6b", "#f3d27a", "#9fb58a"] },
    absichten: [
      { id: "freude", titel: "Eine kleine Freude machen", satz: "Ein lieber Gruß, einfach so.", groesse: "S", weil: "eine kleine Freude machen" },
      { id: "ueberraschen", titel: "Richtig überraschen", satz: "Ein Moment, der bleibt.", groesse: "M", weil: "richtig überraschen" },
      { id: "besonders", titel: "Etwas Besonderes schenken", satz: "Für einen unvergesslichen Tag.", groesse: "L", weil: "etwas Besonderes schenken" },
    ],
    gefuehle: ALLE,
    namen: { zart: "Pfirsichhauch", froehlich: "Sonnenmoment", natuerlich: "Gartenfest", elegant: "Festtag", ausdrucksstark: "Farbenrausch" },
  },
  {
    id: "liebe", titel: "Liebe & Jahrestag", fuer: "einen Moment zu zweit",
    farbworte: "Altrosa, Bordeaux und Creme mit dunkleren Akzenten",
    farben: { grund: "#f8f1ef", flaeche: "#f1e0dd", akzent: "#8d3b4a", tinte: "#34232a", bild: ["#d9a3a8", "#8d3b4a", "#f1e4d6", "#7e8c6c"] },
    absichten: [
      { id: "naehe", titel: "Nähe zeigen", satz: "Ein Zeichen für zwischendurch.", groesse: "S", weil: "Nähe zeigen" },
      { id: "jahrestag", titel: "Einen Jahrestag feiern", satz: "Für das, was ihr zusammen seid.", groesse: "M", weil: "einen Jahrestag feiern" },
      { id: "gross", titel: "Etwas ganz Großes sagen", satz: "Wenn Worte nicht reichen.", groesse: "L", weil: "etwas ganz Großes sagen" },
    ],
    gefuehle: ALLE,
    namen: { zart: "Rosenflüstern", froehlich: "Herzklopfen", natuerlich: "Wiesenliebe", elegant: "Samtabend", ausdrucksstark: "Rotglut" },
  },
  {
    id: "hochzeit", titel: "Hochzeit", fuer: "eine Hochzeit",
    farbworte: "Elfenbein, Blush, Salbei und Champagner",
    farben: { grund: "#f9f6f0", flaeche: "#efeadf", akzent: "#8a9a7b", tinte: "#2f2c27", bild: ["#f4ede1", "#e8c9c1", "#b7c3a5", "#e3d3b5"] },
    absichten: [
      { id: "gratulieren", titel: "Herzlich gratulieren", satz: "Ein Gruß zum großen Tag.", groesse: "S", weil: "herzlich gratulieren" },
      { id: "mitfeiern", titel: "Den Tag mitfeiern", satz: "Ein Strauß, der auf die Feier passt.", groesse: "M", weil: "den Tag mitfeiern" },
      { id: "bleibt", titel: "Ein Geschenk, das bleibt", satz: "Großzügig, für das Brautpaar.", groesse: "L", weil: "ein Geschenk machen, das bleibt" },
    ],
    gefuehle: ["zart", "natuerlich", "elegant", "froehlich"],
    namen: { zart: "Schleierweiß", froehlich: "Glückstag", natuerlich: "Landpartie", elegant: "Jawort" },
  },
  {
    id: "danke", titel: "Danke & Anerkennung", fuer: "ein Dankeschön",
    farbworte: "Terrakotta, Pfirsich, Sand und Olive",
    farben: { grund: "#f8f2ea", flaeche: "#efe2d2", akzent: "#b0633f", tinte: "#34281f", bild: ["#c77b55", "#f0bf9c", "#e3d2b4", "#8a8f5a"] },
    absichten: [
      { id: "kurz", titel: "Kurz Danke sagen", satz: "Eine freundliche Geste.", groesse: "S", weil: "kurz Danke sagen" },
      { id: "herzen", titel: "Von Herzen danken", satz: "Für etwas, das dir viel bedeutet hat.", groesse: "M", weil: "von Herzen danken" },
      { id: "anerkennung", titel: "Große Anerkennung zeigen", satz: "Für eine besondere Leistung.", groesse: "L", weil: "große Anerkennung zeigen" },
    ],
    gefuehle: ALLE,
    namen: { zart: "Leises Danke", froehlich: "Dankeschön", natuerlich: "Erntegruß", elegant: "Hochachtung", ausdrucksstark: "Großes Danke" },
  },
  {
    id: "trost", titel: "Trost & Gedenken", fuer: "einen stillen Moment",
    farbworte: "gebrochenes Weiß, gedecktes Grün, Mauve und sanftes Blau",
    farben: { grund: "#f5f4f1", flaeche: "#e9e8e3", akzent: "#6f7a86", tinte: "#2e3033", bild: ["#f1efe9", "#a9b3a0", "#b8a6b6", "#a7b8c8"] },
    absichten: [
      { id: "anteil", titel: "Anteilnahme zeigen", satz: "Ein stilles Zeichen.", groesse: "S", weil: "Anteilnahme zeigen" },
      { id: "verbunden", titel: "Verbundenheit ausdrücken", satz: "Du bist nicht allein.", groesse: "M", weil: "Verbundenheit ausdrücken" },
      { id: "abschied", titel: "Einen persönlichen Abschied gestalten", satz: "Für einen Menschen, der fehlt.", groesse: "L", weil: "einen persönlichen Abschied gestalten" },
    ],
    // Fröhlich und ausdrucksstark passen nicht zu Trost – sie werden gar nicht erst angeboten.
    gefuehle: ["zart", "natuerlich", "elegant"],
    namen: { zart: "Stilles Licht", natuerlich: "Verbunden", elegant: "In Würde" },
    leise: true,
  },
  {
    id: "einfach", titel: "Einfach so", fuer: "einfach so",
    farbworte: "frischen Farben der Saison",
    farben: { grund: "#f7f3ed", flaeche: "#ebeee0", akzent: "#5e7050", tinte: "#2f2a25", bild: ["#e7c3bd", "#efc9a8", "#b9a7c9", "#9fb08e"] },
    absichten: [
      { id: "freude", titel: "Eine kleine Freude machen", satz: "Weil heute ein guter Tag dafür ist.", groesse: "S", weil: "eine kleine Freude machen" },
      { id: "alltag", titel: "Den Alltag schöner machen", satz: "Für den Tisch, das Büro, das Zuhause.", groesse: "M", weil: "den Alltag schöner machen" },
      { id: "verwoehnen", titel: "Richtig verwöhnen", satz: "Sich selbst oder jemand anderen.", groesse: "L", weil: "richtig verwöhnen" },
    ],
    gefuehle: ALLE,
    namen: { zart: "Kleine Pause", froehlich: "Gute Laune", natuerlich: "Feldweg", elegant: "Ohne Anlass", ausdrucksstark: "Wildfang" },
  },
];

export const SCHRITTE = ["anlass", "absicht", "gefuehl", "groesse"];

export function anlass(id) {
  return ANLAESSE.find((a) => a.id === id) ?? null;
}

/**
 * Auswahl bereinigen: nur, was zum Anlass passt; alles nach einer ungültigen Stelle fällt weg.
 * → { anlass, absicht, gefuehl, groesse } mit `null` für Offenes.
 */
export function auswahlLesen(roh) {
  const a = anlass(roh?.anlass);
  const aus = { anlass: null, absicht: null, gefuehl: null, groesse: null };
  if (!a) return aus;
  aus.anlass = a.id;
  const ab = a.absichten.find((x) => x.id === roh?.absicht);
  if (!ab) return aus;
  aus.absicht = ab.id;
  if (!a.gefuehle.includes(roh?.gefuehl)) return aus;
  aus.gefuehl = roh.gefuehl;
  if (!groesse(roh?.groesse)) return aus;
  aus.groesse = roh.groesse;
  return aus;
}

/** Der nächste offene Schritt (0–3) oder 4 = Ergebnis. */
export function schritt(auswahl) {
  const i = SCHRITTE.findIndex((k) => !auswahl[k]);
  return i === -1 ? 4 : i;
}

/** Die Größe, die Schritt 4 vorschlägt – aus der Absicht. */
export function groessenVorschlag(auswahl) {
  return anlass(auswahl.anlass)?.absichten.find((x) => x.id === auswahl.absicht)?.groesse ?? "M";
}

/** Auswahl ↔ URL-Hash (`#anlass=…&absicht=…`), damit „Zurück" im Browser einen Schritt zurück geht. */
export function auswahlAusHash(hash) {
  const p = new URLSearchParams(String(hash ?? "").replace(/^#/, ""));
  return auswahlLesen({ anlass: p.get("anlass"), absicht: p.get("absicht"), gefuehl: p.get("gefuehl"), groesse: p.get("groesse") });
}

export function hashAusAuswahl(auswahl) {
  const p = new URLSearchParams();
  for (const k of SCHRITTE) if (auswahl[k]) p.set(k, auswahl[k]);
  const s = p.toString();
  return s ? `#${s}` : "";
}

/** „fröhlich und besonders" – Wirkung in Worten für die Erklärung. */
function wirkung(gefuehlId) {
  return gefuehl(gefuehlId)?.name.toLowerCase() ?? "";
}

/**
 * Die florale Antwort: ein Hauptprodukt und höchstens zwei Alternativen (dasselbe Gefühl, eine Größe kleiner bzw.
 * größer). `null`, wenn die Auswahl nicht vollständig ist oder der Katalog den Strauß nicht hat.
 */
export function ergebnis(roh, artikel) {
  const w = auswahlLesen(roh);
  if (schritt(w) < 4) return null;
  const a = anlass(w.anlass);
  const ab = a.absichten.find((x) => x.id === w.absicht);
  const haupt = finden(artikel, w.gefuehl, w.groesse);
  if (!haupt) return null;
  const i = GROESSEN.findIndex((g) => g.id === w.groesse);
  const alternativen = [GROESSEN[i - 1], GROESSEN[i + 1]]
    .filter(Boolean)
    .map((g) => ({ groesse: g, artikel: finden(artikel, w.gefuehl, g.id), richtung: GROESSEN.indexOf(g) < i ? "kleiner" : "größer" }))
    .filter((x) => x.artikel);
  const g = gefuehl(w.gefuehl);
  return {
    auswahl: w,
    anlass: a,
    name: a.namen[w.gefuehl] ?? g.name,
    ueberschrift: `Dein Strauß für ${a.fuer}`,
    text: `${g.text} Gebunden in ${a.farbworte}.`,
    erklaerung: `Das passt zu deiner Auswahl, weil du ${ab.weil} möchtest und es ${wirkung(w.gefuehl)} wirken soll.`,
    groesse: groesse(w.groesse),
    haupt,
    alternativen,
  };
}

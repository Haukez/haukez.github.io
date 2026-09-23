// Die geführte Auswahl der Kaufseite (docs/specs/2026-09-23-gefuehrte-kaufseite.md § 2, Layout nach der Vorlage des
// Nutzers vom 2026-09-23): Anlass → Botschaft (+ Preisrahmen, optional) → „Mein Vorschlag für dich" mit Varianten.
// Ohne DOM, getestet in beratung.test.mjs.
//
// Das Produkt sind Gefühl × Größe (15 Produkte). Das Gefühl leitet sich aus Anlass und Botschaft ab, die Größe aus
// Botschaft oder Preisrahmen; „etwas ruhiger / wilder / größer / günstiger" verschiebt beides. Namen und Texte des
// Vorschlags sind Sprache, keine eigenen Produkte.

import { finden, gefuehl, GEFUEHLE, groesse, GROESSEN, produktTitel } from "./sortiment.js";

const ALLE = GEFUEHLE.map((g) => g.id);

/** Von ruhig nach wild – für „etwas ruhiger" und „etwas wilder". */
export const RUHE_REIHE = ["zart", "elegant", "natuerlich", "froehlich", "ausdrucksstark"];

/**
 * Die sechs Anlasswelten.
 * `absichten`: was die Geste sagen soll – mit Gefühl und Größe, die dazu passen.
 * `namen`: der Name des Vorschlags je Gefühl. `farben`: Akzent für Chips und Flächen.
 */
export const ANLAESSE = [
  {
    id: "geburtstag", titel: "Geburtstag", unter: "Freude schenken", fuer: "einen besonderen Geburtstag",
    farbworte: "Apricot, Koralle und Buttergelb mit frischem Grün",
    farben: { flaeche: "#fbeee3", akzent: "#b8643f" },
    absichten: [
      { id: "freude", titel: "Eine kleine Freude machen", satz: "Ein lieber Gruß, einfach so.", gefuehl: "froehlich", groesse: "S", weil: "eine kleine Freude machen" },
      { id: "ueberraschen", titel: "Richtig überraschen", satz: "Ein besonderer Moment, der bleibt.", gefuehl: "froehlich", groesse: "M", weil: "richtig überraschen" },
      { id: "besonders", titel: "Etwas Besonderes schenken", satz: "Für einen unvergesslichen Tag.", gefuehl: "ausdrucksstark", groesse: "L", weil: "etwas Besonderes schenken" },
    ],
    gefuehle: ALLE,
    namen: { zart: "Pfirsichhauch", froehlich: "Sonnenmoment", natuerlich: "Gartenfest", elegant: "Festtag", ausdrucksstark: "Farbenrausch" },
  },
  {
    id: "liebe", titel: "Liebe & Jahrestag", unter: "Nähe zeigen", fuer: "einen Moment zu zweit",
    farbworte: "Altrosa, Bordeaux und Creme mit dunkleren Akzenten",
    farben: { flaeche: "#f5e6e4", akzent: "#8e4a44" },
    absichten: [
      { id: "naehe", titel: "Nähe zeigen", satz: "Ein Zeichen für zwischendurch.", gefuehl: "zart", groesse: "S", weil: "Nähe zeigen" },
      { id: "jahrestag", titel: "Einen Jahrestag feiern", satz: "Für das, was ihr zusammen seid.", gefuehl: "elegant", groesse: "M", weil: "einen Jahrestag feiern" },
      { id: "gross", titel: "Etwas ganz Großes sagen", satz: "Wenn Worte nicht reichen.", gefuehl: "ausdrucksstark", groesse: "L", weil: "etwas ganz Großes sagen" },
    ],
    gefuehle: ALLE,
    namen: { zart: "Rosenflüstern", froehlich: "Herzklopfen", natuerlich: "Wiesenliebe", elegant: "Samtabend", ausdrucksstark: "Rotglut" },
  },
  {
    id: "hochzeit", titel: "Hochzeit", unter: "Den großen Tag feiern", fuer: "eine Hochzeit",
    farbworte: "Elfenbein, Blush, Salbei und Champagner",
    farben: { flaeche: "#f1eee6", akzent: "#6f7f62" },
    absichten: [
      { id: "gratulieren", titel: "Herzlich gratulieren", satz: "Ein Gruß zum großen Tag.", gefuehl: "zart", groesse: "S", weil: "herzlich gratulieren" },
      { id: "mitfeiern", titel: "Den Tag mitfeiern", satz: "Ein Strauß, der auf die Feier passt.", gefuehl: "natuerlich", groesse: "M", weil: "den Tag mitfeiern" },
      { id: "bleibt", titel: "Ein Geschenk, das bleibt", satz: "Großzügig, für das Brautpaar.", gefuehl: "elegant", groesse: "L", weil: "ein bleibendes Geschenk machen" },
    ],
    gefuehle: ["zart", "natuerlich", "elegant", "froehlich"],
    namen: { zart: "Schleierweiß", froehlich: "Glückstag", natuerlich: "Landpartie", elegant: "Jawort" },
  },
  {
    id: "danke", titel: "Danke", unter: "Wertschätzung zeigen", fuer: "ein Dankeschön",
    farbworte: "Terrakotta, Pfirsich, Sand und Olive",
    farben: { flaeche: "#f4e9dc", akzent: "#9c5a38" },
    absichten: [
      { id: "kurz", titel: "Kurz Danke sagen", satz: "Eine freundliche Geste.", gefuehl: "natuerlich", groesse: "S", weil: "kurz Danke sagen" },
      { id: "herzen", titel: "Von Herzen danken", satz: "Für etwas, das dir viel bedeutet hat.", gefuehl: "froehlich", groesse: "M", weil: "von Herzen danken" },
      { id: "anerkennung", titel: "Große Anerkennung zeigen", satz: "Für eine besondere Leistung.", gefuehl: "elegant", groesse: "L", weil: "große Anerkennung zeigen" },
    ],
    gefuehle: ALLE,
    namen: { zart: "Leises Danke", froehlich: "Dankeschön", natuerlich: "Erntegruß", elegant: "Hochachtung", ausdrucksstark: "Großes Danke" },
  },
  {
    id: "trost", titel: "Trost & Gedenken", unter: "In Verbundenheit", fuer: "einen stillen Moment",
    farbworte: "gebrochenem Weiß, gedecktem Grün, Mauve und sanftem Blau",
    farben: { flaeche: "#eeefeb", akzent: "#5f6b73" },
    absichten: [
      { id: "anteil", titel: "Anteilnahme zeigen", satz: "Ein stilles Zeichen.", gefuehl: "zart", groesse: "S", weil: "Anteilnahme zeigen" },
      { id: "verbunden", titel: "Verbundenheit ausdrücken", satz: "Du bist nicht allein.", gefuehl: "natuerlich", groesse: "M", weil: "Verbundenheit ausdrücken" },
      { id: "abschied", titel: "Einen persönlichen Abschied gestalten", satz: "Für einen Menschen, der fehlt.", gefuehl: "elegant", groesse: "L", weil: "einen persönlichen Abschied gestalten" },
    ],
    // Fröhlich und ausdrucksstark passen nicht zu Trost – sie werden gar nicht erst angeboten, auch nicht als Variante.
    gefuehle: ["zart", "natuerlich", "elegant"],
    namen: { zart: "Stilles Licht", natuerlich: "Verbunden", elegant: "In Würde" },
    leise: true,
  },
  {
    id: "einfach", titel: "Einfach so", unter: "Jemanden überraschen", fuer: "einfach so",
    farbworte: "frischen Farben der Saison",
    farben: { flaeche: "#eef0e6", akzent: "#2f4a36" },
    absichten: [
      { id: "freude", titel: "Eine kleine Freude machen", satz: "Weil heute ein guter Tag dafür ist.", gefuehl: "froehlich", groesse: "S", weil: "eine kleine Freude machen" },
      { id: "alltag", titel: "Den Alltag schöner machen", satz: "Für den Tisch, das Büro, das Zuhause.", gefuehl: "natuerlich", groesse: "M", weil: "den Alltag schöner machen" },
      { id: "verwoehnen", titel: "Richtig verwöhnen", satz: "Sich selbst oder jemand anderen.", gefuehl: "ausdrucksstark", groesse: "L", weil: "richtig verwöhnen" },
    ],
    gefuehle: ALLE,
    namen: { zart: "Kleine Pause", froehlich: "Gute Laune", natuerlich: "Feldweg", elegant: "Ohne Anlass", ausdrucksstark: "Wildfang" },
  },
];

/**
 * Preisrahmen (optional) – er wählt die Größe; „egal" lässt die Botschaft entscheiden. Preise kommen aus dem Katalog.
 * Jede Stufe nennt ihren Preis (Review 2026-09-23: keine Preisüberraschung); die Kennung „egal" bleibt für alte Links.
 */
export const PREISRAHMEN = [
  { id: "klein", groesse: "S", label: (p) => `Bis ${p}` },
  { id: "mittel", groesse: "M", label: (p) => `Etwa ${p}` },
  { id: "gross", groesse: "L", label: (p) => `Etwa ${p}` },
  { id: "egal", groesse: null, label: () => "Preis ist offen" },
];

export const SCHRITTE = ["anlass", "absicht"];

export function anlass(id) {
  return ANLAESSE.find((a) => a.id === id) ?? null;
}

/**
 * Auswahl bereinigen: nur, was zum Anlass passt. `preis`, `gefuehl` und `groesse` sind optional (null = abgeleitet);
 * ein Gefühl, das der Anlass nicht anbietet, fällt weg.
 */
export function auswahlLesen(roh) {
  const aus = { anlass: null, absicht: null, preis: null, gefuehl: null, groesse: null };
  const a = anlass(roh?.anlass);
  if (!a) return aus;
  aus.anlass = a.id;
  const ab = a.absichten.find((x) => x.id === roh?.absicht);
  if (!ab) return aus;
  aus.absicht = ab.id;
  if (PREISRAHMEN.some((p) => p.id === roh?.preis)) aus.preis = roh.preis;
  if (a.gefuehle.includes(roh?.gefuehl)) aus.gefuehl = roh.gefuehl;
  if (groesse(roh?.groesse)) aus.groesse = roh.groesse;
  return aus;
}

/** Der nächste offene Schritt: 0 = Anlass, 1 = Botschaft, 2 = Vorschlag. */
export function schritt(auswahl) {
  if (!auswahl.anlass) return 0;
  if (!auswahl.absicht) return 1;
  return 2;
}

/** Gefühl und Größe des Vorschlags: ausdrücklich gewählt, sonst aus Botschaft bzw. Preisrahmen. */
export function wahl(auswahl) {
  const a = anlass(auswahl.anlass);
  const ab = a?.absichten.find((x) => x.id === auswahl.absicht);
  if (!a || !ab) return null;
  const rahmen = PREISRAHMEN.find((p) => p.id === auswahl.preis)?.groesse;
  const g = auswahl.gefuehl ?? (a.gefuehle.includes(ab.gefuehl) ? ab.gefuehl : a.gefuehle[0]);
  return { gefuehl: g, groesse: auswahl.groesse ?? rahmen ?? ab.groesse };
}

/** Auswahl ↔ URL-Hash, damit „Zurück" im Browser einen Schritt zurückgeht. */
export function auswahlAusHash(hash) {
  const p = new URLSearchParams(String(hash ?? "").replace(/^#/, ""));
  return auswahlLesen({ anlass: p.get("anlass"), absicht: p.get("absicht"), preis: p.get("preis"), gefuehl: p.get("gefuehl"), groesse: p.get("groesse") });
}

export function hashAusAuswahl(auswahl, ansicht = null) {
  const p = new URLSearchParams();
  for (const k of ["anlass", "absicht", "preis", "gefuehl", "groesse"]) if (auswahl?.[k]) p.set(k, auswahl[k]);
  if (ansicht) p.set("v", ansicht);
  const s = p.toString();
  return s ? `#${s}` : "";
}

function schrittIn(reihe, von, richtung, erlaubt) {
  const liste = reihe.filter((x) => erlaubt.includes(x));
  const i = liste.indexOf(von);
  const j = i + richtung;
  return i >= 0 && j >= 0 && j < liste.length ? liste[j] : null;
}

/**
 * Der Vorschlag: ein Hauptprodukt, Name und Erklärung, drei Varianten für denselben Anlass (andere Gefühle, gleiche
 * Größe) und die Nachbarn für „etwas ruhiger / wilder / größer / günstiger" (`null` = gibt es nicht).
 */
export function vorschlag(roh, artikel) {
  const w = auswahlLesen(roh);
  if (schritt(w) < 2) return null;
  const a = anlass(w.anlass);
  const ab = a.absichten.find((x) => x.id === w.absicht);
  const { gefuehl: gId, groesse: grId } = wahl(w);
  const haupt = finden(artikel, gId, grId);
  if (!haupt) return null;
  const g = gefuehl(gId);
  // Reihenfolge der Wahl (Nutzer 2026-09-23: „muss Sinn ergeben im Ergebnis"): die spätere Wahl gewinnt, und das
  // Ergebnis sagt, warum. Botschaft → Gefühl + Größe; Preisrahmen → Größe; Größe von Hand → Größe; Richtung → Gefühl.
  const rahmen = PREISRAHMEN.find((p) => p.id === w.preis) ?? null;
  const groesseGrund = grId === ab.groesse ? "botschaft" : w.groesse ? "gewaehlt" : rahmen?.groesse ? "preis" : "botschaft";
  const eigenesGefuehl = Boolean(w.gefuehl) && w.gefuehl !== (a.gefuehle.includes(ab.gefuehl) ? ab.gefuehl : a.gefuehle[0]);
  const nachbar = (feld, wert) => (wert && (feld === "gefuehl" ? finden(artikel, wert, grId) : finden(artikel, gId, wert)) ? wert : null);
  const groessen = GROESSEN.map((x) => x.id);
  const varianten = a.gefuehle
    .filter((x) => x !== gId)
    .map((x) => ({ gefuehl: x, name: a.namen[x], artikel: finden(artikel, x, grId) }))
    .filter((x) => x.artikel)
    .slice(0, 3);
  return {
    auswahl: w,
    anlass: a,
    absicht: ab,
    gefuehl: g,
    groesse: groesse(grId),
    name: a.namen[gId] ?? g.name,
    ueberschrift: `Dein Strauß für ${a.fuer}`,
    text: `${g.text} Gebunden in ${a.farbworte}.`,
    // Elas Stimme statt Rechenweg (Review 2026-09-23): „Floristin empfiehlt", nicht „das System hat errechnet".
    erklaerung: `Wenn du ${ab.weil} möchtest${eigenesGefuehl ? ` und es ${g.name.toLowerCase()} sein soll` : ""}, würde ich dir diesen Strauß binden: ${g.merkmal} – in ${a.farbworte}.`,
    /** Warum die Größe nicht die der Botschaft ist – `null`, wenn sie es ist (kein Satz nötig). */
    groesseGrund: groesseGrund === "botschaft" ? null : groesseGrund,
    groesseSatz: groesseGrund === "preis"
      ? `Passend zu deinem Preisrahmen binde ich ihn in der Größe „${groesse(grId).name}“ – ${euro(haupt.cent)}.`
      : groesseGrund === "gewaehlt" ? `In der Größe „${groesse(grId).name}“, wie du sie gewählt hast – ${euro(haupt.cent)}.` : null,
    /** Der Preisrahmen gilt nur, solange er die Größe bestimmt – sonst zeigt ihn kein Chip mehr an. */
    rahmen: groesseGrund === "preis" || (rahmen?.groesse && rahmen.groesse === grId) ? rahmen : null,
    /** Das Produkt, das man kauft – stabil über alle Anlässe („Fröhlich · Besonders"). */
    produkt: produktTitel(gId, grId),
    haupt,
    varianten,
    ruhiger: nachbar("gefuehl", schrittIn(RUHE_REIHE, gId, -1, a.gefuehle)),
    wilder: nachbar("gefuehl", schrittIn(RUHE_REIHE, gId, 1, a.gefuehle)),
    groesser: nachbar("groesse", schrittIn(groessen, grId, 1, groessen)),
    guenstiger: nachbar("groesse", schrittIn(groessen, grId, -1, groessen)),
  };
}

/**
 * Ein Strauß ohne Beratung („Alle Sträuße", Review 2026-09-23): derselbe stabile Name überall – „Elegant · Besonders" –
 * statt eines Anlassnamens. `null`, wenn es ihn im Katalog nicht gibt.
 */
export function strauss(gefuehlId, groesseId, artikel) {
  const g = gefuehl(gefuehlId);
  const gr = groesse(groesseId) ?? groesse("M");
  const haupt = g ? finden(artikel, g.id, gr.id) : null;
  if (!haupt) return null;
  return { auswahl: null, anlass: null, gefuehl: g, groesse: gr, name: produktTitel(g.id, gr.id), produkt: produktTitel(g.id, gr.id), text: g.text, haupt };
}

/** `#strauss=elegant&groesse=M` ↔ Gefühl und Größe (die Produktseite ohne Anlass). */
export function straussAusHash(hash) {
  const p = new URLSearchParams(String(hash ?? "").replace(/^#/, ""));
  const g = gefuehl(p.get("strauss"));
  if (!g) return null;
  return { gefuehl: g.id, groesse: groesse(p.get("groesse"))?.id ?? "M", ersetze: /^price_[A-Za-z0-9]{1,200}$/.test(p.get("ersetze") ?? "") ? p.get("ersetze") : null };
}

export function hashAusStrauss(gefuehlId, groesseId, ersetze = null) {
  const p = new URLSearchParams({ strauss: gefuehlId, groesse: groesseId });
  if (ersetze) p.set("ersetze", ersetze);
  return `#${p}`;
}

/** 2900 → „29 €", 3950 → „39,50 €" (nur für Sätze; die Seite formatiert Preise sonst selbst). */
function euro(cent) {
  const e = cent / 100;
  return `${Number.isInteger(e) ? e : e.toFixed(2).replace(".", ",")} €`;
}

/** Bild zu einem Vorschlag: Elas Foto aus dem Katalog, sonst das Beispielbild der Anlasswelt. */
export function bildPfad(anlassId, gefuehlId) {
  return `bilder/${anlassId}_${gefuehlId}.jpg`;
}

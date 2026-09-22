// Reine Regeln der Kaufseite – ohne DOM, getestet in logik.test.mjs.
// Specs: docs/specs/2026-09-22-shop-seite.md (Seite), docs/specs/2026-09-22-stripe-statt-shopify.md § 6 (Stripe).

/** Höchstmenge je Artikel – dieselbe Grenze prüft der Worker (`MENGE_MAX`). */
export const MENGE_MAX = 20;
/** Höchstens so viele verschiedene Artikel je Warenkorb (Worker: `POSITIONEN_MAX`). */
export const POSITIONEN_MAX = 20;
/** Die fünf Rechtstexte – ohne sie öffnet der Shop nicht (Stripe liefert keine, V7). */
export const RECHTLICHES = [
  ["impressum", "Impressum"],
  ["datenschutz", "Datenschutz"],
  ["agb", "AGB"],
  ["widerruf", "Widerruf"],
  ["versand", "Versand & Abholung"],
];

/** Adresse des Workers: nur https und nur der Ursprung (kein Pfad). Zum Testen auch http://127.0.0.1 / localhost. */
export function workerAdresse(eingabe) {
  try {
    const u = new URL(String(eingabe ?? "").trim());
    const lokal = u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost");
    if (u.protocol !== "https:" && !lokal) return null;
    if ((u.pathname !== "/" && u.pathname !== "") || u.search || u.hash || u.username) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Link auf einen Rechtstext: eine Seite neben der Kaufseite (`impressum.html`) oder eine https-Adresse. */
export function rechtsLink(eingabe) {
  const s = String(eingabe ?? "").trim();
  if (/^[a-z0-9][a-z0-9-]*\.html$/.test(s)) return s;
  try {
    return new URL(s).protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}

export function rechtlicheLinks(rechtliches) {
  return RECHTLICHES.map(([k, titel]) => ({ schluessel: k, titel, url: rechtsLink(rechtliches?.[k]) })).filter((x) => x.url);
}

/**
 * Was die Seite zeigt:
 *  - „bald": kein Worker eingetragen oder Rechtstexte unvollständig – dann keine einzige Anfrage an den Worker.
 *  - „vorschau": `?vorschau=http://127.0.0.1:<port>` – nur ein lokaler Worker, zum Testen (Rechtstexte egal).
 *  - „shop": Worker und alle fünf Rechtstexte stehen.
 *  - „demo": sonst, wenn config.js `demo: true` setzt – alle Produkte als Vorschau, Kasse gesperrt, keine Anfrage
 *    (Spec 2026-09-23-wochenatelier E2). Vorrang: Vorschau vor Shop vor Demo vor „bald".
 */
export function modus(konfig, suche = "") {
  const p = new URLSearchParams(suche);
  const vorschau = workerAdresse(p.get("vorschau"));
  if (vorschau && vorschau.startsWith("http://")) return { art: "vorschau", worker: vorschau };
  const worker = workerAdresse(konfig?.worker);
  const demo = konfig?.demo === true;
  if (!worker) return demo ? { art: "demo" } : { art: "bald", grund: "worker" };
  if (rechtlicheLinks(konfig?.rechtliches).length < RECHTLICHES.length) return demo ? { art: "demo" } : { art: "bald", grund: "rechtliches" };
  return { art: "shop", worker };
}

/** Darf „Zur Kasse" überhaupt fragen? Nur mit Worker – in der Demo nie (WA7). */
export function kasseErlaubt(m) {
  return (m?.art === "shop" || m?.art === "vorschau") && typeof m.worker === "string";
}

/** 1250 → „12,50 €" (deutsches Format, geschütztes Leerzeichen vor dem Zeichen). */
export function preisText(cent) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format((Number(cent) || 0) / 100);
}

// ------------------------------------------------------------------ Warenkorb: [{ preis, menge }]
/** Aus localStorage: kaputt, fremd oder zu groß → leer bzw. bereinigt. */
export function korbLesen(text) {
  try {
    const liste = JSON.parse(text ?? "[]");
    if (!Array.isArray(liste)) return [];
    const aus = [];
    for (const x of liste) {
      const preis = typeof x?.preis === "string" && /^price_[A-Za-z0-9]{1,200}$/.test(x.preis) ? x.preis : null;
      const menge = Number(x?.menge);
      if (!preis || !Number.isInteger(menge) || menge < 1 || aus.some((a) => a.preis === preis)) continue;
      aus.push({ preis, menge: Math.min(menge, MENGE_MAX) });
    }
    return aus.slice(0, POSITIONEN_MAX);
  } catch {
    return [];
  }
}

/** Menge setzen; 0 oder weniger entfernt. Neu nur, solange noch Platz ist. */
export function korbSetzen(korb, preis, menge) {
  const m = Math.max(0, Math.min(MENGE_MAX, Math.floor(Number(menge) || 0)));
  const ohne = korb.filter((p) => p.preis !== preis);
  if (m === 0) return ohne;
  if (ohne.length === korb.length && korb.length >= POSITIONEN_MAX) return korb;
  const i = korb.findIndex((p) => p.preis === preis);
  return i >= 0 ? korb.map((p) => (p.preis === preis ? { preis, menge: m } : p)) : [...korb, { preis, menge: m }];
}

export function korbHinzu(korb, preis) {
  const jetzt = korb.find((p) => p.preis === preis)?.menge ?? 0;
  return korbSetzen(korb, preis, jetzt + 1);
}

/** Nur, was es im Katalog noch gibt (Artikel können in Stripe archiviert werden). */
export function korbBereinigen(korb, artikel) {
  const da = new Set((artikel ?? []).map((a) => a.preis_id));
  return korb.filter((p) => da.has(p.preis));
}

export function korbSumme(korb, artikel) {
  return korb.reduce((s, p) => s + (artikel.find((a) => a.preis_id === p.preis)?.cent ?? 0) * p.menge, 0);
}

export function korbAnzahl(korb) {
  return korb.reduce((s, p) => s + p.menge, 0);
}

/** Was an den Worker geht: nur Price-IDs und Mengen, nie Beträge (ST3). */
export function kassenAnfrage(korb, art) {
  return { art: art === "lieferung" ? "lieferung" : "abholung", positionen: korb.map((p) => ({ preis: p.preis, menge: p.menge })) };
}

/** Rückkehr von Stripe: `?bestellt=1` bzw. `?abgebrochen=1`. */
export function rueckkehr(suche = "") {
  const p = new URLSearchParams(suche);
  if (p.get("bestellt") === "1") return "bestellt";
  if (p.get("abgebrochen") === "1") return "abgebrochen";
  return null;
}

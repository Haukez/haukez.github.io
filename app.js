// Geführte Kaufseite im Layout der Vorlage des Nutzers vom 2026-09-23 (docs/specs/2026-09-23-gefuehrte-kaufseite.md;
// Kasse: 2026-09-22-stripe-statt-shopify.md § 6; Liefertermin: 2026-09-23-wochenatelier.md). Liest config.js.
//
// Ansichten (Zustand im URL-Hash, „Zurück" im Browser geht einen Schritt zurück):
//   Start · Anlass („Wofür sind die Blumen?") · Botschaft (+ Preisrahmen) · Vorschlag mit Varianten · Produkt ·
//   Warenkorb · Bestätigung (Rückkehr von Stripe) · Alle Sträuße · Strauß ohne Anlass (`#strauss=…`).
// Geschärft nach der Review vom 2026-09-23 (docs/specs/2026-09-23-kaufseite-schaerfen.md).
// Modi: „bald" (keine Anfrage) · „demo" (alles zeigen, Kasse gesperrt, keine Anfrage) · „shop"/„vorschau" (Worker).
// CSP ohne 'unsafe-inline': keine style-Attribute – Farben setzt JS über das CSSOM (`farbenSetzen`).
import {
  anlass, ANLAESSE, auswahlAusHash, bildPfad, hashAusAuswahl, hashAusStrauss, PREISRAHMEN, schritt, strauss, straussAusHash, vorschlag, wahl,
} from "./beratung.js";
import {
  kassenAnfrage, kasseErlaubt, korbAnzahl, korbBereinigen, korbHinzu, korbLesen, korbSetzen, korbSumme, MENGE_MAX, modus,
  preisText, rechtlicheLinks, rueckkehr,
} from "./logik.js";
import {
  aktiveExtras, demoKatalog, extraFinden, finden, FOTO_SATZ, gefuehl as gefuehlVon, GEFUEHLE, groesse as groesseVon, GROESSEN, SAISON_SATZ,
} from "./sortiment.js";
import { sprache, STAERKE, weltFarben } from "./welt.js";
import { liefertermin, tagText, wocheLesen, wochenWahl } from "./woche.js";

const konfig = window.SHOP_KONFIG ?? {};
const m = modus(konfig, location.search);
const $ = (id) => document.getElementById(id);
const SPEICHER = "shop-warenkorb";
const NAMEN = "shop-namen";
const ART = "shop-art";
const KARTE = "shop-karte";
const KARTE_MAX = 200;
const LETZTER = "shop-letzter-anlass";
const WOCHE_WAHL = "shop-woche";
const TAGE = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const TAGE_KURZ = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

$("shop-name").textContent = konfig.name || "Shop";
$("shop-unterzeile").textContent = konfig.unterzeile || "";
document.title = konfig.name ? `${konfig.name} – ${konfig.unterzeile || "Shop"}` : "Shop";

let katalog = { artikel: [], lieferung: false, woche: null };
let korb = [];
/** Entwurf auf der Seite „Botschaft" – erst „Vorschlag ansehen" schreibt ihn in den Hash. */
let entwurf = { absicht: null, preis: null };
/** Die letzte Auswahl eines Vorschlags – „Zurück" zur Botschaft desselben Anlasses zeigt sie wieder an. */
let letzteAuswahl = null;
/** Nach der Rückkehr von Stripe: `{ daten }` (Daten vom Worker oder null) – nur bis zum nächsten Seitenwechsel. */
let bestellt = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ------------------------------------------------------------------ Symbole (Linien, currentColor – wie die Vorlage)
const IC = {
  pfeil: "M5 12h14M13 6l6 6-6 6",
  zurueck: "M19 12H5M11 6l-6 6 6 6",
  blatt: "M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7",
  herz: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  lieferung: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  laden: "M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16",
  kalender: "M4 6h16v14H4zM4 10h16M9 4v4M15 4v4",
  haus: "M4 11l8-7 8 7M6 10v10h12V10",
  freude: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9 14c1.5 1.5 4.5 1.5 6 0M9.5 10v.01M14.5 10v.01",
  stern: "M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z",
  geschenk: "M4 9h16v11H4zM4 13h16M12 9v11M12 9c-2-4-6-3-5-1s5 1 5 1zM12 9c2-4 6-3 5-1s-5 1-5 1z",
  haken: "M5 12l5 5 9-10",
  schloss: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  minus: "M6 12h12",
  plus: "M12 6v12M6 12h12",
};
const ABSICHT_IC = ["freude", "stern", "geschenk"];
const ic = (name, klasse = "ic") => `<svg class="${klasse}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[name]}"/></svg>`;

// ------------------------------------------------------------------ Speicher (jeder Zugriff abgesichert)
function lesen(schluessel, standard) {
  try {
    const v = JSON.parse(localStorage.getItem(schluessel) ?? "null");
    return v ?? standard;
  } catch {
    return standard;
  }
}

function merken(schluessel, wert) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // privater Modus: dann nur bis zum Neuladen
  }
}

/** Name des Vorschlags und Anlass je Preis-ID – nur für die Anzeige im Warenkorb, nie an den Worker. */
function namen() {
  const n = lesen(NAMEN, {});
  return n && typeof n === "object" && !Array.isArray(n) ? n : {};
}

function nameMerken(preisId, name, anlassId) {
  const n = namen();
  n[preisId] = { name: String(name).slice(0, 60), anlass: anlass(anlassId)?.id ?? null };
  merken(NAMEN, n);
}

function art() {
  const a = lesen(ART, "abholung");
  return a === "lieferung" && katalog.lieferung ? "lieferung" : "abholung";
}

function karteText() {
  const t = lesen(KARTE, "");
  return typeof t === "string" ? t.slice(0, KARTE_MAX) : "";
}

let meldungZeit;
function meldung(text, kurz = false) {
  const e = $("meldung");
  e.textContent = text;
  e.hidden = !text;
  clearTimeout(meldungZeit);
  if (kurz) meldungZeit = setTimeout(() => { e.hidden = true; }, 3500);
}

/**
 * Die Welt eines Bildschirms (Master-Prompt § 4/§ 5): Farben aus Anlass × Gefühl über das CSSOM, dazu Kennzeichen für
 * Tempo und Typografie (`data-welt`, `data-gefuehl`, `.leise`). Ohne Anlass neutral.
 */
function welt(anlassId, gefuehlId, staerke = 1, nurFarben = false) {
  const f = weltFarben(anlassId, gefuehlId, staerke);
  const r = document.documentElement.style;
  for (const [k, v] of [["grund", f.grund], ["flaeche", f.flaeche], ["karte", f.karte], ["akzent", f.akzent],
    ["akzent-text", f.akzentText], ["akzent-hauch", f.akzentHauch], ["tinte", f.tinte]]) r.setProperty(`--welt-${k}`, v);
  r.setProperty("--bild-filter", f.bild);
  // Die Vorschau beim Überfahren ändert nur Farben – Kennzeichen würden Typografie und Einblendung umschalten und
  // die ganze Seite springen lassen (gemeldet vom Nutzer 2026-09-23).
  if (nurFarben) return;
  document.body.dataset.welt = anlass(anlassId)?.id ?? "";
  document.body.dataset.gefuehl = gefuehlId ?? "";
  document.body.classList.toggle("leise", Boolean(anlass(anlassId)?.leise));
  document.body.classList.toggle("voll", staerke > 1);
}

/** Welt des Warenkorbs: die des ersten Straußes (Anlass gemerkt, Gefühl aus dem Katalog). */
function korbWelt() {
  const n = namen();
  for (const p of korb) {
    const a = katalog.artikel.find((x) => x.preis_id === p.preis && x.stil !== "extra");
    if (a) return [n[p.preis]?.anlass ?? null, a.stil];
  }
  return [null, null];
}

/** Farben und Breiten aus data-Attributen – über das CSSOM, weil die CSP keine style-Attribute erlaubt. */
function farbenSetzen(root) {
  root.querySelectorAll("[data-flaeche]").forEach((e) => e.style.setProperty("--flaeche", e.dataset.flaeche));
  root.querySelectorAll("[data-akzent]").forEach((e) => e.style.setProperty("--akzent", e.dataset.akzent));
  root.querySelectorAll("[data-anteil]").forEach((e) => { e.style.width = `${Number(e.dataset.anteil) * 100}%`; });
}

// ------------------------------------------------------------------ Woche und Bilder
function woche() {
  return wocheLesen(katalog.woche ?? konfig.woche);
}

/** Die wählbaren Wochen (Spec 2026-09-23-kaufseite-schaerfen § 3) – die erste ist die früheste. */
function wahlListe() {
  return wochenWahl(Date.now(), woche());
}

/** Termin der gewählten Woche; eine veraltete Wahl fällt still auf den frühesten zurück. */
function termin() {
  const l = wahlListe();
  const w = lesen(WOCHE_WAHL, null);
  return l.find((x) => x.montag === w) ?? l[0] ?? liefertermin(Date.now(), woche());
}

function kurz(iso) {
  const t = tagText(iso); // „Freitag, 2. Oktober"
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!t || !d) return "";
  const wt = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3])).getUTCDay() || 7;
  return `${TAGE_KURZ[wt]} ${d[3]}.${d[2]}.`;
}

/** „Abholung Fr 25.09. ab 17 Uhr" bzw. „Lieferung Sa 26.09. (9 bis 12 Uhr)" */
/** Die Teile eines Termins: „Mi 23.09., 12 Uhr" · „Fr 25.09. ab 17 Uhr" · „Sa 26.09., 9 bis 12 Uhr". */
function teile(t) {
  const w = woche();
  if (!t?.abholung) return null;
  return {
    schluss: `${kurz(t.bestellschluss)}, ${w.schluss_stunde} Uhr`,
    abholung: `${kurz(t.abholung)}${w.abhol_ab ? ` ab ${w.abhol_ab.replace(/^ab\s+/i, "")}` : ""}`,
    // Verlegte Route (Feiertag): ohne die übliche Uhrzeit – die gilt nur am Routentag.
    route: `${kurz(t.route)}${w.route_zeit && t.route !== t.abholung ? `, ${w.route_zeit}` : ""}`,
  };
}

const KEIN_TERMIN = "Gerade gibt es keinen Termin – schau bald wieder vorbei.";

/** „Abholung: Fr 25.09. ab 17 Uhr" bzw. „Lieferung: Sa 26.09., 9 bis 12 Uhr" */
function terminSatz(a = art(), t = termin()) {
  const x = teile(t);
  if (!x) return KEIN_TERMIN;
  return a === "lieferung" ? `Lieferung: ${x.route}` : `Abholung: ${x.abholung}`;
}

/** Beide Wege nebeneinander: „Abholung: … · Lieferung: …" */
function beideSatz(t = termin()) {
  const x = teile(t);
  if (!x) return KEIN_TERMIN;
  return `Abholung: ${x.abholung}${katalog.lieferung ? ` · Lieferung: ${x.route}` : ""}`;
}

function schlussSatz(t = termin()) {
  const x = teile(t);
  return x ? `Bestellbar bis ${x.schluss}` : "";
}

/** Auswahl der Woche („Für welche Woche?") – natives select, damit Tastatur und Screenreader es kennen. */
function wochenWahlHtml() {
  const l = wahlListe();
  if (l.length < 2) return "";
  const an = termin().montag;
  return `<label class="woche-wahl"><span class="feld-titel">Für welche Woche?</span>
      <select data-woche>${l.map((t, i) => {
        const x = teile(t);
        const vorn = i === 0 ? "Nächster Termin" : `Woche ab ${kurz(t.montag)}`;
        return `<option value="${esc(t.montag)}"${t.montag === an ? " selected" : ""}>${esc(`${vorn} – Abholung ${x.abholung}${katalog.lieferung ? ` · Lieferung ${x.route}` : ""}`)}</option>`;
      }).join("")}</select>
      <span class="klein">Du kannst schon jetzt für einen späteren Anlass bestellen – bis zu ${l.length} Wochen im Voraus.</span>
    </label>`;
}

/** Elas Foto aus dem Katalog vor dem Beispielbild der Anlasswelt. */
function bild(artikel, anlassId) {
  if (artikel?.bild) return { src: artikel.bild, beispiel: false };
  const a = anlass(anlassId)?.id ?? "einfach";
  const g = GEFUEHLE.some((x) => x.id === artikel?.stil) ? artikel.stil : "froehlich";
  // Beispielbilder gibt es nur für die angebotenen Kombinationen – sonst das der Welt „Einfach so".
  return { src: bildPfad(anlass(a).gefuehle.includes(g) ? a : "einfach", g), beispiel: true };
}

const BEISPIEL = `Beispielbild. ${FOTO_SATZ}`;

/** Bild eines Straußes: Elas Foto bleibt unverfälscht (`echt`, kein Farbfilter der Welt), Beispielbilder dürfen tönen. */
function bildHtml(b, alt, breite = 1152, hoehe = 1600) {
  return `<img src="${esc(b.src)}"${b.beispiel ? "" : ` class="echt"`} alt="${esc(alt)}" width="${breite}" height="${hoehe}">`;
}

// ------------------------------------------------------------------ Bausteine
function banner() {
  return m.art === "demo" ? `<p class="demo-banner" role="note">Vorschau – so wird der Shop aussehen. Bestellen geht noch nicht.</p>` : "";
}

/** Fortschritt wie im Entwurf: „1 / 3 · Anlass" mit Balken – nur die drei Beratungsschritte. */
function fortschritt(i) {
  const was = ["", "Anlass", "Botschaft", "Dein Vorschlag"][i];
  return `<div class="fortschritt" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${i}" aria-label="Schritt ${i} von 3: ${was}">
      <span>${i} / 3 · ${was}</span><span class="fortschritt-bahn"><span class="fortschritt-teil" data-anteil="${i / 3}"></span></span>
    </div>`;
}

function zurueckLink(ziel, text = "Zurück") {
  return `<a class="zurueck" href="${esc(ziel)}">${ic("zurueck")}${esc(text)}</a>`;
}

function chip(text) {
  return `<span class="auswahl-chip">${esc(text)}</span>`;
}

function preisVon(groesseId) {
  const liste = GEFUEHLE.map((g) => finden(katalog.artikel, g.id, groesseId)).filter(Boolean).map((a) => a.cent);
  return liste.length ? Math.min(...liste) : null;
}

// ------------------------------------------------------------------ Ansichten
function startHtml() {
  // Die Startseite nach dem Entwurf des Nutzers (2026-09-23): ein Bild über die ganze Breite, Kopf und Text darüber.
  // Texte nach der Review vom 2026-09-23: konkret statt „mit viel Liebe", der Rhythmus als eigene Zeile.
  const x = teile(liefertermin(Date.now(), woche()));
  const dritter = katalog.lieferung ? ["lieferung", "Lieferung in Heide & Umgebung"] : ["laden", "Abholung in Heide"];
  const ela = konfig.ela && typeof konfig.ela.foto === "string" && konfig.ela.foto && typeof konfig.ela.text === "string" && konfig.ela.text;
  return `<section class="buehne">
      <img class="buehne-bild" src="bilder/held_breit.jpg" alt="Wiesenstrauß mit rosa Dahlien und Schmuckkörbchen in einer Keramikkanne auf einem Holztisch" width="1648" height="1024">
      <div class="buehne-inhalt">
        ${m.art === "demo" ? `<p class="buehne-hinweis" role="note">Vorschau – bestellen geht noch nicht</p>` : ""}
        <h1 class="d buehne-satz">Was sollen die Blumen sagen?</h1>
        <p class="buehne-unter">Sag mir, was du ausdrücken möchtest – ich finde den passenden Strauß für dich.</p>
        <div class="buehne-knoepfe">
          <a class="btn-hell" href="#anlass">Zum passenden Strauß${ic("pfeil")}</a>
          <a class="buehne-link" href="#uebersicht">Ich weiß schon, was ich möchte – Alle Sträuße</a>
        </div>
        ${x ? `<p class="buehne-termin">${ic("kalender")}<span>Bestellen bis <strong>${esc(x.schluss)}</strong> · Abholung ${esc(x.abholung)}${katalog.lieferung ? ` · Lieferung ${esc(x.route)}` : ""}</span></p>` : ""}
      </div>
      <ul class="buehne-versprechen" aria-label="Das zeichnet ${esc(konfig.name || "uns")} aus">
        <li>${ic("blatt")}In Heide von Hand gebunden</li>
        <li>${ic("herz")}Jede Woche frisch</li>
        <li>${ic(dritter[0])}${esc(dritter[1])}</li>
      </ul>
      <span class="logo buehne-zug" aria-hidden="true">Mehr<br>als Blumen</span>
    </section>
    ${ela ? `<section class="ela">
      <img src="${esc(konfig.ela.foto)}" alt="${esc(konfig.name || "")}" width="480" height="600" loading="lazy">
      <div><h2 class="d">Hallo, ich bin ${esc(konfig.name || "")}.</h2><p>${esc(konfig.ela.text)}</p></div>
    </section>` : ""}`;
}

function anlassHtml() {
  return `${banner()}
    ${fortschritt(1)}
    <div class="seitenkopf">
      <h1 class="d">Wofür sind die Blumen?</h1>
      <p>Wähle einen Anlass – ich schlage dir den passenden Strauß vor.</p>
    </div>
    <div class="anlaesse">${ANLAESSE.map((a) => `
      <a class="occ${a.leise ? " leise" : ""}" href="${esc(hashAusAuswahl({ anlass: a.id }))}" data-flaeche="${a.farben.flaeche}" data-welt-vorschau="${a.id}">
        <img src="bilder/klein/anlass_${a.id}.jpg" alt="" loading="lazy" width="560" height="778">
        <span class="occ-text"><span class="d occ-titel">${esc(a.titel)}</span><span class="occ-unter">${esc(a.unter)}</span></span>
      </a>`).join("")}</div>
    <div class="trenner"><span></span><span>Oder suchst du etwas anderes?</span><span></span></div>
    <div class="alternativen-kacheln">
      <a class="alt" href="#uebersicht">${ic("stern", "ic gross")}<span><strong>Etwas anderes</strong><span>Geburt, Genesung, Einzug … such dir eine Stimmung aus</span></span>${ic("pfeil")}</a>
      <a class="alt" href="${esc(hashAusAuswahl({ anlass: "einfach", absicht: "alltag" }))}">${ic("haus", "ic gross")}<span><strong>Für mich / fürs Zuhause</strong><span>Blumen für deinen Tisch</span></span>${ic("pfeil")}</a>
    </div>`;
}

function botschaftHtml(w) {
  const a = anlass(w.anlass);
  const sp = sprache(a.id);
  const gewaehlt = entwurf.absicht;
  return `${banner()}
    <div class="schmal">
      <div class="leiste">${zurueckLink("#anlass")}${chip(`Anlass: ${a.titel}`)}</div>
      ${fortschritt(2)}
      <div class="seitenkopf">
        <span class="logo welt-zug" aria-hidden="true">${esc(sp.zug)}</span>
        <h1 class="d">${esc(sp.frage)}</h1>
        <p>${esc(sp.unter)}</p>
      </div>
      <div role="radiogroup" aria-label="Botschaft" class="optionen">${a.absichten.map((ab, i) => `
        <button type="button" class="opt${gewaehlt === ab.id ? " an" : ""}" role="radio" aria-checked="${gewaehlt === ab.id}" data-absicht="${ab.id}">
          ${ic(ABSICHT_IC[i], "ic gross")}
          <span class="opt-text"><span class="opt-titel">${esc(ab.titel)}</span><span class="opt-unter">${esc(ab.satz)}</span></span>
          <span class="opt-punkt" aria-hidden="true">${gewaehlt === ab.id ? ic("haken") : ""}</span>
        </button>`).join("")}</div>
      <fieldset class="rahmen">
        <legend>Preisrahmen <span>(optional)</span></legend>
        <div class="chips">${PREISRAHMEN.map((p) => {
          const cent = p.groesse ? preisVon(p.groesse) : null;
          return `<button type="button" class="chip${entwurf.preis === p.id ? " an" : ""}" aria-pressed="${entwurf.preis === p.id}" data-preis="${p.id}">${esc(p.label(cent != null ? preisText(cent).replace(",00", "") : ""))}</button>`;
        }).join("")}</div>
        ${passtHtml(a, gewaehlt)}
      </fieldset>
      <div class="knopfreihe rechts">
        <button type="button" class="btn" data-vorschlag${gewaehlt ? "" : " disabled"}>Vorschlag ansehen${ic("pfeil")}</button>
      </div>
    </div>`;
}

/** „Abholung kostenlos" – bei Lieferung ohne erfundenen Betrag: den zeigt Stripe vor dem Bezahlen (Lieferpreis offen). */
function preisHinweis() {
  return katalog.lieferung ? "Abholung kostenlos · Lieferkosten siehst du vor dem Bezahlen" : "Abholung kostenlos";
}

/** Größen als Radiogruppe mit Preis und Größenhilfe – `bleiben`: die Adresse wird ersetzt, nicht gestapelt. */
function groessenHtml(v) {
  return `<div role="radiogroup" aria-label="Größe" class="groessen drei">${GROESSEN.map((g) => {
    const x = finden(katalog.artikel, v.gefuehl.id, g.id);
    if (!x) return "";
    const an = g.id === v.groesse.id;
    return `<button type="button" class="sz${an ? " an" : ""}" role="radio" aria-checked="${an}" data-groesse="${g.id}"><span class="sz-kopf"><span>${esc(g.name)}</span><span>${esc(preisText(x.cent))}</span></span><span class="sz-satz">${esc(g.satz)}</span></button>`;
  }).join("")}</div>`;
}

/** Was die gewählte Botschaft für die Größe heißt – damit die Reihenfolge Botschaft → Preisrahmen sichtbar Sinn ergibt. */
function passtHtml(a, absichtId) {
  const ab = a.absichten.find((x) => x.id === absichtId);
  const g = ab && groesseVon(ab.groesse);
  const rahmen = ab && PREISRAHMEN.find((p) => p.groesse === ab.groesse);
  const cent = ab && preisVon(ab.groesse);
  if (!g || !rahmen || cent == null) return "";
  const anders = entwurf.preis && entwurf.preis !== "egal" && entwurf.preis !== rahmen.id;
  return `<p class="klein passt" aria-live="polite">${anders
    ? `Dein Preisrahmen bestimmt die Größe – zu „${esc(ab.titel)}“ hätte „${esc(g.name)}“ (${esc(preisText(cent).replace(",00", ""))}) gepasst.`
    : `Zu „${esc(ab.titel)}“ passt „${esc(g.name)}“ (${esc(preisText(cent).replace(",00", ""))}). Wählst du einen anderen Rahmen, richtet sich die Größe danach.`}</p>`;
}

function vorschlagHtml(v) {
  const b = bild(v.haupt, v.anlass.id);
  // Nur ein Preisrahmen, der die Größe noch bestimmt, steht als Chip da – nach einer Größe von Hand nicht mehr.
  const chips = [v.anlass.titel, v.absicht.titel, v.rahmen && v.rahmen.id !== "egal" ? v.rahmen.label(preisText(preisVon(v.rahmen.groesse)).replace(",00", "")) : null].filter(Boolean);
  const anpassen = [["ruhiger", "Etwas ruhiger", "gefuehl"], ["wilder", "Etwas wilder", "gefuehl"], ["groesser", "Etwas größer", "groesse"], ["guenstiger", "Etwas günstiger", "groesse"]]
    .filter(([k]) => v[k]).map(([k, text, feld]) => `<button type="button" class="chip" data-${feld}="${v[k]}">${text}</button>`).join("");
  return `${banner()}
    <div class="leiste">${zurueckLink(hashAusAuswahl({ anlass: v.anlass.id }))}<span class="chips-zeile">${chips.map(chip).join("")}</span></div>
    ${fortschritt(3)}
    <p class="vorzeile">${esc(sprache(v.anlass.id).vorzeile)}</p>
    <div class="titelzeile"><h1 class="d seitentitel">Mein Vorschlag für dich</h1><span class="logo welt-zug" aria-hidden="true">${esc(sprache(v.anlass.id).zug)}</span></div>
    <section class="vorschlag">
      <figure class="vorschlag-bild">
        ${bildHtml(b, `Strauß ${v.name}`)}
        ${b.beispiel ? `<figcaption>${esc(BEISPIEL)}</figcaption>` : ""}
      </figure>
      <div class="vorschlag-text">
        <div class="name-preis">
          <div><h2 class="d">${esc(v.name)}</h2><p class="produktzeile">${esc(v.produkt)}</p></div>
          <div class="preis"><span class="d">${esc(preisText(v.haupt.cent))}</span><span>${esc(preisHinweis())}</span></div>
        </div>
        <p class="weil">${esc(v.erklaerung)}${v.groesseSatz ? ` ${esc(v.groesseSatz)}` : ""}</p>
        <div class="feld"><div class="feld-titel">Größe</div>${groessenHtml(v)}</div>
        <div class="termin-box">${ic("kalender")}<span>${esc(beideSatz())}<br><span class="klein">${esc(schlussSatz())}</span></span></div>
        <ul class="merkmale">
          <li>${ic("blatt")}${esc(b.beispiel ? SAISON_SATZ.split(":")[0] + " – die Blumen wechseln mit der Saison" : FOTO_SATZ)}</li>
          <li>${ic("herz")}Von Hand gebunden, Grußkarte auf Wunsch</li>
          <li>${ic(katalog.lieferung ? "lieferung" : "laden")}${katalog.lieferung ? "Lieferung in Heide &amp; Umgebung oder Abholung" : "Abholung in Heide"}</li>
        </ul>
        <div class="knopfreihe unten">
          <button type="button" class="btn breit" data-rein="${esc(v.haupt.preis_id)}">${esc(v.groesse.name)} · ${esc(preisText(v.haupt.cent))} in den Warenkorb${ic("pfeil")}</button>
          <a class="btn2" href="${esc(hashAusAuswahl(v.auswahl, "produkt"))}">Details</a>
        </div>
      </div>
    </section>
    <section class="varianten">
      <div class="varianten-kopf">
        <div><h2 class="d">Möchtest du eine andere Richtung?</h2><p>Hier sind ein paar Varianten für denselben Anlass.</p></div>
        ${zurueckLink("#anlass", "Von vorn beginnen")}
      </div>
      ${anpassen ? `<div class="chips" role="group" aria-label="Vorschlag anpassen">${anpassen}</div>` : ""}
      <div class="karten3">${v.varianten.map((x) => {
        const bx = bild(x.artikel, v.anlass.id);
        return `<button type="button" class="pc" data-gefuehl="${x.gefuehl}">
          <img src="${esc(bx.src.replace("bilder/", "bilder/klein/"))}"${bx.beispiel ? "" : ` class="echt"`} alt="Strauß ${esc(x.name)}" loading="lazy" width="560" height="778">
          <span class="pc-text"><span class="d">${esc(x.name)} · ${esc(gefuehlVon(x.gefuehl)?.name ?? "")}</span><span>${esc(preisText(x.artikel.cent))}</span></span>
        </button>`;
      }).join("")}</div>
      <div class="knopfreihe mitte"><a class="btn2" href="#uebersicht">Alle Sträuße ansehen</a></div>
    </section>`;
}

function produktHtml(v, ersetze = null) {
  const b = bild(v.haupt, v.anlass?.id ?? namen()[ersetze]?.anlass ?? null);
  const a = art();
  const pflege = "Schneide die Stiele schräg an, stell den Strauß in frisches, kühles Wasser und wechsle es alle zwei Tage. Kein Platz direkt neben der Heizung oder in praller Sonne.";
  const zurueck = v.auswahl ? zurueckLink(hashAusAuswahl(v.auswahl), "Zurück zum Vorschlag")
    : ersetze ? zurueckLink("#warenkorb", "Zurück zum Warenkorb") : zurueckLink("#uebersicht", "Alle Sträuße");
  const knopf = ersetze
    ? `<button type="button" class="btn breit" data-tausch="${esc(ersetze)}" data-rein="${esc(v.haupt.preis_id)}">Änderung übernehmen – ${esc(v.groesse.name)} · ${esc(preisText(v.haupt.cent))}${ic("pfeil")}</button>`
    : `<button type="button" class="btn breit" data-rein="${esc(v.haupt.preis_id)}">${esc(v.groesse.name)} · ${esc(preisText(v.haupt.cent))} in den Warenkorb${ic("pfeil")}</button>`;
  return `${banner()}
    <div class="leiste">${zurueck}</div>
    <section class="produkt">
      <figure class="produkt-bild">
        ${bildHtml(b, `Strauß ${v.name}`)}
        ${b.beispiel ? `<figcaption>${esc(BEISPIEL)}</figcaption>` : ""}
      </figure>
      <div class="produkt-text">
        <h1 class="d">${esc(v.name)}</h1>
        ${v.produkt !== v.name ? `<p class="produktzeile">${esc(v.produkt)}</p>` : ""}
        <div class="preis"><span class="d">${esc(preisText(v.haupt.cent))}</span><span>${esc(preisHinweis())}</span></div>
        <p class="beschreibung">${esc(v.text)}</p>
        <div class="feld">
          <div class="feld-titel">Größe</div>
          ${groessenHtml(v)}
        </div>
        ${katalog.lieferung ? `<div class="feld">
          <div class="feld-titel">Lieferung oder Abholung?</div>
          <div role="radiogroup" aria-label="Lieferart" class="groessen">
            <button type="button" class="dt${a === "lieferung" ? " an" : ""}" role="radio" aria-checked="${a === "lieferung"}" data-art="lieferung">${ic("lieferung")}Lieferung</button>
            <button type="button" class="dt${a === "abholung" ? " an" : ""}" role="radio" aria-checked="${a === "abholung"}" data-art="abholung">${ic("laden")}Abholung in Heide</button>
          </div>
        </div>` : ""}
        <div class="feld">${wochenWahlHtml()}</div>
        <div class="termin-box">${ic("kalender")}<span><strong>${esc(terminSatz(a))}</strong></span></div>
        ${knopf}
        <p class="klein unter-knopf">${esc(schlussSatz())}</p>
        <div class="akkordeon">
          <details><summary>Was macht diesen Strauß besonders?</summary><p>${esc(v.gefuehl.text)} ${esc(SAISON_SATZ)}</p></details>
          <details><summary>Wie groß ist er?</summary><p>${GROESSEN.map((g) => `${esc(g.name)}: ${esc(g.satz)}.`).join(" ")} Alle drei werden in derselben Farb- und Stilwelt gebunden – größer heißt mehr Blüten und mehr Fülle.</p></details>
          <details><summary>Pflegetipps</summary><p>${esc(pflege)}</p></details>
          <details><summary>Lieferung &amp; Abholung</summary><p>${esc(konfig.abholung || "Abholung in Heide – kostenlos.")} ${katalog.lieferung ? esc(konfig.liefergebiet || "Geliefert wird in Heide und Umgebung, etwa 6 Kilometer weit – mit dem Rad, auf einer Route. Die Lieferkosten siehst du vor dem Bezahlen.") : ""} ${esc(schlussSatz())} – danach geht es in die Woche darauf.</p></details>
        </div>
      </div>
    </section>`;
}

function korbZeilenHtml() {
  const n = namen();
  const zeilen = korb.map((p) => {
    const a = katalog.artikel.find((x) => x.preis_id === p.preis);
    if (!a || a.stil === "extra") return "";
    const meta = n[p.preis] ?? {};
    const b = bild(a, meta.anlass);
    const g = groesseVon(a.groesse);
    return `<div class="korb-zeile">
      <img src="${esc(b.src.replace("bilder/", "bilder/klein/"))}" alt="" width="96" height="120">
      <div class="korb-mitte">
        <div class="d korb-name">${esc(meta.name || a.name)}</div>
        <div class="klein">${esc(meta.name ? a.name : g ? `Größe: ${g.name}` : "")}</div>
        <div class="korb-menge">
          <button type="button" class="qb" aria-label="Menge verringern" data-menge="-1" data-preis-id="${esc(p.preis)}">${ic("minus")}</button>
          <span aria-live="polite">${p.menge}</span>
          <button type="button" class="qb" aria-label="Menge erhöhen" data-menge="1" data-preis-id="${esc(p.preis)}"${p.menge >= MENGE_MAX ? " disabled" : ""}>${ic("plus")}</button>
          ${a.stil && g ? `<a class="lk" href="${esc(hashAusStrauss(a.stil, a.groesse, p.preis))}">Ändern</a>` : ""}
          <button type="button" class="lk" data-weg="${esc(p.preis)}">Entfernen</button>
        </div>
      </div>
      <div class="d korb-preis">${esc(preisText(a.cent * p.menge))}</div>
    </div>`;
  }).join("");
  return zeilen || `<p class="ruhig">Noch nichts im Warenkorb. <a href="#anlass">Den passenden Strauß finden</a></p>`;
}

function warenkorbHtml() {
  const a = art();
  const extras = aktiveExtras(konfig).map((x) => ({ x, art: extraFinden(katalog.artikel, x.id) })).filter((y) => y.art);
  const drin = (id) => korb.some((p) => p.preis === id);
  const karte = extras.find((y) => y.x.id === "karte");
  const karteDrin = karte && drin(karte.art.preis_id);
  const straeusse = korb.filter((p) => katalog.artikel.find((x) => x.preis_id === p.preis && x.stil !== "extra"));
  const summe = korbSumme(korb, katalog.artikel);
  const kannKasse = kasseErlaubt(m) && straeusse.length > 0;
  return `${banner()}
    <div class="seitenkopf zeile"><h1 class="d">Warenkorb</h1><a class="zurueck" href="#anlass">${ic("zurueck")}Weiter stöbern</a></div>
    <div class="korb-raster">
      <div class="korb-links">
        <section class="box" aria-label="Artikel">${korbZeilenHtml()}</section>
        ${straeusse.length ? `<section class="box">
          <h2 class="d">Wann und wie?</h2>
          ${katalog.lieferung ? `<div role="radiogroup" aria-label="Lieferart" class="groessen">
            <button type="button" class="dt${a === "lieferung" ? " an" : ""}" role="radio" aria-checked="${a === "lieferung"}" data-art="lieferung">${ic("lieferung")}Lieferung</button>
            <button type="button" class="dt${a === "abholung" ? " an" : ""}" role="radio" aria-checked="${a === "abholung"}" data-art="abholung">${ic("laden")}Abholung in Heide</button>
          </div>` : ""}
          ${wochenWahlHtml()}
          <div class="termin-box">${ic("kalender")}<span><strong>${esc(terminSatz(a))}</strong><br><span class="klein">${esc(schlussSatz())}</span></span></div>
          <p class="klein">${a === "lieferung"
            ? `Die Anschrift gibst du an der Kasse an.${straeusse.length > 1 ? " Alle Sträuße dieser Bestellung gehen an diese eine Anschrift." : ""}`
            : esc(konfig.abholung || "Abholung in Heide – kostenlos.")}</p>
        </section>
        <section class="box">
          <h2 class="d">Grüße, die von Herzen kommen</h2>
          ${karte ? `<label class="haken-zeile"><input type="checkbox" data-extra="${esc(karte.art.preis_id)}"${karteDrin ? " checked" : ""}>
            <span><strong>${esc(karte.x.name)} dazulegen (+ ${esc(preisText(karte.art.cent))})</strong><span class="klein">Mit deiner Nachricht, passend zum Anlass.</span></span></label>
          <label class="textfeld${karteDrin ? "" : " aus"}">Deine Nachricht
            <textarea rows="3" maxlength="${KARTE_MAX}" data-karte placeholder="${esc(anlass(namen()[straeusse[0]?.preis]?.anlass)?.id === "trost" ? "In stillem Gedenken …" : "Alles Liebe …")}"${karteDrin ? "" : " disabled"}>${esc(karteText())}</textarea>
            <span class="zaehler"><span>Ohne Absender bleibt die Karte anonym.</span><span data-zaehler>${karteText().length} / ${KARTE_MAX}</span></span>
          </label>` : ""}
          ${extras.filter((y) => y.x.id !== "karte").map((y) => `<label class="haken-zeile"><input type="checkbox" data-extra="${esc(y.art.preis_id)}"${drin(y.art.preis_id) ? " checked" : ""}>
            <span><strong>${esc(y.x.name)} (+ ${esc(preisText(y.art.cent))})</strong><span class="klein">${esc(y.x.text)}</span></span></label>`).join("")}
        </section>` : ""}
      </div>
      <aside class="box uebersicht-box" aria-label="Zusammenfassung">
        <h2 class="d">Übersicht</h2>
        ${korb.map((p) => {
          const x = katalog.artikel.find((y) => y.preis_id === p.preis);
          return x ? `<div class="summenzeile"><span>${esc(namen()[p.preis]?.name || x.name)}${p.menge > 1 ? ` × ${p.menge}` : ""}</span><span>${esc(preisText(x.cent * p.menge))}</span></div>` : "";
        }).join("")}
        ${a === "lieferung"
          // Lieferpreis offen (Nutzer 2026-09-23): kein erfundener Betrag – Stripe zeigt ihn vor dem Bezahlen.
          ? `<div class="summenzeile gesamt"><span>Zwischensumme</span><span class="d">${esc(preisText(summe))}</span></div>
        <div class="summenzeile leise"><span>Lieferung Heide &amp; Umgebung</span><span>siehst du vor dem Bezahlen</span></div>`
          : `<div class="summenzeile leise"><span>Abholung</span><span>kostenlos</span></div>
        <div class="summenzeile gesamt"><span>Gesamt</span><span class="d">${esc(preisText(summe))}</span></div>`}
        <button type="button" class="btn breit" data-kasse${kannKasse ? "" : " disabled"}>${kasseErlaubt(m) ? "Zur Kasse" : "Bestellen geht noch nicht"}${kasseErlaubt(m) ? ic("pfeil") : ""}</button>
        <p class="fehler" data-kasse-fehler role="alert" hidden></p>
        <ul class="merkmale klein">
          <li>${ic("schloss")}Sichere Zahlung über Stripe</li>
          <li>${ic("blatt")}Frisch gebunden – ${esc(terminSatz(a))}</li>
        </ul>
        ${rechtlicheLinks(konfig.rechtliches).length ? `<p class="klein rechtliches">${rechtlicheLinks(konfig.rechtliches).map((l) => `<a href="${esc(l.url)}" rel="noopener">${esc(l.titel)}</a>`).join(" · ")}</p>` : ""}
        ${m.art === "demo" ? `<p class="klein">Das ist eine Vorschau – hier wird nichts bestellt.</p>` : ""}
      </aside>
    </div>`;
}

function bestaetigungHtml(d) {
  const a = d?.art === "lieferung" || d?.art === "abholung" ? d.art : art();
  const t = d ? liefertermin(Date.now(), woche(), d.woche) : termin();
  const sp = sprache(lesen(LETZTER, null));
  const kontakt = typeof konfig.kontakt?.email === "string" && /^[^\s@<>]+@[^\s@<>]+$/.test(konfig.kontakt.email) ? konfig.kontakt.email : "";
  return `<section class="bestaetigung">
      <span class="kreis">${ic("haken", "ic gross")}</span>
      <h1 class="d">${esc(sp.dank)}</h1>
      <p>${d && !d.bezahlt ? "Deine Bestellung ist angekommen – die Zahlung ist noch nicht bestätigt." : "Deine Bestellung ist angekommen."} Die Bestätigung kommt per E-Mail.</p>
      ${d ? `<div class="box">
        <h2 class="d">Deine Bestellung</h2>
        <div class="summenzeile"><span>Bestellnummer</span><span>${esc(d.nummer)}</span></div>
        ${(Array.isArray(d.positionen) ? d.positionen : []).map((p) => `<div class="summenzeile"><span>${esc(p.titel)}</span><span>× ${esc(p.menge)}</span></div>`).join("")}
        ${Number.isInteger(d.cent) ? `<div class="summenzeile gesamt"><span>${d.bezahlt ? "Bezahlt" : "Betrag"}</span><span class="d">${esc(preisText(d.cent))}</span></div>` : ""}
        <div class="termin-box">${ic(a === "lieferung" ? "lieferung" : "laden")}<span><strong>${esc(terminSatz(a, t))}</strong>${a === "abholung" && konfig.abholung ? `<br><span class="klein">${esc(konfig.abholung)}</span>` : ""}</span></div>
      </div>` : ""}
      <div class="box">
        <h2 class="d">So geht es weiter</h2>
        <ol class="nummern">
          <li><span>1</span><span><strong>Nach dem Bestellschluss</strong> kommen die Blumen der Woche – dann wird dein Strauß frisch gebunden.</span></li>
          <li><span>2</span><span><strong>${esc(t.abholung ? terminSatz(a, t) : "Dein Termin")}</strong> – ${a === "lieferung" ? "dann kommt er zu dir." : "dann kannst du ihn abholen."}</span></li>
          <li><span>3</span><span>Etwas ändern? ${kontakt ? `Schreib an <a href="mailto:${esc(kontakt)}">${esc(kontakt)}</a>${d ? ` und nenne die Nummer ${esc(d.nummer)}` : ""}.` : "Antworte einfach auf die Bestätigungsmail."}</span></li>
        </ol>
      </div>
      <div class="knopfreihe"><a class="btn2" href="#" data-ziel="start">Zur Startseite</a><span class="logo signatur">Blumen verbinden Menschen.</span></div>
    </section>`;
}

function uebersichtHtml() {
  return `${banner()}
    <div class="seitenkopf">
      <h1 class="d">Alle Sträuße</h1>
      <p>Fünf Stimmungen, drei Größen – jeder Strauß wird in der Woche frisch gebunden. Lieber beraten werden? <a href="#anlass">Wofür sind die Blumen?</a></p>
    </div>
    <div class="karten3 fuenf">${GEFUEHLE.map((g) => {
      const x = finden(katalog.artikel, g.id, "M");
      if (!x) return "";
      const b = bild(x, "einfach");
      // Stabiler Name (Review 2026-09-23): „Elegant" führt zu „Elegant · Besonders", nicht zu einem Anlassnamen.
      return `<a class="pc" href="${esc(hashAusStrauss(g.id, "M"))}">
        <img src="${esc(b.src.replace("bilder/", "bilder/klein/"))}"${b.beispiel ? "" : ` class="echt"`} alt="Strauß ${esc(g.name)}" loading="lazy" width="560" height="778">
        <span class="pc-text"><span class="d">${esc(g.name)}</span><span>ab ${esc(preisText(Math.min(...GROESSEN.map((s) => finden(katalog.artikel, g.id, s.id)?.cent ?? Infinity))))}</span></span>
        <span class="pc-unter">${esc(g.kurz)}</span>
      </a>`;
    }).join("")}</div>`;
}

// ------------------------------------------------------------------ Routing
export function zustandAus(hash) {
  if (hash === "#anlass") return { ansicht: "anlass" };
  if (hash === "#uebersicht") return { ansicht: "uebersicht" };
  if (hash === "#warenkorb") return { ansicht: "warenkorb" };
  if (/^#strauss=/.test(hash ?? "")) {
    const x = straussAusHash(hash);
    return x ? { ansicht: "strauss", strauss: x } : { ansicht: "start" };
  }
  const auswahl = auswahlAusHash(hash);
  if (!auswahl.anlass) return { ansicht: "start" };
  if (schritt(auswahl) === 1) return { ansicht: "botschaft", auswahl };
  const v = new URLSearchParams(String(hash).replace(/^#/, "")).get("v");
  return { ansicht: v === "produkt" ? "produkt" : "vorschlag", auswahl };
}

function zustand() {
  return zustandAus(location.hash);
}

function gehe(hash, ersetzen = false) {
  if (location.hash === hash || (!hash && !location.hash)) return zeichnen();
  if (ersetzen) {
    history.replaceState(null, "", hash || location.pathname + location.search);
    return seiteWechseln();
  }
  if (!hash) {
    history.pushState(null, "", location.pathname + location.search);
    return seiteWechseln();
  }
  location.hash = hash;
}

// ------------------------------------------------------------------ Seitenwechsel
// Nutzer 2026-09-23: „achte auf angenehmen Seitenwechsel". Die alte Seite bleibt stehen, bis die neue über ihr
// eingeblendet ist (View Transitions, Kopf bleibt ruhig); die ersten Bilder sind dann schon dekodiert. Zurück landet
// dort, wo man die Seite verlassen hat, vorwärts oben. Ohne API oder bei reduzierter Bewegung: wie bisher.
const REIHE = ["start", "anlass", "uebersicht", "strauss", "botschaft", "vorschlag", "produkt", "warenkorb"];
const lage = new Map(); // Bildlauf je Adresse
let letzteAdresse = null;
const ruhig = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Wartet kurz auf die ersten Bilder der neuen Seite, höchstens `ms` – damit keine leeren Kästen einblenden. */
function bilderBereit(el, ms = 220) {
  const bilder = [...el.querySelectorAll("img")].slice(0, 3).map((b) => b.decode?.().catch(() => {}));
  return Promise.race([Promise.all(bilder), new Promise((r) => setTimeout(r, ms))]);
}

let unterwegs = null; // Adresse eines laufenden Wechsels – „Zurück" meldet hashchange und popstate
function seiteWechseln() {
  const ziel = location.hash + location.search;
  if (ziel === unterwegs) return;
  if (zustand().ansicht === letzteAnsicht || !document.startViewTransition || ruhig() || document.hidden) return zeichnen();
  unterwegs = ziel;
  const w = document.startViewTransition(async () => {
    zeichnen();
    await bilderBereit($("inhalt"));
  });
  w.finished.finally(() => { if (unterwegs === ziel) unterwegs = null; });
}

let letzteAnsicht = null;
function zeichnen() {
  const inhalt = $("inhalt");
  const z = zustand();
  if (z.ansicht === "botschaft" && letzteAnsicht !== "botschaft") {
    const l = letzteAuswahl?.anlass === z.auswahl.anlass ? letzteAuswahl : null;
    entwurf = { absicht: l?.absicht ?? null, preis: l?.preis ?? null };
  }
  if (z.ansicht === "anlass") letzteAuswahl = null; // „Von vorn beginnen" beginnt wirklich von vorn
  if (z.ansicht === "vorschlag" || z.ansicht === "produkt") letzteAuswahl = z.auswahl;
  if (z.ansicht !== "start") bestellt = null; // die Bestätigung gilt nur bis zum nächsten Seitenwechsel
  let html;
  let straussV = null;
  if (bestellt && z.ansicht === "start") html = bestaetigungHtml(bestellt.daten);
  else if (z.ansicht === "start") html = startHtml();
  else if (z.ansicht === "anlass") html = anlassHtml();
  else if (z.ansicht === "uebersicht") html = uebersichtHtml();
  else if (z.ansicht === "warenkorb") html = warenkorbHtml();
  else if (z.ansicht === "botschaft") html = botschaftHtml(z.auswahl);
  else if (z.ansicht === "strauss") {
    straussV = strauss(z.strauss.gefuehl, z.strauss.groesse, katalog.artikel);
    const n = namen()[z.strauss.ersetze];
    if (straussV && z.strauss.ersetze && n?.name) straussV = { ...straussV, name: n.name }; // „Ändern": der Name aus der Beratung
    html = !straussV ? `<p class="ruhig">Diesen Strauß gibt es gerade nicht. <a href="#uebersicht">Alle Sträuße</a></p>` : produktHtml(straussV, z.strauss.ersetze);
  } else {
    const v = vorschlag(z.auswahl, katalog.artikel);
    html = !v ? `<p class="ruhig">Diesen Strauß gibt es gerade nicht. <a href="#anlass">Noch einmal wählen</a></p>`
      : z.ansicht === "produkt" ? produktHtml(v) : vorschlagHtml(v);
  }
  // Die Welt folgt der Auswahl: Anlass ab Schritt 2, dazu das Gefühl des Vorschlags; der Warenkorb trägt die Welt
  // seines Straußes, die Bestätigung die des letzten Einkaufs. Start, Anlasswahl und Übersicht bleiben neutral.
  // Stufen (Nutzer 2026-09-23): erst eine Ahnung, die volle Farbe mit dem Bild des Straußes.
  if (z.ansicht === "botschaft") welt(z.auswahl.anlass, null, STAERKE.botschaft);
  else if (z.ansicht === "vorschlag" || z.ansicht === "produkt") welt(z.auswahl.anlass, wahl(z.auswahl)?.gefuehl ?? null, STAERKE.strauss);
  else if (z.ansicht === "strauss") welt(namen()[z.strauss.ersetze]?.anlass ?? null, z.strauss.gefuehl, STAERKE.strauss);
  else if (z.ansicht === "warenkorb") welt(...korbWelt(), STAERKE.warenkorb);
  else if (bestellt && z.ansicht === "start") welt(lesen(LETZTER, null), null, STAERKE.warenkorb);
  else welt(null, null);
  const neu = z.ansicht !== letzteAnsicht;
  const zurueck = REIHE.indexOf(z.ansicht) < REIHE.indexOf(letzteAnsicht);
  const adresse = location.hash + location.search;
  if (neu && letzteAdresse !== null) lage.set(letzteAdresse, window.scrollY);
  letzteAdresse = adresse;
  letzteAnsicht = z.ansicht;
  // Die Bestätigung nach Stripe steht auf der Startadresse – aber nicht als Bühne.
  document.body.dataset.ansicht = z.ansicht === "start" && bestellt ? "bestaetigung" : z.ansicht === "strauss" ? "produkt" : z.ansicht;
  inhalt.innerHTML = html;
  farbenSetzen(inhalt);
  radiosOrdnen(inhalt);
  if (neu) {
    inhalt.classList.remove("einblenden");
    void inhalt.offsetWidth;
    inhalt.classList.add("einblenden");
    // Nach dem Einblenden die Klasse lösen – sonst startet jede spätere Regeländerung die Animation neu.
    inhalt.addEventListener("animationend", () => inhalt.classList.remove("einblenden"), { once: true });
    window.scrollTo({ top: zurueck ? lage.get(adresse) ?? 0 : 0, behavior: "auto" });
    inhalt.focus({ preventScroll: true });
  }
  korbZahl();
}

/** Radiogruppen: nur die gewählte Option ist per Tab erreichbar, Pfeiltasten wechseln (siehe `pfeile`). */
function radiosOrdnen(root) {
  root.querySelectorAll('[role="radiogroup"]').forEach((g) => {
    const r = [...g.querySelectorAll('[role="radio"]')];
    const an = r.find((x) => x.getAttribute("aria-checked") === "true") ?? r[0];
    r.forEach((x) => { x.tabIndex = x === an ? 0 : -1; });
  });
}

/** Pfeiltasten in einer Radiogruppe wählen die nächste Option und behalten den Fokus nach dem Neuzeichnen. */
function pfeile(ev) {
  const schritt = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
  const r = schritt && ev.target.closest?.('[role="radio"]');
  const gruppe = r?.closest('[role="radiogroup"]');
  if (!gruppe) return;
  ev.preventDefault();
  const alle = [...gruppe.querySelectorAll('[role="radio"]')];
  const ziel = alle[(alle.indexOf(r) + schritt + alle.length) % alle.length];
  const merkmal = ["absicht", "groesse", "art"].find((k) => ziel.dataset[k] !== undefined);
  if (!merkmal) return;
  const wert = ziel.dataset[merkmal];
  ziel.click();
  const fokus = () => document.querySelector(`[role="radio"][data-${merkmal}="${CSS.escape(wert)}"]`)?.focus();
  fokus();
  requestAnimationFrame(fokus);
  setTimeout(fokus, 60); // nach einem Adresswechsel (Größe) zeichnet erst hashchange neu
}

// ------------------------------------------------------------------ Warenkorb
function korbZahl() {
  korb = korbBereinigen(korb, katalog.artikel);
  const n = korbAnzahl(korb);
  $("warenkorb-zahl").textContent = n ? String(n) : "";
  // Für Screenreader: „Warenkorb, 2 Artikel" statt einer nackten Zahl.
  $("warenkorb-knopf").setAttribute("aria-label", n ? `Warenkorb, ${n} Artikel` : "Warenkorb, leer");
}

function nachAenderung() {
  merken(SPEICHER, korb);
  korbZahl();
}

async function zurKasse(knopf) {
  if (!kasseErlaubt(m)) return; // Demo: keine Anfrage, nie
  merken(LETZTER, korbWelt()[0]);
  const fehler = document.querySelector("[data-kasse-fehler]");
  fehler.hidden = true;
  knopf.disabled = true;
  const text = knopf.innerHTML;
  knopf.textContent = "Einen Moment …";
  const karteDrin = korb.some((p) => katalog.artikel.find((x) => x.preis_id === p.preis && x.stil === "extra" && x.groesse === "karte"));
  try {
    const r = await fetch(`${m.worker}/shop/kasse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(kassenAnfrage(korb, art(), karteDrin ? karteText() : "", termin().montag ?? null)),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && typeof d.url === "string" && /^https:\/\//.test(d.url)) {
      location.href = d.url;
      return;
    }
    fehler.textContent = typeof d.fehler === "string" ? d.fehler : "Die Kasse ist gerade nicht erreichbar – bitte gleich noch einmal versuchen.";
  } catch {
    fehler.textContent = "Die Kasse ist gerade nicht erreichbar – bitte gleich noch einmal versuchen.";
  }
  fehler.hidden = false;
  knopf.disabled = false;
  knopf.innerHTML = text;
}

// ------------------------------------------------------------------ Klicks und Eingaben (ein Zuhörer je Art)
function klick(ev) {
  const el = ev.target.closest("[data-ziel], [data-absicht], [data-preis], [data-vorschlag], [data-gefuehl], [data-groesse], [data-rein], [data-art], [data-menge], [data-weg], [data-kasse]");
  if (!el) return;
  const d = el.dataset;
  const z = zustand();
  if (d.ziel !== undefined) {
    ev.preventDefault();
    if (d.ziel === "start") bestellt = null;
    return gehe(d.ziel === "start" ? "" : `#${d.ziel}`);
  }
  if (d.absicht && z.ansicht === "botschaft") {
    entwurf.absicht = d.absicht;
    return zeichnen();
  }
  if (d.preis && z.ansicht === "botschaft") {
    entwurf.preis = entwurf.preis === d.preis ? null : d.preis;
    return zeichnen();
  }
  if (d.vorschlag !== undefined && entwurf.absicht) {
    return gehe(hashAusAuswahl({ anlass: z.auswahl.anlass, absicht: entwurf.absicht, preis: entwurf.preis }));
  }
  if (d.gefuehl && z.auswahl) {
    return gehe(hashAusAuswahl({ ...z.auswahl, gefuehl: d.gefuehl }, z.ansicht === "produkt" ? "produkt" : null));
  }
  if (d.groesse && z.ansicht === "strauss") {
    return gehe(hashAusStrauss(z.strauss.gefuehl, d.groesse, z.strauss.ersetze), true);
  }
  if (d.groesse && z.auswahl) {
    // Die Größenwahl (Radiogruppe) ersetzt den Eintrag – „Zurück" führt nicht durch jede Größe. „Etwas größer" stapelt.
    const ersetzen = z.ansicht === "produkt" || el.getAttribute("role") === "radio";
    // Größe von Hand ist die spätere Wahl: sie gewinnt, der Preisrahmen fällt weg (kein widersprüchlicher Chip).
    return gehe(hashAusAuswahl({ ...z.auswahl, groesse: d.groesse, preis: null }, z.ansicht === "produkt" ? "produkt" : null), ersetzen);
  }
  if (d.rein && d.tausch) {
    // „Ändern" aus dem Warenkorb: dieselbe Menge, Name und Anlass aus der Beratung bleiben.
    const alt = korb.find((p) => p.preis === d.tausch);
    const n = namen()[d.tausch];
    if (alt && d.tausch !== d.rein) {
      korb = korbSetzen(korbSetzen(korb, d.tausch, 0), d.rein, alt.menge + (korb.find((p) => p.preis === d.rein)?.menge ?? 0));
      if (n?.name) nameMerken(d.rein, n.name, n.anlass);
      nachAenderung();
    }
    return gehe("#warenkorb");
  }
  if (d.rein) {
    const v = z.auswahl ? vorschlag(z.auswahl, katalog.artikel) : null;
    korb = korbHinzu(korb, d.rein);
    if (v && v.haupt.preis_id === d.rein) nameMerken(d.rein, v.name, v.anlass.id);
    nachAenderung();
    return gehe("#warenkorb");
  }
  if (d.art) {
    merken(ART, d.art === "lieferung" ? "lieferung" : "abholung");
    return zeichnen();
  }
  if (d.menge && d.preisId) {
    const p = korb.find((x) => x.preis === d.preisId);
    if (p) korb = korbSetzen(korb, p.preis, p.menge + Number(d.menge));
    nachAenderung();
    return zeichnen();
  }
  if (d.weg) {
    korb = korbSetzen(korb, d.weg, 0);
    // Ohne Strauß keine Karte allein im Korb
    if (!korb.some((p) => katalog.artikel.find((x) => x.preis_id === p.preis && x.stil !== "extra"))) korb = [];
    nachAenderung();
    return zeichnen();
  }
  if (d.kasse !== undefined) return zurKasse(el);
}

function eingabe(ev) {
  const t = ev.target;
  if (t.matches("[data-extra]")) {
    korb = t.checked ? korbSetzen(korb, t.dataset.extra, 1) : korbSetzen(korb, t.dataset.extra, 0);
    nachAenderung();
    return zeichnen();
  }
  if (t.matches("[data-woche]") && ev.type === "change") {
    merken(WOCHE_WAHL, t.value);
    return zeichnen();
  }
  if (t.matches("[data-karte]")) {
    const text = t.value.slice(0, KARTE_MAX);
    merken(KARTE, text);
    const z = document.querySelector("[data-zaehler]");
    if (z) z.textContent = `${text.length} / ${KARTE_MAX}`;
  }
}

// ------------------------------------------------------------------ Fuß und Start
function fuss() {
  const links = rechtlicheLinks(konfig.rechtliches);
  const hinweis = m.art === "bald" ? "Impressum und Datenschutz folgen mit dem Start des Shops."
    : m.art === "demo" ? "Vorschau – bestellen geht noch nicht. Impressum und Datenschutz folgen mit dem Start des Shops."
    : m.art === "vorschau" ? "Vorschau mit einem lokalen Worker – hier wird nichts echt bezahlt."
    : "Abholung kostenlos · Lieferkosten siehst du vor dem Bezahlen · Bezahlt wird sicher über Stripe.";
  const k = konfig.kontakt ?? {};
  const mail = typeof k.email === "string" && /^[^\s@<>]+@[^\s@<>]+$/.test(k.email) ? k.email : "";
  const tel = typeof k.telefon === "string" && /^[+0-9 ()/-]{6,30}$/.test(k.telefon) ? k.telefon : "";
  const kontakt = [
    mail ? `<a class="fl" href="mailto:${esc(mail)}">${esc(mail)}</a>` : "",
    tel ? `<a class="fl" href="tel:${esc(tel.replace(/[^+0-9]/g, ""))}">${esc(tel)}</a>` : "",
    konfig.abholung ? `<span>${esc(konfig.abholung)}</span>` : "",
  ].filter(Boolean);
  $("fuss").innerHTML = `<div class="fuss-oben">
      <div class="fuss-marke"><span class="logo">${esc(konfig.name || "")}</span><span>${esc(konfig.unterzeile || "")}</span><span>Aus Heide. Für besondere Menschen.</span></div>
      <nav class="fuss-nav" aria-label="Service"><a class="fl" href="#anlass">Strauß finden</a><a class="fl" href="#uebersicht">Alle Sträuße</a><a class="fl" href="#warenkorb">Warenkorb</a></nav>
      ${kontakt.length ? `<div class="fuss-kontakt">${kontakt.join("")}</div>` : ""}
    </div>
    <div class="fuss-unten"><span>${esc(hinweis)}</span>${links.length ? `<nav class="fuss-nav" aria-label="Rechtliches">${links.map((l) => `<a class="fl" href="${esc(l.url)}" rel="noopener">${esc(l.titel)}</a>`).join("")}</nav>` : ""}</div>`;
}

function bald() {
  $("inhalt").innerHTML = `<section class="bald"><h2 class="d">Der Shop öffnet bald</h2><p>Hier kannst du demnächst Blumen für besondere Momente bestellen.</p></section>`;
}

/** Einzelheiten der Bestellung vom eigenen Worker (Nummer, bezahlt, Betrag, Positionen) – sonst die allgemeine Bestätigung. */
async function bestellungHolen(id) {
  if (!kasseErlaubt(m) || !/^cs_[A-Za-z0-9_]{10,250}$/.test(id)) return null;
  try {
    const r = await fetch(`${m.worker}/shop/bestellung?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function katalogHolen() {
  if (m.art === "demo") {
    return { artikel: demoKatalog(konfig.preise, aktiveExtras(konfig)), lieferung: konfig.lieferung !== false, woche: null };
  }
  const r = await fetch(`${m.worker}/shop/katalog`);
  const d = await r.json();
  if (!r.ok || !d.bereit) return null;
  return { artikel: Array.isArray(d.artikel) ? d.artikel : [], lieferung: Boolean(d.lieferung), woche: d.woche ?? null };
}

async function laden() {
  try {
    korb = korbLesen(localStorage.getItem(SPEICHER));
  } catch {
    korb = [];
  }
  const vonStripe = rueckkehr(location.search);
  const sessionId = new URLSearchParams(location.search).get("session_id") ?? "";
  if (vonStripe === "bestellt") {
    korb = [];
    merken(SPEICHER, korb);
    merken(KARTE, "");
    merken(WOCHE_WAHL, null);
    bestellt = { daten: await bestellungHolen(sessionId) };
  } else if (vonStripe === "abgebrochen") {
    meldung("Bezahlung abgebrochen – dein Warenkorb ist noch da.", true);
  }
  // Adresse bereinigen: Neuladen zeigt danach die Startseite, nicht noch einmal die Bestätigung.
  if (vonStripe) {
    const q = new URLSearchParams(location.search);
    for (const k of ["bestellt", "abgebrochen", "session_id"]) q.delete(k);
    history.replaceState(null, "", `${location.pathname}${q.size ? `?${q}` : ""}${location.hash}`);
  }
  try {
    const k = await katalogHolen();
    if (!k) {
      bald();
      return;
    }
    katalog = k;
  } catch {
    $("inhalt").innerHTML = `<section class="bald"><h2 class="d">Gerade nicht erreichbar</h2><p>Der Shop antwortet im Moment nicht – bitte versuch es in ein paar Minuten noch einmal.</p><a class="btn2" href="">Neu laden</a></section>`;
    return;
  }
  $("warenkorb-knopf").hidden = false;
  zeichnen();
  window.addEventListener("hashchange", seiteWechseln);
  window.addEventListener("popstate", seiteWechseln);
  document.addEventListener("click", klick);
  // „Die Seite darf sich während der Navigation verwandeln" (Master-Prompt § 5): auf der Anlass-Seite tönt das
  // Überfahren oder Fokussieren einer Karte die Seite leise in deren Welt – ohne Klick, ohne Sprung.
  const vorschau = (ev) => {
    if (zustand().ansicht !== "anlass") return;
    const k = ev.target.closest?.("[data-welt-vorschau]");
    welt(k ? k.dataset.weltVorschau : null, null, STAERKE.vorschau, true);
  };
  document.addEventListener("pointerover", vorschau);
  document.addEventListener("focusin", vorschau);
  document.addEventListener("change", eingabe);
  document.addEventListener("keydown", pfeile);
  document.addEventListener("input", eingabe);
}

if (m.art === "bald") bald();
else laden();
fuss();

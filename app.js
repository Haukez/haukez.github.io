// Geführte Kaufseite im Layout der Vorlage des Nutzers vom 2026-09-23 (docs/specs/2026-09-23-gefuehrte-kaufseite.md;
// Kasse: 2026-09-22-stripe-statt-shopify.md § 6; Liefertermin: 2026-09-23-wochenatelier.md). Liest config.js.
//
// Ansichten (Zustand im URL-Hash, „Zurück" im Browser geht einen Schritt zurück):
//   Start · Anlass („Wofür sind die Blumen?") · Botschaft (+ Preisrahmen) · Vorschlag mit Varianten · Produkt ·
//   Warenkorb · Bestätigung (Rückkehr von Stripe) · Übersicht („Für mich").
// Modi: „bald" (keine Anfrage) · „demo" (alles zeigen, Kasse gesperrt, keine Anfrage) · „shop"/„vorschau" (Worker).
// CSP ohne 'unsafe-inline': keine style-Attribute – Farben setzt JS über das CSSOM (`farbenSetzen`).
import { anlass, ANLAESSE, auswahlAusHash, bildPfad, hashAusAuswahl, PREISRAHMEN, schritt, vorschlag, wahl } from "./beratung.js";
import {
  kassenAnfrage, kasseErlaubt, korbAnzahl, korbBereinigen, korbHinzu, korbLesen, korbSetzen, korbSumme, MENGE_MAX, modus,
  preisText, rechtlicheLinks, rueckkehr,
} from "./logik.js";
import { aktiveExtras, demoKatalog, extraFinden, finden, GEFUEHLE, groesse as groesseVon, GROESSEN, SAISON_SATZ } from "./sortiment.js";
import { sprache, weltFarben } from "./welt.js";
import { liefertermin, tagText, wocheLesen } from "./woche.js";

const konfig = window.SHOP_KONFIG ?? {};
const m = modus(konfig, location.search);
const $ = (id) => document.getElementById(id);
const SPEICHER = "shop-warenkorb";
const NAMEN = "shop-namen";
const ART = "shop-art";
const KARTE = "shop-karte";
const KARTE_MAX = 200;
const LETZTER = "shop-letzter-anlass";
const TAGE = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const TAGE_KURZ = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

$("shop-name").textContent = konfig.name || "Shop";
$("shop-unterzeile").textContent = konfig.unterzeile || "";
document.title = konfig.name ? `${konfig.name} – ${konfig.unterzeile || "Shop"}` : "Shop";

let katalog = { artikel: [], lieferung: false, woche: null };
let korb = [];
/** Entwurf auf der Seite „Botschaft" – erst „Vorschlag ansehen" schreibt ihn in den Hash. */
let entwurf = { absicht: null, preis: null };

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
function welt(anlassId, gefuehlId) {
  const f = weltFarben(anlassId, gefuehlId);
  const r = document.documentElement.style;
  for (const [k, v] of [["grund", f.grund], ["flaeche", f.flaeche], ["karte", f.karte], ["akzent", f.akzent],
    ["akzent-text", f.akzentText], ["akzent-hauch", f.akzentHauch], ["tinte", f.tinte]]) r.setProperty(`--welt-${k}`, v);
  r.setProperty("--bild-filter", f.bild);
  document.body.dataset.welt = anlass(anlassId)?.id ?? "";
  document.body.dataset.gefuehl = gefuehlId ?? "";
  document.body.classList.toggle("leise", Boolean(anlass(anlassId)?.leise));
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

function termin() {
  return liefertermin(Date.now(), woche());
}

function kurz(iso) {
  const t = tagText(iso); // „Freitag, 2. Oktober"
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!t || !d) return "";
  const wt = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3])).getUTCDay() || 7;
  return `${TAGE_KURZ[wt]} ${d[3]}.${d[2]}.`;
}

/** „Abholung Fr 25.09. ab 17 Uhr" bzw. „Lieferung Sa 26.09. (9 bis 12 Uhr)" */
function terminSatz(a = art()) {
  const t = termin();
  const w = woche();
  if (!t.abholung) return "Gerade gibt es keinen Termin – schau bald wieder vorbei.";
  return a === "lieferung"
    ? `Lieferung ${kurz(t.route)}${w.route_zeit && t.route !== t.abholung ? ` (${w.route_zeit})` : ""}`
    : `Abholung ${kurz(t.abholung)}${w.abhol_ab ? ` ab ${w.abhol_ab.replace(/^ab\s+/i, "")}` : ""}`;
}

function schlussSatz() {
  const t = termin();
  const w = woche();
  return t.bestellschluss ? `Bis ${kurz(t.bestellschluss)}, ${w.schluss_stunde} Uhr bestellen` : "";
}

/** Elas Foto aus dem Katalog vor dem Beispielbild der Anlasswelt. */
function bild(artikel, anlassId) {
  if (artikel?.bild) return { src: artikel.bild, beispiel: false };
  const a = anlass(anlassId)?.id ?? "einfach";
  const g = GEFUEHLE.some((x) => x.id === artikel?.stil) ? artikel.stil : "froehlich";
  // Beispielbilder gibt es nur für die angebotenen Kombinationen – sonst das der Welt „Einfach so".
  return { src: bildPfad(anlass(a).gefuehle.includes(g) ? a : "einfach", g), beispiel: true };
}

const BEISPIEL = "Beispielbild – jeder Strauß wird saisonal gebunden und ist ein Unikat.";

// ------------------------------------------------------------------ Bausteine
function banner() {
  return m.art === "demo" ? `<p class="demo-banner" role="note">Vorschau – so wird der Shop aussehen. Bestellen geht noch nicht.</p>` : "";
}

/** Fortschritt wie im Entwurf: „1 / 3" mit Balken. */
function fortschritt(i) {
  return `<div class="fortschritt" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${i}" aria-label="Schritt ${i} von 3">
      <span>${i} / 3</span><span class="fortschritt-bahn"><span class="fortschritt-teil" data-anteil="${i / 3}"></span></span>
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
  const t = termin();
  const dritter = katalog.lieferung ? ["lieferung", "Lieferung in Heide & Umgebung"] : ["laden", "Abholung in Heide"];
  return `<section class="buehne">
      <img class="buehne-bild" src="bilder/held_breit.jpg" alt="Wiesenstrauß mit rosa Dahlien und Schmuckkörbchen in einer Keramikkanne auf einem Holztisch" width="1648" height="1024">
      <div class="buehne-inhalt">
        ${m.art === "demo" ? `<p class="buehne-hinweis" role="note">Vorschau – bestellen geht noch nicht</p>` : ""}
        <h1 class="d buehne-satz">Was möchtest du jemandem fühlen lassen?</h1>
        <p class="buehne-unter">Blumen sagen oft mehr, als man selbst die richtigen Worte findet.</p>
        <a class="btn-hell" href="#anlass">Zum passenden Strauß${ic("pfeil")}</a>
        ${t.abholung ? `<p class="buehne-termin">${esc(schlussSatz())} – ${esc(terminSatz("abholung"))}</p>` : ""}
      </div>
      <ul class="buehne-versprechen" aria-label="Das zeichnet ${esc(konfig.name || "uns")} aus">
        <li>${ic("blatt")}Regional aus Heide</li>
        <li>${ic("herz")}Mit viel Liebe gebunden</li>
        <li>${ic(dritter[0])}${esc(dritter[1])}</li>
      </ul>
      <span class="logo buehne-zug" aria-hidden="true">Mehr<br>als Blumen</span>
    </section>`;
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
      <a class="alt" href="#uebersicht">${ic("haus", "ic gross")}<span><strong>Für mich</strong><span>Blumen für dein eigenes Zuhause</span></span>${ic("pfeil")}</a>
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
          return `<button type="button" class="chip${entwurf.preis === p.id ? " an" : ""}" aria-pressed="${entwurf.preis === p.id}" data-preis="${p.id}">${esc(p.label(cent != null ? preisText(cent) : ""))}</button>`;
        }).join("")}</div>
      </fieldset>
      <div class="knopfreihe rechts">
        <button type="button" class="btn" data-vorschlag${gewaehlt ? "" : " disabled"}>Vorschlag ansehen${ic("pfeil")}</button>
      </div>
    </div>`;
}

function vorschlagHtml(v) {
  const b = bild(v.haupt, v.anlass.id);
  const rahmen = PREISRAHMEN.find((p) => p.id === v.auswahl.preis);
  const chips = [v.anlass.titel, v.absicht.titel, rahmen && rahmen.id !== "egal" ? rahmen.label(preisText(preisVon(rahmen.groesse))) : null].filter(Boolean);
  const anpassen = [["ruhiger", "Etwas ruhiger", "gefuehl"], ["wilder", "Etwas wilder", "gefuehl"], ["groesser", "Etwas größer", "groesse"], ["guenstiger", "Etwas günstiger", "groesse"]]
    .filter(([k]) => v[k]).map(([k, text, feld]) => `<button type="button" class="chip" data-${feld}="${v[k]}">${text}</button>`).join("");
  return `${banner()}
    <div class="leiste">${zurueckLink(hashAusAuswahl({ anlass: v.anlass.id }))}<span class="chips-zeile">${chips.map(chip).join("")}</span></div>
    ${fortschritt(3)}
    <p class="vorzeile">${esc(sprache(v.anlass.id).vorzeile)}</p>
    <div class="titelzeile"><h1 class="d seitentitel">Mein Vorschlag für dich</h1><span class="logo welt-zug" aria-hidden="true">${esc(sprache(v.anlass.id).zug)}</span></div>
    <section class="vorschlag">
      <figure class="vorschlag-bild">
        <img src="${esc(b.src)}" alt="Strauß ${esc(v.name)}" width="1152" height="1600">
        ${b.beispiel ? `<figcaption>${esc(BEISPIEL)}</figcaption>` : ""}
      </figure>
      <div class="vorschlag-text">
        <div class="name-preis">
          <h2 class="d">${esc(v.name)}</h2>
          <div class="preis"><span class="d">${esc(preisText(v.haupt.cent))}</span><span>zzgl. Lieferung</span></div>
        </div>
        <p class="beschreibung">${esc(v.text)}</p>
        <p class="weil">${esc(v.erklaerung)}</p>
        <div class="groesse-zeile"><span>Größe: <strong>${esc(v.groesse.name)}</strong> · ${esc(v.groesse.satz)}</span><a href="${esc(hashAusAuswahl(v.auswahl, "produkt"))}">Größe ändern</a></div>
        <div class="termin-box">${ic("kalender")}<span>${esc(terminSatz("abholung"))}${katalog.lieferung ? ` · ${esc(terminSatz("lieferung"))}` : ""}</span></div>
        <ul class="merkmale">
          <li>${ic("blatt")}Saisonal gebunden – jeder Strauß ist ein Unikat</li>
          <li>${ic("herz")}Mit Liebe gebunden, Grußkarte auf Wunsch</li>
          <li>${ic(katalog.lieferung ? "lieferung" : "laden")}${katalog.lieferung ? "Lieferung in Heide &amp; Umgebung oder Abholung" : "Abholung in Heide"}</li>
        </ul>
        <div class="knopfreihe unten">
          <button type="button" class="btn breit" data-rein="${esc(v.haupt.preis_id)}">In den Warenkorb${ic("pfeil")}</button>
          <a class="btn2" href="${esc(hashAusAuswahl(v.auswahl, "produkt"))}">Details</a>
        </div>
      </div>
    </section>
    <section class="varianten">
      <div class="varianten-kopf">
        <div><h2 class="d">Noch nicht ganz deins?</h2><p>Hier sind ein paar Varianten für denselben Anlass.</p></div>
        ${zurueckLink("#anlass", "Von vorn beginnen")}
      </div>
      ${anpassen ? `<div class="chips" role="group" aria-label="Vorschlag anpassen">${anpassen}</div>` : ""}
      <div class="karten3">${v.varianten.map((x) => {
        const bx = bild(x.artikel, v.anlass.id);
        return `<button type="button" class="pc" data-gefuehl="${x.gefuehl}">
          <img src="${esc(bx.src.replace("bilder/", "bilder/klein/"))}" alt="Strauß ${esc(x.name)}" loading="lazy" width="560" height="778">
          <span class="pc-text"><span class="d">${esc(x.name)}</span><span>${esc(preisText(x.artikel.cent))}</span></span>
        </button>`;
      }).join("")}</div>
      <div class="knopfreihe mitte"><a class="btn2" href="#uebersicht">Alle Sträuße ansehen</a></div>
    </section>`;
}

function produktHtml(v) {
  const b = bild(v.haupt, v.anlass.id);
  const a = art();
  const pflege = "Schneide die Stiele schräg an, stell den Strauß in frisches, kühles Wasser und wechsle es alle zwei Tage. Kein Platz direkt neben der Heizung oder in praller Sonne.";
  return `${banner()}
    <div class="leiste">${zurueckLink(hashAusAuswahl(v.auswahl), "Zurück zum Vorschlag")}</div>
    <section class="produkt">
      <figure class="produkt-bild">
        <img src="${esc(b.src)}" alt="Strauß ${esc(v.name)}" width="1152" height="1600">
        ${b.beispiel ? `<figcaption>${esc(BEISPIEL)}</figcaption>` : ""}
      </figure>
      <div class="produkt-text">
        <h1 class="d">${esc(v.name)}</h1>
        <div class="preis"><span class="d">${esc(preisText(v.haupt.cent))}</span><span>zzgl. Lieferung</span></div>
        <p class="beschreibung">${esc(v.text)}</p>
        <div class="feld">
          <div class="feld-titel">Größe</div>
          <div role="radiogroup" aria-label="Größe" class="groessen">${GROESSEN.map((g) => {
            const x = finden(katalog.artikel, v.gefuehl.id, g.id);
            if (!x) return "";
            const an = g.id === v.groesse.id;
            return `<button type="button" class="sz${an ? " an" : ""}" role="radio" aria-checked="${an}" data-groesse="${g.id}" data-bleiben="produkt"><span>${esc(g.name)}</span><span>${esc(preisText(x.cent))}</span></button>`;
          }).join("")}</div>
          <p class="klein">${esc(v.groesse.satz)}</p>
        </div>
        ${katalog.lieferung ? `<div class="feld">
          <div class="feld-titel">Lieferung oder Abholung?</div>
          <div role="radiogroup" aria-label="Lieferart" class="groessen">
            <button type="button" class="dt${a === "lieferung" ? " an" : ""}" role="radio" aria-checked="${a === "lieferung"}" data-art="lieferung">${ic("lieferung")}Lieferung</button>
            <button type="button" class="dt${a === "abholung" ? " an" : ""}" role="radio" aria-checked="${a === "abholung"}" data-art="abholung">${ic("laden")}Abholung in Heide</button>
          </div>
        </div>` : ""}
        <div class="termin-box">${ic("kalender")}<span>Dein Termin: <strong>${esc(terminSatz(a))}</strong>. ${esc(schlussSatz())}.</span></div>
        <button type="button" class="btn breit" data-rein="${esc(v.haupt.preis_id)}">In den Warenkorb – ${esc(preisText(v.haupt.cent))}${ic("pfeil")}</button>
        <div class="akkordeon">
          <details><summary>Was macht diesen Strauß besonders?</summary><p>${esc(v.gefuehl.text)} ${esc(SAISON_SATZ)}</p></details>
          <details><summary>Pflegetipps</summary><p>${esc(pflege)}</p></details>
          <details><summary>Lieferung &amp; Abholung</summary><p>${esc(konfig.abholung || "Abholung in Heide.")} ${katalog.lieferung ? esc(konfig.liefergebiet || "Geliefert wird in Heide und Umgebung, etwa 6 Kilometer weit – mit dem Rad, auf einer Route. Was die Lieferung kostet, siehst du an der Kasse.") : ""} ${esc(schlussSatz())} – danach geht es in die Woche darauf.</p></details>
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
        <div class="klein">${esc(meta.name ? a.name : "")}${g ? `${meta.name ? " · " : ""}Größe: ${esc(g.name)}` : ""}</div>
        <div class="korb-menge">
          <button type="button" class="qb" aria-label="Menge verringern" data-menge="-1" data-preis-id="${esc(p.preis)}">${ic("minus")}</button>
          <span aria-live="polite">${p.menge}</span>
          <button type="button" class="qb" aria-label="Menge erhöhen" data-menge="1" data-preis-id="${esc(p.preis)}"${p.menge >= MENGE_MAX ? " disabled" : ""}>${ic("plus")}</button>
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
          <div class="termin-box">${ic("kalender")}<span><strong>${esc(terminSatz(a))}</strong> · ${esc(schlussSatz())}</span></div>
          <p class="klein">${a === "lieferung" ? "Die Anschrift gibst du an der Kasse an." : esc(konfig.abholung || "Abholung in Heide.")}</p>
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
        ${a === "lieferung" ? `<div class="summenzeile leise"><span>Lieferung Heide &amp; Umgebung</span><span>an der Kasse</span></div>` : ""}
        <div class="summenzeile gesamt"><span>Gesamt</span><span class="d">${esc(preisText(summe))}</span></div>
        <button type="button" class="btn breit" data-kasse${kannKasse ? "" : " disabled"}>${kasseErlaubt(m) ? "Zur Kasse" : "Bestellen geht noch nicht"}${kasseErlaubt(m) ? ic("pfeil") : ""}</button>
        <p class="fehler" data-kasse-fehler role="alert" hidden></p>
        <ul class="merkmale klein">
          <li>${ic("schloss")}Sichere Zahlung über Stripe</li>
          <li>${ic("blatt")}Frisch gebunden – ${esc(terminSatz(a))}</li>
        </ul>
        ${m.art === "demo" ? `<p class="klein">Das ist eine Vorschau – hier wird nichts bestellt.</p>` : ""}
      </aside>
    </div>`;
}

function bestaetigungHtml() {
  const t = termin();
  const a = art();
  const sp = sprache(lesen(LETZTER, null));
  return `<section class="bestaetigung">
      <span class="kreis">${ic("haken", "ic gross")}</span>
      <h1 class="d">${esc(sp.dank)}</h1>
      <p>Deine Bestellung ist angekommen. Die Bestätigung kommt per E-Mail.</p>
      <div class="box">
        <h2 class="d">So geht es weiter</h2>
        <ol class="nummern">
          <li><span>1</span><span><strong>Nach dem Bestellschluss</strong> kommen die Blumen der Woche – dann wird dein Strauß frisch gebunden.</span></li>
          <li><span>2</span><span><strong>${esc(t.abholung ? terminSatz(a) : "Dein Termin")}</strong> – ${a === "lieferung" ? "dann kommt er zu dir." : "dann kannst du ihn abholen."}</span></li>
          <li><span>3</span><span>Etwas ändern? Antworte einfach auf die Bestätigungsmail.</span></li>
        </ol>
      </div>
      <div class="knopfreihe"><a class="btn2" href="#">Zur Startseite</a><span class="logo signatur">Blumen verbinden Menschen.</span></div>
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
      const ab = anlass("einfach").absichten.find((y) => y.groesse === "M");
      return `<a class="pc" href="${esc(hashAusAuswahl({ anlass: "einfach", absicht: ab.id, gefuehl: g.id }, "produkt"))}">
        <img src="${esc(b.src.replace("bilder/", "bilder/klein/"))}" alt="Strauß ${esc(g.name)}" loading="lazy" width="560" height="778">
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
    return zeichnen();
  }
  if (!hash) {
    history.pushState(null, "", location.pathname + location.search);
    return zeichnen();
  }
  location.hash = hash;
}

let letzteAnsicht = null;
function zeichnen() {
  const inhalt = $("inhalt");
  const z = zustand();
  if (z.ansicht === "botschaft" && letzteAnsicht !== "botschaft") entwurf = { absicht: null, preis: null };
  let html;
  if (rueckkehr(location.search) === "bestellt" && z.ansicht === "start") html = bestaetigungHtml();
  else if (z.ansicht === "start") html = startHtml();
  else if (z.ansicht === "anlass") html = anlassHtml();
  else if (z.ansicht === "uebersicht") html = uebersichtHtml();
  else if (z.ansicht === "warenkorb") html = warenkorbHtml();
  else if (z.ansicht === "botschaft") html = botschaftHtml(z.auswahl);
  else {
    const v = vorschlag(z.auswahl, katalog.artikel);
    html = !v ? `<p class="ruhig">Diesen Strauß gibt es gerade nicht. <a href="#anlass">Noch einmal wählen</a></p>`
      : z.ansicht === "produkt" ? produktHtml(v) : vorschlagHtml(v);
  }
  // Die Welt folgt der Auswahl: Anlass ab Schritt 2, dazu das Gefühl des Vorschlags; der Warenkorb trägt die Welt
  // seines Straußes, die Bestätigung die des letzten Einkaufs. Start, Anlasswahl und Übersicht bleiben neutral.
  if (z.ansicht === "botschaft") welt(z.auswahl.anlass, null);
  else if (z.ansicht === "vorschlag" || z.ansicht === "produkt") welt(z.auswahl.anlass, wahl(z.auswahl)?.gefuehl ?? null);
  else if (z.ansicht === "warenkorb") welt(...korbWelt());
  else if (rueckkehr(location.search) === "bestellt" && z.ansicht === "start") welt(lesen(LETZTER, null), null);
  else welt(null, null);
  const neu = z.ansicht !== letzteAnsicht;
  letzteAnsicht = z.ansicht;
  // Die Bestätigung nach Stripe steht auf der Startadresse – aber nicht als Bühne.
  document.body.dataset.ansicht = z.ansicht === "start" && rueckkehr(location.search) === "bestellt" ? "bestaetigung" : z.ansicht;
  inhalt.innerHTML = html;
  farbenSetzen(inhalt);
  if (neu) {
    inhalt.classList.remove("einblenden");
    void inhalt.offsetWidth;
    inhalt.classList.add("einblenden");
    window.scrollTo({ top: 0, behavior: "auto" });
    inhalt.focus({ preventScroll: true });
  }
  korbZahl();
}

// ------------------------------------------------------------------ Warenkorb
function korbZahl() {
  korb = korbBereinigen(korb, katalog.artikel);
  const n = korbAnzahl(korb);
  $("warenkorb-zahl").textContent = n ? String(n) : "";
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
      body: JSON.stringify(kassenAnfrage(korb, art(), karteDrin ? karteText() : "")),
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
  if (d.groesse && z.auswahl) {
    // Auf der Produktseite ersetzt die Größe den Eintrag – „Zurück" führt dann zum Vorschlag, nicht durch jede Größe.
    return gehe(hashAusAuswahl({ ...z.auswahl, groesse: d.groesse }, z.ansicht === "produkt" ? "produkt" : null), z.ansicht === "produkt");
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
    : "Alle Preise zzgl. Lieferung. Bezahlt wird sicher über Stripe.";
  $("fuss").innerHTML = `<div class="fuss-oben">
      <div class="fuss-marke"><span class="logo">${esc(konfig.name || "")}</span><span>Aus Heide. Für besondere Menschen.</span></div>
      <nav class="fuss-nav" aria-label="Service"><a class="fl" href="#anlass">Anlässe</a><a class="fl" href="#uebersicht">Alle Sträuße</a><a class="fl" href="#warenkorb">Warenkorb</a></nav>
    </div>
    <div class="fuss-unten"><span>${esc(hinweis)}</span>${links.length ? `<nav class="fuss-nav" aria-label="Rechtliches">${links.map((l) => `<a class="fl" href="${esc(l.url)}" rel="noopener">${esc(l.titel)}</a>`).join("")}</nav>` : ""}</div>`;
}

function bald() {
  $("inhalt").innerHTML = `<section class="bald"><h2 class="d">Der Shop öffnet bald</h2><p>Hier kannst du demnächst Blumen für besondere Momente bestellen.</p></section>`;
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
  if (vonStripe === "bestellt") {
    korb = [];
    merken(SPEICHER, korb);
    merken(KARTE, "");
  } else if (vonStripe === "abgebrochen") {
    meldung("Bezahlung abgebrochen – dein Warenkorb ist noch da.", true);
  }
  try {
    const k = await katalogHolen();
    if (!k) {
      bald();
      return;
    }
    katalog = k;
  } catch {
    $("inhalt").innerHTML = `<p class="ruhig">Der Shop ist gerade nicht erreichbar – bitte später noch einmal.</p>`;
    return;
  }
  $("warenkorb-knopf").hidden = false;
  zeichnen();
  window.addEventListener("hashchange", zeichnen);
  window.addEventListener("popstate", zeichnen);
  document.addEventListener("click", klick);
  // „Die Seite darf sich während der Navigation verwandeln" (Master-Prompt § 5): auf der Anlass-Seite tönt das
  // Überfahren oder Fokussieren einer Karte die Seite leise in deren Welt – ohne Klick, ohne Sprung.
  const vorschau = (ev) => {
    if (zustand().ansicht !== "anlass") return;
    const k = ev.target.closest?.("[data-welt-vorschau]");
    welt(k ? k.dataset.weltVorschau : null, null);
  };
  document.addEventListener("pointerover", vorschau);
  document.addEventListener("focusin", vorschau);
  document.addEventListener("change", eingabe);
  document.addEventListener("input", eingabe);
}

if (m.art === "bald") bald();
else laden();
fuss();

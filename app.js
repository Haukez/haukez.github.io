// Geführte Kaufseite (docs/specs/2026-09-23-gefuehrte-kaufseite.md; Kasse: 2026-09-22-stripe-statt-shopify.md § 6;
// Liefertermin: 2026-09-23-wochenatelier.md). Liest config.js.
//
// Nicht Blumen auswählen, einen Moment auswählen: Anlass → Absicht → Gefühl → Größe der Geste → eine florale Antwort
// (höchstens zwei Alternativen) → erst dann „Mach es noch persönlicher". Nebenweg: „Ich weiß schon, was ich möchte".
// Der Zustand steht im URL-Hash – „Zurück" im Browser geht einen Schritt zurück.
//  - „bald": kein Worker/keine Rechtstexte und keine Demo – eine Hinweisseite, keine Anfrage.
//  - „demo": alle Produkte als Vorschau, Warenkorb klickbar, Kasse gesperrt – keine einzige Anfrage.
//  - „shop"/„vorschau": Katalog vom eigenen Worker; „Zur Kasse" schickt nur Price-IDs und Mengen.
// CSP ohne 'unsafe-inline': keine style-Attribute im HTML – Farben und Breiten setzt JS über das CSSOM (`farbenSetzen`).
import {
  ANLAESSE, anlass, auswahlAusHash, ergebnis, groessenVorschlag, hashAusAuswahl, schritt, SCHRITTE,
} from "./beratung.js";
import {
  kassenAnfrage, kasseErlaubt, korbAnzahl, korbBereinigen, korbHinzu, korbLesen, korbSetzen, korbSumme, MENGE_MAX, modus,
  preisText, rechtlicheLinks, rueckkehr,
} from "./logik.js";
import { abPreis, aktiveExtras, demoKatalog, extraFinden, finden, gefuehl, GROESSEN, gruppieren, SAISON_SATZ } from "./sortiment.js";
import { liefertermin, tagText, wocheLesen, wochenSatz } from "./woche.js";
import { ABSICHT_SYMBOLE, strauss, SYMBOL } from "./zeichnung.js";

const konfig = window.SHOP_KONFIG ?? {};
const m = modus(konfig, location.search);
const $ = (id) => document.getElementById(id);
const SPEICHER = "shop-warenkorb";
const NAMEN = "shop-namen";
const NEUTRAL = { grund: "#f7f3ed", flaeche: "#efe8db", akzent: "#5e7050", tinte: "#2f2a25", bild: ["#e7c3bd", "#efc9a8", "#b9a7c9", "#9fb08e"] };
const TAGE = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

$("shop-name").textContent = konfig.name || "Shop";
$("shop-unterzeile").textContent = konfig.unterzeile || "";
document.title = konfig.name ? `${konfig.name} – ${konfig.unterzeile || "Shop"}` : "Shop";

let katalog = { artikel: [], lieferung: false, woche: null };
let korb = [];
let gewaehlt = null;
/** Die gewählten Ergänzungen im Schritt „Mach es noch persönlicher". */
let extrasWahl = new Set();

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ------------------------------------------------------------------ Speicher
function lesen(schluessel, standard) {
  try {
    return JSON.parse(localStorage.getItem(schluessel) ?? "null") ?? standard;
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

function korbLaden() {
  try {
    return korbLesen(localStorage.getItem(SPEICHER));
  } catch {
    return [];
  }
}

/** Der Name der floralen Antwort je Preis-ID („Sonnenmoment") – nur für den Warenkorb, nie an den Worker. */
function nameMerken(preisId, name) {
  const n = lesen(NAMEN, {});
  if (!n || typeof n !== "object" || Array.isArray(n)) return;
  n[preisId] = String(name).slice(0, 60);
  merken(NAMEN, n);
}

let meldungZeit;
/** `kurz`: nach ein paar Sekunden wieder weg; Dank und Abbruch bleiben stehen. */
function meldung(text, kurz = false) {
  const e = $("meldung");
  e.textContent = text;
  e.hidden = !text;
  clearTimeout(meldungZeit);
  if (kurz) meldungZeit = setTimeout(() => { e.hidden = true; }, 3500);
}

// ------------------------------------------------------------------ Welt (Farben, Ruhe)
function welt(anlassId, gefuehlId) {
  const a = anlass(anlassId);
  const f = a?.farben ?? NEUTRAL;
  const r = document.documentElement.style;
  r.setProperty("--welt-grund", f.grund);
  r.setProperty("--welt-flaeche", f.flaeche);
  r.setProperty("--welt-akzent", f.akzent);
  r.setProperty("--welt-tinte", f.tinte);
  document.body.dataset.welt = a?.id ?? "";
  document.body.dataset.gefuehl = gefuehlId ?? "";
  document.body.classList.toggle("leise", Boolean(a?.leise));
}

/** Farben und Breiten aus data-Attributen – über das CSSOM, weil die CSP keine style-Attribute erlaubt. */
function farbenSetzen(root) {
  root.querySelectorAll("[data-flaeche]").forEach((e) => e.style.setProperty("--karte", e.dataset.flaeche));
  root.querySelectorAll("[data-anteil]").forEach((e) => { e.style.width = `${Number(e.dataset.anteil) * 100}%`; });
}

// ------------------------------------------------------------------ Woche
function woche() {
  return wocheLesen(katalog.woche ?? konfig.woche);
}

function termin() {
  return liefertermin(Date.now(), woche());
}

// ------------------------------------------------------------------ Ansichten
function banner() {
  return m.art === "demo" ? `<p class="demo-banner" role="note">Vorschau – so wird der Shop aussehen. Bestellen geht noch nicht.</p>` : "";
}

function startHtml() {
  const t = termin();
  const hinweise = [
    [SYMBOL.blatt, "Regional aus Heide"],
    [SYMBOL.bluete, "Saisonal gebunden"],
    [katalog.lieferung ? SYMBOL.rad : SYMBOL.kalender, t.abholung ? `Nächster Termin: ${tagText(t.abholung)}` : "Termine folgen"],
  ];
  return `${banner()}
    <section class="held">
      <div class="held-text">
        <h1 class="held-satz">Blumen sagen etwas, bevor man selbst die richtigen Worte findet.</h1>
        <span class="held-linie" aria-hidden="true"></span>
        <p class="held-frage">Für welchen Moment suchst du etwas?</p>
        <button type="button" class="knopf haupt gross" data-weiter="anlass">Den passenden Strauß finden <span aria-hidden="true">→</span></button>
        <ul class="held-hinweise">${hinweise.map(([s, x]) => `<li>${s}<span>${esc(x)}</span></li>`).join("")}</ul>
      </div>
      <div class="held-bild" aria-hidden="true">${strauss({ form: "natuerlich", farben: ["#e7a58a", "#f3d27a", "#d9a3a8", "#b9a7c9", "#efc9a8"], groesse: "L" })}</div>
    </section>
    <p class="held-woche">${esc(wochenSatz(t, woche(), katalog.lieferung))}</p>`;
}

function kopfSchritt(i, frage, unter) {
  return `<div class="fortschritt" role="progressbar" aria-valuemin="1" aria-valuemax="4" aria-valuenow="${i + 1}" aria-label="Schritt ${i + 1} von 4">
      <span class="fortschritt-zahl">${i + 1} / 4</span>
      <span class="fortschritt-bahn"><span class="fortschritt-teil" data-anteil="${(i + 1) / 4}"></span></span>
    </div>
    <h1 class="frage">${esc(frage)}</h1>${unter ? `<p class="frage-unter">${esc(unter)}</p>` : ""}`;
}

function zurueckKnopf(ziel) {
  return `<div class="schritt-fuss"><button type="button" class="knopf leise-knopf" data-zurueck="${esc(ziel)}"><span aria-hidden="true">←</span> Zurück</button></div>`;
}

function schritt1Html() {
  return `${kopfSchritt(0, "Was ist der Anlass?", "Jeder Moment ist besonders. Wähle den, der am besten passt.")}
    <div class="karten karten-anlass">${ANLAESSE.map((a) => `
      <button type="button" class="wahl wahl-bild" data-anlass="${a.id}" data-flaeche="${a.farben.flaeche}">
        <span class="wahl-motiv">${strauss({ form: a.leise ? "zart" : "froehlich", farben: a.farben.bild, groesse: "M" })}</span>
        <span class="wahl-titel">${esc(a.titel)}</span>
      </button>`).join("")}</div>
    ${zurueckKnopf("start")}`;
}

function schritt2Html(w) {
  const a = anlass(w.anlass);
  return `${kopfSchritt(1, "Was möchtest du bewirken?", a.leise ? "Was soll deine Geste ausdrücken?" : "Was soll deine Geste sagen?")}
    <div class="karten karten-liste">${a.absichten.map((ab, i) => `
      <button type="button" class="wahl wahl-zeile" data-absicht="${ab.id}">
        <span class="wahl-symbol">${SYMBOL[ABSICHT_SYMBOLE[i]]}</span>
        <span class="wahl-worte"><span class="wahl-titel">${esc(ab.titel)}</span><span class="wahl-satz">${esc(ab.satz)}</span></span>
      </button>`).join("")}</div>
    ${zurueckKnopf("anlass")}`;
}

function schritt3Html(w) {
  const a = anlass(w.anlass);
  return `${kopfSchritt(2, "Wie soll es sich anfühlen?", "Welche Stimmung passt am besten?")}
    <div class="karten karten-gefuehl">${a.gefuehle.map((id) => {
      const g = gefuehl(id);
      return `<button type="button" class="wahl wahl-bild" data-gefuehl="${g.id}" data-flaeche="${a.farben.flaeche}">
        <span class="wahl-motiv">${strauss({ form: g.id, farben: a.farben.bild, groesse: "M" })}</span>
        <span class="wahl-titel">${esc(g.name)}</span><span class="wahl-satz">${esc(g.kurz)}</span>
      </button>`;
    }).join("")}</div>
    ${zurueckKnopf("absicht")}`;
}

function schritt4Html(w) {
  const a = anlass(w.anlass);
  const vorschlag = groessenVorschlag(w);
  return `${kopfSchritt(3, "Wie groß darf die Geste sein?", "Wähle die Größe, die zu deinem Moment passt.")}
    <div class="karten karten-groesse">${GROESSEN.map((g) => {
      const art = finden(katalog.artikel, w.gefuehl, g.id);
      if (!art) return "";
      return `<button type="button" class="wahl wahl-bild${g.id === vorschlag ? " vorschlag" : ""}" data-groesse="${g.id}" data-flaeche="${a.farben.flaeche}">
        ${g.id === vorschlag ? `<span class="wahl-marke">Passt zu deiner Absicht</span>` : ""}
        <span class="wahl-motiv">${strauss({ form: w.gefuehl, farben: a.farben.bild, groesse: g.id })}</span>
        <span class="wahl-titel">${esc(g.name)}</span><span class="wahl-satz">${esc(g.satz)}</span>
        <span class="wahl-preis">${esc(preisText(art.cent))}</span>
      </button>`;
    }).join("")}</div>
    ${zurueckKnopf("gefuehl")}`;
}

function ergebnisHtml(e) {
  const t = termin();
  const alternativen = e.alternativen.length
    ? `<div class="alternativen"><p class="alternativen-titel">Oder lieber …</p>${e.alternativen.map((x) => `
        <button type="button" class="knopf leise-knopf" data-groesse="${x.groesse.id}">etwas ${esc(x.richtung)}: ${esc(x.groesse.name)} · ${esc(preisText(x.artikel.cent))}</button>`).join("")}</div>`
    : "";
  return `${banner()}
    <button type="button" class="knopf leise-knopf zur-auswahl" data-zurueck="groesse"><span aria-hidden="true">←</span> Zur Auswahl ändern</button>
    <section class="antwort">
      <div class="antwort-text">
        <p class="antwort-vorzeile">Das passt zu deinem Moment</p>
        <h1 class="antwort-ueberschrift">${esc(e.ueberschrift)}</h1>
        <h2 class="antwort-name">${esc(e.name)}</h2>
        <p class="antwort-beschreibung">${esc(e.text)}</p>
        <p class="antwort-weil">${esc(e.erklaerung)}</p>
        <div class="antwort-kauf">
          <span class="antwort-preis">${esc(preisText(e.haupt.cent))}</span>
          <button type="button" class="knopf haupt gross" data-rein="${esc(e.haupt.preis_id)}">In den Warenkorb</button>
          <span class="antwort-groesse">${esc(e.groesse.name)} · ${esc(e.groesse.satz)}</span>
        </div>
        <ul class="antwort-hinweise">
          <li>${SYMBOL.bluete}<span>${esc(SAISON_SATZ)}</span></li>
          ${t.abholung ? `<li>${katalog.lieferung ? SYMBOL.rad : SYMBOL.kalender}<span>${esc(wochenSatz(t, woche(), katalog.lieferung))}</span></li>` : ""}
        </ul>
        ${alternativen}
      </div>
      <figure class="antwort-bild" data-flaeche="${e.anlass.farben.flaeche}">${e.haupt.bild
        ? `<img src="${esc(e.haupt.bild)}" alt="${esc(e.name)} – Beispiel" loading="lazy">`
        : strauss({ form: e.auswahl.gefuehl, farben: e.anlass.farben.bild, groesse: e.auswahl.groesse, titel: e.name })}
        <figcaption class="bild-hinweis">${e.haupt.bild ? "Beispielbild – gebunden wird, was diese Woche blüht." : "Zeichnung – gebunden wird, was diese Woche blüht."}</figcaption>
      </figure>
    </section>`;
}

function extrasHtml(e) {
  const liste = aktiveExtras(konfig).map((x) => ({ x, art: extraFinden(katalog.artikel, x.id) })).filter((y) => y.art);
  const dank = e.anlass.leise ? "Danke, dass du an jemanden denkst." : "Schön, dass du Freude verschenkst.";
  return `${banner()}
    <section class="persoenlich">
      <h1 class="frage">Mach es noch persönlicher</h1>
      <p class="frage-unter">${esc(e.name)} liegt im Warenkorb. Magst du noch etwas dazulegen?</p>
      ${liste.length ? `<div class="karten karten-liste">${liste.map(({ x, art }) => `
        <button type="button" class="wahl wahl-zeile${extrasWahl.has(x.id) ? " gewaehlt" : ""}" data-extra="${x.id}" aria-pressed="${extrasWahl.has(x.id)}">
          <span class="wahl-symbol">${x.id === "karte" ? SYMBOL.herz : SYMBOL.bluete}</span>
          <span class="wahl-worte"><span class="wahl-titel">${esc(x.name)} <span class="wahl-plus">+ ${esc(preisText(art.cent))}</span></span><span class="wahl-satz">${esc(x.text)}</span></span>
        </button>`).join("")}</div>` : ""}
      <div class="schritt-fuss">
        <button type="button" class="knopf leise-knopf" data-fertig="ohne">${extrasWahl.size ? "Doch ohne" : "Ohne Ergänzung weiter"}</button>
        <button type="button" class="knopf haupt" data-fertig="mit">${extrasWahl.size ? "Mit Ergänzung zum Warenkorb" : "Zum Warenkorb"} <span aria-hidden="true">→</span></button>
      </div>
      <p class="dank">${esc(dank)}</p>
    </section>`;
}

function uebersichtHtml() {
  const { stile, weitere } = gruppieren(katalog.artikel);
  return `${banner()}
    <h1 class="frage">Alle Sträuße</h1>
    <p class="frage-unter">Fünf Stimmungen, drei Größen – jeder Strauß wird in der Woche frisch gebunden.
      Lieber beraten werden? <a href="#anlass" data-ziel="anlass">Für welchen Moment suchst du etwas?</a></p>
    <div class="uebersicht">${stile.map((s) => `
      <article class="stil">
        <div class="stil-bild">${strauss({ form: s.id, farben: NEUTRAL.bild, groesse: "M" })}</div>
        <div class="stil-text">
          <h2 class="stil-name">${esc(s.name)}</h2>
          <p class="stil-beschreibung">${esc(s.text)}</p>
          <p class="stil-ab">ab ${esc(preisText(abPreis(s.groessen)))}</p>
          <div class="groessen" role="group" aria-label="Größe für ${esc(s.name)}">${s.groessen.map((a) => {
            const g = GROESSEN.find((x) => x.id === a.groesse);
            return `<button type="button" class="groesse" data-rein="${esc(a.preis_id)}" aria-label="${esc(a.name)} für ${esc(preisText(a.cent))} in den Warenkorb">
              <span class="groesse-id">${esc(g?.name ?? a.groesse)}</span><span class="groesse-preis">${esc(preisText(a.cent))}</span></button>`;
          }).join("")}</div>
        </div>
      </article>`).join("")}</div>
    ${weitere.length ? `<h2 class="info-titel">Außerdem</h2><div class="raster">${weitere.map((a) => `
      <article class="karte"><button type="button" class="karte-knopf" data-produkt="${esc(a.preis_id)}">
        <div class="karte-bild">${a.bild ? `<img src="${esc(a.bild)}" alt="${esc(a.name)}" loading="lazy">` : `<div class="bild-leer" aria-hidden="true"></div>`}</div>
        <h2 class="karte-titel">${esc(a.name)}</h2><p class="karte-preis">${esc(preisText(a.cent))}</p></button></article>`).join("")}</div>` : ""}`;
}

function infosHtml() {
  const w = woche();
  const t = termin();
  const fragen = [
    ["Welche Blumen bekomme ich?", SAISON_SATZ],
    ["Kann eine Karte dabei sein?", "Ja – die Grußkarte legst du nach deinem Strauß dazu, den Text schreibst du an der Kasse (bis zu 255 Zeichen)."],
    ["Wie bezahle ich?", "Vorab und sicher über Stripe. Erst danach werden die Blumen für deinen Strauß bestellt."],
    ["Was, wenn ich nach dem Bestellschluss bestelle?", "Dann kommt dein Strauß in die Woche danach – der Satz zum Termin nennt dir den Tag."],
  ];
  return `<div class="infos">
      <section class="info">
        <h2 class="info-titel">So kommt dein Strauß zu dir</h2>
        <ol class="schritte">
          <li><strong>Bis ${TAGE[w.schluss_tag]}, ${w.schluss_stunde} Uhr, bestellen</strong><span>${t.bestellschluss ? `Diese Woche also bis ${esc(tagText(t.bestellschluss))}.` : "Danach geht es in die nächste Woche."}</span></li>
          <li><strong>Frisch gebunden</strong><span>Die Blumen werden erst bestellt, wenn die Bestellungen der Woche stehen – nichts liegt auf Vorrat.</span></li>
          <li><strong>${katalog.lieferung ? "Abholen oder liefern lassen" : "Abholen"}</strong><span>${esc(TAGE[w.abhol_tag])}${w.abhol_ab ? ` ab ${esc(w.abhol_ab.replace(/^ab\s+/i, ""))}` : ""}${katalog.lieferung ? ` – oder die Lieferung am ${esc(TAGE[w.route_tag])}${w.route_zeit ? ` (${esc(w.route_zeit)})` : ""}` : ""}.</span></li>
        </ol>
      </section>
      <section class="info">
        <h2 class="info-titel">${katalog.lieferung ? "Abholung und Liefergebiet" : "Abholung"}</h2>
        <p>${esc(konfig.abholung || "Abholung in Heide.")}</p>
        ${katalog.lieferung ? `<p>${esc(konfig.liefergebiet || "Geliefert wird in Heide und Umgebung, etwa 6 Kilometer weit – mit dem Rad, auf einer Route.")}</p>
        <p class="leise-satz">Was die Lieferung kostet, siehst du an der Kasse, bevor du bezahlst.</p>` : ""}
      </section>
      <section class="info">
        <h2 class="info-titel">Fragen</h2>
        ${fragen.map(([f, a]) => `<details class="frage-klappe"><summary>${esc(f)}</summary><p>${esc(a)}</p></details>`).join("")}
      </section>
    </div>`;
}

// ------------------------------------------------------------------ Routing (Hash)
export function zustandAus(hash) {
  if (hash === "#uebersicht") return { ansicht: "uebersicht" };
  if (hash === "#anlass") return { ansicht: "schritt", auswahl: auswahlAusHash(""), i: 0 };
  const auswahl = auswahlAusHash(hash);
  if (!auswahl.anlass) return { ansicht: "start" };
  const i = schritt(auswahl);
  if (i < 4) return { ansicht: "schritt", auswahl, i };
  const v = new URLSearchParams(String(hash).replace(/^#/, "")).get("v");
  return { ansicht: v === "persoenlich" ? "persoenlich" : "ergebnis", auswahl };
}

function zustand() {
  return zustandAus(location.hash);
}

function gehe(hash) {
  if (location.hash === hash || (!hash && !location.hash)) zeichnen();
  else if (!hash) history.pushState(null, "", location.pathname + location.search), zeichnen();
  else location.hash = hash;
}

function zeichnen() {
  const inhalt = $("inhalt");
  const z = zustand();
  const w = z.auswahl ?? {};
  welt(w.anlass, w.gefuehl);
  let html;
  if (z.ansicht === "start") html = startHtml() + infosHtml();
  else if (z.ansicht === "uebersicht") html = uebersichtHtml() + infosHtml();
  else if (z.ansicht === "schritt") html = `<section class="schritt">${[schritt1Html, schritt2Html, schritt3Html, schritt4Html][z.i](w)}</section>`;
  else {
    const e = ergebnis(w, katalog.artikel);
    html = !e
      ? `<p class="ruhig">Diesen Strauß gibt es gerade nicht. <a href="#anlass" data-ziel="anlass">Noch einmal wählen</a></p>`
      : z.ansicht === "persoenlich" ? extrasHtml(e) : ergebnisHtml(e) + infosHtml();
  }
  inhalt.innerHTML = html;
  farbenSetzen(inhalt);
  inhalt.classList.remove("einblenden");
  void inhalt.offsetWidth; // die sanfte Einblendung neu starten
  inhalt.classList.add("einblenden");
  if (z.ansicht !== "start") {
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    inhalt.focus({ preventScroll: true });
  }
}

/** Einen Schritt zurück: die Auswahl vor `ziel` behalten. */
function zurueckNach(ziel) {
  if (ziel === "start") return gehe("");
  if (ziel === "anlass") return gehe("#anlass");
  const w = zustand().auswahl ?? {};
  const neu = {};
  SCHRITTE.slice(0, SCHRITTE.indexOf(ziel)).forEach((k) => { neu[k] = w[k]; });
  gehe(hashAusAuswahl(neu));
}

function waehlen(schluessel, wert) {
  const w = { ...(zustand().auswahl ?? {}) };
  w[schluessel] = wert;
  // Wer vorne etwas ändert, wählt danach neu – außer bei der Größe (Alternative im Ergebnis).
  SCHRITTE.slice(SCHRITTE.indexOf(schluessel) + 1).forEach((k) => { delete w[k]; });
  gehe(hashAusAuswahl(w));
}

// ------------------------------------------------------------------ Warenkorb
function hinein(preisId, name) {
  korb = korbHinzu(korb, preisId);
  if (name) nameMerken(preisId, name);
  nachAenderung();
}

function korbZeichnen() {
  korb = korbBereinigen(korb, katalog.artikel);
  const namen = lesen(NAMEN, {}) ?? {};
  const n = korbAnzahl(korb);
  $("warenkorb-zahl").textContent = n ? String(n) : "";
  const liste = $("korb-liste");
  liste.replaceChildren();
  for (const p of korb) {
    const a = katalog.artikel.find((x) => x.preis_id === p.preis);
    if (!a) continue;
    const li = document.createElement("li");
    li.className = "korb-zeile";
    const titel = typeof namen[p.preis] === "string" ? `${namen[p.preis]} (${a.name})` : a.name;
    li.innerHTML = `<span class="korb-name">${esc(titel)}</span>
      <span class="korb-menge">
        <button type="button" class="mini" data-menge="-1" aria-label="Eins weniger ${esc(a.name)}">−</button>
        <span>${p.menge}</span>
        <button type="button" class="mini" data-menge="1" aria-label="Eins mehr ${esc(a.name)}"${p.menge >= MENGE_MAX ? " disabled" : ""}>+</button>
      </span>
      <span class="korb-preis">${esc(preisText(a.cent * p.menge))}</span>`;
    li.querySelectorAll("[data-menge]").forEach((b) => b.addEventListener("click", () => {
      korb = korbSetzen(korb, p.preis, p.menge + Number(b.dataset.menge));
      nachAenderung();
    }));
    liste.append(li);
  }
  $("korb-leer").hidden = korb.length > 0;
  $("korb-art").hidden = korb.length === 0;
  $("art-liefern").hidden = !katalog.lieferung;
  if (!katalog.lieferung) document.querySelector('input[name="art"][value="abholung"]').checked = true;
  $("korb-summe").textContent = preisText(korbSumme(korb, katalog.artikel));
  const t = termin();
  const wann = t.abholung ? ` Abholung ${tagText(t.abholung)}${katalog.lieferung ? `, Lieferung ${tagText(t.route)}` : ""}.` : "";
  $("korb-hinweis").textContent = m.art === "demo"
    ? `Das ist eine Vorschau – bestellen geht noch nicht.${wann}`
    : `${katalog.lieferung ? "Lieferkosten, " : ""}Text für die Karte und einen Hinweis trägst du an der Kasse ein.${wann}`;
  const kasse = $("zur-kasse");
  kasse.disabled = korb.length === 0 || !kasseErlaubt(m);
  kasse.textContent = kasseErlaubt(m) ? "Zur Kasse" : "Bestellen geht noch nicht";
}

function nachAenderung() {
  merken(SPEICHER, korb);
  korbZeichnen();
}

async function zurKasse() {
  if (!kasseErlaubt(m)) return; // Demo: keine Anfrage, nie
  const fehler = $("korb-fehler");
  fehler.hidden = true;
  const knopf = $("zur-kasse");
  knopf.disabled = true;
  knopf.textContent = "Einen Moment …";
  const art = document.querySelector('input[name="art"]:checked')?.value;
  try {
    const r = await fetch(`${m.worker}/shop/kasse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(kassenAnfrage(korb, art)),
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
  knopf.textContent = "Zur Kasse";
}

// ------------------------------------------------------------------ Klicks (ein Zuhörer)
function klick(ev) {
  const el = ev.target.closest("[data-ziel], [data-weiter], [data-zurueck], [data-anlass], [data-absicht], [data-gefuehl], [data-groesse], [data-rein], [data-extra], [data-fertig], [data-produkt]");
  if (!el || el.closest("dialog")) return;
  const d = el.dataset;
  if (d.ziel !== undefined) {
    ev.preventDefault();
    return gehe(d.ziel === "start" ? "" : `#${d.ziel}`);
  }
  if (d.weiter) return gehe(`#${d.weiter}`);
  if (d.zurueck) return zurueckNach(d.zurueck);
  if (d.anlass) return waehlen("anlass", d.anlass);
  if (d.absicht) return waehlen("absicht", d.absicht);
  if (d.gefuehl) return waehlen("gefuehl", d.gefuehl);
  if (d.groesse) return waehlen("groesse", d.groesse);
  if (d.rein) {
    const z = zustand();
    const e = z.auswahl && z.ansicht === "ergebnis" ? ergebnis(z.auswahl, katalog.artikel) : null;
    if (e && e.haupt.preis_id === d.rein) {
      hinein(d.rein, e.name);
      extrasWahl = new Set();
      return gehe(`${hashAusAuswahl(z.auswahl)}&v=persoenlich`);
    }
    hinein(d.rein, null);
    const a = katalog.artikel.find((x) => x.preis_id === d.rein);
    return meldung(`Im Warenkorb: ${a?.name ?? "Strauß"}.`, true);
  }
  if (d.extra) {
    if (extrasWahl.has(d.extra)) extrasWahl.delete(d.extra);
    else extrasWahl.add(d.extra);
    return zeichnen();
  }
  if (d.fertig) {
    if (d.fertig === "mit") {
      for (const id of extrasWahl) {
        const a = extraFinden(katalog.artikel, id);
        if (a) hinein(a.preis_id, null);
      }
    }
    extrasWahl = new Set();
    zeichnen();
    korbZeichnen();
    $("warenkorb").showModal();
    return;
  }
  if (d.produkt) {
    const a = katalog.artikel.find((x) => x.preis_id === d.produkt);
    if (!a) return;
    gewaehlt = a;
    $("produkt-bild").innerHTML = a.bild ? `<img src="${esc(a.bild)}" alt="${esc(a.name)}">` : `<div class="bild-leer" aria-hidden="true"></div>`;
    $("produkt-titel").textContent = a.name;
    $("produkt-preis").textContent = preisText(a.cent);
    $("produkt-beschreibung").textContent = a.beschreibung ?? "";
    $("produkt-dialog").showModal();
  }
}

// ------------------------------------------------------------------ Fuß und Start
function fuss() {
  const links = rechtlicheLinks(konfig.rechtliches);
  const text = m.art === "bald" ? "Impressum und Datenschutz folgen mit dem Start des Shops."
    : m.art === "demo" ? "Vorschau – bestellen geht noch nicht. Impressum und Datenschutz folgen mit dem Start des Shops."
    : m.art === "vorschau" ? "Vorschau mit einem lokalen Worker – hier wird nichts echt bezahlt."
    : "Bezahlt wird sicher über Stripe.";
  $("fuss").innerHTML = `${links.length ? `<nav class="fuss-links" aria-label="Rechtliches">${links.map((l) => `<a href="${esc(l.url)}" rel="noopener">${esc(l.titel)}</a>`).join("")}</nav>` : ""}
    <p class="fuss-klein">${esc(text)}</p>`;
}

function bald() {
  $("inhalt").innerHTML = `<section class="bald"><h2>Der Shop öffnet bald</h2><p>Hier kannst du demnächst Blumen für besondere Momente bestellen.</p></section>`;
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
  korb = korbLaden();
  const vonStripe = rueckkehr(location.search);
  if (vonStripe === "bestellt") {
    korb = [];
    merken(SPEICHER, korb);
    meldung("Danke für deine Bestellung! Die Bestätigung kommt per E-Mail.");
  } else if (vonStripe === "abgebrochen") {
    meldung("Bezahlung abgebrochen – dein Warenkorb ist noch da.");
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
  zeichnen();
  korbZeichnen();
  window.addEventListener("hashchange", zeichnen);
  window.addEventListener("popstate", zeichnen);
  document.addEventListener("click", klick);
  const knopf = $("warenkorb-knopf");
  knopf.hidden = false;
  knopf.addEventListener("click", () => { korbZeichnen(); $("warenkorb").showModal(); });
  $("produkt-rein").addEventListener("click", () => {
    if (!gewaehlt) return;
    hinein(gewaehlt.preis_id, null);
    $("produkt-dialog").close();
    $("warenkorb").showModal();
  });
  $("zur-kasse").addEventListener("click", zurKasse);
}

for (const zu of document.querySelectorAll("[data-zu]")) zu.addEventListener("click", () => zu.closest("dialog").close());

welt(null, null);
if (m.art === "bald") bald();
else laden();
fuss();

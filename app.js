// Kaufseite (Specs docs/specs/2026-09-22-shop-seite.md, 2026-09-22-stripe-statt-shopify.md § 6).
// Liest config.js. Ohne Worker oder Rechtstexte: „bald", keine Anfrage. Sonst Katalog vom eigenen Worker, Warenkorb
// im Browser, „Zur Kasse" schickt nur Price-IDs und Mengen – bezahlt wird bei Stripe.
import {
  kassenAnfrage, korbAnzahl, korbBereinigen, korbHinzu, korbLesen, korbSetzen, korbSumme, MENGE_MAX, modus, preisText,
  rechtlicheLinks, rueckkehr,
} from "./logik.js";

const konfig = window.SHOP_KONFIG ?? {};
const m = modus(konfig, location.search);
const $ = (id) => document.getElementById(id);
const SPEICHER = "shop-warenkorb";

$("shop-name").textContent = konfig.name || "Shop";
$("shop-unterzeile").textContent = konfig.unterzeile || "";
document.title = konfig.name ? `${konfig.name} – Shop` : "Shop";

let katalog = { artikel: [], lieferung: false };
let korb = [];
let gewaehlt = null;

function korbLaden() {
  try {
    return korbLesen(localStorage.getItem(SPEICHER));
  } catch {
    return [];
  }
}

function korbMerken() {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(korb));
  } catch {
    // privater Modus: der Warenkorb lebt dann nur bis zum Neuladen
  }
}

function meldung(text) {
  const e = $("meldung");
  e.textContent = text;
  e.hidden = !text;
}

function fuss() {
  const f = $("fuss");
  f.replaceChildren();
  const links = rechtlicheLinks(konfig.rechtliches);
  if (links.length) {
    const nav = document.createElement("nav");
    nav.className = "fuss-links";
    nav.setAttribute("aria-label", "Rechtliches");
    for (const l of links) {
      const a = document.createElement("a");
      a.href = l.url;
      a.textContent = l.titel;
      a.rel = "noopener";
      nav.append(a);
    }
    f.append(nav);
  }
  const p = document.createElement("p");
  p.className = "fuss-klein";
  p.textContent = m.art === "bald" ? "Impressum und Datenschutz folgen mit dem Start des Shops."
    : m.art === "vorschau" ? "Vorschau mit einem lokalen Worker – hier wird nichts echt bezahlt."
    : "Bezahlt wird sicher über Stripe.";
  f.append(p);
}

function bald() {
  $("inhalt").innerHTML = `<section class="bald">
      <h2>Der Shop öffnet bald</h2>
      <p>Hier kannst du demnächst Sträuße und Gestecke bestellen.</p>
    </section>`;
}

function bildElement(artikel, breite) {
  if (!artikel.bild) {
    const leer = document.createElement("div");
    leer.className = "bild-leer";
    leer.setAttribute("aria-hidden", "true");
    return leer;
  }
  const img = document.createElement("img");
  img.src = artikel.bild;
  img.alt = artikel.name;
  img.loading = "lazy";
  img.width = breite;
  img.height = Math.round(breite * 1.25);
  return img;
}

function raster() {
  const inhalt = $("inhalt");
  inhalt.replaceChildren();
  if (!katalog.artikel.length) {
    inhalt.innerHTML = `<p class="ruhig">Gerade ist nichts im Angebot – schau bald wieder vorbei.</p>`;
    return;
  }
  const sec = document.createElement("section");
  sec.className = "raster";
  sec.setAttribute("aria-label", "Produkte");
  for (const a of katalog.artikel) {
    const karte = document.createElement("article");
    karte.className = "karte";
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "karte-knopf";
    const bild = document.createElement("div");
    bild.className = "karte-bild";
    bild.append(bildElement(a, 480));
    const titel = document.createElement("h2");
    titel.className = "karte-titel";
    titel.textContent = a.name;
    const preis = document.createElement("p");
    preis.className = "karte-preis";
    preis.textContent = preisText(a.cent);
    knopf.append(bild, titel, preis);
    knopf.addEventListener("click", () => zeigeProdukt(a));
    karte.append(knopf);
    sec.append(karte);
  }
  inhalt.append(sec);
}

function zeigeProdukt(a) {
  gewaehlt = a;
  $("produkt-bild").replaceChildren(bildElement(a, 720));
  $("produkt-titel").textContent = a.name;
  $("produkt-preis").textContent = preisText(a.cent);
  $("produkt-beschreibung").textContent = a.beschreibung ?? "";
  $("produkt-dialog").showModal();
}

function korbZeichnen() {
  korb = korbBereinigen(korb, katalog.artikel);
  const n = korbAnzahl(korb);
  $("warenkorb-zahl").textContent = n ? String(n) : "";
  const liste = $("korb-liste");
  liste.replaceChildren();
  for (const p of korb) {
    const a = katalog.artikel.find((x) => x.preis_id === p.preis);
    if (!a) continue;
    const li = document.createElement("li");
    li.className = "korb-zeile";
    const name = document.createElement("span");
    name.className = "korb-name";
    name.textContent = a.name;
    const menge = document.createElement("span");
    menge.className = "korb-menge";
    const weniger = document.createElement("button");
    weniger.type = "button";
    weniger.className = "mini";
    weniger.textContent = "−";
    weniger.setAttribute("aria-label", `Eins weniger ${a.name}`);
    weniger.addEventListener("click", () => { korb = korbSetzen(korb, p.preis, p.menge - 1); nachAenderung(); });
    const zahl = document.createElement("span");
    zahl.textContent = String(p.menge);
    const mehr = document.createElement("button");
    mehr.type = "button";
    mehr.className = "mini";
    mehr.textContent = "+";
    mehr.disabled = p.menge >= MENGE_MAX;
    mehr.setAttribute("aria-label", `Eins mehr ${a.name}`);
    mehr.addEventListener("click", () => { korb = korbSetzen(korb, p.preis, p.menge + 1); nachAenderung(); });
    menge.append(weniger, zahl, mehr);
    const preis = document.createElement("span");
    preis.className = "korb-preis";
    preis.textContent = preisText(a.cent * p.menge);
    li.append(name, menge, preis);
    liste.append(li);
  }
  $("korb-leer").hidden = korb.length > 0;
  $("korb-art").hidden = korb.length === 0;
  $("art-liefern").hidden = !katalog.lieferung;
  if (!katalog.lieferung) document.querySelector('input[name="art"][value="abholung"]').checked = true;
  $("korb-summe").textContent = preisText(korbSumme(korb, katalog.artikel));
  $("korb-hinweis").textContent = katalog.lieferung
    ? "Lieferkosten, Wunschtermin und Text für die Karte kommen an der Kasse dazu."
    : "Wunschtermin und Text für die Karte trägst du an der Kasse ein.";
  $("zur-kasse").disabled = korb.length === 0;
}

function nachAenderung() {
  korbMerken();
  korbZeichnen();
}

async function zurKasse() {
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

async function laden() {
  korb = korbLaden();
  const zurueck = rueckkehr(location.search);
  if (zurueck === "bestellt") {
    korb = [];
    korbMerken();
    meldung("Danke für deine Bestellung! Die Bestätigung kommt per E-Mail.");
  } else if (zurueck === "abgebrochen") {
    meldung("Bezahlung abgebrochen – dein Warenkorb ist noch da.");
  }
  try {
    const r = await fetch(`${m.worker}/shop/katalog`);
    const d = await r.json();
    if (!r.ok || !d.bereit) {
      bald();
      return;
    }
    katalog = { artikel: Array.isArray(d.artikel) ? d.artikel : [], lieferung: Boolean(d.lieferung) };
  } catch {
    $("inhalt").innerHTML = `<p class="ruhig">Der Shop ist gerade nicht erreichbar – bitte später noch einmal.</p>`;
    return;
  }
  raster();
  korbZeichnen();
  const knopf = $("warenkorb-knopf");
  knopf.hidden = false;
  knopf.addEventListener("click", () => { korbZeichnen(); $("warenkorb").showModal(); });
  $("produkt-rein").addEventListener("click", () => {
    if (!gewaehlt) return;
    korb = korbHinzu(korb, gewaehlt.preis_id);
    nachAenderung();
    $("produkt-dialog").close();
    $("warenkorb").showModal();
  });
  $("zur-kasse").addEventListener("click", zurKasse);
}

for (const zu of document.querySelectorAll("[data-zu]")) zu.addEventListener("click", () => zu.closest("dialog").close());

if (m.art === "bald") bald();
else laden();
fuss();

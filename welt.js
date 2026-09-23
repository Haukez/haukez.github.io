// Anlasswelten der Kaufseite (Master-Prompt des Nutzers § 4/§ 5, Spec 2026-09-23-gefuehrte-kaufseite § 7):
// Jede Wahl verändert die Wirkung – Farbe, Bildsprache, Sprache, Tempo. 80 % bleibt stabil (Knöpfe, Karten, Warenkorb),
// 20 % ist die Welt. Hier wird nur gerechnet: Farben aus Anlass × Gefühl, ohne DOM. Getestet in welt.test.mjs.

/** Grundpaletten je Anlass (Farbangaben aus dem Master-Prompt § 4). `null` = neutral (Start, Übersicht). */
export const WELTEN = {
  neutral: { grund: "#F7F3EC", flaeche: "#EFE8DD", karte: "#FFFDF9", akzent: "#2F4A36", tinte: "#2B2622" },
  // Apricot, Koralle, Buttergelb, frisches Grün – Freude, Energie, Leichtigkeit, Wärme
  geburtstag: { grund: "#FCF2E7", flaeche: "#F9DFC9", karte: "#FFFBF5", akzent: "#C8603A", tinte: "#3A2A22" },
  // Altrosa, Bordeaux, Creme, dunklere Akzente – Nähe, Intimität, Wärme, Tiefe
  liebe: { grund: "#F7EDEC", flaeche: "#EED6D4", karte: "#FFFAF9", akzent: "#8A3342", tinte: "#351F26" },
  // Elfenbein, Blush, Salbei, Champagner – Ruhe, Feinheit, Besonderheit, Eleganz
  hochzeit: { grund: "#F8F6F0", flaeche: "#ECE7DC", karte: "#FFFEFB", akzent: "#7A8B6C", tinte: "#2F2E29" },
  // Terrakotta, Pfirsich, Sand, Olive – Herzlichkeit, Wärme, Natürlichkeit
  danke: { grund: "#F7EFE5", flaeche: "#EEDDC9", karte: "#FFFBF6", akzent: "#A5552F", tinte: "#33271E" },
  // Gebrochenes Weiß, gedecktes Grün, Mauve, sanftes Blau – Ruhe, Würde, Verbundenheit, Zurückhaltung
  trost: { grund: "#F1F1EE", flaeche: "#E3E5E0", karte: "#FBFBF9", akzent: "#5D6A73", tinte: "#2D3033" },
  // frisch und saisonal – leicht, freundlich
  einfach: { grund: "#F4F4EB", flaeche: "#E4EAD8", karte: "#FFFEF8", akzent: "#4C6B43", tinte: "#2A2B23" },
};

/**
 * Wie ein Gefühl die Welt verschiebt: `hell` mischt Weiß hinein, `saett` skaliert die Sättigung, `ton` mischt eine
 * Tönung hinein, `tief` dunkelt den Akzent ab. `bild` ist der CSS-Filter für die Fotos.
 */
export const WIRKUNG = {
  zart: { hell: 0.4, saett: 0.72, ton: null, tief: -0.06, bild: "brightness(1.05) saturate(0.86)" },
  froehlich: { hell: 0, saett: 1.28, ton: ["#FFD9A0", 0.1], tief: 0, bild: "saturate(1.08) brightness(1.02)" },
  natuerlich: { hell: 0.1, saett: 0.95, ton: ["#DDE5C8", 0.22], tief: 0.02, bild: "saturate(0.98)" },
  elegant: { hell: 0.18, saett: 0.55, ton: ["#E7E3DE", 0.15], tief: 0.12, bild: "saturate(0.88) contrast(1.04)" },
  ausdrucksstark: { hell: -0.02, saett: 1.35, ton: null, tief: 0.1, bild: "saturate(1.12) contrast(1.03)" },
};

// ------------------------------------------------------------------ Farbrechnung (rein)
function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex([r, g, b]) {
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function mischen(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}

function zuHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function ausHsl([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Sättigung skalieren (× f) und Helligkeit verschieben (+ dl, −1…1). */
export function hsl(hexwert, f = 1, dl = 0) {
  const [h, s, l] = zuHsl(rgb(hexwert));
  return hex(ausHsl([h, Math.max(0, Math.min(1, s * f)), Math.max(0, Math.min(1, l + dl))]));
}

/** Sättigung einer Farbe (0–1) – für Tests und Prüfungen. */
export function saettigung(hexwert) {
  return zuHsl(rgb(hexwert))[1];
}

/** Farbigkeit (Chroma, 0–1): Abstand zwischen stärkstem und schwächstem Kanal – taugt auch bei sehr hellen Tönen. */
export function farbigkeit(hexwert) {
  const c = rgb(hexwert);
  return (Math.max(...c) - Math.min(...c)) / 255;
}

/** Helligkeit (0–1). */
export function helligkeit(hexwert) {
  return zuHsl(rgb(hexwert))[2];
}

/** Kontrast nach WCAG 2.x (1–21). */
export function kontrast(a, b) {
  const lum = (c) => {
    const [r, g, bl] = rgb(c).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** So lange abdunkeln, bis `farbe` auf `grund` mindestens `ziel` Kontrast hat (höchstens 20 Schritte). */
function lesbar(farbe, grund, ziel) {
  let f = farbe;
  for (let i = 0; i < 20 && kontrast(f, grund) < ziel; i++) f = hsl(f, 1, -0.03);
  return f;
}

/**
 * Wie stark die Welt je Schritt durchkommt (Nutzer 2026-09-23: „die volle Farbe erst, wenn man den Screen mit dem Bild
 * des Straußes sieht"). 0 = neutral, 1 = volle Welt, darüber: der Grund nimmt zusätzlich Farbe der Fläche an.
 */
export const STAERKE = { vorschau: 0.25, botschaft: 0.35, strauss: 1.35, warenkorb: 0.8 };

/**
 * Die Farben eines Bildschirms: Welt des Anlasses, verschoben durch das Gefühl, mit `staerke` (0 … 1,5) zwischen
 * neutral und voll. Ohne Anlass neutral.
 * → { grund, flaeche, karte, akzent, akzentText, akzentHauch, tinte, bild }
 */
export function weltFarben(anlassId, gefuehlId, staerke = 1) {
  const voll = weltVoll(anlassId, gefuehlId);
  const n = WELTEN.neutral;
  const t = Math.max(0, Math.min(1.5, Number.isFinite(staerke) ? staerke : 1));
  let { grund, flaeche, karte, akzent, tinte } = voll;
  if (t < 1) {
    grund = mischen(n.grund, grund, t);
    flaeche = mischen(n.flaeche, flaeche, t);
    karte = mischen(n.karte, karte, t);
    // Der Akzent erscheint gleich in seiner eigenen Farbe – ein Mischen quer über den Farbkreis (Grün → Koralle) ergäbe
    // Braun (gemessen 2026-09-23: #855638). Nur die Flächen blenden ein.
    if (t === 0) akzent = n.akzent;
    tinte = mischen(n.tinte, tinte, t);
  } else if (t > 1) {
    grund = mischen(grund, flaeche, (t - 1) * 1.4); // volle Farbe: der Grund nimmt Fläche an
  }
  akzent = lesbar(akzent, karte, 3);
  const akzentText = lesbar(lesbar(akzent, grund, 4.5), karte, 4.5);
  return {
    grund, flaeche, karte, akzent, akzentText, tinte,
    akzentHauch: mischen(akzent, karte, 0.88),
    bild: t < 1 ? "none" : voll.bild,
  };
}

function weltVoll(anlassId, gefuehlId) {
  const w = WELTEN[anlassId] ?? WELTEN.neutral;
  const g = WIRKUNG[gefuehlId];
  let { grund, flaeche, karte, akzent, tinte } = w;
  if (g) {
    const flaechig = (c) => {
      let x = hsl(c, g.saett);
      if (g.ton) x = mischen(x, g.ton[0], g.ton[1]);
      return g.hell >= 0 ? mischen(x, "#FFFFFF", g.hell) : mischen(x, "#000000", -g.hell);
    };
    grund = flaechig(grund);
    flaeche = flaechig(flaeche);
    karte = mischen(karte, "#FFFFFF", Math.max(0, g.hell) * 0.5);
    akzent = hsl(akzent, Math.min(1.4, 0.55 + g.saett * 0.45), -g.tief);
  }
  return { grund, flaeche, karte, akzent, tinte, bild: g?.bild ?? (anlassId === "trost" ? "saturate(0.82)" : "none") };
}
// Rahmen und Flächen brauchen ≥ 3:1, Schrift in der Akzentfarbe ≥ 4,5:1 (WCAG AA) – auf Grund und Karte (in weltFarben).

// ------------------------------------------------------------------ Sprache je Anlass (Master-Prompt § 9)
/**
 * `frage`/`unter`: Kopf der Seite „Botschaft“. `vorzeile`: über dem Vorschlag. `zug`: handschriftliche Zeile.
 * `dank`: Satz der Bestätigung. Warm, ruhig, ohne Kitsch; Trost zurückhaltend.
 */
export const SPRACHE = {
  neutral: { frage: "Was möchtest du damit sagen?", unter: "Such dir aus, was am besten passt.", vorzeile: "Das passt zu deinem Moment", zug: "", dank: "Schön, dass du Freude verschenkst." },
  geburtstag: { frage: "Was möchtest du damit sagen?", unter: "Ein Geburtstag verdient Freude – wie viel, entscheidest du.", vorzeile: "Das passt zu diesem Tag", zug: "Freude schenken", dank: "Schön, dass du Freude verschenkst." },
  liebe: { frage: "Was sollen die Blumen sagen?", unter: "Ganz leise oder ganz groß – beides ist richtig.", vorzeile: "Das passt zu euch", zug: "von Herzen", dank: "Schön, dass du Nähe verschenkst." },
  hochzeit: { frage: "Was möchtest du dem Paar sagen?", unter: "Für einen Tag, an den man sich lange erinnert.", vorzeile: "Das passt zum großen Tag", zug: "für den großen Tag", dank: "Schön, dass du mitfeierst." },
  danke: { frage: "Wie groß ist dein Dank?", unter: "Kleine Gesten zählen genauso wie große.", vorzeile: "Das passt zu deinem Dank", zug: "mit Dank", dank: "Schön, dass du Danke sagst." },
  trost: { frage: "Was möchtest du ausdrücken?", unter: "Nimm dir die Zeit, die du brauchst.", vorzeile: "Das passt zu diesem Moment", zug: "in Verbundenheit", dank: "Danke, dass du an jemanden denkst." },
  einfach: { frage: "Was soll der Strauß tun?", unter: "Manchmal braucht es keinen Anlass.", vorzeile: "Das passt zu deinem Moment", zug: "einfach so", dank: "Schön, dass du Freude verschenkst." },
};

export function sprache(anlassId) {
  return SPRACHE[anlassId] ?? SPRACHE.neutral;
}

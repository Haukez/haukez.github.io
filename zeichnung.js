// Zeichnungen für die Kaufseite (Entscheidung 2026-09-23: Zeichnungen bis zu echten Fotos, keine KI-Bilder für Ware).
// Ein Strauß als SVG-Text aus Form (Gefühl), Farben (Anlasswelt) und Größe (Fülle). Ohne DOM, deterministisch.
// Feste Farben statt CSS-Variablen: var() in SVG-Attributen tragen nicht alle Browser.

const GRUEN = "#7f906c";
const STIEL = "#5e7050";

/** Wie viele Blüten je Größe – die Fülle macht die Geste sichtbar. */
const FUELLE = { S: 3, M: 5, L: 8 };

// Feste Positionen (x, y, r-Faktor) – so sieht derselbe Strauß immer gleich aus.
const PLAETZE = [
  [60, 44, 1], [42, 56, 0.9], [78, 54, 0.95], [52, 30, 0.8], [70, 30, 0.8],
  [32, 40, 0.7], [88, 40, 0.7], [60, 62, 0.75],
];

function farbe(liste, i) {
  return liste[i % liste.length];
}

function stiele(n, weit) {
  let s = "";
  for (let i = 0; i < Math.min(n, 5); i++) {
    const x = 60 + (i - (Math.min(n, 5) - 1) / 2) * (weit ? 7 : 4);
    s += `<path d="M60 148 Q${(60 + x) / 2} 110 ${x.toFixed(1)} 82" stroke="${STIEL}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }
  return s;
}

function blaetter(n) {
  const alle = [[40, 90, -30], [80, 88, 30], [34, 72, -45], [86, 70, 45]];
  return alle.slice(0, n).map(([x, y, w]) => `<ellipse cx="${x}" cy="${y}" rx="12" ry="5" transform="rotate(${w} ${x} ${y})" fill="${GRUEN}" opacity=".85"/>`).join("");
}

const FORMEN = {
  // weiche, helle Kreise mit viel Luft
  zart: (n, f) => PLAETZE.slice(0, n).map(([x, y, r], i) =>
    `<circle cx="${x}" cy="${y}" r="${(12 * r).toFixed(1)}" fill="${farbe(f, i)}" opacity=".55"/><circle cx="${x}" cy="${y}" r="${(4 * r).toFixed(1)}" fill="${farbe(f, i + 1)}" opacity=".6"/>`).join(""),
  // runde, volle Blüten
  froehlich: (n, f) => PLAETZE.slice(0, n).map(([x, y, r], i) =>
    `<circle cx="${x}" cy="${y}" r="${(15 * r).toFixed(1)}" fill="${farbe(f, i)}"/><circle cx="${x}" cy="${y}" r="${(6 * r).toFixed(1)}" fill="${farbe(f, i + 2)}" opacity=".8"/>`).join(""),
  // Gräser und kleine Blüten, locker
  natuerlich: (n, f) => {
    let s = "";
    for (let i = 0; i < n + 2; i++) {
      const x = 22 + i * (76 / (n + 1));
      s += `<path d="M60 120 Q${(x + 60) / 2} 80 ${x.toFixed(1)} ${24 + (i % 3) * 8}" stroke="${GRUEN}" stroke-width="1.3" fill="none"/>`;
      s += `<ellipse cx="${x.toFixed(1)}" cy="${24 + (i % 3) * 8}" rx="3" ry="8" fill="${farbe(f, i)}" opacity=".9"/>`;
    }
    return s + PLAETZE.slice(0, Math.ceil(n / 2)).map(([x, y, r], i) => `<circle cx="${x}" cy="${y + 6}" r="${(8 * r).toFixed(1)}" fill="${farbe(f, i + 1)}"/>`).join("");
  },
  // wenige, hohe Stiele mit einer klaren Blüte
  elegant: (n, f) => {
    const k = Math.min(n, 5);
    let s = "";
    for (let i = 0; i < k; i++) {
      const x = 60 + (i - (k - 1) / 2) * 12;
      const y = 26 + Math.abs(i - (k - 1) / 2) * 10;
      s += `<path d="M60 130 L${x} ${y + 10}" stroke="${STIEL}" stroke-width="1.4"/><ellipse cx="${x}" cy="${y}" rx="8" ry="11" fill="${farbe(f, i)}" stroke="#6f675b" stroke-width=".6"/>`;
    }
    return s;
  },
  // große Blüten mit Kranz
  ausdrucksstark: (n, f) => PLAETZE.slice(0, n).map(([x, y, r], i) => {
    const R = 17 * r;
    let blatt = "";
    for (let k = 0; k < 8; k++) {
      const w = (k * Math.PI) / 4;
      blatt += `<ellipse cx="${(x + Math.cos(w) * R * 0.7).toFixed(1)}" cy="${(y + Math.sin(w) * R * 0.7).toFixed(1)}" rx="${(R * 0.45).toFixed(1)}" ry="${(R * 0.25).toFixed(1)}" transform="rotate(${k * 45} ${(x + Math.cos(w) * R * 0.7).toFixed(1)} ${(y + Math.sin(w) * R * 0.7).toFixed(1)})" fill="${farbe(f, i)}"/>`;
    }
    return `${blatt}<circle cx="${x}" cy="${y}" r="${(R * 0.35).toFixed(1)}" fill="${farbe(f, i + 1)}"/>`;
  }).join(""),
};

/**
 * Ein Strauß als SVG. `form` = Gefühl, `farben` = Liste von Tönen der Anlasswelt, `groesse` = S/M/L.
 * Unbekannte Werte fallen auf „froehlich" bzw. „M" zurück.
 */
export function strauss({ form = "froehlich", farben = ["#e7c3bd", "#efc9a8", "#b9a7c9", "#9fb08e"], groesse = "M", titel = "" } = {}) {
  const n = FUELLE[groesse] ?? FUELLE.M;
  const f = Array.isArray(farben) && farben.length ? farben : ["#e7c3bd"];
  const bluete = (FORMEN[form] ?? FORMEN.froehlich)(n, f);
  const beschriftung = titel ? `<title>${titel.replace(/[<&>"]/g, "")}</title>` : "";
  return `<svg viewBox="0 0 120 150" class="strauss" role="img" aria-label="Zeichnung${titel ? `: ${titel.replace(/[<&>"]/g, "")}` : ""}">${beschriftung}
    ${stiele(n, form === "natuerlich")}${blaetter(Math.min(4, 1 + Math.floor(n / 2)))}${bluete}
    <path d="M52 118 L68 118 L64 128 L56 128 Z" fill="#d8c7a8" opacity=".9"/>
  </svg>`;
}

/** Kleine Symbole für die Absichten und Hinweise (ruhige Linien, currentColor). */
export const SYMBOL = {
  herz: `<svg viewBox="0 0 24 24" aria-hidden="true" class="symbol"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  bluete: `<svg viewBox="0 0 24 24" aria-hidden="true" class="symbol"><circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 4c2 2 2 4 0 6-2-2-2-4 0-6Zm6 6c-2 2-4 2-6 0 2-2 4-2 6 0ZM6 10c2-2 4-2 6 0-2 2-4 2-6 0Zm6 2v8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  stern: `<svg viewBox="0 0 24 24" aria-hidden="true" class="symbol"><path d="M12 4l2.2 4.8 5.2.6-3.9 3.5 1.1 5.1L12 15.4 7.4 18l1.1-5.1-3.9-3.5 5.2-.6Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  blatt: `<svg viewBox="0 0 24 24" aria-hidden="true" class="symbol"><path d="M5 19C5 10 11 5 19 5c0 8-5 14-14 14Zm0 0 8-8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  rad: `<svg viewBox="0 0 24 24" aria-hidden="true" class="symbol"><circle cx="6" cy="16" r="3.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="18" cy="16" r="3.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 16l4-7h5l3 7M10 9 8 6h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  kalender: `<svg viewBox="0 0 24 24" aria-hidden="true" class="symbol"><rect x="4" y="6" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4 10h16M9 4v4M15 4v4" stroke="currentColor" stroke-width="1.3"/></svg>`,
};

/** Welches Symbol zu welcher Absicht passt – der Reihe nach. */
export const ABSICHT_SYMBOLE = ["herz", "bluete", "stern"];

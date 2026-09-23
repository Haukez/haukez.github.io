// Die Regel der Woche (docs/specs/2026-09-23-wochenatelier.md § 2.1) – dieselbe Regel steht in
// src-tauri/src/woche.rs. Beide prüfen die Fälle in woche-faelle.json (GUARDRAILS V27). Ohne DOM, ohne Netz.

/** Wochentage: 1 = Montag … 7 = Sonntag. */
export const WOCHE_STANDARD = Object.freeze({
  schluss_tag: 3,
  schluss_stunde: 12,
  abhol_tag: 5,
  abhol_ab: "17 Uhr",
  route_tag: 6,
  route_zeit: "9 bis 12 Uhr",
  pausen: [],
});

const TAG_MS = 86_400_000;
const WOCHEN_MAX = 52;

/** Reine Kalendertage als UTC-Mitternacht (Zeitzone spielt hier keine Rolle mehr). */
function tag(j, m, t) {
  return Date.UTC(j, m - 1, t);
}

export function isoTag(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function ausIso(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ""));
  return m ? tag(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

/** Wochentag 1–7 eines Kalendertags. */
function wochentag(ms) {
  const w = new Date(ms).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Montag der Woche eines Kalendertags. */
export function montagVon(ms) {
  return ms - (wochentag(ms) - 1) * TAG_MS;
}

/** Letzter Sonntag eines Monats, 01:00 UTC – Beginn bzw. Ende der Sommerzeit in der EU. */
function letzterSonntag01Utc(j, m) {
  let t = Date.UTC(j, m, 0); // letzter Tag des Monats m
  while (new Date(t).getUTCDay() !== 0) t -= TAG_MS;
  return t + 3_600_000;
}

/** Ortszeit Europe/Berlin: MEZ (+1), MESZ (+2) vom letzten Sonntag im März bis zum letzten Sonntag im Oktober. */
export function berlin(utcMs) {
  const j = new Date(utcMs).getUTCFullYear();
  const sommer = utcMs >= letzterSonntag01Utc(j, 3) && utcMs < letzterSonntag01Utc(j, 10);
  const lokal = new Date(utcMs + (sommer ? 2 : 1) * 3_600_000);
  return {
    tag: tag(lokal.getUTCFullYear(), lokal.getUTCMonth() + 1, lokal.getUTCDate()),
    stunde: lokal.getUTCHours(),
    minute: lokal.getUTCMinutes(),
  };
}

/** Ostersonntag (gregorianisch, Gauß/Anonymus). */
export function ostern(j) {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), t = ((h + l - 7 * m + 114) % 31) + 1;
  return tag(j, monat, t);
}

/** Gesetzliche Feiertage in Schleswig-Holstein. */
export function feiertag(ms) {
  const d = new Date(ms);
  const j = d.getUTCFullYear(), m = d.getUTCMonth() + 1, t = d.getUTCDate();
  const fest = [[1, 1], [5, 1], [10, 3], [10, 31], [12, 25], [12, 26]];
  if (fest.some(([fm, ft]) => fm === m && ft === t)) return true;
  const o = ostern(j);
  return [-2, 1, 39, 50].some((v) => o + v * TAG_MS === ms);
}

/** Rhythmus prüfen und mit dem Standard auffüllen; Unsinn fällt auf den Standard zurück. */
export function wocheLesen(roh) {
  const w = { ...WOCHE_STANDARD, ...(roh && typeof roh === "object" ? roh : {}) };
  const ganz = (x, von, bis) => Number.isInteger(x) && x >= von && x <= bis;
  if (!ganz(w.schluss_tag, 1, 7) || !ganz(w.abhol_tag, 1, 7) || !ganz(w.route_tag, 1, 7) || !ganz(w.schluss_stunde, 0, 23)
    || !(w.schluss_tag < w.abhol_tag && w.abhol_tag <= w.route_tag)) {
    return { ...WOCHE_STANDARD, pausen: pausenLesen(w.pausen) };
  }
  return {
    schluss_tag: w.schluss_tag, schluss_stunde: w.schluss_stunde, abhol_tag: w.abhol_tag, route_tag: w.route_tag,
    abhol_ab: String(w.abhol_ab ?? "").slice(0, 40), route_zeit: String(w.route_zeit ?? "").slice(0, 40),
    pausen: pausenLesen(w.pausen),
  };
}

function pausenLesen(liste) {
  return (Array.isArray(liste) ? liste : [])
    .map((p) => ({ von: ausIso(p?.von), bis: ausIso(p?.bis), grund: typeof p?.grund === "string" ? p.grund.slice(0, 80) : "" }))
    .filter((p) => p.von !== null && p.bis !== null && p.von <= p.bis)
    .slice(0, 50)
    .map((p) => ({ von: isoTag(p.von), bis: isoTag(p.bis), grund: p.grund }));
}

/**
 * Liefer-Woche einer Bestellung zum Zeitpunkt `jetztMs` (UTC).
 * `wunsch` (optional, "JJJJ-MM-TT"): die gewünschte Woche (Spec 2026-09-23-kaufseite-schaerfen § 3) – gesucht wird ab
 * der späteren von frühester und gewünschter Woche; ein Wunsch vor dem Bestellschluss ändert nichts.
 * → { bestellschluss, abholung, route, uebersprungen, grund } – Tage als "JJJJ-MM-TT"; `grund` des ersten
 *   übersprungenen Termins: "feiertag" | "pause" | null. Nach 52 Wochen ohne Termin: abholung/route = null.
 */
export function liefertermin(jetztMs, wocheRoh, wunsch = null) {
  const w = wocheLesen(wocheRoh);
  const pausen = w.pausen.map((p) => ({ von: ausIso(p.von), bis: ausIso(p.bis) }));
  const in_pause = (ms) => pausen.some((p) => ms >= p.von && ms <= p.bis);
  const b = berlin(jetztMs);
  let montag = b.tag - (wochentag(b.tag) - 1) * TAG_MS;
  const vorSchluss = wochentag(b.tag) < w.schluss_tag || (wochentag(b.tag) === w.schluss_tag && b.stunde < w.schluss_stunde);
  if (!vorSchluss) montag += 7 * TAG_MS;
  const w0 = ausIso(wunsch);
  if (w0 !== null) montag = Math.max(montag, montagVon(w0));
  let grund = null;
  for (let k = 0; k < WOCHEN_MAX; k++, montag += 7 * TAG_MS) {
    let abholung = montag + (w.abhol_tag - 1) * TAG_MS;
    let route = montag + (w.route_tag - 1) * TAG_MS;
    const fa = feiertag(abholung), fr = feiertag(route);
    if ((fa && fr) || (abholung === route && fa)) {
      grund ??= "feiertag";
      continue;
    }
    if (fa) abholung = route;
    if (fr) route = abholung;
    if (in_pause(abholung) || in_pause(route)) {
      grund ??= "pause";
      continue;
    }
    return {
      bestellschluss: isoTag(montag + (w.schluss_tag - 1) * TAG_MS), abholung: isoTag(abholung), route: isoTag(route),
      uebersprungen: k, grund,
    };
  }
  return { bestellschluss: null, abholung: null, route: null, uebersprungen: WOCHEN_MAX, grund };
}

/** So viele Wochen darf man im Voraus wählen (Spec 2026-09-23-kaufseite-schaerfen § 3; der Worker prüft 9). */
export const WAHL_WOCHEN = 8;

/**
 * Die nächsten `n` möglichen Termine zum Auswählen, jeweils mit `montag` der Woche (Pausen und ausgefallene Wochen
 * fehlen). Der erste ist der früheste.
 */
export function wochenWahl(jetztMs, wocheRoh, n = WAHL_WOCHEN) {
  const aus = [];
  let wunsch = null;
  for (let i = 0; i < n; i++) {
    const t = liefertermin(jetztMs, wocheRoh, wunsch);
    if (!t.abholung) break;
    const montag = montagVon(ausIso(t.bestellschluss));
    aus.push({ ...t, montag: isoTag(montag) });
    wunsch = isoTag(montag + 7 * TAG_MS);
  }
  return aus;
}

const TAGE = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** "2026-10-02" → „Freitag, 2. Oktober“. */
export function tagText(iso) {
  const ms = ausIso(iso);
  if (ms === null) return "";
  const d = new Date(ms);
  return `${TAGE[wochentag(ms)]}, ${d.getUTCDate()}. ${MONATE[d.getUTCMonth()]}`;
}

/** Der ruhige Satz der Woche für die Seite (kein Countdown). */
export function wochenSatz(termin, wocheRoh, lieferung) {
  const w = wocheLesen(wocheRoh);
  if (!termin.abholung) return "Gerade gibt es keinen Liefertermin – schau bald wieder vorbei.";
  const schluss = `${tagText(termin.bestellschluss)}, ${w.schluss_stunde} Uhr`;
  const ab = w.abhol_ab ? `, ab ${w.abhol_ab.replace(/^ab\s+/i, "")}` : "";
  const abholen = `holst du deinen Strauß am ${tagText(termin.abholung)}${ab} ab`;
  // Verlegte Route (Feiertag): ohne die übliche Uhrzeit – die gilt nur am Routentag.
  const zeit = w.route_zeit && wochentag(ausIso(termin.route)) === w.route_tag ? ` (${w.route_zeit})` : "";
  const liefern = lieferung ? ` – oder er kommt am ${tagText(termin.route)}${zeit} zu dir` : "";
  const vorher = termin.grund === "pause" ? "Diese Woche ist Pause. " : termin.grund === "feiertag" ? "Wegen der Feiertage geht es eine Woche später weiter. " : "";
  return `${vorher}Bestellst du bis ${schluss}, ${abholen}${liefern}.`;
}

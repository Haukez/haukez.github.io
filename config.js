// Die einzige Stelle zum Einstellen (Specs docs/specs/2026-09-22-shop-seite.md S1, 2026-09-22-stripe-statt-shopify.md § 6,
// 2026-09-23-wochenatelier.md § 2.4). Solange `worker` leer ist oder ein Rechtstext fehlt, fragt die Seite nichts ab:
// mit `demo: true` zeigt sie die Vorschau (Kasse gesperrt), sonst „Der Shop öffnet bald".
window.SHOP_KONFIG = {
  /** Adresse des eigenen Cloudflare-Workers, z. B. "https://compass-backend.<name>.workers.dev". Leer = Shop zu. */
  worker: "",
  /** Vorschau mit allen Produkten (15 Sträuße und die Grußkarte) – bestellen geht darin nie (Entscheidung E2, 2026-09-23). */
  demo: true,
  /** Name und Unterzeile oben auf der Seite – wie im Entwurf des Nutzers vom 2026-09-23 (Marke offen, Konzept O9). */
  name: "Ela",
  unterzeile: "Floristik aus Heide",
  /**
   * Rhythmus der Woche, solange der Worker keinen liefert (Compass sendet ihn unter Aufträge › Diese Woche).
   * Wochentage 1 = Montag … 7 = Sonntag. Leer = Standard: Bestellschluss Mittwoch 12 Uhr, Abholung Freitag ab 17 Uhr,
   * Route Samstag 9 bis 12 Uhr.
   */
  woche: {},
  /** Nur für die Vorschau: Preise in Cent (im Shop kommen sie aus Stripe). */
  preise: { S: 2900, M: 3900, L: 5500 },
  /**
   * Ergänzungen nach dem Strauß („Mach es noch persönlicher"): "karte" (Grußkarte). "vase" ist vorbereitet und bleibt
   * aus, bis Ela Vasen führt – dann hier ergänzen und in Compass anlegen.
   */
  extras: ["karte"],
  /** Nur für die Vorschau: gibt es Lieferung? (Im Shop entscheidet der Worker über SHOP_LIEFERUNG.) */
  lieferung: true,
  /**
   * Nur für die Vorschau: Lieferpreis in Cent, z. B. 500. null = noch offen – dann nennt die Seite keinen Betrag.
   * Im Shop kommt er aus SHOP_LIEFERUNG im Worker.
   */
  lieferpreis: null,
  /** Sätze zu Abholung und Liefergebiet – leer = die ruhigen Standardsätze. `abholung` erscheint auch im Fuß. */
  abholung: "",
  liefergebiet: "",
  /**
   * Kontakt im Fuß und in der Bestätigung – leer = nicht gezeigt (nichts erfinden).
   * `whatsapp`: Nummer international, z. B. "+49 170 1234567" – dann können Kundinnen per WhatsApp ein individuelles
   * Angebot anfragen (Anlass-Seite, Vorschlag, Produkt, Fuß), auch in der Vorschau. Leer = kein WhatsApp-Knopf.
   */
  // TESTNUMMER (Nutzer 2026-09-23: „lass die testnummer drin“) – vor dem Start durch die echte Nummer ersetzen.
  kontakt: { email: "", telefon: "", whatsapp: "+49 170 0000000" },
  /**
   * Ela auf der Startseite: ein eigenes Foto (Datei neben dieser, z. B. "ela.jpg") und drei Zeilen von ihr. Erst wenn
   * beides gesetzt ist, erscheint der Abschnitt (Spec 2026-09-23-kaufseite-schaerfen § 2).
   */
  ela: { foto: "", text: "" },
  /**
   * Rechtstexte – eigene Seiten neben dieser (z. B. "impressum.html") oder https-Adressen. Stripe liefert keine.
   * Erst wenn alle fünf gesetzt sind, öffnet der Shop.
   */
  rechtliches: { impressum: "", datenschutz: "", agb: "", widerruf: "", versand: "" },
};

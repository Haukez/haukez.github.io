// Die einzige Stelle zum Einstellen (Specs docs/specs/2026-09-22-shop-seite.md S1, 2026-09-22-stripe-statt-shopify.md § 6).
// Solange `worker` leer ist oder ein Rechtstext fehlt, zeigt die Seite „Der Shop öffnet bald" und fragt nichts ab.
window.SHOP_KONFIG = {
  /** Adresse des eigenen Cloudflare-Workers, z. B. "https://compass-backend.<name>.workers.dev". Leer = Shop zu. */
  worker: "",
  /** Name und Unterzeile oben auf der Seite. */
  name: "Floristik Heide",
  unterzeile: "Sträuße und Gestecke, mit Liebe gebunden",
  /**
   * Rechtstexte – eigene Seiten neben dieser (z. B. "impressum.html") oder https-Adressen. Stripe liefert keine.
   * Erst wenn alle fünf gesetzt sind, öffnet der Shop.
   */
  rechtliches: { impressum: "", datenschutz: "", agb: "", widerruf: "", versand: "" },
};

# Kaufseite (GitHub Pages + Stripe)

Eine statische Seite ohne Build und ohne Abhängigkeit. Den Katalog liefert der eigene Cloudflare-Worker
(`../cloudflare`) aus Stripe. Der Warenkorb liegt im Browser. „Zur Kasse" schickt nur Price-IDs und Mengen an den
Worker, bezahlt wird in Stripes Checkout. Die Bestellung kommt über den Online-Eingang in Compass an.

Specs: [`../docs/specs/2026-09-22-shop-seite.md`](../docs/specs/2026-09-22-shop-seite.md) (Seite),
[`../docs/specs/2026-09-22-stripe-statt-shopify.md`](../docs/specs/2026-09-22-stripe-statt-shopify.md) (Stripe) und
[`../docs/specs/2026-09-23-wochenatelier.md`](../docs/specs/2026-09-23-wochenatelier.md) (Wochenseite, Demo).

**Geführte Kaufseite** ([Spec](../docs/specs/2026-09-23-gefuehrte-kaufseite.md)): Anlass → Absicht → Gefühl → Größe
der Geste → eine florale Antwort mit höchstens zwei Alternativen → „Mach es noch persönlicher" (Grußkarte). Nebenweg
„Ich weiß schon, was ich möchte". Die Dateien:
- `beratung.js`: Anlasswelten, Absichten, Namen, Ergebnis.
- `sortiment.js`: 5 Gefühle × 3 Größen, Ergänzungen.
- `zeichnung.js`: Zeichnungen statt Fotos.
- `woche.js`: der Liefertermin nach derselben Regel wie Compass.

Gefühl und Größe kommen im Shop aus den Stripe-Metadaten (`stil`, `groesse`; Ergänzungen `stil` = `extra`),
Rhythmus und Pausen vom Worker (Compass sendet sie). Ware wird nur mit echten Fotos gezeigt, sonst mit einer
gekennzeichneten Zeichnung. Keine `style`-Attribute im HTML (CSP) – Farben setzt `app.js` über das CSSOM.

**Demo:** `demo: true` in `config.js` zeigt ohne Worker alle 15 Sträuße und die Grußkarte als gekennzeichnete Vorschau.
Der Warenkorb geht, die Kasse ist gesperrt und fragt nichts ab. Die Vase ist vorbereitet: `extras: ["karte", "vase"]`.

## Ansehen, ohne etwas zu veröffentlichen

```bash
python -m http.server 4321 --directory shop
```

- `http://localhost:4321/` zeigt mit `demo: true` die Vorschau (ohne: „Der Shop öffnet bald") und fragt nichts ab.
- `http://localhost:4321/?vorschau=http://127.0.0.1:8788` nutzt einen lokalen Worker, z. B. `cloudflare/lokal/server.ts`
  gegen den nachgebauten Stripe (siehe `../cloudflare/README.md`). Es wird nichts echt bezahlt.

## Vor dem Start (in dieser Reihenfolge)

1. Stripe-Konto anlegen, zuerst im Testmodus. Produkte legst du in Compass an: Mein Unternehmen › Shop.
2. Worker einrichten: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SHOP_URL`, `ALLOWED_ORIGINS` und nach Wunsch
   `SHOP_LIEFERUNG` (siehe `../cloudflare/README.md`).
3. Die fünf Rechtstexte als eigene Seiten anlegen (Impressum, Datenschutz, AGB, Widerruf, Versand & Abholung) und in
   `config.js` unter `rechtliches` eintragen. Stripe liefert keine Rechtstexte. Ohne alle fünf bleibt die Seite auf
   „bald". Die Texte selbst sind keine Rechtsberatung.
4. In `config.js` die Adresse des Workers unter `worker` eintragen und Name und Unterzeile prüfen. Dazu nach Wunsch:
   - `kontakt` (E-Mail, Telefon) für den Fuß und die Bestätigung,
   - `abholung` (der Abholort),
   - `ela` (eigenes Foto und drei Zeilen für die Startseite).
   Leer bleibt der jeweilige Teil unsichtbar.
   - `kontakt.whatsapp` (international, z. B. „+49 170 …“): Dann erscheint „Etwas ganz Eigenes? Per WhatsApp
     schreiben“ auf der Anlass-Seite, beim Vorschlag, auf der Produktseite und im Fuß, auch in der Vorschau. Der Link
     öffnet WhatsApp mit einer vorbereiteten Nachricht (Anlass, Botschaft, Strauß, Termin). Die Seite selbst schickt
     nichts. In die Datenschutzerklärung gehört ein Satz zu WhatsApp (Meta), sobald die Nummer eingetragen ist.
5. In `index.html` die Zeile `<meta name="robots" content="noindex">` entfernen und `robots.txt` auf `Allow: /`
   stellen. Mit eigener Domain `og:image` in `index.html` auf die neue Adresse umstellen.
6. Offen, zu prüfen: Stripe beschriftet den Bestellknopf mit „Kaufen". Ob das der Button-Lösung (§ 312j Abs. 3 BGB)
   genügt, ist ungeklärt (Stripe-Spec O1).
7. Das neue öffentliche Repo anlegen, **nur mit Freigabe**. Den Inhalt dieses Ordners als Wurzel pushen und unter
   Settings › Pages „GitHub Actions" wählen. Der Workflow `.github/workflows/pages.yml` veröffentlicht dann bei jedem
   Push auf `main`.

Schriften: Allura, Cormorant Garamond und Source Serif 4 liegen lokal in `fonts/` (SIL OFL, Lizenztexte daneben). Es
gibt keinen Abruf bei Google. `inter-latin-wght-normal.woff2` liegt noch dort, wird aber von `styles.css` nicht
geladen.

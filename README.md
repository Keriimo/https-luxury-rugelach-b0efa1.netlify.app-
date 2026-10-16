# MarktRadar 5.2 — Cloudflare Free (kein kostenpflichtiges Abo)

## MarktRadar 5.2 – Neues Vertriebs-Dashboard

Die Benutzeroberfläche kann jetzt unmittelbar im Browser angepasst werden: oben rechts **Darstellung anpassen** auswählen und Marke, Überschrift, Untertitel sowie Rot-/Dunkelblau-Farben verändern. Die Darstellung wird **nur auf diesem Gerät** gespeichert und beeinflusst den Scanner nicht. Es ist kein offizielles Unternehmensdesign oder eine offizielle LaminatDEPOT-Anwendung.

**Preisradar:** Die vier Übersichts-Karten zeigen die günstigsten **tatsächlich erfassten** Preise für Laminat, Vinyl, Parkett und Stückpreise für Zubehör. Darunter sieht man die Abdeckung der €/m²-Daten je ausgewähltem Shop. Ohne Preis wird „Noch kein Preis“ statt einer Zahl angezeigt.

**Vergleich:** Automatische technische Alternativen erfordern mindestens zwei übereinstimmende Merkmale. Auch ohne €/m²-Preis werden Vorschläge angezeigt, aber **kein Preisvorteil berechnet**. In der Produktliste können zwei Produkte über **Vergleichen** manuell ausgewählt werden, unabhängig davon, ob Preise vorhanden sind. Solche Gegenüberstellungen sind keine Gleichwertigkeitsbescheinigung.

**Geschwindigkeit:** **Schnellscan** bearbeitet pro Shop eine kurze Etappe und zeigt bereits gespeicherte Ergebnisse. **Scan vertiefen / fortsetzen** holt in weiteren Etappen zusätzliche Daten. Bei kostenlosen Kontingenten und Shop-Sperren kann die Erfassung weiterhin unvollständig bleiben.

Der Cloudflare-Scanner und die Worker-Routen wurden bei diesem Frontend-Upgrade unverändert übernommen. Die Kataloge liegen weiterhin unter `marktradar:catalog:v3` im Browserspeicher. Die automatische Release-Prüfung enthält `tests/ui.test.cjs` für Browser-Oberfläche, Katalogerhalt und Vergleich ohne fehlende Preise.


## Stand 5.2

Der Cloudflare-Scanner nutzt öffentliche Shopify-Kataloge, Produktseiten und Sitemaps (auch Hinweise aus `robots.txt`). Scans laufen in kleinen Etappen und können fortgesetzt werden. Shop-Sperren, Gratislimits, veraltete Preise und fehlende Daten werden sichtbar gekennzeichnet.

**Wichtig:** Eine neue GitHub-Version ist erst nach erfolgreichem Cloudflare-Deployment live. GitHub-Commits allein ändern keine bereits veröffentlichte Webseite. Falls automatische Deployments ausbleiben, kann der konfigurierte `CLOUDFLARE_DEPLOY_HOOK` über den GitHub-Actions-Workflow den nächsten Cloudflare-Build anfordern.

Die Browserdaten der alten Netlify-Domain werden **nicht** automatisch auf die neue Cloudflare-Domain übertragen. Die Webseite ist ohne Anmeldung benutzbar, Daten verschiedener Kollegen werden aber nicht automatisch synchronisiert. Nutze bei Bedarf „Gefilterte Tabelle kopieren“, um Ergebnisse ohne Download in Excel Online einzufügen.


Die bisherige Netlify-Version bleibt wegen ausgeschöpfter Gratis-Credits auf dem letzten veröffentlichten Stand. Für neue Veröffentlichungen ist **Cloudflare Pages Free** vorgesehen.

**[Anleitung für die Cloudflare-Einrichtung](./CLOUDFLARE_FREE_SETUP.md)** – vollständig im Browser, keine lokale Installation und keine kostenpflichtige KI.

Die neue kostenlose Web-App nutzt `functions/api/catalog.js`, `_routes.json` und `build-cloudflare.sh`. Bitte für neue Nutzung **nicht** mehr die alte Netlify-Adresse verwenden. Die neue Adresse entsteht nach der einmaligen Cloudflare-Verknüpfung mit diesem GitHub-Projekt.

---

# MarktRadar – Wettbewerbsanalyse Bodenbeläge

Web-App für einen Vergleich öffentlich zugänglicher Bodenbelag-Angebote. Keine lokale Installation erforderlich.

## Bedienung

1. Webseite öffnen: https://luxury-rugelach-b0efa1.netlify.app/
2. Namen und HTTPS-Adresse eines Bodenbelag-Onlineshops eintragen und auf **Shop hinzufügen** klicken.
3. Shops über die Auswahlkästchen aktivieren. Es lassen sich auch nur zwei Shops vergleichen.
4. **Ausgewählte Shops prüfen / fortsetzen** startet die Erfassung oder führt eine abgebrochene Suche weiter.
5. Über Produktname, Kategorie, Top 10/20/50 und Werbepreis filtern. Der technische Vergleich zeigt Preis- und Merkmalsunterschiede.

## Was automatisch erkannt wird

Katalog- und Produktseiten über Sitemaps, Shop-Navigation, allgemeine HTML-Muster und bei Shopify gegebenenfalls den öffentlichen JSON-Katalog. Produktangaben aus JSON-LD, Preisen mit expliziter €/m²-Einheit oder Preisen mit nachvollziehbarer Paketfläche.

Erkannte Kategorien: Laminat, Vinyl, Parkett, Bioboden/Kork, Teppich, PVC, andere Bodenbeläge und Zubehör. Technische Attribute wie Stärke, Nutzschicht, Nutzungsklasse und Abriebklasse werden übernommen, wenn vorhanden.

## Grenzen und Datenqualität

- **Keine Garantie auf alle Produkte**: Manche Shops blockieren Bots, liefern Daten nur nach Anmeldung oder laden ihre Produktseiten dynamisch nach. Die Erfassung erfolgt etappenweise und kann fortgesetzt werden.
- **Kein bestätigter Produktgleichstand**: Technische Vergleiche sind Vorschläge, keine Gleichwertigkeitsbescheinigungen. Produktdaten im Originalshop prüfen.
- **Keine Preis-Schätzung**: Ohne gesicherten Quadratmeterpreis bleibt das Preisfeld leer; Stück- und Paketpreise dürfen nicht fälschlich als €/m² gelten.
- **Aktionshinweis statt erfundener Rabatt**: Prozentwerte nur bei einem erkannten Bezug auf dieselbe Einheit.
- **Speicherung im Browser**: Shopliste, Preise und Fortschritt liegen bevorzugt in IndexedDB auf dem jeweiligen Gerät. Andere Mitarbeiter sehen diese Daten **nicht automatisch synchronisiert**.
- **Keine externe KI**: Die Zuordnung arbeitet derzeit regelbasiert; eine kostenpflichtige KI-Anbindung ist nicht nötig.
- **Betrieb über Netlify Functions**: Es fallen keine Installationen auf dem Firmenrechner an. Aufrufe zählen zum Netlify-Kontingent; kostenlose Kontingente und Grenzen des Anbieters beachten.
- **Datenschutz**: Nur öffentliche Produktdaten verwenden. Das GitHub-Repository ist öffentlich; dort keine vertraulichen internen Firmendaten oder API-Schlüssel veröffentlichen.

## Technik / Qualität

Die Website besteht aus `index.html` und `app.js`. Der generische Scanner liegt unter `netlify/functions/catalog.js`, die Legacy-Funktion bleibt unter `scan.js`. `netlify.toml` enthält den Build. Regressionstests in `tests/catalog.test.js` und GitHub Actions prüfen die Erkennung wichtiger Eigenschaften und ungültiger Adressen.

## Sicherheit

Der Scanner lässt nur HTTPS-Adressen des hinzugefügten Shops zu und versucht, DNS-Auflösungen auf öffentlich geroutete IP-Adressen zu begrenzen. Redirects auf andere Domains werden abgewiesen; Abrufe sind in Größe, Zeit und Umfang begrenzt. Kein öffentlich zugänglicher Crawler kann trotzdem den vollständigen Schutz einer verwalteten Unternehmenslösung ersetzen. Beim Einsatz mit vielen Nutzern: Zugriffsschutz, Kostenlimits und Shop-Nutzungsregeln prüfen.

# MarktRadar 5.9 — Cloudflare Free (kein kostenpflichtiges Abo)

## MarktRadar 5.9 – Automatikmodus, genaue Bodenfilter und Designstudio

**Automatischer Produktabgleich (kostenlos):** Standardmäßig ist „Automatische Produktprüfung“ aktiviert. Nach dem Laden des lokalen Katalogs beginnt bei einem geöffneten, sichtbaren Browser-Tab selbstständig eine Prüfetappe, wenn noch offene Shop-Aufgaben vorliegen oder der letzte Shopscan älter als 24 Stunden ist. Die automatische Wiederholung lässt sich auf 30 Minuten, 60 Minuten oder 3 Stunden einstellen oder per Checkbox deaktivieren. Die Einstellung wird getrennt vom Produktkatalog unter `marktradar:auto:v1` gespeichert.

**Sicherheit bei automatischen Abrufen:** Bereits laufende Scans werden nicht doppelt gestartet. Ein kooperativer Browser-Tab-Sperrvermerk soll gleichzeitige automatische Scans mehrerer Tabs vermeiden. Blockierte Shops haben eine Abkühlphase von drei Stunden. Eine automatische Prüfetappe bleibt auf maximal 3,5 Minuten begrenzt und unterliegt dem bestehenden Tagesbudget. Offene Aufgaben werden später fortgesetzt. Der Scanner **arbeitet nicht weiter, wenn der Browser geschlossen oder der Tab unsichtbar ist**. Ein echter rund um die Uhr arbeitender Server-Scan würde eigene zentrale Speicherung und Cloudflare-Zeitpläne erfordern.

**Dämmung und Zubehör zuverlässig ausschließen:** Auch frühere falsch als „Laminat“ gespeicherte Produkte mit Namen wie „Trittschalldämmung für Laminat“, „Unterlage für Laminat“ oder „Dämmmatte Vinyl“ werden aus Produktliste, Kennzahlen und Vergleich entfernt, ohne die alte Browser-Datenbank zu löschen. Die Backend-Erkennung ignoriert solche Produktkarten, URLs und Detailseiten. Tatsächliche Bodenbeläge mit ausdrücklich beigelegter Dämmung bleiben zulässig. Weiterhin nur Laminat, Vinyl/Rigid-Vinyl und Parkett.

**Designstudio erweitert:** Zusätzlich zu eigenem Logo, Überschrift, Untertitel und Beschriftungen jetzt frei wählbare Karten- und Rahmenfarben, Schriftfamilie, Schriftgröße, Abstände, Kartenradien, Seitenbreite, Kartenschatten und vier Designvorlagen. Vorschau anzeigen, speichern oder über JSON importieren/exportieren. **„Logo sofort entfernen“** löscht das gespeicherte Logo per Klick und bleibt auch nach Aktualisieren der Seite wirksam. Das Design bleibt unabhängig von Scanner- und Produktdaten und gilt ohne Import nur im aktuellen Browser.

**Zuverlässigere Wiederaufnahme:** Neue Scan-Warteschlangen und gespeicherte Zwischenstände verwenden dieselbe Scanner-Engine-Version. Dadurch soll die Prüfung die offenen Seiten fortsetzen, statt bei jeder Etappe erneut am Kataloganfang zu starten.

**Grenzen:** Der Automatikmodus garantiert weder eine vollständige Kopie fremder Shops noch Preise, die nur per JavaScript zugänglich sind oder durch Zugriffsbeschränkungen geschützt werden. Erforderliche externe Zugriffserlaubnisse und kostenlose Cloudflare-Kontingente werden nicht umgangen.


## MarktRadar 5.8 – Bodenarten-Bestpreise, volle Produktliste und Vergleichsstart

- **Drei Bestpreis-Kennzahlen anstelle der alten Zahlenkarten:** Laminat, Vinyl/Rigid-Vinyl und Parkett mit niedrigstem **erfasstem €/m²-Preis**, Angebotslink und zugehörigem Shop. Fehlt ein verifizierbarer Preis, erscheint keine erfundene Zahl.
- **Standard „Alle erfassten · alle Shops“:** Nicht länger nur Top 20; alle vorhandenen Bodenprodukte werden angezeigt und nach Kategorie/Suchbegriff gefiltert. Die bisherige maximale Vorschau von 300 Artikeloptionen im 2-Produkte-Vergleich wurde entfernt.
- **2-Produkte-Check:** Links und rechts jeweils Shop und konkreten Artikel wählen, dann **„Jetzt beide Produkte vergleichen“** anklicken. Die technische Gegenüberstellung enthält Produkt, Bodenart, Marke, Artikelnummer, Stärke, Nutzschicht, NK/AC und Preise, sofern erfasst. Fehlt ein Preis, findet die technische Gegenüberstellung dennoch statt; der Preisvorteil bleibt unbekannt.
- **Katalogsuche Laminat DEPOT:** Die öffentlich verfügbaren Verzeichnisse `/alleboeden`, `/laminat`, `/vinylboeden` und `/parkett` werden beim neuen Scan ausdrücklich als Startseiten genutzt. Erkennbare Pagination mit deutschen Linkbezeichnungen wird verfolgt. Die gespeicherte Scan-Warteschlange wird aufgrund des Engine-Wechsels auf v8 erneuert, ohne bereits erfasste Artikel zu löschen.
- **Keine Zubehörartikel:** Nach wie vor nur Laminat, Vinyl/Rigid-Vinyl und Parkett. Schon anhand des Links erkennbare Leisten, Trittschalldämmung und Kleber werden nicht eigens abgerufen. Historisch gespeicherte andere Produkte bleiben unverändert archiviert, werden aber nicht angezeigt.
- **Browserressourcen:** Bei großen Tabellen wird während langer Scans nur periodisch die Benutzeroberfläche aktualisiert, während Zwischenergebnisse weiterhin gespeichert werden. Die lokale Ersatzsicherung reduziert die Produktzahl nicht mehr heimlich auf 500; sie hängt weiterhin vom Browser-Speicherplatz ab, die vollständige Speicherung erfolgt bevorzugt in IndexedDB.
- **Grenzen:** „Alle erfassten“ bedeutet alle gefundenen Daten, nicht die vollständige Produktpalette jedes externen Shops. Offene Aufgaben, Zugriffssperren und kostenlose Abrufkontingente müssen weiterhin ausdrücklich berücksichtigt werden.


## MarktRadar 5.7 – Transparenter Vergleich, Shop-Mix & Designstudio

- **Nur Bodenbeläge:** Laminat, Vinyl/Rigid-Vinyl und Parkett. Fuß-/Sockelleisten und sämtliches andere Zubehör sind wieder vollständig aus Scan, Filtern und Dashboard entfernt. Bereits gespeicherte Rohdaten bleiben im Browser erhalten, damit kein unbeabsichtigter Datenverlust entsteht.
- **Preisradar zeigt alle aktiven Shops:** Ein Shop ohne automatisch erkannte €/m²-Preise (z. B. Laminat DEPOT) wird **nicht ausgeblendet**. Stattdessen zeigt die jeweilige Zelle die Produktanzahl, „Noch kein geprüfter €/m²-Preis“ und einen Originalprodukt-Link. Technisch unterschiedliche Kategorie-Bestpreise werden nicht als direkte Gleichwertigkeit ausgegeben.
- **Direkter 2-Produkte-Vergleich:** Separate Shopauswahl links/rechts mit Suchfeldern und Artikelwählern; auch Produkte ohne Preise können nebeneinander anhand der vorhandenen technischen Eigenschaften geprüft werden.
- **Preis nach Originalprüfung ergänzen:** Pro Artikel kann der Nutzer nach Öffnen des Originalshops einen überprüften €/m²-Preis per Dialog eintragen. Der Eintrag ist als manuell markiert, wird datiert im bisherigen Browser-Katalog `marktradar:catalog:v3` gespeichert und ist eine **Angabe des Nutzers**, keine Bestätigung durch den automatischen Scanner. Ungültige/abgebrochene Eingaben werden nicht übernommen.
- **Shop-Mix Standard:** Die ersten Treffer in „Alle Produkte“ wechseln zwischen aktiven Shops, damit Anbieter ohne maschinell erkannte Preise nicht hinter allen Artikeln anderer Anbieter verschwinden. „Günstigste zuerst“ bleibt als auswählbare Sortierung verfügbar.
- **Designstudio:** Individuelle Überschrift, Markenzeile, Untertitel, Beschreibung der Preisübersicht, Reitertexte, vier benutzerdefinierte Farben und ein eigenes **PNG/JPG/WebP-Logo bis 200 KB**. Speicherung erfolgt ausschließlich in diesem Browser, unabhängig vom Scanner. Design per JSON exportieren/importieren, um es ohne Benutzerkonto auf einem anderen Gerät zu verwenden.
- **Weiterhin unverändert:** Cloudflare Worker-Route `/api/catalog`, Cloudflare-Gratisbetrieb, bestehende Shop-URLs und Browser-Datenbank-Schema. Vollständige Live-Abdeckung beider Shops und fehlerfreie automatische €/m²-Erkennung können ohne erfolgreich ausgeführten Live-Scan nicht zugesichert werden.


## MarktRadar 5.6 – Bodenbeläge und Fuß-/Sockelleisten

- **Einzige Produktgruppen:** Laminat, Vinyl/Rigid-Vinyl, Parkett und **Fuß-/Sockelleisten** (eigene Kategorie „Leisten“).
- Andere Zubehörprodukte wie Trittschalldämmung, Unterlagen, Montagekleber, Reinigungsmittel und Übergangsprofile werden weder als Leisten ausgezeichnet noch in den Produktlisten und Auswertungen angezeigt. Gleiches gilt weiterhin für Teppichboden, PVC, Bioboden und Kork.
- Der Scanner erkennt Sockelleisten und Fußleisten in Produktnamen, SEO-Produktlinks und zugehörigen Kategorien. Zubehör-Kategorieseiten können als Wegweiser dienen, aber irrelevante Artikel werden ausgeschlossen.
- **Kein Einheiten-Mix:** Bodenpreise je m²; Leistenpreise nur bei eindeutig ausgewiesener Einheit **€/laufendem Meter** oder **€/Stück**. Ohne klare Einheit bleibt der Leistenpreis unbekannt. Das Preisduell führt €/m und €/Stück in getrennten Reihen.
- Frühere als „Zubehör“ gespeicherte Leisten werden anhand ihres Produktnamens als „Leisten“ behandelt, ohne bestehende Bodenbelag-Daten oder Shop-Links zu löschen.
- Browser-Datenbank und Cloudflare-Worker bleiben unverändert; der Scan übernimmt mit der Versionsaktualisierung die neue Kategorie-Warteschlange.


## Version 5.5 – Vollscan und echte Laminat-DEPOT-Preise

- **Erneutes Prüfen früherer Nullpreise:** Vorhandene Laminat-/Vinyl-/Parkett-Artikel ohne geprüften €/m²-Preis kommen nach dem Upgrade wieder in die Prüfwarteschlange. Gespeicherte Shop- und Produktdaten bleiben unverändert.
- **Produktkarten:** Aktuelle „Komplett-Set XX,XX €/m²“-Preise auf Laminat-DEPOT-Kategorieseiten werden auch erkannt, wenn der Betrag außerhalb des Produktlinks in einem benachbarten HTML-Element steht. Der Scanner begrenzt diese Zuordnung bis vor das nächste andere Produkt, um Preise nicht zu verwechseln. Katalogkartenpreise sind als vorläufig markiert.
- **Shopify-Fehler:** products.json wird nur bei Anzeichen für Shopify geprüft. Ein nicht zugänglicher optionaler Shopify-Feed beendet nicht die reguläre Produktseiten-Erfassung.
- **Vollscan:** Über **Alle offenen Aufgaben automatisch prüfen** verarbeitet der Browser mehrere Scan-Etappen, bis keine erreichbaren Aufgaben übrig sind, ein Shop blockiert, das Gratis-Kontingent erreicht ist, der Benutzer stoppt oder das Sicherheitslimit von **15 Minuten pro Sitzung** erreicht wird. Browser-Tab geöffnet lassen. Fehlgeschlagene Produktabrufe werden begrenzt wiederholt und anschließend als nicht prüfbar markiert; sie gelten nicht als erfolgreich geprüft.
- **Kein Vollständigkeitsversprechen:** Ein tatsächlicher Gesamtabgleich ist nur nach bestätigter Erreichbarkeit, zugänglichem vollständigem Shop-Katalog und ohne offene/fehlgeschlagene Aufgaben möglich. Cloudflare-Free-Kontingente, Blockaden, JavaScript-only-Preise und Shop-Rechte werden nicht umgangen. Der Worker arbeitet nicht automatisch weiter, wenn die Seite geschlossen wird.


## MarktRadar 5.4 – Sortiment & Preise (Oktober 2026)

- Es werden ausschließlich **Laminat**, **Vinyl einschließlich Rigid-Vinyl/SPC/LVT** sowie **Parkett** ausgelesen und angezeigt. Bioboden, Teppich, PVC, Kork, Zubehör und sonstige Bodenarten entfallen aus Erkennung, Dashboard, Preisduell, Filter und neuer Erfassung.
- Der Laminat-DEPOT-Parser priorisiert **Komplettpreis €/m²** und **Bodenpreis €/m²**, statt Streichpreise, Dämmungs- oder Paketpreise mit dem Verkaufspreis zu verwechseln. Ausgewiesene alte Komplettpreise werden nur bei eindeutig höherem €/m²-Preis als Vergleichspreis übernommen. Unklare Preise bleiben unbekannt.
- Größere Shops: Kataloglisten bis zu 2.500 Links und 500-URL-Sitemap-Seiten, bis zu 100 Seiten eines öffentlichen Shopify-Katalogs. Der selbst gesetzte Browser-Grenzwert beträgt nun **1.000 Scan-API-Anfragen pro UTC-Tag**. Cloudflare-Free-Kontingent und Shop-Zugriffsbeschränkungen bleiben davon unabhängig bestehen.
- **Scan vertiefen:** Mehrere Prüfetappen pro Klick, mit einem globalen Zeitlimit von 210 Sekunden. Weitere offene Aufgaben sind am nächsten Klick fortsetzbar. Den Browser-Tab währenddessen geöffnet lassen.
- Bereits gespeicherte Shop- und Produktdaten bleiben unter dem bekannten Browserschlüssel `marktradar:catalog:v3` verfügbar. Frühere nicht unterstützte Produktarten werden aus der Anzeige gefiltert.
- Der Browser nutzt weiterhin IndexedDB für vollständige Kataloge; die lokale Ersatzsicherung schneidet nicht mehr schon früh auf 60 Produkte ab. Ein Regressionstest prüft 340 Produkte ohne IndexedDB.
- **Keine Vollständigkeitsgarantie:** Keine öffentlich zugängliche Lösung kann garantieren, dass alle Artikel und aktuelle Preise jeder fremden Shopseite ausgelesen werden. Angaben im MarktRadar vor Entscheidungen mit den Originalangeboten abgleichen.


## MarktRadar 5.3 – gleichmäßiger Scan und verlässliches Preisduell

- **Laminat DEPOT und alle anderen Shops:** Der Katalogscan erkennt nun auch flache Produktadressen wie `/laminat-bodomo-premium-schlossdiele-natur-100013100`. Auf Kategorie- und Listenseiten ausdrücklich am Produkt angezeigte €/m²-Preise werden sofort erfasst. Ein Preis aus der Produktliste wird sichtbar als vorläufig gekennzeichnet; Artikelquelle prüfen.
- **Faire Scan-Reihenfolge:** Jede ausgewählte Shopadresse wird mit derselben technischen Scan-Konfiguration bearbeitet; bei mehreren Shops wechseln sich die Prüfetappen ab. Die Anzahl tatsächlich auslesbarer Produkte kann trotzdem je Shop abweichen (Sitemaps, technische Zugriffe, Webseitenstruktur).
- **Alte Daten schützen:** Der bisherige Speicherschlüssel `marktradar:catalog:v3` bleibt bestehen. Veraltete Scan-Warteschlangen werden beim nächsten Scan neu aufgebaut, bereits erfasste Produkte bleiben erhalten. Es gibt keinen automatischen Datenverlust.
- **Preisduell statt automatischer Fehlzuordnung:** Der Reiter „Preisduell & 2er-Check“ zeigt je Bodenart den niedrigsten **erfassten** Preis pro Shop und den Abstand zu anderen Angeboten derselben Kategorie. **Das sind möglicherweise verschiedene Böden**, daher keine Behauptung gleicher Qualität oder Produkte. Zwei ausdrücklich ausgewählte Artikel werden weiterhin technisch gegenübergestellt; fehlende Preise werden nicht erfunden.
- **Keine Vollständigkeitsgarantie:** Allgemeine Scanregeln unterstützen viele Shops. Shops mit Bot-Schutz, JavaScript-Preisen, unzugänglichen Sitemaps oder anderen Seitentypen können weiterhin unvollständig sein.


## MarktRadar 5.2 – Neues Vertriebs-Dashboard (weiter enthalten)

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

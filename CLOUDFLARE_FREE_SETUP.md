# MarktRadar 5.5 – kostenlos bei Cloudflare Pages

**Ohne Downloads oder Installationen auf dem Firmenlaptop.** Die Veröffentlichung läuft vollständig über den Browser. Keine kostenpflichtigen APIs und keine Kreditkarte erforderlich, wenn Cloudflare die Free-Registrierung ohne Zahlungsdaten ermöglicht.

## Veröffentlichung

1. https://dash.cloudflare.com/ öffnen und ein kostenloses Cloudflare-Konto erstellen (nur einmalig für die Veröffentlichung).
2. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git / Import existing Git repository** wählen.
3. GitHub verbinden und dieses Repository auswählen: `Keriimo/https-luxury-rugelach-b0efa1.netlify.app-`.
4. Git-Branch: `main`; Framework: **None** oder **No framework**.
5. **Build command**: `sh build-cloudflare.sh`.
6. **Build output directory / Publish directory**: `dist`.
7. Speichern und veröffentlichen. Cloudflare erzeugt eine neue Adresse unter `*.pages.dev`.
8. Zum Prüfen die neue Adresse um `/api/catalog` erweitern: Es muss JSON mit `"ok":true` und `"version":"5.6.0-free"` erscheinen.
9. MarktRadar öffnen und den Button **Verbindung prüfen** klicken. Anschließend mit nur einem Shop einen kleinen Scan starten.

**Wichtig:** Die alte Netlify-Adresse wird durch die Veröffentlichung bei Cloudflare NICHT automatisch aktualisiert. Kollegen benötigen später den neuen Cloudflare-Link.

## Kostenkontrolle

- Nur **Cloudflare Workers Free** und **Cloudflare Pages Free** verwenden.
- Kein Upgrade auf Workers Paid / Pages Paid; keine Kreditkarte oder kostenpflichtige Zusatzdienste hinterlegen.
- MarktRadar hat eine lokale Obergrenze von **180 API-Anfragen pro Tag je Browser**. Die echten Gratis-Grenzen gelten **kontoweit** über sämtliche Nutzer und Projekte.
- Der Scan lädt höchstens 2 Produktseiten pro Funktion ab und verarbeitet pro Scan-Etappe begrenzte Mengen, um unnötige Anfragen zu vermeiden. Scans können manuell fortgesetzt werden.
- `_routes.json` sorgt dafür, dass statische HTML-/JS-Dateien nicht durch eine Worker-Funktion gehen. Dadurch bleiben normale Seitenaufrufe vom Worker-Verbrauch getrennt.
- Wenn Gratis-Grenzen erreicht oder andere Shops gesperrt werden, muss die Suche pausieren oder unvollständig bleiben. Bei Workers Free erfolgt keine automatische Umstellung auf ein bezahltes Abo.
- Im Dashboard ist keine kostenpflichtige KI eingebaut.

## Funktionen

- Shop-Links hinzufügen und verwalten, zwei oder viele Shops auswählen.
- Scans für Laminat, Vinyl, Parkett, Kork/Bioboden, PVC, Teppich und Zubehör über öffentlich zugängliche Kataloge, Sitemaps und Produktseiten.
- Freie Shopify-Produktfeeds verwenden, falls sie offen sind.
- Preise pro m² nur bei nachvollziehbarer Einheit anzeigen, Paketpreise nur bei bekannter Paketfläche umrechnen.
- Top 10 / 20 / 50, Suche, Werbepreis-Markierungen und technische Produktvergleiche.
- Speicherung im lokalen Browser (IndexedDB); Kollegen sehen **nicht automatisch dieselben Daten**.

## Wichtige Grenzen

Kein kostenloser Webscanner kann alle Shops zu 100 % zuverlässig auslesen. Manche Shops sperren Bots, erfordern Anmeldung oder laden Preisangaben per JavaScript. Die technische Vergleichsfunktion erzeugt Hinweise, **keine bestätigte Gleichwertigkeit**; Angebote vor Verwendung im Vertrieb prüfen.

Der Quellcode liegt in einem **öffentlichen GitHub-Repository**. Bitte hier keine geheimen internen Daten, Passwörter oder Firmenpreise hochladen. Cloudflare Pages ist ohne gesonderte Zugriffskontrolle ebenfalls öffentlich erreichbar.

## Technischer Aufbau

- `index.html` und `app.js`: Browser-Dashboard.
- `functions/api/catalog.js`: Cloudflare Pages Function für `/api/catalog`.
- `_routes.json`: Nur API-Aufrufe führen eine Funktion aus.
- `build-cloudflare.sh`: Erstellt das statische Output-Verzeichnis `dist`.
- `tests/cloudflare.test.cjs`: Code- und Extraktionsprüfungen.
- Alte `netlify/functions/*` sind nur für die vorherige Netlify-Version vorhanden und werden von Cloudflare nicht verwendet.

## Prüfen, wenn etwas nicht funktioniert

1. Cloudflare → Workers & Pages → Projekt → Deployments: **Success**?
2. Die neue `*.pages.dev/api/catalog`-Adresse liefert JSON mit `ok:true`?
3. Verbindungstest im Dashboard verwenden.
4. Falls 403/429/timeout: öffentlich zugängliche Shopseiten sind möglicherweise technisch eingeschränkt. Das ist kein Hinweis auf fehlende Produkte.

## Version 5.1.0 – Qualität und Betrieb

- Die Build-Prüfung führt JavaScript-Syntaxchecks und Cloudflare-API-Regressionstests aus. Bei Fehlern bricht das Deployment ab, statt eine kaputte Version zu veröffentlichen.
- Zum Veröffentlichen nach GitHub-Änderungen: Cloudflare-Git-Integration oder optional GitHub Actions → `MarktRadar – Cloudflare veröffentlichen`; hierfür muss `CLOUDFLARE_DEPLOY_HOOK` in GitHub Actions als Repository-Secret hinterlegt sein. Hook-Adresse niemals im Chat oder öffentlichen Code posten.
- Unter Cloudflare → Deployments muss die aktuelle GitHub-Version mit Status **Success** erscheinen. Ohne erfolgreiche Veröffentlichung ist der Code nur im Repository geändert.
- Der Scanner zeigt die Datenlage ehrlich: öffentlich nicht auslesbare oder technisch gesperrte Shops bleiben unvollständig. Das Tool garantiert keine Vollständigkeit bei beliebigen Shops.
- Kein automatisches Überschreiten von Gratis-Tarifen wird bewusst eingerichtet. Der Client limitiert den eigenen Browser auf 180 API-Aufrufe pro UTC-Tag; das **Cloudflare-Gesamtkontingent** gilt zusätzlich für alle Nutzer gemeinsam.
- Das Produktmatching ist regelbasiert und nur ein Vorschlag, keine KI-gestützte bestätigte Gleichwertigkeit.

## MarktRadar 5.5

Der neue Reiter „Preisduell & 2er-Check“ ersetzt die fehleranfällige automatische Gleichsetzung ähnlicher Produkte. Allgemeine Kategorie-Bestpreise können unterschiedlich ausgestattete Produkte betreffen. Zum technischen Gegenüberstellen zwei konkrete Produkte manuell auswählen. Der Scan entdeckt unter anderem flache Produkt-URLs und übernimmt klar ausgewiesene Listenpreise mit einem Hinweis auf die vorläufige Quelle. Bisherige Browser-Katalogdaten bleiben erhalten; die Warteschlange wird nach dem Update automatisch erneuert.

## 5.4 – Produktabdeckung prüfen

Beim erneuten Scan werden ältere Scan-Warteschlangen aktualisiert. Gespeicherte Produkte bleiben erhalten; nur Laminat, Vinyl/Rigid-Vinyl und Parkett werden angezeigt. Für große Shops „Scan vertiefen / fortsetzen“ verwenden. Der erfasste Produktbestand kann über 200 hinauswachsen, sofern Produktlisten oder Sitemaps erreichbar sind und kostenlose Abrufgrenzen noch verfügbar sind. Der Scanner stoppt spätestens nach 210 Sekunden pro vertieftem Start und speichert Zwischenergebnisse für den nächsten Durchgang.

## MarktRadar 5.5 – Vollscan

Für bereits erfasste Produkte ohne Preis wird beim nächsten Scan eine neue Prüfwarteschlange erzeugt. Der neue Button „Alle offenen Aufgaben automatisch prüfen“ arbeitet bis zu 15 Minuten, sofern der Tab geöffnet bleibt. Bisherige Daten gehen nicht verloren. Ein Abbruch wegen Cloudflare-Free-Budget, Shop-Zugriffssperren oder wiederholt unerreichbaren Produkten bedeutet ausdrücklich **keinen vollständigen Katalogscan**.

## Version 5.6 – Nur Bodenbeläge und Leisten

Filter, Katalogscan und Bestpreis-Dashboard führen Laminat, Vinyl/Rigid-Vinyl, Parkett sowie Fuß-/Sockelleisten. Keine weiteren Zubehörprodukte. Leisten je Meter und je Stück getrennt darstellen; keine Preisberechnung aus unbeschrifteten Paket- oder Gesamtpreisen. Der Browser speichert Daten weiterhin unter `marktradar:catalog:v3`, die Scanwarteschlange wird auf die neue Version aktualisiert.

# Feuerwehr-Führerscheinverwaltung

Webanwendung zur Verwaltung von Fahrerlaubnissen, Feuerwehrführerscheinen, regelmäßigen Führerscheinkontrollen und der fahrzeugbezogenen Einsatzbereitschaft in der Feuerwehr.

## Funktionsübersicht

- **EU-Führerscheinklassen & Einschlussregeln**: Unterstützung aller EU-Klassen (`AM`, `A1`, `A2`, `A`, `B`, `BE`, `C1`, `C1E`, `C`, `CE`, `D1`, `D1E`, `D`, `DE`, `L`, `T`) inklusive automatischer Einschlusslogik und individueller Erteilungs-/Ablaufdaten.
- **Feuerwehrführerschein**: Verwaltung von `FW_475` (bis 4,75 t) und `FW_750` (bis 7,5 t) einschließlich automatischer Abdeckung durch vorhandene Klassen (`C1`, `C1E`, `C`, `CE`).
- **Schlüsselzahlen & Sperren**: Erfassung globaler und klassenspezifischer Schlüsselzahlen (z. B. `01`, `78`, `95`, `96`, `171`, `172`, `196`, `197`) sowie befristeter oder unbefristeter Fahrverbote/Sperren.
- **Führerscheinkontrollen & Revisionssicherheit**: Dokumentierte Sichtprüfungen (Original-EU-Führerschein, FW-Fahrberechtigung, Auflagen/Schlüsselzahlen) mit frei konfigurierbarem Kontrollintervall (Standard: 6 Monate), Vorwarnfristen, Prüfprotokoll und Erkennung überfälliger Kontrollen. Erfasste Kontrollen lassen sich aus Revisionsgründen nicht löschen, sondern nur durch Administratoren mit Pflichtbegründung stornieren; Änderungen werden im Audit-Log festgehalten.
- **Fahrzeug-3-Stufen-Ampel & Einweisungen**: Pro Fahrzeug (konfigurierbare ODER-Klassenanforderungen, Automatik/Schaltgetriebe, optionaler Anhängerbetrieb sowie optionale Einweisungspflicht) werden berechtigte aktive Kameraden automatisch bewertet:
  - **Grün**: Gültige Klasse, aktuelle Kontrolle, ggf. erforderliche Einweisung vorhanden, keine Einschränkung.
  - **Gelb**: Warnung (z. B. bald ablaufende Klasse/Karte, Kontrolle fällig/überfällig, fehlende Erstkontrolle oder fehlende Fahrzeug-Einweisung).
  - **Rot**: Nicht fahrberechtigt (abgelaufene Klasse, aktives Fahrverbot, Beanstandung bei der letzten Kontrolle oder Schlüsselzahl `78` auf Schaltfahrzeug).
- **Kalender-Abo (iCal / `.ics`)**: Geschützter Kalender-Feed für fällige Kontrollen sowie ablaufende Klassen und Führerscheinkarten inkl. Erinnerungen (`VALARM`) und Token-Rotation.
- **E-Mail-Benachrichtigungen (SMTP & JMAP)**: Automatische Sammelberichte (Digest) für Verantwortliche sowie individuelle Vorab-Erinnerungen an Kameraden – wahlweise per SMTP oder JMAP (RFC 8620/8621).
- **PDF- & CSV-Export/Import**: Druckfertige PDF-Berichte (Prüfprotokoll mit Unterschriftsfeld, Fahrzeug-Fahrerlisten, Kameradenübersicht), CSV-Export und CSV-Import mit Vorschau.
- **Backup & Restore**: SQLite-Datenbank-Snapshot und portables JSON-Backup mit Wiederherstellung.
- **Rollenmodell**: Getrennte Berechtigungen für `admin` (Vollzugriff), `inspector` (Prüfer: Kameraden & Kontrollen) und `viewer` (Nur Lesen).

---

## Lokale Entwicklung

Voraussetzung ist **Node.js 24** (wegen des integrierten `node:sqlite`-Moduls).

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten (Backend auf :3000 + Vite Frontend auf :5173)
npm run dev

# Automatisierte Tests ausführen
npm test

# TypeScript-Typprüfung (Server & Client)
npm run typecheck

# Produktions-Build erstellen (server/dist & client/dist)
npm run build

# Gebaute Anwendung produktiv starten
npm start
```

Beim ersten Start öffnet sich im Browser automatisch der **Ersteinrichtungs-Assistent**, über den der erste Administrator, der Name der Feuerwehr und das Kontrollintervall angelegt werden.

---

## Docker-Deployment

Die Anwendung wird als Multi-Stage-Image auf Basis von `node:24-slim` gebaut und läuft unter dem Non-Root-User `node`.

```bash
# Container bauen und im Hintergrund starten
docker compose up -d --build
```

Anschließend ist die Anwendung unter `http://<host>:3000` erreichbar.

### Wichtige Umgebungsvariablen

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `PORT` | `3000` | HTTP-Port des Express-Servers |
| `DATA_DIR` | `/app/data` (lokal: `./data`) | Speicherort für die SQLite-Datenbank (`fw-fuehrerschein.db`) und interne Schlüsseldaten |
| `TZ` | `Europe/Berlin` | Zeitzone für Datumsberechnungen, Scheduler und Logs |
| `APP_SECRET` | *(optional)* | Schlüssel für die AES-256-GCM-Verschlüsselung gespeicherter Mail-Zugangsdaten |
| `COOKIE_SECURE` | *(automatisch bei HTTPS)* | Setzt das `Secure`-Flag auf das Session-Cookie (`fw_session`), wenn `true` (z. B. hinter einem TLS-Reverse-Proxy) |
| `ALLOW_INSECURE_JMAP_URLS` | `false` | Erlaubt `http://`-URLs für JMAP-Endpunkte (nur für lokale Tests/Entwicklung; standardmäßig ist `https://` Pflicht) |
| `ALLOW_PRIVATE_JMAP_URLS` | `false` | Erlaubt JMAP-Anfragen an private, Loopback- oder Link-Local-IP-Adressen (standardmäßig zum SSRF-Schutz blockiert) |

> **Hinweis zu `DATA_DIR` und `APP_SECRET`:**
> In `docker-compose.yml` wird `./data` auf `/app/data` gemountet, damit Datenbank und Konfiguration über Container-Neustarts hinweg erhalten bleiben.
> Wird `APP_SECRET` nicht explizit gesetzt, erzeugt die Anwendung beim ersten Start automatisch einen zufälligen Schlüssel unter `<DATA_DIR>/.app-secret`. Wenn Sie Datenbank-Dateien ohne das ursprüngliche `DATA_DIR` umziehen oder ein reproduzierbares Secret bevorzugen, setzen Sie `APP_SECRET` direkt in Ihrer Compose-Umgebung.

Der Container enthält einen integrierten `HEALTHCHECK` gegen `http://127.0.0.1:3000/api/health`.

---

## E-Mail-Konfiguration (SMTP & JMAP)

Die E-Mail-Einstellungen werden von Administratoren unter **Einstellungen → E-Mail & Erinnerungen** gepflegt. Zugangsdaten (Passwörter/Tokens) werden verschlüsselt gespeichert und in der Oberfläche/API niemals im Klartext zurückgegeben.

- **SMTP**: Klassische Konfiguration mit Host, Port (z. B. `587` mit STARTTLS oder `465` mit SSL/TLS), Benutzername, Passwort sowie Absenderadresse und -name.
- **JMAP (z. B. Stalwart Mail Server oder Fastmail)**:
  - **Session-URL**: z. B. `https://mail.example.org/.well-known/jmap` oder `https://api.fastmail.com/jmap/session`
  - **Authentifizierung**: `Bearer`-Token (empfohlen bei Fastmail-API-Tokens bzw. OAuth/App-Tokens) oder `Basic` (Benutzername + Passwort, z. B. für Stalwart)
  - **Account-ID**: optional; wird sie leer gelassen, verwendet die Anwendung automatisch die primäre Mail-/Submission-Account-ID aus der JMAP-Session.

Über **Test-E-Mail senden** können die aktuell eingegebenen oder gespeicherten Einstellungen direkt vor dem Speichern geprüft werden.

---

## iCal-Kalender-Abo

Unter **Einstellungen → Kalender (iCal)** steht eine persönliche Abo-URL im Format:

```text
https://<ihre-domain>/api/calendar/<ical-token>.ics
```

Diese URL benötigt kein Browser-Login und kann direkt in Kalender-Clients (z. B. Nextcloud, Thunderbird, Apple Kalender, Outlook) als Web-Kalender abonniert werden. Bei Bedarf lässt sich der Token jederzeit rotieren (der alte Link wird dadurch sofort ungültig). Zusätzlich kann die `.ics`-Datei für angemeldete Benutzer direkt über `/api/calendar.ics` heruntergeladen werden.

---

## CSV-Import-Format

Über **Einstellungen → Import/Export & Backup** lässt sich eine fertige CSV-Vorlage (`/api/import/template.csv`) herunterladen.

- **Trennzeichen**: Semikolon (`;`) oder Komma (`,`), UTF-8 (mit oder ohne BOM)
- **Typische Spalten**: `Personalnummer`, `Vorname`, `Nachname`, `Einheit`, `Email`, `Telefon`, `Status`, `Fuehrerscheinnummer`, `Karte_Ablauf`, `Schluesselzahlen`, `Klassen`
- **Format der Spalte `Klassen`**: Kommagetrennte Liste der Klassen mit optionalem Ablaufdatum (`YYYY-MM-DD`) nach einem Doppelpunkt:
  ```text
  B, C1:2028-05-01, FW_750
  ```
- Vor dem eigentlichen Schreiben zeigt die **Import-Vorschau** alle erkannten Neuanlagen, Aktualisierungen sowie eventuelle Zeilenfehler an; der Commit erfolgt atomar in einer Transaktion.

---

## Revisionssicherheit, Audit-Log & Fahrzeug-Einweisungen

- **Stornierung statt Löschung**: Erfasste Führerscheinkontrollen lassen sich aus Nachvollziehbarkeits- und Revisionsgründen nicht über `DELETE /api/inspections/:id` löschen (Antwort `405 Method Not Allowed`). Fehleingaben werden durch Administratoren mit verpflichtender Angabe eines Stornogrundes über `POST /api/inspections/:id/cancel` storniert und im Protokoll entsprechend markiert.
- **Audit-Log**: Kontrollvorgänge, Stornierungen sowie Änderungen an Fahrzeug-Einweisungen werden mit Zeitstempel, ausführendem Benutzer und Details in der Tabelle `audit_logs` protokolliert und stehen Administratoren im Prüfprotokoll (bzw. über `GET /api/inspections/audit`) zur Einsicht bereit.
- **Fahrzeug-Einweisungen**: Fahrzeuge können optional als einweisungspflichtig markiert werden. In der Kameraden-Detailansicht pflegen Administratoren und Prüfer die eingewiesenen Fahrzeuge pro Kamerad (`PUT /api/members/:id/briefings`); fehlt bei einem einweisungspflichtigen Fahrzeug die Einweisung, wird der Fahrer in der Fahrzeugliste mit einer gelben Warnung (`Einweisung fehlt`) geführt.

---

## Backup & Restore

Unter **Einstellungen → Import/Export & Backup** stehen zwei Sicherungswege zur Verfügung:

1. **SQLite-Backup & -Restore (`/api/admin/backup/sqlite` & `/api/admin/restore/sqlite`)**: Erzeugt über `VACUUM INTO` eine konsistente Kopie der gesamten Datenbank (`fw-fuehrerschein.db`) inklusive Benutzerkonten, Einstellungen und Benachrichtigungsprotokoll; beim SQLite-Restore werden Fachdaten und nicht-sensitive Einstellungen atomar wiederhergestellt, während lokale Benutzerkonten und aktive Sessions erhalten bleiben.
2. **JSON-Backup & -Restore (`/api/admin/backup/json` & `/api/admin/restore/json`)**: Exportiert Kameraden, Führerscheine, Kontrollen, Fahrzeuge, Fahrzeug-Einweisungen und nicht-sensitive Einstellungen als JSON-Datei und ermöglicht die vollständige Wiederherstellung dieser Fachdaten in einer Transaktion.

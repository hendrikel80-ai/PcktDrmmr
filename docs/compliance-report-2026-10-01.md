# Pocket Studio: Bericht zu Compliance und Veröffentlichungsreife

**Stand:** 2026-10-01 · **Geprüft:** Arbeitskopie mit allen noch nicht committeten Änderungen

## Kurz vorweg: Wie wird die App tatsächlich verteilt?

Geprüft an `package.json`, `src-tauri/tauri.conf.json`, `public/manifest.json`, `.github/workflows/release.yml` und `src-tauri/gen/`:

- **Desktop:** Windows-Installer (NSIS/MSI) über GitHub Releases, gebaut mit `cargo tauri build`. Bisher gibt es **keinen einzigen Git-Tag**, also auch noch keinen echten Release.
- **Mobile:** Web-App (`?mobile`), als PWA zum Home-Bildschirm hinzufügbar. **Kein Android-Projekt** (`src-tauri/gen/` enthält nur `schemas`), kein iOS/macOS-Binary.
- **Wichtig:** Das GitHub-Repo `hendrikel80-ai/PcktDrmmr` ist **öffentlich** (GitHub-API antwortet ohne Anmeldung mit HTTP 200). Ein veröffentlichter Release ist also für jeden herunterladbar, nicht nur für Freunde.

Daraus folgt: Die Anforderungen von Google Play und Apple App Store sind **aktuell keine akuten Blocker**. In jedem Befund ist gekennzeichnet, was „**Gilt so oder so**“ ist und was „**Nur bei echter Store-Einreichung**“ zählt.

Die Datei `.env` mit den echten Schlüsseln wurde bewusst **nicht gelesen**; geprüft wurde nur, dass sie nicht in Git landet.

---

## 1. Datenschutz und Datenfluss

| # | Befund | Status | Kategorie |
|---|---|---|---|
| 1.1 | Aufnahmen bleiben auf dem Gerät | ✅ Erfüllt | Gilt so oder so |
| 1.2 | Datenschutz-Hinweis in der App vorhanden | ✅ Erfüllt (mit Lücken, siehe 1.3–1.5) | Gilt so oder so |
| 1.3 | Google Fonts wird bei jedem Start von Google-Servern geladen und ist nicht offengelegt | ❌ Fehlt | Gilt so oder so |
| 1.4 | KI-Anfragen werden serverseitig dauerhaft gespeichert und sind nicht offengelegt | ⚠️ Teilweise | Gilt so oder so |
| 1.5 | Keine Kontaktperson und keine Angaben zur Speicherdauer im Hinweis | ⚠️ Teilweise | Gilt so oder so (bei Store Pflicht) |
| 1.6 | Mikrofonzugriff erst auf Knopfdruck, mit Erklärung | ✅ Erfüllt | Gilt so oder so |

**1.1 Aufnahmen bleiben lokal.** Im Frontend gibt es nur die Netzwerkaufrufe `/api/library`, `/api/generate-pattern`, `/api/sound-like`, die Sample-Dateien und `fetch(r.url)` in `src/components/RecordingPanel.jsx:296` und `:507`. `r.url` stammt immer aus `URL.createObjectURL(...)` (`src/audio/useAudioEngine.js:229, 737, 760, 793`, `src/audio/useMobileAudioEngine.js:214`). Native Aufnahmen landen über Rust nur im Downloads-Ordner (`src-tauri/src/lib.rs:326–340`). Die Zusage in `src/components/InfoDialog.jsx:35–36` stimmt.

**1.2 Hinweis vorhanden.** `InfoDialog.jsx` ist auf Desktop (`App.jsx:449`) und Mobile (`MobileApp.jsx:333`) erreichbar und nennt korrekt, welche Daten an Anthropic/DeepSeek gehen.

**1.3 Google Fonts.** `index.html:7–11` lädt Schriften von `fonts.googleapis.com`/`fonts.gstatic.com` — bei jedem App-Start geht die IP-Adresse an Google. LG München I (Az. 3 O 17493/20) hat das ohne Einwilligung als DSGVO-Verstoß gewertet. Der Hinweis „runs locally on your device“ ist dadurch unvollständig.
- **Nächster Schritt:** „Bebas Neue“ und „Source Sans 3“ (SIL OFL) lokal unter `public/fonts/` einbinden, die drei `<link>`-Zeilen entfernen.

**1.4 Serverseitiger Cache.** `server/cache.js` speichert jeden Prompt und jede Sound-Like-Suche dauerhaft in `server/data/patternCache.json`/`soundLikeCache.json`. Lokal harmlos, bei gehostetem Backend liegen Eingaben von Freunden unbefristet auf dem Server.
- **Nächster Schritt:** Satz im Hinweis ergänzen und eine Speicherdauer festlegen.

**1.5 Fehlende Pflichtangaben.** Es fehlen verantwortliche Person/Kontakt, Links zu den Datenschutzerklärungen von Anthropic und DeepSeek, Speicherdauer und Löschung (Apple 5.1.1(i); Google Play verlangt eine Datenschutzerklärung auch für Apps ohne Datenerhebung).
- **Nächster Schritt:** Kurze Datenschutzerklärung (`PRIVACY.md` oder GitHub Pages) schreiben und aus `InfoDialog.jsx` verlinken.

**1.6 Mikrofon.** `getUserMedia` nur in `MicEngine.js:78` und `GuitarEngine.js:201`, erst über „Connect Microphone“ (`MobileMicPanel.jsx:66`), mit Zweck- und Kopfhörer-Hinweis (`MobileMicPanel.jsx:57–59`). Fehlermeldungen verständlich (`GuitarEngine.js:36`).

---

## 2. Berechtigungen

| # | Befund | Status | Kategorie |
|---|---|---|---|
| 2.1 | Tauri-Berechtigungen sind sparsam | ✅ Erfüllt | Gilt so oder so |
| 2.2 | Keine Content-Security-Policy, Tauri-Funktionen global im Fenster | ⚠️ Teilweise | Gilt so oder so |
| 2.3 | Mikrofon braucht HTTPS, für Mobile noch nicht eingerichtet | ❌ Fehlt | Gilt so oder so |
| 2.4 | Android-Manifest, Apple-Begründungstexte | — Nicht anwendbar | Nur bei echter Store-Einreichung |

**2.1** `src-tauri/capabilities/default.json:8–12`: nur `core:default`, `dialog:default`, `opener:default` — keine `fs`/`shell`-Rechte. Dateizugriff nur über eigene, abgesicherte Rust-Befehle (siehe 3.4).

**2.2** `tauri.conf.json`: `"csp": null`, `"withGlobalTauri": true`. Kein akuter Fehler (React maskiert KI-Texte, kein `dangerouslySetInnerHTML`), aber keine zweite Verteidigungslinie.
- **Nächster Schritt:** CSP setzen, z. B. `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ipc: http://ipc.localhost` (leichter nach 1.3).

**2.3** Laut CLAUDE.md offen. `vite.config.js:22` setzt bereits `allowedHosts: true` für Tailscale Funnel — siehe aber 3.3.

**2.4** Android bräuchte `INTERNET`, `RECORD_AUDIO`, ggf. `MODIFY_AUDIO_SETTINGS`; iOS ein `NSMicrophoneUsageDescription` (Apple 5.1.1(ii)). Heute nicht nötig.

---

## 3. Sicherheit

| # | Befund | Status | Kategorie |
|---|---|---|---|
| 3.1 | Keine Secrets im Repo, in der Historie oder im Build | ✅ Erfüllt | Gilt so oder so |
| 3.2 | Auth und Rate-Limit korrekt eingebunden | ✅ Erfüllt (mit Grenzen) | Gilt so oder so |
| 3.3 | Vite und esbuild haben bekannte Lücken, kritisch bei Funnel-Freigabe | ❌ Fehlt | Gilt so oder so |
| 3.4 | Rust prüft Eingaben aus dem App-Fenster | ✅ Erfüllt (2 Kleinigkeiten) | Gilt so oder so |
| 3.5 | CORS offen für jede Webseite | ⚠️ Teilweise | Gilt so oder so |
| 3.6 | `cargo audit` | ✅ Erfüllt | Gilt so oder so |

**3.1** `git ls-files` listet nur `.env.example`; `git log --all -- .env` leer; keine Schlüsselmuster (`sk-ant-…`, `AKIA…`, `ghp_…`) in Stand, Historie oder `dist/`. `.gitignore:3–5` schließt `.env*` aus.

**3.2 Auth/Rate-Limit (neu, uncommitted).**
- `server/index.js:52` `aiGuards = [requireApiToken, aiRateLimit]`, verwendet auf `:54` (`/api/generate-pattern`) und `:95` (`/api/sound-like`). `/api/library` und `/api/health` bewusst offen.
- Frontend: `PromptBar.jsx:28` und `SoundLike.jsx:39` nutzen `apiHeaders()`; `App.jsx`/`MobileApp.jsx` binden nur `PromptBar` ein.
- Zeitkonstanter Token-Vergleich (`auth.js:18–23`), Prompt-Limits (`index.js:27–28, :60, :67`), max. 3 Websuchen (`aiProvider.js:37`).
- `VITE_API_ACCESS_TOKEN` landet bewusst im JS-Bundle (`apiAuth.js:6`, dokumentiert in `auth.js:8–14`) — hält Bots fern, ist aber **kein Zugangsschutz**. Der eigentliche KI-Schlüssel gelangt nicht ins Frontend.
- **Grenze 1:** Limiter zählt nach `req.ip` (`rateLimit.js:61`), über den Vite-Proxy kommt alles von `127.0.0.1` — das Limit gilt also immer für alle Nutzer zusammen (Kommentar in `.env.example` legt anderes nahe).
- **Grenze 2:** Nur im Arbeitsspeicher, Reset bei Neustart.
- **Nächster Schritt:** Bei gehostetem Backend ein hartes Monatsbudget im Anthropic-/DeepSeek-Konto setzen.

**3.3 `npm audit`:** 2 Lücken (1 hoch, 1 mittel).
- `vite@5.4.21`, **hoch:** `server.fs.deny`-Bypass auf Windows (GHSA-fx2h-pf6j-xcff); dazu GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3.
- `esbuild@0.21.5`, mittel: GHSA-67mh-4wv8-2f99.
- Betrifft nur den Dev-Server — genau der soll aber per Tailscale Funnel öffentlich werden. `server.fs.deny` schützt u. a. die `.env`.
- **Nächster Schritt:** Dev-Server **nie** per Funnel freigeben; für Mobile den Build (`dist/`) statisch ausliefern (z. B. `express.static('dist')`). Vite auf gepatchte Version heben (Breaking Change, kurz testen).

**3.4 Rust-IPC (`src-tauri/src/lib.rs`)** sauber: `confine_to_downloads` (`:217–231`), `sanitize_filename` (`:238–245`), `.nam`-Prüfung (`:254–269`), Papierkorb statt Löschen (`:308`), `driver_name`-Whitelist in `start` (`asio_engine.rs:259–265`), Kanal-Bereichsprüfung (`:285`, `:290`).
- (a) `probe_asio_channels` (`lib.rs:51` → `asio_engine.rs:229`) prüft `driver_name` nicht gegen die Liste — gleiche Prüfung wie in `start` einbauen.
- (b) `save_recording_bytes` (`:326–340`) überschreibt beliebige Dateien im Downloads-Ordner ohne Rückfrage — Präfix `pocket-studio-riff-` + Endung `.mp3`/`.wav` erzwingen, Überschreiben ablehnen.

**3.5** `server/index.js:31` `app.use(cors())` → jede offene Webseite könnte lokal `/api/generate-pattern` aufrufen und KI-Kosten verbrauchen (gedeckelt durchs Rate-Limit).
- **Nächster Schritt:** `cors({ origin: ['http://localhost:5173'] })` oder CORS ganz weglassen (Vite-Proxy ist same-origin).

**3.6 `cargo audit`:** 515 Crates, keine Lücken; 7 Warnungen (unmaintained `proc-macro-error`, `unic-*`; `glib` unsound, nur Linux). Kein Handlungsbedarf.

---

## 4. Lizenzen und Namensnennung

| # | Befund | Status | Kategorie |
|---|---|---|---|
| 4.1 | CC-BY-Namensnennung für Pearl-Kit sichtbar | ✅ Erfüllt | Gilt so oder so |
| 4.2 | Übrige Sample-Kits dokumentiert | ✅ Erfüllt | Gilt so oder so |
| 4.3 | Steinberg-ASIO-SDK-Lizenz ungeklärt | ❌ Fehlt, **wichtigster Blocker** | Gilt so oder so |
| 4.4 | LAME (LGPL-3.0) statisch eingebaut, „kein Handlungsbedarf“ zu optimistisch | ⚠️ Teilweise | Gilt so oder so |
| 4.5 | Kleinere Lücken (NAM-WASM, Schriften, Cargo-Metadaten) | ⚠️ Teilweise | Gilt so oder so |
| 4.6 | Eigene LICENSE-Datei vorhanden | ✅ Erfüllt | Gilt so oder so |

**4.1** `InfoDialog.jsx:58–69` (Desktop + Mobile), `public/samples/LICENSE.md`, `src/data/kits.js:47`. Optional: Link zur Originalquelle auch im Dialog zeigen.

**4.2** `pearl-acoustic` (CC-BY 3.0), `trap-bounce`, `trap-hard`, `vintage-soul` (CC0), `standard` synthetisch — dokumentiert in `public/samples/LICENSE.md` und `InfoDialog.jsx:70–74`. `amps/` (ungeklärte `.nam`/IRs) ist per `.gitignore:15` ausgeschlossen und nicht im Installer.

**4.3 Steinberg ASIO SDK.** Seit Oktober 2025 dual lizenziert (GPLv3 oder proprietärer Vertrag). `LICENSE` erklärt die App für proprietär, Vertrag nicht unterschrieben (`LICENSE:27–39`). Repo öffentlich, `release.yml` baut die SDK in den Installer ein — ab dem ersten veröffentlichten Release öffentliche Verbreitung ohne erfüllte Lizenzbedingung. Zusätzlich gelten Steinbergs „ASIO“-Usage-Guidelines.
- **Nächster Schritt (vor erstem Release):** Proprietären Vertrag abschließen **oder** GPLv3 wählen (dann `LICENSE` ändern); ASIO-Markenhinweis in die Credits.

**4.4 LAME.** `mp3lame-encoder`/`mp3lame-sys` (LGPL-3.0) statisch in der `.exe`, `@breezystack/lamejs` (LGPL-3.0) im Frontend-Bundle. LGPL bei statischem Linken in proprietäre Software verlangt u. a. Lizenztext und Relink-Möglichkeit; LAME fehlt im Info-Dialog. Bei GPLv3-Weg weitgehend erledigt.
- **Nächster Schritt:** LAME + LGPL-3.0 in die Credits; bei proprietärem Weg Relink-Pflicht klären oder dynamische DLL / anderen Encoder.

**4.5** `neural-amp-modeler-wasm` (ISC) nicht in den Credits; Schriften OFL (optional); sonst nur MPL-2.0/Unicode-3.0. `Cargo.toml` hat noch Vorlagenwerte (`license = ""`, `authors = ["you"]`, `description = "A Tauri App"`).

**4.6** `LICENSE` vorhanden, muss je nach 4.3 angepasst werden.

---

## 5. Store-spezifische technische Anforderungen

**Alles hier ist „Nur bei echter Store-Einreichung“ und aktuell nicht anwendbar — außer 5.4.**

| # | Befund | Status |
|---|---|---|
| 5.1 | Google Play: Data Safety, Ziel-API, Tester-Pflicht | — Nicht anwendbar |
| 5.2 | Apple App Store | — Nicht anwendbar (technisch blockiert) |
| 5.3 | Ko-fi-Spendenlink im Store-Kontext | — Nicht anwendbar |
| 5.4 | Windows-Installer ohne Code-Signing | ❌ Fehlt (**Gilt so oder so**) |

**5.1 Google Play:** Data-Safety-Formular (anzugeben: KI-Prompts, IP an Google Fonts, Sound-Like-Suche; Mikrofon-Audio nicht), Ziel-API **36** ab 31.08.2026 (Verlängerung bis 01.11.2026), **12 Tester über 14 Tage** für neue private Konten, signiertes AAB, Altersfreigabe.

**5.2 Apple:** 5.1.1(i) Datenschutzerklärung, 5.1.1(ii) Mikrofon-Begründung, 2.1(a) Backend während Prüfung erreichbar, 4.2 Mehrwert über Web-Hülle. macOS braucht zuerst eine CoreAudio-Portierung.

**5.3 Ko-fi** (`MobileApp.jsx:334–342`, `App.jsx:451–455`, uncommitted): bei Store-Einreichung Apple 3.1.1 / Google-Zahlungsrichtlinie prüfen. Heute: prüfen, ob `ko-fi.com/Jack_Bello_Industries` dein Konto ist und ob Spenden zur „non-commercial“-Formulierung in `LICENSE` passen.

**5.4 Code-Signing:** `release.yml` signiert nicht → SmartScreen-Warnung. Microsoft „Artifact Signing“ für Einzelpersonen derzeit nur USA/Kanada; in Deutschland bleibt ein OV-Zertifikat.
- **Nächster Schritt:** Für Freunde akzeptieren, Release-Beschreibung mit „Weitere Informationen → Trotzdem ausführen“ und SHA-256-Prüfsumme.

---

## 6. Allgemeine Programmier-Best-Practices

| # | Befund | Status | Kategorie |
|---|---|---|---|
| 6.1 | **Installierte Desktop-App: Beat Library, Generate a Beat und Sound Like funktionieren voraussichtlich nicht** | ❌ Fehlt | Gilt so oder so |
| 6.2 | Fehlermeldungen für Entwickler statt Nutzer formuliert | ⚠️ Teilweise | Gilt so oder so |
| 6.3 | Versionen konsistent, CHANGELOG vorhanden | ✅ Erfüllt | Gilt so oder so |
| 6.4 | Release-Workflow ungetestet, ohne Prüfschritte | ⚠️ Teilweise | Gilt so oder so |
| 6.5 | Barrierefreiheit | ⚠️ Teilweise | Gilt so oder so |
| 6.6 | Logging sparsam, keine sensiblen Daten | ✅ Erfüllt | Gilt so oder so |
| 6.7 | Tests nur für die native Drum-Engine | ⚠️ Teilweise | Gilt so oder so |
| 6.8 | NAM-Fehler führt zu stiller Stummschaltung | ⚠️ Teilweise | Gilt so oder so |

**6.1 Wichtigster praktischer Fund für den Installer.** Das Frontend ruft die API relativ auf (`LibraryBrowser.jsx:18`, `ArrangementEditor.jsx:58`, `PromptBar.jsx:26`, `SoundLike.jsx:37`). Im Dev-Modus leitet Vite weiter (`vite.config.js:23–27`); im Installer lädt Tauri `dist` ohne Proxy und ohne mitgelieferten Express-Server (kein `externalBin`/Sidecar, Library-JSONs nicht gebündelt, keine konfigurierbare API-Adresse). Folge: auch die **Beat Library** dürfte bei Freunden fehlschlagen. *Aus dem Code abgeleitet, nicht per echtem Build getestet.*
- **Nächster Schritt:** (a) Library-Daten ins Frontend packen (JSON-Import oder `public/library/`). (b) `VITE_API_BASE_URL` einführen und KI-Bereiche ohne Backend ausblenden oder als „nicht verfügbar“ kennzeichnen.

**6.2** `PromptBar.jsx:39–41` und `SoundLike.jsx:47` zeigen „Is the backend running? (npm run dev:full …)“. Positiv: Fehler werden nicht verschluckt (`index.js:88–92`, `:110–114`).
- **Nächster Schritt:** Nutzerfreundliche Meldung, technischer Hinweis nur bei `import.meta.env.DEV`.

**6.3** `package.json`, `tauri.conf.json`, `Cargo.toml`: alle 0.1.0; App-Version aus einer Quelle (`vite.config.js:5, :14`). `CHANGELOG.md` gepflegt — Auth/Rate-Limit, Ko-fi, Papierkorb-Löschen nachtragen. `productName` ist `pocket-studio-native` → evtl. „Pocket Studio“.

**6.4** `release.yml` gut aufgebaut (nur Tag, nur Draft, Submodule), aber nie gelaufen und ohne Prüfschritte.
- **Nächster Schritt:** Tag `v0.1.1-test` pushen; vor `cargo tauri build` `cargo test` (in `src-tauri`) und `npm audit --omit=dev --audit-level=high` einbauen (Achtung: `--omit=dev` meldet die Vite-Lücke nicht).

**6.5 Barrierefreiheit (Stichproben).**
- Kontrast: Haupttext 13,9:1, gedimmt 6,3:1, Gold 7,5:1, Akzent `#d35b2c` 4,56:1 — alles AA, Akzent knapp.
- Touch-Ziele 44 px in Mobile umgesetzt (`index.css:1557–1580`).
- Step-Zellen sind `<button>` (`StepCell.jsx`), aber `aria-label` nur „Velocity 0“ → besser „Snare, Schritt 5, Ghost“.
- `outline: none` ohne Ersatz bei Slidern (`index.css:48–50`) und BPM-Feld (`:1076–1078`); Vorbild existiert bei `.generation-box__input:focus` (`:389`).
- `index.html:2` `lang="de"`, UI ist Englisch → `lang="en"`.

**6.6** Server loggt nur Fehler (`index.js:81, :90, :112`) und den Library-Pfad (`library.js:54`, enthält Windows-Benutzernamen). `logs/` ignoriert, Rust-Logging nur im Debug-Build (`lib.rs:430–436`).

**6.7** 5 Rust-Tests in `drum_engine.rs` (z. B. `:554`). **Keine JavaScript-Tests**, kein Test-Script. Am dringendsten: `src/data/validatePattern.js`, `sanitize_filename`/`confine_to_downloads`, `server/auth.js`/`server/rateLimit.js`, `Scheduler.js`.

**6.8** Neue Exception-Absicherung in `nam_shim.cpp` ist eine echte Verbesserung, aber nach 8 Fehlern in Folge dauerhaft Stille ohne Meldung ans Frontend.
- **Nächster Schritt:** Status-Befehl (z. B. `get_nam_status`) + UI-Hinweis „Amp-Modell ausgefallen, bitte neu laden“.

---

## 7. Inhalte und rechtliche Grauzonen

| # | Befund | Status | Kategorie |
|---|---|---|---|
| 7.1 | Sound Like: Nennung realer Musiker:innen | ✅ Im Wesentlichen unkritisch | Gilt so oder so |
| 7.2 | TONE3000-Nutzungsbedingungen eingehalten | ✅ Erfüllt | Gilt so oder so |
| 7.3 | KI-Beats „im Stil von …“ | ✅ Erfüllt | Gilt so oder so |

**7.1** Sachliche Ausrüstungs-Fakten, nur Such-Link, keine angedeutete Kooperation; System-Prompt verbietet geschützte Inhalte (`server/soundLikePrompt.js`). Restrisiko: falsche Zuordnung.
- **Optional:** Dauerhafte Zeile „KI-generierte Recherche, kann Fehler enthalten. Keine Verbindung zu den genannten Künstler:innen oder Herstellern.“

**7.2** KI ruft `tone3000.com` nicht ab, nur der Nutzer selbst; Lizenzhinweis (`TONE3000_LICENSE_HINT`) wird angezeigt.

**7.3** Reine Step-Patterns statt Audio, stilistische Interpretation — geringes Risiko.

---

## Priorisierte Zusammenfassung

### A. Vor der Weitergabe an andere Nutzer (Installer-Release oder PWA-Link)

1. **Steinberg-ASIO-Lizenz klären (4.3)** — proprietärer Vertrag oder GPLv3, **bevor** der erste Draft veröffentlicht wird. Danach `LICENSE` + Credits (inkl. ASIO-Markenhinweis).
2. **Prüfen, was im Installer funktioniert (6.1)** — Beat Library ohne Server lauffähig machen, KI-Bereiche ohne Backend ausblenden/erklären. Mit `v0.1.1-test` bestätigen.
3. **Vite-Dev-Server nie per Tailscale Funnel freigeben (3.3)** — für Mobile nur den Build statisch ausliefern; Vite aktualisieren.
4. **Google Fonts lokal einbinden (1.3)** und **Datenschutz-Hinweis vervollständigen (1.4/1.5)**.
5. **CORS beschränken (3.5)**, bei gehostetem Backend **Budget-Limit beim KI-Anbieter** (3.2).
6. **LAME (LGPL) in den Credits, Relink-Frage klären (4.4)** — hängt an Punkt 1.
7. **Nutzerfreundliche Fehlermeldungen (6.2)**, Release-Beschreibung mit SmartScreen-Hinweis + SHA-256 (5.4), Ko-fi-Konto prüfen (5.3).

Danach (Qualität, kein Blocker): JS-Tests (6.7), Fokus-Styles/`aria-label`/`lang="en"` (6.5), zwei Rust-Härtungen (3.4), NAM-Ausfall-Hinweis (6.8), CSP (2.2), Platzhalter in `Cargo.toml`/`productName`.

### Bereits sauber
- Keine Schlüssel in Repo, Historie oder Build.
- Aufnahmen bleiben nachweislich lokal.
- Auth und Rate-Limit auf allen KI-Endpunkten, alle Frontend-Aufrufe senden den Header.
- Tauri-Berechtigungen minimal, Rust-Pfadprüfungen gründlich.
- CC-BY-Namensnennung in der App sichtbar.
- Mikrofon erst auf Knopfdruck, mit Erklärung.
- Versionen konsistent, CHANGELOG vorhanden.
- Kontrast und 44-px-Touch-Ziele eingehalten.
- `cargo audit` ohne Sicherheitslücken.

### B. Erst relevant bei einer künftigen echten Store-Einreichung
- **Google Play:** Data Safety, Datenschutz-URL, Ziel-API 36, 12 Tester/14 Tage, signiertes AAB, Altersfreigabe, `RECORD_AUDIO`/`INTERNET`.
- **Apple:** 5.1.1(i), Mikrofon-Begründung, Backend live während Prüfung (2.1), Mehrwert über Web-Hülle (4.2), Ko-fi nach 3.1.1. macOS braucht CoreAudio-Portierung.
- **Microsoft-Signatur:** Artifact Signing für Einzelpersonen in DE nicht verfügbar; Alternative OV-Zertifikat.

---

## Quellen
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play: Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play: Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [Android Developers: Target API level requirement](https://developer.android.com/google/play/requirements/target-sdk)
- [Google Play: Testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Tauri v2 Opener Plugin](https://v2.tauri.app/plugin/opener/)
- [Steinberg Forum: ASIO License and Open Source software](https://forums.steinberg.net/t/asio-license-and-open-source-software/696630)
- [Steinberg Pressemitteilung 29.10.2025](https://ocl-steinberg-live.steinberg.net/_storage/asset/819253/storage/master/Press%20Release%20-%202025-10-29%20-%20VST%203.8%20-%20EN.pdf)
- [Beispiel GPLv3-ASIO-Build (SwankyAmp PR #84)](https://github.com/resonantdsp/SwankyAmp/pull/84)
- [Microsoft: Code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- [Azure Artifact Signing](https://azure.microsoft.com/en-us/products/artifact-signing)
- [Microsoft Q&A: Artifact Signing für Einzelpersonen außerhalb USA/Kanada](https://learn.microsoft.com/en-us/answers/questions/5810735/cant-create-a-new-trusted-signing-individual-ident)
- [LG München I, Google Fonts (Dr. Bahr)](https://www.dr-bahr.com/news/nutzung-von-google-fonts-auf-webseite-datenschutzwidrig-berechtigtes-interesse-nicht-ausreichend.html)
- [Google-Fonts-Urteil rechtskräftig (dr-dsgvo.de)](https://dr-dsgvo.de/google-fonts-urteil-rechtskraeftig-auswirkungen/)
- npm-Advisories: [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff), [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3), [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)

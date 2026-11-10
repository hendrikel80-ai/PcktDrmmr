# Pocket Studio – Benutzerhandbuch

Pocket Studio gibt dir ein Schlagzeug zum Mitspielen. Du suchst dir einen Beat
aus oder baust selbst einen, spielst Gitarre, Bass oder Gesang dazu und nimmst
alles zusammen als MP3 auf.

Die Oberfläche der App ist auf Englisch. Deshalb stehen Buttons hier genau so,
wie du sie in der App siehst, zum Beispiel **Start Recording**.

*English version: [User Guide](User-Guide.md)*

## Inhalt

1. [Was du brauchst](#was-du-brauchst)
2. [Installation](#installation)
3. [In 5 Minuten zum ersten Beat](#in-5-minuten-zum-ersten-beat)
4. [Beats finden und bauen](#beats-finden-und-bauen)
5. [Einen ganzen Song bauen](#einen-ganzen-song-bauen)
6. [Gitarre oder Bass anschließen](#gitarre-oder-bass-anschließen)
7. [Den Sound einstellen](#den-sound-einstellen)
8. [Mikrofon und Gesang](#mikrofon-und-gesang)
9. [Aufnehmen](#aufnehmen)
10. [Tastenkürzel](#tastenkürzel)
11. [Wenn etwas nicht klappt](#wenn-etwas-nicht-klappt)
12. [Deine Daten](#deine-daten)
13. [Hilfe, Feedback und Lizenz](#hilfe-feedback-und-lizenz)

## Was du brauchst

**Nur für Beats:** einen Windows-PC mit Lautsprechern oder Kopfhörern.

**Zum Einspielen von Gitarre, Bass oder Gesang zusätzlich:**

- ein Audio-Interface, also das Kästchen, in das du dein Instrument einsteckst
  (zum Beispiel eine Focusrite Scarlett)
- den **ASIO-Treiber** für dieses Interface. Du bekommst ihn beim Hersteller des
  Interfaces. Ohne ASIO-Treiber kann die App dein Instrument nicht erkennen.

## Installation

1. Öffne die [Download-Seite](https://github.com/hendrikel80-ai/PcktDrmmr/releases).
2. Lade bei der neuesten Version die Datei herunter, die auf `-setup.exe` endet.
3. Starte die Datei mit einem Doppelklick.
4. Windows zeigt vermutlich die Warnung „Der Computer wurde durch Windows
   geschützt“. Das liegt daran, dass die App noch keine kostenpflichtige
   Signatur hat. Klicke auf **Weitere Informationen** und dann auf **Trotzdem
   ausführen**.
5. Bestätige die Lizenz und folge dem Installer.
6. Starte die App über das Startmenü. Suche dort nach „pocket-studio“.

## In 5 Minuten zum ersten Beat

1. Scrolle zum Bereich **Drums**.
2. Wähle unter **Beat Library** ein Genre, ein Subgenre und ein Pattern aus.
3. Klicke auf **Load from Library**.
4. Klicke auf **▶ Play**. Der Beat läuft jetzt in einer Schleife.
5. Stelle mit **−** und **+** bei **BPM** das Tempo ein.
6. Stelle mit dem Regler **Drums** die Lautstärke ein.

Das war's, du kannst mitspielen.

## Beats finden und bauen

Über dem Drum-Bereich schaltest du zwischen zwei Ansichten um:

| Ansicht | Wofür |
| --- | --- |
| **Jam** | Beats suchen, bauen und mitspielen |
| **Songwriting** | Mehrere Beats zu einem Song zusammensetzen |

### Beat Library

Die Bibliothek enthält über 100 fertige Beats aus Rock, Punk, Metal, Funk,
Reggae, Blues, Country, Jazz, Latin, Pop, Hip-Hop und Electronic. Dazu kommen
Fills und unter **Transitions → Empty Bar** ein leerer Takt. Wofür der gut ist,
steht unter [Leere Takte für Übergänge](#leere-takte-für-übergänge).

### Generate a Beat

Tippe einfach ein, was du suchst, und klicke auf **✨ Generate**. Zum Beispiel:

- `punk 160 bpm`
- `funk`
- `reggae`

Die App sucht dann passend zu Genre und Tempo in der Bibliothek.

> **Hinweis:** In der installierten Version funktioniert das im Moment nur mit
> Genres. Freie Wünsche wie „im Stil von Nirvana“ brauchen den Online-KI-Dienst,
> der dort noch nicht verfügbar ist. Die App zeigt dann eine Meldung an.

### Build a Beat: selbst programmieren

Im Raster unten steht jede Zeile für ein Instrument, zum Beispiel Kick, Snare
oder Hi-Hat. Jedes Kästchen ist ein kurzer Moment im Takt, die Zahlen 1 bis 4
oben zeigen die Zählzeiten.

Klicke auf ein Kästchen, um die Anschlagstärke zu ändern. Jeder Klick schaltet
eine Stufe weiter:

| Stufe | Bedeutung |
| --- | --- |
| **Off** | Kein Schlag |
| **Ghost** | Ganz leiser Schlag |
| **Normal** | Normaler Schlag |
| **Accent** | Kräftig betonter Schlag |

Das sind die wichtigsten Werkzeuge:

| Bedienelement | Was es macht |
| --- | --- |
| **Bar / Bars** (− und +) | Macht den Beat 1 bis 8 Takte lang |
| **BPM** | Stellt das Tempo ein, von 40 bis 300 |
| **Undo** oder `Strg` + `Z` | Nimmt die letzte Änderung am Beat zurück (Tempoänderungen nicht) |
| **✕ Clear** | Löscht alle Schläge im aktuellen Beat |
| **Save** | Speichert den Beat unter dem Namen, den du davor eingibst |
| **Load** | Lädt den gewählten gespeicherten Beat |
| **🗑** | Löscht den gewählten gespeicherten Beat |
| **Export MIDI** | Speichert den Beat als MIDI-Datei für andere Musikprogramme |

**Tipp:** Ein Beat aus der Bibliothek lässt sich genauso bearbeiten. Lade ihn,
ändere ein paar Kästchen und speichere ihn unter einem eigenen Namen.

## Einen ganzen Song bauen

1. Schalte auf **Songwriting**.
2. Füge unter **Build a Song** die Teile deines Songs hinzu:
   - **From Library** nimmt einen Beat aus der Bibliothek.
   - **From Own Patterns** nimmt einen Beat, den du gespeichert hast. Mit
     **+ Add to Song** kommt er in den Song.
3. Stelle bei jedem Teil ein, wie oft er sich wiederholen soll (1 bis 32 Mal)
   und in welchem Tempo er läuft.
4. Ändere bei Bedarf mit den Pfeilen die Reihenfolge.
5. Klicke auf **▶ Play Song**. Der gerade laufende Teil wird hervorgehoben.
6. Gib einen Namen ein und klicke auf **Save Song**.

Mit **Loop whole song** startet der Song am Ende wieder von vorn. **Export MIDI**
speichert den ganzen Song als MIDI-Datei.

**Wichtig:** Ein Song merkt sich nur Verweise auf deine gespeicherten Beats.
Wenn du einen Beat löschst, der im Song vorkommt, stoppt der Song an dieser
Stelle mit einer Meldung.

### Leere Takte für Übergänge

Oft weißt du schon, dass zwischen Strophe und Refrain ein Übergang kommen soll,
hast ihn aber noch nicht programmiert. Dafür gibt es den leeren Takt: Er ist ein
Platzhalter, den du in den Song setzt und später mit Schlägen füllst.

1. Wähle unter **From Library** das Genre **Transitions**, das Subgenre **Empty
   Bar** und das Pattern aus und klicke auf **+ Add to Song**. Der leere Takt
   landet am Ende des Songs. Schiebe ihn mit den Pfeilen an die richtige Stelle.
2. Klicke bei diesem Teil auf **✎ Edit**. Der leere Takt wird ins Raster geladen.
3. Klicke die Schläge ein, die du haben möchtest, zum Beispiel einen Fill. Mit
   **Bar / Bars** machst du den Übergang bei Bedarf länger. Mit **▶ Play** hörst
   du ihn dir an.
4. Klicke auf **Save to song entry**. Es erscheint „Saved to the song entry.“
5. Klicke auf **Done**, wenn du fertig bist.
6. Klicke auf **Save Song**, damit auch der Song selbst gespeichert ist.

Jeder leere Takt, den du aus der Bibliothek hinzufügst, ist ein eigenes Pattern.
Du kannst also mehrere davon in einen Song setzen und jeden anders füllen.

**Gut zu wissen:**

- **✎ Edit** funktioniert bei jedem Teil des Songs, nicht nur beim leeren Takt.
- Während der Song läuft, ist **✎ Edit** gesperrt. **▶ Play Song** beendet das
  Bearbeiten automatisch, deshalb vorher **Save to song entry** klicken.
- Bei einem Teil aus **From Own Patterns** änderst du den gespeicherten Beat
  selbst. Kommt er mehrmals im Song vor, ändern sich alle diese Stellen mit.
- Du kannst den leeren Takt auch über **Generate a Beat** laden, indem du
  `empty bar` oder `leerer takt` eintippst.

## Gitarre oder Bass anschließen

1. Stecke dein Instrument in das Audio-Interface.
2. Klicke in der Karte **Guitar** auf **Connect Guitar**.
3. Der Statuspunkt in der Karte zeigt die Verbindung an. Spiele ein paar Töne.

### Wenn du ein anderes Interface oder einen anderen Eingang nutzt

Ohne weitere Einstellung sucht die App nach einem Focusrite-Interface. Bei
anderen Geräten gehst du so vor:

1. Klicke in der Karte **Guitar** auf das Zahnrad.
2. Wähle deinen Treiber aus.
3. Klicke auf **Detect Channels**.
4. Wähle bei **Guitar Input Channel** und **Mic Input Channel** die Eingänge, in
   denen dein Instrument und dein Mikrofon stecken.
5. Klicke auf **Save**.
6. Klicke auf **Disconnect** und dann wieder auf **Connect Guitar**. Erst dann
   gelten die neuen Einstellungen.

## Den Sound einstellen

Die Karte **Amp** wird aktiv, sobald die Gitarre verbunden ist.

| Regler | Was er macht |
| --- | --- |
| **Gain** | Je höher, desto mehr Verzerrung |
| **Bass** | Tiefe Töne |
| **Middle** | Mittlere Töne |
| **Treble** | Hohe Töne |
| **Reverb** | Raumklang |
| **Output** | Lautstärke des Amps |
| **Delay** | Echo: Häkchen setzen, dann mit dem Regler die Stärke einstellen |

### Stimmgerät

Setze das Häkchen bei **Tuner** und spiele eine einzelne Saite an. Die Anzeige
zeigt den Ton und wie weit du danebenliegst. Du bist richtig gestimmt, wenn der
Zeiger in der Mitte steht und seine Farbe wechselt.

### Echte Amp-Sounds laden

Pocket Studio kann sogenannte **NAM-Modelle** laden. Das sind Dateien, die den
Klang eines echten Verstärkers nachbilden.

1. Besorge dir eine Datei mit der Endung `.nam`, zum Beispiel von
   [TONE3000](https://www.tone3000.com).
2. Klicke in der Karte **Amp** auf **🎛 Load NAM Model (.nam)**.
3. Wähle die Datei aus.

### Presets: Einstellungen speichern

Gib unter den Reglern einen Namen ein und klicke auf **Save Preset**. Mit
**Load** holst du die Einstellungen zurück, mit **🗑** löschst du sie. Ein Preset
speichert die Regler, aber nicht das geladene NAM-Modell.

### Make me Sound Like

Du gibst einen Musiker oder eine Band ein und bekommst passende Verstärker
vorgeschlagen, jeweils mit Link zur Suche bei TONE3000.

> **Hinweis:** Diese Funktion braucht den Online-KI-Dienst. In der installierten
> Version steht dort im Moment, dass sie noch nicht verfügbar ist.

## Mikrofon und Gesang

1. Stecke das Mikrofon in den zweiten Eingang des Interfaces. Manche Mikrofone
   brauchen zusätzlich die 48-V-Taste am Interface.
2. Klicke auf **Connect Guitar**. Dieser Button verbindet das ganze Interface,
   also auch das Mikrofon.
3. Setze in der Karte **Microphone** das Häkchen bei **Enable**.
4. Stelle mit **Gain** die Lautstärke und mit **Reverb** den Raumklang ein.

## Aufnehmen

1. Lade einen Beat und verbinde dein Instrument.
2. Klicke auf **Start Recording** oder drücke die Taste `→`.
3. Die App zählt 2 Takte lang ein. Der Klick dabei wird nicht mit aufgenommen.
4. Danach starten Beat und Aufnahme gemeinsam. Du musst nicht extra auf Play
   klicken.
5. Klicke auf **Stop Recording** oder drücke die Taste `←`.
6. Warte kurz. Solange die App „Saving your last take“ anzeigt, darfst du sie
   nicht schließen.

Deine Aufnahme enthält alles zusammen: Drums, Gitarre und Gesang. Sie liegt als
MP3 in deinem Windows-Ordner **Downloads** und erscheint in der Liste unter dem
Aufnahme-Button.

### Aufnahmen verwalten

| Bedienelement | Was es macht |
| --- | --- |
| Player | Spielt die Aufnahme direkt in der App ab |
| Dateiname | Speichert eine Kopie der Aufnahme |
| **Rename** | Benennt die Aufnahme um |
| **Archive** | Blendet die Aufnahme aus, die Datei bleibt erhalten |
| **Show archived** | Zeigt ausgeblendete Aufnahmen, **Unarchive** holt sie zurück |
| **🗑** | Verschiebt die Datei nach einer Rückfrage in den Windows-Papierkorb |

**Achtung beim Umbenennen:** Die App zeigt nach einem Neustart nur Dateien an,
deren Name mit `pocket-studio-riff-` beginnt. Behalte diesen Anfang also bei,
wenn die Aufnahme in der Liste bleiben soll. Eine anders benannte Datei geht
nicht verloren, sie liegt weiterhin im Ordner Downloads.

### Loops aufnehmen

Setze vor der Aufnahme das Häkchen bei **Loop recording**. Die App schneidet die
Aufnahme dann am Ende des letzten vollständigen Takts ab, damit sie sich sauber
wiederholen lässt.

Bei solchen Aufnahmen ist das 🔁-Häkchen in der Liste schon gesetzt. Du kannst
es auch bei jeder anderen Aufnahme setzen. Dann hast du diese Möglichkeiten:

- **▶ Loop** spielt die Aufnahme ohne Pause in Dauerschleife.
- In der Zeitanzeige stellst du die Länge des Loops ein.
- In der Wellenform legst du Anfang und Ende des Loops fest.

### Wenn Gitarre und Drums nicht genau zusammenpassen

Mit dem Regler **Guitar/Mic Sync** gleichst du das aus. Die App merkt sich den
Wert für die nächsten Aufnahmen.

| In der Aufnahme kommt die Gitarre … | Regler schieben nach … |
| --- | --- |
| zu spät | links (Richtung Minus) |
| zu früh | rechts (Richtung Plus) |

Ändere den Wert in kleinen Schritten und mache jeweils eine kurze Testaufnahme.
Der Regler wirkt nur auf neue Aufnahmen.

## Tastenkürzel

| Taste | Funktion |
| --- | --- |
| `→` | Aufnahme mit Einzählen starten |
| `←` | Aufnahme stoppen |
| `Strg` + `Z` | Letzte Änderung am Beat rückgängig machen |

Die Tasten wirken nicht, solange du gerade in ein Textfeld tippst.

## Wenn etwas nicht klappt

**Ich höre die Drums nicht.**
Prüfe den Regler **Drums** und die Windows-Lautstärke. Die Drums laufen über das
Standard-Ausgabegerät von Windows. Wenn dein Kopfhörer am Interface steckt, stelle
das Interface in Windows als Ausgabegerät ein.

**Die App findet mein Interface nicht.**
Installiere den ASIO-Treiber vom Hersteller, schließe das Interface an und starte
die App neu. Wähle danach über das Zahnrad deinen Treiber aus.

**Connect Guitar funktioniert, aber ich höre nichts.**
Prüfe über das Zahnrad den **Guitar Input Channel**. Trenne danach einmal mit
**Disconnect** und verbinde neu. Prüfe auch die Regler **Gain** und **Output** in
der Karte **Amp** sowie die Lautstärke am Interface.

**Die Karten Amp und Microphone sind leer.**
Klicke zuerst auf **Connect Guitar**. Beide Karten werden erst danach aktiv.

**Das Mikrofon ist stumm.**
Prüfe das Häkchen bei **Enable** und über das Zahnrad den **Mic Input Channel**.
Schalte bei Bedarf die 48-V-Taste am Interface ein.

**Generate a Beat findet nichts.**
Nenne ein Genre, zum Beispiel `punk`, `funk` oder `reggae`, oder suche direkt in
der **Beat Library**.

**Gitarre und Drums sind in der Aufnahme leicht versetzt.**
Stelle den Regler **Guitar/Mic Sync** ein, siehe
[oben](#wenn-gitarre-und-drums-nicht-genau-zusammenpassen).

**Eine Aufnahme fehlt in der Liste.**
Schaue unter **Show archived** nach und danach im Windows-Ordner **Downloads**.
Umbenannte Aufnahmen findest du nach einem Neustart eventuell nur noch dort.

**Der Edit-Button im Song ist grau.**
Der Song läuft gerade. Stoppe ihn mit **⏸ Stop Song**, dann kannst du wieder
bearbeiten.

## Deine Daten

- **Aufnahmen** bleiben auf deinem Gerät und werden nie hochgeladen.
- **Beats, Songs und Presets** speichert die App lokal auf deinem Gerät. Sie
  stehen nur dort zur Verfügung, es gibt keine Cloud und kein automatisches
  Backup. Wichtige Beats sicherst du am besten zusätzlich mit **Export MIDI**.
- **Online-KI-Funktionen** senden nur deinen eingegebenen Text an den KI-Anbieter.
  Bei **Generate a Beat** können das auch einige deiner gespeicherten Beats als
  Stilvorlage sein. Audio wird nie übertragen.

Die vollständigen Angaben stehen in der App unten unter **Privacy & Credits**.

## Hilfe, Feedback und Lizenz

Einen Fehler gefunden oder eine Idee? Klicke unten in der App auf **Send
Feedback**. Dein E-Mail-Programm öffnet sich dann mit einem fertigen Entwurf. Du
kannst auch direkt an feedback.pocketstudio@gmail.com schreiben.

Pocket Studio ist freie Software unter der GNU General Public License Version 3
(GPL-3.0-only) und wird ohne jede Gewährleistung bereitgestellt. Den Quellcode
findest du auf [GitHub](https://github.com/hendrikel80-ai/PcktDrmmr).

ASIO is a trademark of Steinberg Media Technologies GmbH, registered in Europe
and other countries.

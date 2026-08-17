# Drum Pattern JSON Schema

## JSON Schema (für Validierung, z.B. mit ajv/zod)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DrumPattern",
  "type": "object",
  "required": ["bpm", "time_signature", "bars", "pattern"],
  "properties": {
    "bpm": {
      "type": "number",
      "minimum": 40,
      "maximum": 300
    },
    "time_signature": {
      "type": "string",
      "enum": ["4/4", "3/4", "6/8", "2/4", "5/4"]
    },
    "bars": {
      "type": "integer",
      "minimum": 1,
      "maximum": 8
    },
    "style_description": {
      "type": "string",
      "description": "Kurze Beschreibung des Stils, v.a. bei 'im Stile von X' Anfragen"
    },
    "pattern": {
      "type": "object",
      "properties": {
        "kick":          { "$ref": "#/definitions/step_array" },
        "snare":         { "$ref": "#/definitions/step_array" },
        "hihat_closed":  { "$ref": "#/definitions/step_array" },
        "hihat_open":    { "$ref": "#/definitions/step_array" },
        "crash":         { "$ref": "#/definitions/step_array" },
        "ride":          { "$ref": "#/definitions/step_array" },
        "tom_low":       { "$ref": "#/definitions/step_array" },
        "tom_mid":       { "$ref": "#/definitions/step_array" },
        "tom_high":      { "$ref": "#/definitions/step_array" }
      },
      "additionalProperties": false,
      "minProperties": 1
    },
    "humanize": {
      "type": "boolean",
      "default": false
    }
  },
  "definitions": {
    "step_array": {
      "type": "array",
      "description": "16 Steps pro Takt. 0 = stumm, 1-127 = Velocity (1=leise, 127=laut). Array-Länge = bars * 16.",
      "items": {
        "type": "integer",
        "minimum": 0,
        "maximum": 127
      }
    }
  }
}
```

**Hinweis zur Velocity:** Statt nur `0`/`1` nutzt das Pattern Werte `0-127` (MIDI-Velocity-Konvention). So kann die KI z.B. Ghost Notes (`snare: 20`) von Akzenten (`snare: 110`) unterscheiden — klingt sofort weniger mechanisch.

---

## Beispiel 1: Punk Beat, 4/4, 160 BPM

Anfrage: *"Punk Beat 4/4 160 BPM"*

```json
{
  "bpm": 160,
  "time_signature": "4/4",
  "bars": 1,
  "style_description": "Klassischer Punk-Beat: treibende durchgehende Achtel auf der Hihat, Snare auf 2 und 4, Kick auf 1 und die 'and' von 2",
  "pattern": {
    "kick":         [110,0,0,0, 0,0,90,0, 0,0,0,0, 110,0,0,0],
    "snare":        [0,0,0,0, 100,0,0,0, 0,0,0,0, 105,0,0,0],
    "hihat_closed": [80,60,80,60, 80,60,80,60, 80,60,80,60, 80,60,80,60]
  },
  "humanize": true
}
```

## Beispiel 2: "Im Stile von X" (Songs Offspring)

Anfrage: *"Erstelle mir einen Drumbeat im Stile von Self Esteem von The Offspring"*

Zwischenschritt (Modell-Antwort, Textteil vor dem JSON — in der App separat anzeigen):
> "Self Esteem" ist ein Pop-Punk-Song mit treibendem Uptempo-Groove, durchgehenden Achtel-Hihats, kräftiger Backbeat-Snare auf 2/4 und gelegentlichen Vierteltriolen-Fills vor dem Refrain. Tempo liegt im Bereich 150–160 BPM.

```json
{
  "bpm": 155,
  "time_signature": "4/4",
  "bars": 2,
  "style_description": "Pop-Punk-Groove im Stil treibender 90er-Punk-Rock-Beats: durchgehende Achtel-Hihat, Backbeat-Snare, punktuelle Kick-Synkopen",
  "pattern": {
    "kick":         [110,0,0,0, 0,0,90,0, 0,0,0,0, 110,0,0,0,  110,0,0,0, 0,0,90,0, 0,0,0,0, 100,0,90,0],
    "snare":        [0,0,0,0, 100,0,0,0, 0,0,0,0, 105,0,0,0,  0,0,0,0, 100,0,0,0, 0,0,0,0, 30,30,30,110],
    "hihat_closed": [80,60,80,60, 80,60,80,60, 80,60,80,60, 80,60,80,60,  80,60,80,60, 80,60,80,60, 80,60,80,60, 0,0,0,0],
    "crash":        [100,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,  0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
  },
  "humanize": true
}
```
*(Takt 2, letzter Schlag: kleines Snare-Fill als Übergang — bewusst kein Kopieren des Original-Patterns, sondern stilistische Annäherung.)*

---

## Beispiel API-Call (JavaScript, Claude API)

```javascript
const SYSTEM_PROMPT = `Du bist ein Drum-Pattern-Generator für einen Step-Sequencer.
Gib AUSSCHLIESSLICH gültiges JSON zurück, das exakt dem vorgegebenen Schema entspricht.
Kein Fließtext, keine Markdown-Codeblöcke, keine Erklärung — nur das rohe JSON-Objekt.

Schema: [siehe oben, hier einfügen]

Regeln:
- Bei Songanfragen: KEIN 1:1-Nachbau realer Patterns. Übersetze in Stilmerkmale 
  (Genre, Tempo-Range, typische Drum-Elemente) und generiere ein eigenständiges Pattern.
- Nutze variierende Velocity-Werte (0-127) statt nur An/Aus für einen musikalischeren Groove.
- Baue dezente Ghost Notes und kleine Fills ein, besonders am Ende von Mehrtakt-Patterns.
- Bei fehlender BPM-Angabe: wähle einen genretypischen Wert.`;

async function generatePattern(userPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  const data = await response.json();
  const rawText = data.content[0].text;
  return JSON.parse(rawText); // ggf. mit Schema validieren (ajv)
}

// Nutzung:
const pattern = await generatePattern("Punk Beat 4/4 160 BPM");
```

---

## Praxis-Tipps

- **Validierung:** Immer mit `ajv` oder `zod` gegen das Schema prüfen, bevor das Pattern abgespielt wird — LLMs halten Formate nicht 100% zuverlässig ein.
- **Retry-Logik:** Bei ungültigem JSON automatisch 1x erneut anfragen mit Fehlermeldung im Prompt.
- **Few-Shot verbessert Qualität deutlich:** 3-5 handkuratierte Beispiel-Patterns (Funk, Metal, Reggae, Rock) direkt im System-Prompt mitgeben.
- **Style statt Song:** Der Zwischenschritt "Songbeschreibung → Stilmerkmale → Pattern" hält dich rechtlich auf der sicheren Seite und liefert oft musikalisch bessere Ergebnisse als der Versuch, ein reales Pattern zu erraten.

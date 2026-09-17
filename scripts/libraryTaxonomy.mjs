// Gemeinsame Taxonomie für die Beat-Library — einzige Quelle der Wahrheit,
// genutzt sowohl vom Batch-Generator (scripts/generate-library.mjs, baut
// die Variations-Prompts pro Subgenre) als auch vom Server-seitigen
// Matcher (server/library.js, Alias-/BPM-Stichwortsuche auf den
// Nutzer-Prompt). Erweiterbar: einfach weitere Genres/Subgenres ergänzen,
// beide Seiten ziehen automatisch nach.
//
// Jedes Subgenre-Objekt:
//   label       - Anzeige-/Beschreibungstext, fließt in die User-Message
//                 der Batch-Generierung ein (z.B. "Street Punk")
//   aliases     - Stichwörter, gegen die ein Nutzer-Prompt (lowercased)
//                 geprüft wird — längere/spezifischere zuerst, damit z.B.
//                 "pop punk" vor dem allgemeineren "punk" matcht
//   bpmRange    - [min, max] für den BPM-gefilterten Fallback-Schritt in
//                 server/library.js; auch als Vorgabe für die
//                 Batch-Generierung (mittlerer Wert als BPM-Hinweis)
//   variations  - Kurze Zusatz-Anweisungen, die die Batch-Generierung an
//                 die User-Message hängt, damit sich Varianten innerhalb
//                 eines Subgenres unterscheiden (siehe CLAUDE.md-Aufgabe)
//
// Genres ohne sinnvolle Subgenre-Aufteilung (Funk, Reggae) bekommen ein
// einzelnes "general"-Subgenre, damit der Ordner-Walk in server/library.js
// und generate-library.mjs immer exakt zweistufig (genre/subgenre/) bleibt.
//
// Wichtig aus der Praxis (siehe Verifikation des Plans): vage Stil-Wörter
// wie "syncopated kick" oder "with a fill" reichen NICHT aus, um das
// Modell von seinem genre-typischen Standard-Skelett (Kick auf 1 + "&" von
// 2, Snare auf 2+4) wegzubringen — mehrere Testläufe kamen trotz
// unterschiedlicher Anweisung auf ein nahezu identisches Kick-Pattern im
// ersten Takt heraus und wurden vom Ähnlichkeits-Check zu Recht verworfen.
// Die Variations-Texte geben deshalb bewusst KONKRETE, sich gegenseitig
// ausschließende Kick-Platzierungen vor (Beat-/16tel-Positionen benannt),
// statt nur eine Stimmung zu beschreiben — das ist der zuverlässigste
// Hebel, um wirklich unterschiedliche erste Takte zu bekommen.
//
// Zweiter Fund (Nutzer-Feedback nach der ersten vollen Generierung): ohne
// explizite Vorgabe rutscht das Modell beim Hihat sehr häufig zu
// Sechzehnteln, selbst wenn die Anweisung dazu schweigt. Jede
// Variations-Zeile nennt deshalb jetzt explizit "eighth-note hihat (not
// sixteenths)" ODER "sixteenth-note hihat" — bewusst gemischt innerhalb
// jedes Subgenres, statt es dem Modell zu überlassen.
export const LIBRARY_TAXONOMY = {
  punk: {
    label: 'Punk',
    aliases: ['punk'],
    subgenres: {
      'street-punk': {
        label: 'Street Punk',
        aliases: ['street punk', 'streetpunk', 'street-punk'],
        bpmRange: [150, 180],
        variations: [
          'kick ONLY on beat 1 — no other kick hits in bar 1, sparse and driving, steady eighth-note closed hihat throughout (not sixteenths)',
          'kick on beat 1 and the "&" of beat 3 only — leave beat 2 and 4 kick-free, sixteenth-note closed hihat drive',
          'kick avoids beat 1 — place it on the "&" of beat 1 and on beat 3 instead, off-kilter syncopated feel, steady eighth-note hihat (not sixteenths)',
          'kick on every off-beat 16th subdivision ("e" and "a" positions) for a busy, syncopated street-punk feel, steady eighth-note hihat underneath (not sixteenths)',
          'kick doubled as two quick hits right on beat 1, plus a single hit on beat 3, with a full fill in the second half of bar 2, sixteenth-note hihat throughout',
          'kick on beat 1, beat 2, and beat 4 (three hits, skip beat 3) — choppier than the standard backbeat, steady eighth-note hihat (not sixteenths)',
        ],
      },
      'skate-punk': {
        label: 'Skate Punk',
        aliases: ['skate punk', 'skatepunk', 'skate-punk'],
        bpmRange: [170, 220],
        variations: [
          'kick ONLY on beat 1 and beat 3 — clean two-hit pattern, relentless straight-eighth hihat drive (not sixteenths)',
          'kick as a fast sixteenth-note run right before beat 3 (a short double-kick-style burst), otherwise silent, sixteenth-note hihat for a busier drive',
          'kick avoids the downbeats entirely — only on the "&" of beat 2 and the "&" of beat 4, steady eighth-note hihat (not sixteenths)',
          'kick on every "e" 16th-note subdivision (steps 2, 6, 10, 14 counting from 1) for a galloping feel, sixteenth-note hihat throughout',
          'kick on beat 1 plus a sixteenth-note double-kick burst on beat 4, with a fill filling all of bar 2, steady eighth-note hihat (not sixteenths) outside the fill',
        ],
      },
      'pop-punk': {
        label: 'Pop-Punk',
        aliases: ['pop punk', 'pop-punk', 'poppunk'],
        bpmRange: [140, 175],
        variations: [
          'kick ONLY on beat 1 — clean, catchy straight-eighth groove, steady eighth-note hihat (not sixteenths)',
          'kick on beat 1 and the "&" of beat 2 — classic pop-punk push, open eighth-note hihat accents on the off-beats',
          'kick on beat 1 and beat 3 evenly, with busier snare ghost notes between the backbeat hits, sixteenth-note hihat throughout',
          'kick avoids beat 1 — starts on the "&" of beat 1 instead, syncopated pop-punk pickup feel, steady eighth-note hihat (not sixteenths)',
          'kick doubled on beat 3 (two quick hits) with a short fill leading into the last bar, sixteenth-note hihat for extra energy',
        ],
      },
      hardcore: {
        label: 'Hardcore',
        aliases: ['hardcore', 'hardcore punk'],
        bpmRange: [170, 220],
        variations: [
          'kick ONLY on beat 1 — stark, aggressive, driving straight-eighth hihat (not sixteenths)',
          'kick hits every "a" 16th-note subdivision (the last 16th of each beat) — relentless, off-kilter drive, sixteenth-note hihat throughout',
          'kick avoids downbeats — only on the "&" of beat 1 and "&" of beat 3, crash accent on beat 1, steady eighth-note hihat (not sixteenths)',
          'halftime breakdown feel: kick only on beat 1 and beat 3, wide-open snare on beat 3 (not 2+4), sixteenth-note hihat for contrast against the halftime feel',
          'kick doubled as a fast burst right on beat 3, otherwise silent, with a fill every bar, steady eighth-note hihat (not sixteenths)',
        ],
      },
      psychobilly: {
        label: 'Psychobilly',
        aliases: ['psychobilly', 'psycho billy'],
        bpmRange: [180, 220],
        variations: [
          'kick ONLY on beat 1 — fast, driving, steady eighth-note hihat throughout (not sixteenths), relentless psychobilly energy',
          'kick on beat 1 and beat 3, galloping sixteenth-note kick bursts between them, steady eighth-note ride cymbal (not sixteenths)',
          'kick avoids beat 1 — starts on the "&" of beat 2 instead, fast sixteenth-note hihat drive',
          'kick doubled as a fast burst on beat 3, crash accent on beat 1, steady eighth-note hihat (not sixteenths)',
          'kick on every off-beat 16th subdivision for a relentless drive, sixteenth-note hihat throughout',
        ],
      },
      ska: {
        label: 'Ska',
        aliases: ['ska', 'ska punk', 'two-tone', 'two tone'],
        bpmRange: [120, 180],
        variations: [
          'kick ONLY on beat 1 and beat 3, steady eighth-note hihat sharply accenting the off-beats ("and" of each beat) — classic ska skank feel, not sixteenths',
          'kick on beat 1 only, snare/rim on every off-beat, sixteenth-note hihat pattern for a busier ska-punk drive',
          'kick avoids beat 1 — starts on the "&" of beat 1 instead, steady eighth-note hihat with off-beat emphasis (not sixteenths)',
          'kick doubled on beat 3 (two quick hits), crash accent on beat 1, steady eighth-note hihat throughout (not sixteenths)',
          'kick on beat 1, beat 2, and beat 4 (skip beat 3), sixteenth-note hihat drive',
        ],
      },
    },
  },
  metal: {
    label: 'Metal',
    aliases: ['metal'],
    subgenres: {
      thrash: {
        label: 'Thrash Metal',
        aliases: ['thrash', 'thrash metal'],
        bpmRange: [160, 220],
        variations: [
          'kick ONLY on beat 1 and beat 3, fast driving sixteenth-note picking feel on the ride/crash',
          'gallop-rhythm kick (short-short-long feel) landing on beat 1 and beat 3, steady backbeat, steady eighth-note ride (not sixteenths)',
          'kick as a sixteenth-note double-kick burst on beat 2 and beat 4, otherwise silent, sixteenth-note hihat throughout',
          'kick avoids beat 1 — starts on the "&" of beat 1, syncopated off-kilter thrash feel, steady eighth-note ride (not sixteenths)',
          'halftime breakdown feel: kick only on beat 1, wide-open snare hit on beat 3, sixteenth-note hihat for contrast against the halftime feel',
        ],
      },
      doom: {
        label: 'Doom Metal',
        aliases: ['doom', 'doom metal'],
        bpmRange: [55, 90],
        variations: [
          'kick ONLY on beat 1 — extremely sparse, slow halftime groove, huge amount of space, sparse eighth-note ride cymbal (not a continuous sixteenth pulse)',
          'kick on beat 1 and the "&" of beat 3 only — dragging, behind-the-beat snare feel, steady eighth-note ride cymbal underneath',
          'kick avoids beat 1 entirely — a single hit on beat 3 only, crash accent on every downbeat, no continuous hihat pulse',
          'sludgy triplet-feel kick pattern clustered around beat 3, silent everywhere else, sparse eighth-note ride cymbal',
          'kick doubled as two slow hits spanning beat 1 and the "&" of beat 2, nothing else, sixteenth-note hihat for a busier contrast variant',
        ],
      },
      metalcore: {
        label: 'Metalcore',
        aliases: ['metalcore'],
        bpmRange: [140, 190],
        variations: [
          'kick ONLY on beat 1 — driving straight-eighth ride pattern (not sixteenths), nothing else in the kick',
          'breakdown-style kick on beat 1 and the "&" of beat 2 only, heavy snare accents, sixteenth-note hihat throughout',
          'kick avoids downbeats — only on the "&" of beat 1 and "&" of beat 3, steady eighth-note ride (not sixteenths)',
          'halftime breakdown feel: kick only on beat 3, wide-open snare hit alongside it, sixteenth-note hihat for contrast against the halftime feel',
          'double-kick-style sixteenth-note burst on beat 4 only, silent everywhere else, steady eighth-note ride underneath (not sixteenths)',
        ],
      },
    },
  },
  rock: {
    label: 'Rock',
    aliases: ['rock'],
    subgenres: {
      'classic-rock': {
        label: 'Classic Rock',
        aliases: ['classic rock', 'classic-rock'],
        bpmRange: [100, 140],
        variations: [
          'kick ONLY on beat 1 and beat 3 — straightforward, driving backbeat groove, steady eighth-note hihat (not sixteenths)',
          'kick on beat 1 and the "&" of beat 2 — classic syncopated rock push, sixteenth-note hihat for a busier push',
          'kick avoids beat 1 — starts on the "&" of beat 1 instead, slightly laid-back feel, steady eighth-note hihat (not sixteenths)',
          'kick doubled on beat 3 (two quick hits), open eighth-note hihat accents on the off-beats',
          'kick on beat 1, skip beat 3 entirely, add a hit on the "&" of beat 4 with a fill every 4 bars, sixteenth-note hihat throughout',
        ],
      },
      'indie-rock': {
        label: 'Indie Rock',
        aliases: ['indie rock', 'indie-rock', 'indie'],
        bpmRange: [100, 135],
        variations: [
          'kick ONLY on beat 1 — loose, understated groove with light ghost notes, steady eighth-note hihat, sparse and understated (not sixteenths)',
          'kick on beat 1 and the "&" of beat 3, steady straight-eighth feel with subtle dynamics throughout, including the hihat',
          'kick avoids downbeats — only on the "&" of beat 2, steady eighth-note hihat with open accents off-beat (not sixteenths)',
          'kick doubled as two soft hits around beat 3, with a short fill leading into the last bar, sixteenth-note hihat for contrast',
          'kick on beat 1 and beat 2 (back-to-back), skip beats 3 and 4 entirely for a lopsided feel, steady eighth-note hihat (not sixteenths)',
        ],
      },
      'rock-n-roll': {
        label: "Rock 'n' Roll",
        aliases: ["rock n roll", "rock'n'roll", 'rock and roll', '50s rock'],
        bpmRange: [120, 180],
        variations: [
          "kick ONLY on beat 1 and beat 3 — classic 1950s rock'n'roll two-beat feel, steady eighth-note hihat throughout (not sixteenths)",
          'kick on every beat (1, 2, 3, 4), shuffle-feel hihat, snare backbeat on 2 and 4',
          'kick avoids beat 1 — starts on the "&" of beat 1 instead, steady eighth-note ride pattern (not sixteenths)',
          'kick doubled on beat 3 (two quick hits), crash accent on beat 1, driving eighth-note hihat (not sixteenths)',
          'kick on beat 1 and beat 2 back-to-back, skip beats 3 and 4, sixteenth-note hihat for a busier contrast variant',
        ],
      },
      rockabilly: {
        label: 'Rockabilly',
        aliases: ['rockabilly'],
        bpmRange: [150, 200],
        variations: [
          'kick ONLY on beat 1 — fast, driving, steady eighth-note hihat throughout (not sixteenths), classic rockabilly energy',
          'kick on beat 1 and beat 3, shuffle-feel hihat with accented triplets',
          'kick avoids beat 1 — starts on the "&" of beat 2 instead, steady eighth-note ride drive (not sixteenths)',
          'kick doubled on beat 3 (two quick hits), crash accent on beat 1, sixteenth-note hihat for a busier variant',
          'kick on every off-beat 16th subdivision for a galloping feel, steady eighth-note ride accents (not sixteenths)',
        ],
      },
    },
  },
  funk: {
    label: 'Funk',
    aliases: ['funk'],
    subgenres: {
      general: {
        label: 'Funk',
        aliases: ['funk'],
        bpmRange: [90, 115],
        variations: [
          'kick ONLY on beat 1 and the "&" of beat 2 — tight pocket, syncopated sixteenth-note hihat with ghost-note snare fills',
          'kick on the "e" of beat 1 and beat 3 only (avoid landing squarely on beat 1), heavily ghosted snare, sixteenth-note hihat throughout',
          'kick pattern spread across three off-beat 16th positions, none on a downbeat, sixteenth-note hihat with open accents on the "and"',
          'kick doubled on beat 1 (two quick hits) plus a hit on the "&" of beat 3, with a fill every 4 bars, steady eighth-note hihat (not sixteenths) for a more laid-back funk pocket',
          'kick avoids beat 1 entirely — starts on the "a" of beat 1, deeply syncopated pocket, sixteenth-note hihat throughout',
        ],
      },
    },
  },
  reggae: {
    label: 'Reggae',
    aliases: ['reggae'],
    subgenres: {
      general: {
        label: 'Reggae',
        aliases: ['reggae'],
        bpmRange: [70, 95],
        variations: [
          'classic one-drop feel: kick and snare land together ONLY on beat 3, silent on beats 1, 2 and 4, steady eighth-note hihat pulse (not sixteenths)',
          'steppers feel: kick on every beat (1, 2, 3, 4), laid-back sparse eighth-note hihat pattern (not sixteenths)',
          'rockers feel: kick on beat 1 and beat 3 with a syncopated kick accent on the "&" of beat 2, sixteenth-note hihat for a busier feel',
          'kick avoids beat 3 (unlike one-drop) — hits on beat 1 and the "&" of beat 4 instead, with a fill every 4 bars, steady eighth-note hihat (not sixteenths)',
          'kick doubled on beat 1 (two quick hits), silent for the rest of the bar, deep laid-back pocket, sixteenth-note hihat throughout',
        ],
      },
    },
  },
  blues: {
    label: 'Blues',
    aliases: ['blues'],
    subgenres: {
      'chicago-blues': {
        label: 'Chicago Blues',
        aliases: ['chicago blues', 'chicago-blues', 'electric blues', 'shuffle blues'],
        bpmRange: [90, 120],
        variations: [
          'kick ONLY on beat 1 — swung shuffle-feel closed hihat throughout, laid-back blues shuffle groove',
          'kick on beat 1 and beat 3, shuffle hihat with accented triplets, snare backbeat on 2 and 4',
          'kick avoids beat 1 — starts on the "&" of beat 2 instead, loose swung shuffle hihat feel',
          'kick doubled on beat 3 (two quick hits), shuffle hihat, crash accent on bar 1 downbeat',
          'kick on every off-beat 16th subdivision for a busier drive, but a STRAIGHT (non-shuffle) steady eighth-note hihat instead of the usual shuffle feel — more driving, less swung',
        ],
      },
      'slow-blues': {
        label: 'Slow Blues',
        aliases: ['slow blues', 'slow-blues', 'delta blues', '12/8 blues'],
        bpmRange: [55, 80],
        variations: [
          'kick ONLY on beat 1 — very sparse, slow blues feel, huge amount of space, sparse eighth-note ride cymbal (quarter or eighth notes, lots of space)',
          'kick on beat 1 and the "&" of beat 3 only, laid-back dragging snare feel, sparse eighth-note ride pattern',
          'kick avoids beat 1 entirely — a single hit on beat 3 only, soft sparse eighth-note ride cymbal instead of hihat',
          'kick doubled as two slow hits around beat 1, sparse eighth-note ride pattern, nothing else',
          'kick on beat 1 and beat 2 back-to-back, skip beats 3 and 4 entirely for a lopsided blues feel, sparse eighth-note ride, lots of space',
        ],
      },
    },
  },
  country: {
    label: 'Country',
    aliases: ['country'],
    subgenres: {
      'classic-country': {
        label: 'Classic Country',
        aliases: ['classic country', 'classic-country', 'train beat', 'two-step', 'two step'],
        bpmRange: [95, 130],
        variations: [
          'kick ONLY on beat 1 and beat 3 — classic country two-step, steady eighth-note closed hihat (not sixteenths)',
          'train-beat feel: kick on every beat (1, 2, 3, 4), snare on every off-beat for a rolling feel',
          'kick avoids beat 1 — starts on the "&" of beat 1 instead, syncopated country push, steady eighth-note hihat (not sixteenths)',
          'kick doubled on beat 3 (two quick hits), open eighth-note hihat accents on the off-beats',
          'kick on beat 1, skip beat 3 entirely, add a hit on the "&" of beat 4 with a fill every 4 bars, sixteenth-note hihat for a busier variant',
        ],
      },
      'country-rock': {
        label: 'Country Rock',
        aliases: ['country rock', 'country-rock', 'outlaw country'],
        bpmRange: [110, 150],
        variations: [
          'kick ONLY on beat 1 and beat 3 — driving, upbeat country-rock backbeat, steady eighth-note hihat (not sixteenths)',
          'kick on beat 1 and the "&" of beat 2, sixteenth-note hihat drive for a busier variant',
          'kick avoids beat 1 — starts on the "&" of beat 1 instead, syncopated feel, steady eighth-note hihat (not sixteenths)',
          'kick doubled on beat 3 (two quick hits), crash accent on beat 1 of each bar, sixteenth-note hihat throughout',
          'kick on beat 1, beat 2, and beat 4 (skip beat 3), choppier driving feel, steady eighth-note hihat (not sixteenths)',
        ],
      },
    },
  },
};

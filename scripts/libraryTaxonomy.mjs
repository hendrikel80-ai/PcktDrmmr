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
  'hip-hop': {
    label: 'Hip-Hop',
    aliases: ['hip hop', 'hip-hop', 'rap', 'boom bap'],
    subgenres: {
      'boom-bap': {
        label: 'Boom Bap',
        aliases: ['boom bap', 'boom-bap', '90s hip hop', 'old school hip hop', 'golden era'],
        bpmRange: [85, 95],
        variations: [
          'kick ONLY on beat 1 and the "e" of beat 3 — sparse, laid-back boom-bap pocket, swung eighth-note hihat throughout (not straight)',
          'kick on beat 1 and a syncopated hit on the "a" of beat 2, heavy snare on 2 and 4 with a soft ghost note right before beat 3, sparse swung hihat with an open-hat accent on the last off-beat',
          'kick avoids beat 1 — enters on the "&" of beat 1 instead, dragging sample-chopped shuffle feel, sixteenth-note hihat for a busier variant',
          'kick doubled as a quick pair right before beat 3, otherwise sparse and spacious, swung eighth-note hihat with an occasional open-hat lift, heavy snare backbeat on 2 and 4',
          'kick on beat 1 and the "e" of beat 4 for a dragging, behind-the-beat feel, steady eighth-note hihat (not sixteenths), heavy snare with a soft ghost note leading into the backbeat',
          'kick on beat 1 and a lazy, dragging hit just before beat 4 (the "a" of beat 3), heavy snare on 2 and 4 with a soft ghost roll leading in, swung eighth-note hihat with an open-hat lift on the last off-beat',
          'minimal, spacious boom-bap: kick on beat 1 only, snare backbeat on 2 and 4 with a single ghost note before beat 2, very sparse swung eighth-note hihat (lots of space), no fills',
          'boom-bap with a double-kick flourish on the "&" and "a" of beat 4, heavy snare on 2 and 4, sixteenth-note hihat for a busier, more sample-chopped feel, single crash accent on bar 1',
        ],
      },
    },
  },
  pop: {
    label: 'Pop',
    aliases: ['pop', 'pop music', 'mainstream pop'],
    subgenres: {
      'modern-pop': {
        label: 'Modern Pop',
        aliases: ['modern pop', 'pop', 'contemporary pop', 'radio pop'],
        bpmRange: [95, 130],
        variations: [
          'kick ONLY on beat 1 and beat 3 — clean, radio-friendly pop backbeat, steady eighth-note closed hihat (not sixteenths)',
          'kick on beat 1 and the "&" of beat 2 — catchy syncopated pop push, sixteenth-note hihat for a busier, more produced feel',
          'four-on-the-floor kick (every beat: 1, 2, 3, 4), steady eighth-note hihat, big pop chorus energy',
          'kick avoids beat 1 — starts on the "&" of beat 1 instead, modern trap-pop-influenced push, sixteenth-note hihat with rolls',
          'kick doubled on beat 3 (two quick hits), open eighth-note hihat accents on the off-beats, polished pop-radio feel',
          'kick on beat 1, skip beat 3 entirely, syncopated hit on the "a" of beat 4 instead, steady eighth-note hihat (not sixteenths)',
          'minimal, spacious verse-style kick on beat 1 only, soft snare with ghost notes, sparse eighth-note hihat — pop verse dynamic before a bigger chorus',
          'kick on beat 1 and the "&" of beat 2 with an extra push on the "a" of beat 4, sixteenth-note hihat with velocity rolls building into the backbeat, upbeat contemporary pop energy',
        ],
      },
    },
  },
  jazz: {
    label: 'Jazz',
    aliases: ['jazz', 'swing', 'bebop'],
    subgenres: {
      swing: {
        label: 'Swing',
        aliases: ['swing', 'bebop', 'jazz swing', 'straight-ahead jazz'],
        bpmRange: [100, 200],
        variations: [
          'classic swing ride pattern carrying the whole groove, soft "feathered" kick on every beat at low velocity, pedal hihat chick on beats 2 and 4, sparse comping snare with ghost notes',
          'up-tempo bebop ride pattern, kick used sparingly for accents only (not on the beat), pedal hihat chick on 2 and 4, snare comping with syncopated accents',
          'medium swing feel, ride carrying a steady pulse, kick dropping accented "bombs" at irregular points, snare ghost notes throughout, hihat chick on 2 and 4',
          'ballad-style slow swing, sparse ride pattern with lots of space, very soft low-velocity snare texture, minimal kick, hihat chick on 2 and 4 only',
          'walking swing groove, steady ride pattern, kick lightly reinforcing beat 1 and 3, snare comping with occasional accents, hihat chick on 2 and 4',
          'fast bebop drive, busy ride cymbal pattern, kick accents syncopated off the beat, snare peppered with ghost notes and the occasional accent, hihat chick on 2 and 4',
          'laid-back swing feel, kick on beat 1 only, snare comping sparse and behind the beat, hihat chick on 2 and 4',
          'swing groove building intensity: ride pattern gets denser toward the end of the bar, kick accents increase, snare fill in the last beat, hihat chick on 2 and 4 throughout',
        ],
      },
    },
  },
  electronic: {
    label: 'Electronic',
    aliases: ['electronic', 'edm', 'house', 'techno'],
    subgenres: {
      'four-on-the-floor': {
        label: 'Four on the Floor',
        aliases: ['house', 'techno', 'four on the floor', 'four-on-the-floor', 'edm'],
        bpmRange: [120, 135],
        variations: [
          'classic four-on-the-floor house: kick on every beat (1, 2, 3, 4), open hihat on the off-beat eighth notes, claps/snare on beats 2 and 4, steady sixteenth-note closed hihat texture underneath',
          'techno-driving four-on-the-floor: kick on every beat, no open hihat, relentless sixteenth-note closed hihat throughout, snare/clap on 2 and 4',
          'four-on-the-floor with syncopated off-beat kick accent — kick on every beat PLUS a soft extra hit on the "a" of beat 3, open hihat on off-beats, claps on 2 and 4',
          'deep house groove: kick on every beat, open hihat lifting on the "&" of beat 2 and beat 4 only (sparser than usual), soft claps on 2 and 4, minimal sixteenth-note closed hihat',
          'four-on-the-floor build-up feel: kick on every beat, closed hihat sixteenth notes increasing in velocity toward the end of the bar, claps on 2 and 4, open hihat accent on the last "and" of the bar',
          'four-on-the-floor with a percussive kick pattern: kick on every beat plus a double-kick flourish on beat 4 ("&" and "a"), open hihat off-beats, claps on 2 and 4',
          'stripped-back minimal techno: kick on every beat only, sparse open hihat on the "&" of every beat, claps on 2 and 4 kept soft',
          'four-on-the-floor with a breakdown-style halftime clap: kick on every beat, claps only on beat 3 (halftime backbeat), steady sixteenth-note closed hihat throughout, open hihat accent on the last beat',
        ],
      },
    },
  },
  latin: {
    label: 'Latin',
    aliases: ['latin', 'salsa', 'bossa nova', 'latin rock'],
    subgenres: {
      'latin-groove': {
        label: 'Latin Groove',
        aliases: ['latin groove', 'salsa', 'son', 'mambo', 'bossa nova', 'latin rock', 'songo'],
        bpmRange: [90, 180],
        variations: [
          'son montuno-inspired feel: kick on beat 1 and the "&" of beat 2, snare/rim ghost-note accents following a clave-adjacent syncopation, steady eighth-note closed hihat, occasional tom accent on the "&" of beat 4',
          'Latin rock groove: kick on beat 1 and beat 3 with a syncopated push on the "&" of beat 2, snare backbeat on 2 and 4 with tom fills bridging into the next bar, steady eighth-note hihat',
          'songo-style groove: busy syncopated kick hitting off-beat sixteenth positions, snare/rim ghost notes throughout for a rolling feel, sixteenth-note hihat, tom accents outlining a clave-like rhythm',
          'bossa nova-inspired laid-back groove: sparse kick on beat 1 and the "&" of beat 3, soft snare with ghost notes, steady eighth-note ride instead of hihat for a smoother, jazzier texture',
          'cha-cha-adjacent groove: kick on beat 1 and beat 3, syncopated snare rim accents on the off-beats, steady eighth-note hihat, accent tom hit on the "&" of beat 4',
          'Latin-funk crossover: kick syncopated on the "e" and "a" of beat 2, heavy snare backbeat on 2 and 4 with ghost notes, sixteenth-note hihat with open accents, tom fill every 2 bars',
          'mambo-inspired driving groove: kick on beat 1 and the "&" of beat 2 and beat 3, snare accents outlining a clave-adjacent syncopation, steady eighth-note ride, crash accent on bar 1 downbeat',
          'Latin ballad feel: sparse kick on beat 1 only, soft snare with ghost notes throughout, sparse eighth-note ride for a spacious feel, single tom accent closing each phrase',
        ],
      },
    },
  },
  fills: {
    label: 'Fills',
    aliases: ['fill', 'fills', 'drum fill', 'fill-in', 'fill in'],
    subgenres: {
      'quarter-bar-fills': {
        label: 'Quarter-Bar Fills',
        aliases: ['quarter bar fill', 'quarter-bar fill', 'short fill', 'one-beat fill'],
        bpmRange: [90, 140],
        variations: [
          'one bar total: kick ONLY on beat 1 for the groove (beats 1-3), snare on beat 2, straight eighth-note hihat under the groove, then beat 4 filled entirely with a fast sixteenth-note snare roll (four snare hits)',
          'one bar total: kick on beat 1 and beat 3 for the groove, snare on beat 2, straight eighth-note hihat, then beat 4 filled with a descending tom cascade: high tom, high tom, mid tom, low tom (one per sixteenth note)',
          'one bar total: kick on beat 1 and the "&" of beat 2 for the groove, snare on beat 2, straight eighth-note hihat, then beat 4 filled with two kick+snare unison hits on the downbeat and the "&" of beat 4, silent on the other two sixteenths',
          'one bar total: kick on the "&" of beat 1 only (no kick on the downbeat) for the groove, snare on beat 2, straight eighth-note hihat, then beat 4 filled with alternating kick and snare on all four sixteenth notes (kick, snare, kick, snare)',
          'one bar total: kick on beat 1, beat 2, and beat 3 (kick on every beat) for the groove, snare on beat 2, straight eighth-note hihat, then beat 4 has a single accented crash cymbal plus kick hit on the downbeat only, completely silent for the rest of beat 4',
          'one bar total: kick on the "e" of beat 1 and on beat 3 for the groove, snare on beat 2, sixteenth-note hihat throughout the groove, then beat 4 filled with a rapid tom cascade alternating high tom and mid tom on all four sixteenth notes',
          'one bar total: kick doubled on beat 1 (two quick sixteenth-note hits right on the downbeat) plus a single hit on beat 3 for the groove, snare on beat 2, straight eighth-note hihat, then beat 4 filled with a busy snare pattern hitting all four sixteenth notes at increasing velocity',
          'one bar total: kick on beat 2 only (no kick on beat 1 or beat 3) for the groove, snare on beat 2 doubled together with the kick, straight eighth-note hihat, then beat 4 filled with an open hihat hit on the downbeat combined with a snare hit on the third sixteenth note',
          'one bar total: kick on beat 1 and the "a" of beat 2 for the groove, snare on beat 2, straight eighth-note hihat, then beat 4 has just a single sparse ghost-note snare hit on the second sixteenth note ("e" of beat 4), silent otherwise',
          'one bar total: kick ONLY on the off-beat "&" positions of beats 1, 2, and 3 (no kick on any downbeat) for the groove, snare on beat 2, sixteenth-note hihat throughout, then beat 4 filled with alternating kick and snare ending on an accented crash on the last sixteenth note',
          'one bar total: kick on beat 1, the "e" of beat 2, and beat 3 for the groove, snare on beat 2, straight eighth-note hihat, then beat 4 filled with a tom-only pattern: mid tom, low tom, mid tom, low tom on all four sixteenth notes',
          'one bar total: kick on beat 1 only for the groove, snare on beat 2 with a ghost note right before it, sparse eighth-note ride cymbal instead of hihat, then beat 4 has one single, big accented snare hit on the downbeat only, completely silent for the rest of the beat',
          'one bar total: kick on beat 1 and the "&" of beat 3 for the groove, snare on beat 2, relentless sixteenth-note closed hihat throughout the groove, then beat 4 filled with a fast kick-driven sixteenth-note run (kick on all four sixteenths) with a crash cymbal accent landing exactly on the downbeat of beat 4',
          'one bar total: no kick at all during beats 1-3 (kick completely silent), snare on beat 2, straight eighth-note hihat, then beat 4 filled with a quick snare double-hit on the downbeat and the "&" of beat 4 only',
          'one bar total: kick on beat 1 and the "e" of beat 3 for the groove, snare on beat 2, straight eighth-note hihat, then beat 4 filled with a rising pattern ending in a crash: low tom, mid tom, high tom, crash cymbal (one hit per sixteenth note)',
          'one bar total: kick on beat 1 and beat 3, snare on the "&" of beat 2 instead of the downbeat, sixteenth-note hihat throughout the groove, then beat 4 filled with a fast descending tom run: high, mid, low, low',
          'one bar total: kick on beat 1 only, snare doubled on beat 2 and beat 3 (two backbeat hits instead of one), open hihat on every off-beat eighth note during the groove, then beat 4 has a single crash hit on the downbeat only, silent after',
          'one bar total: no hihat or ride at all during the groove (cymbals completely silent), kick on beat 1 and beat 2, snare on beat 3 instead of beat 2, then beat 4 filled with a busy sixteenth-note snare roll',
          'one bar total: kick on the "e" of beat 1 and on beat 2, snare on beat 2 plus a ghost note on the "a" of beat 1, ride cymbal quarter-note pulse instead of hihat, then beat 4 filled with alternating kick and tom hits on all four sixteenths',
          'one bar total: kick on beat 3 only (nothing on beat 1 or 2), snare on beat 1 and beat 2 instead of the usual backbeat, sixteenth-note hihat throughout, then beat 4 filled with a rising tom cascade ending on a crash',
          'one bar total: kick on beat 1 and the "a" of beat 1, snare on the "&" of beat 1 and on beat 2, straight eighth-note ride cymbal instead of hihat, then beat 4 filled with a kick-and-snare unison hit on every sixteenth note',
          'one bar total: kick on the "&" of beat 1, the "&" of beat 2, and the "&" of beat 3 (off-beats only, no downbeats), snare on beat 2 only, open hihat on the downbeat of each beat, then beat 4 has a single accented snare hit on the "&" only, silent elsewhere',
          'one bar total: kick on beat 1 and beat 2, snare ghost notes on the "e" of beat 1 and the "a" of beat 2 in addition to the beat-2 backbeat, sixteenth-note hihat with alternating velocity accents, then beat 4 filled with tom hits on the first three sixteenths and a crash on the last',
          'one bar total: kick on beat 1 only, snare on beat 2 and beat 3 together (double backbeat), swung eighth-note hihat, then beat 4 filled with a triplet-feel kick-snare-kick pattern',
          'one bar total: kick completely silent throughout beats 1-3, snare on beat 1, beat 2, and beat 3 (every beat), straight eighth-note hihat, then beat 4 filled with a fast kick-only sixteenth-note run',
          'one bar total: kick on the "&" of beat 2 only, snare on beat 1 and beat 3 instead of the usual backbeat, ride cymbal instead of hihat, then beat 4 filled with a descending tom-then-crash pattern',
          'one bar total: kick on beat 1, beat 2, and the "&" of beat 3, snare reduced to a single ghost note on the "e" of beat 2 (no strong backbeat), sixteenth-note hihat throughout, then beat 4 filled with an open-hihat-and-snare combo on the first and third sixteenth notes',
        ],
      },
    },
  },
};

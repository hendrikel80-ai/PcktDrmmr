# Pocket Studio – User Guide

Pocket Studio gives you a drummer to play along with. Pick a beat or build your
own, play guitar, bass or vocals over it, and record everything together as an
MP3.

Buttons are written here exactly as they appear in the app, for example
**Start Recording**.

*Deutsche Version: [Benutzerhandbuch](Benutzerhandbuch.md)*

## Contents

1. [What you need](#what-you-need)
2. [Installation](#installation)
3. [Your first beat in 5 minutes](#your-first-beat-in-5-minutes)
4. [Finding and building beats](#finding-and-building-beats)
5. [Building a whole song](#building-a-whole-song)
6. [Connecting a guitar or bass](#connecting-a-guitar-or-bass)
7. [Shaping your sound](#shaping-your-sound)
8. [Microphone and vocals](#microphone-and-vocals)
9. [Recording](#recording)
10. [Keyboard shortcuts](#keyboard-shortcuts)
11. [Troubleshooting](#troubleshooting)
12. [Your data](#your-data)
13. [Help, feedback and license](#help-feedback-and-license)

## What you need

**For beats only:** a Windows PC with speakers or headphones.

**To play guitar, bass or vocals along, you also need:**

- an audio interface, the box you plug your instrument into (for example a
  Focusrite Scarlett)
- the **ASIO driver** for that interface. You get it from the interface's
  manufacturer. Without an ASIO driver, the app can't detect your instrument.

## Installation

1. Open the [download page](https://github.com/hendrikel80-ai/PcktDrmmr/releases).
2. Under the latest version, download the file ending in `-setup.exe`.
3. Double-click the file to start it.
4. Windows will probably show the warning "Windows protected your PC". This is
   because the app doesn't have a paid code signature yet. Click **More info**,
   then **Run anyway**.
5. Accept the license and follow the installer.
6. Start the app from the Start menu. Search for "pocket-studio".

## Your first beat in 5 minutes

1. Scroll to the **Drums** section.
2. Under **Beat Library**, pick a genre, a subgenre and a pattern.
3. Click **Load from Library**.
4. Click **▶ Play**. The beat now plays in a loop.
5. Set the tempo with **−** and **+** next to **BPM**.
6. Set the volume with the **Drums** slider.

That's it, you can start playing along.

## Finding and building beats

Above the drum section you switch between two views:

| View | What it's for |
| --- | --- |
| **Jam** | Finding beats, building them and playing along |
| **Songwriting** | Putting several beats together into a song |

### Beat Library

The library holds more than 100 ready-made beats from rock, punk, metal, funk,
reggae, blues, country, jazz, latin, pop, hip-hop and electronic. There are also
fills, and an empty bar under **Transitions → Empty Bar**. What that's good for
is explained under [Empty bars for transitions](#empty-bars-for-transitions).

### Generate a Beat

Type what you're looking for and click **✨ Generate**. For example:

- `punk 160 bpm`
- `funk`
- `reggae`

The app then searches the library for a matching genre and tempo.

> **Note:** In the installed version, this currently only works with genres.
> Free-form requests like "in the style of Nirvana" need the online AI service,
> which isn't available there yet. The app shows a message in that case.

### Build a Beat: programming your own

In the grid below, each row is one instrument, for example kick, snare or hi-hat.
Each box is a short moment within the bar, and the numbers 1 to 4 at the top
show the beats.

Click a box to change how hard it's hit. Each click moves one level further:

| Level | Meaning |
| --- | --- |
| **Off** | No hit |
| **Ghost** | Very soft hit |
| **Normal** | Normal hit |
| **Accent** | Strong, accented hit |

These are the main tools:

| Control | What it does |
| --- | --- |
| **Bar / Bars** (− and +) | Makes the beat 1 to 8 bars long |
| **BPM** | Sets the tempo, from 40 to 300 |
| **Undo** or `Ctrl` + `Z` | Undoes the last change to the beat (not tempo changes) |
| **✕ Clear** | Removes all hits from the current beat |
| **Save** | Saves the beat under the name you type in first |
| **Load** | Loads the selected saved beat |
| **🗑** | Deletes the selected saved beat |
| **Export MIDI** | Saves the beat as a MIDI file for other music software |

**Tip:** You can edit a library beat the same way. Load it, change a few boxes
and save it under your own name.

## Building a whole song

1. Switch to **Songwriting**.
2. Under **Build a Song**, add the parts of your song:
   - **From Library** takes a beat from the library.
   - **From Own Patterns** takes a beat you saved yourself.

   **+ Add to Song** adds it to the song.
3. For each part, set how often it repeats (1 to 32 times) and its tempo.
4. Change the order with the arrows if needed.
5. Click **▶ Play Song**. The part that's currently playing is highlighted.
6. Type a name and click **Save Song**.

With **Loop whole song**, the song starts over when it reaches the end.
**Export MIDI** saves the whole song as a MIDI file.

**Important:** A song only remembers references to your saved beats. If you
delete a beat that's used in the song, the song stops at that point and shows a
message.

### Empty bars for transitions

You often know there should be a transition between verse and chorus before
you've programmed it. That's what the empty bar is for: a placeholder you put
into the song and fill with hits later.

1. Under **From Library**, pick the genre **Transitions**, the subgenre **Empty
   Bar** and the pattern, then click **+ Add to Song**. The empty bar is added at
   the end of the song. Move it to the right spot with the arrows.
2. Click **✎ Edit** on that part. The empty bar is loaded into the grid.
3. Click in the hits you want, for example a fill. Use **Bar / Bars** to make the
   transition longer if needed. Click **▶ Play** to listen to it.
4. Click **Save to song entry**. You'll see "Saved to the song entry."
5. Click **Done** when you're finished.
6. Click **Save Song** so the song itself is saved too.

Every empty bar you add from the library is a separate pattern. So you can put
several of them into one song and fill each one differently.

**Good to know:**

- **✎ Edit** works on every part of the song, not just on empty bars.
- While the song is playing, **✎ Edit** is disabled. **▶ Play Song** ends
  editing automatically, so click **Save to song entry** first.
- For a part from **From Own Patterns**, you're changing the saved beat itself.
  If it appears several times in the song, all of those places change with it.
- You can also load the empty bar via **Generate a Beat** by typing `empty bar`.

## Connecting a guitar or bass

1. Plug your instrument into the audio interface.
2. In the **Guitar** card, click **Connect Guitar**.
3. The status dot in the card shows the connection. Play a few notes.

### If you use a different interface or input

By default, the app looks for a Focusrite interface. For other devices:

1. Click the gear icon in the **Guitar** card.
2. Select your driver.
3. Click **Detect Channels**.
4. Under **Guitar Input Channel** and **Mic Input Channel**, choose the inputs
   your instrument and microphone are plugged into.
5. Click **Save**.
6. Click **Disconnect**, then **Connect Guitar** again. The new settings only
   take effect after that.

## Shaping your sound

The **Amp** card becomes active once the guitar is connected.

| Control | What it does |
| --- | --- |
| **Gain** | The higher, the more distortion |
| **Bass** | Low frequencies |
| **Middle** | Mid frequencies |
| **Treble** | High frequencies |
| **Reverb** | Room sound |
| **Output** | Amp volume |
| **Delay** | Echo: tick the box, then set the amount with the slider |

### Tuner

Tick **Tuner** and play a single string. The display shows the note and how far
off you are. You're in tune when the pointer sits in the middle and changes
color.

### Loading real amp sounds

Pocket Studio can load **NAM models**. These are files that recreate the sound
of a real amplifier.

1. Get a file ending in `.nam`, for example from
   [TONE3000](https://www.tone3000.com).
2. In the **Amp** card, click **🎛 Load NAM Model (.nam)**.
3. Select the file.

### Presets: saving your settings

Type a name below the controls and click **Save Preset**. **Load** brings the
settings back, **🗑** deletes them. A preset saves the controls, but not the
loaded NAM model.

### Make me Sound Like

You enter a musician or band and get matching amplifiers suggested, each with a
link to a TONE3000 search.

> **Note:** This feature needs the online AI service. In the installed version,
> it currently says it isn't available yet.

## Microphone and vocals

1. Plug the microphone into the interface's second input. Some microphones also
   need the 48V button on the interface.
2. Click **Connect Guitar**. This button connects the whole interface, including
   the microphone.
3. In the **Microphone** card, tick **Enable**.
4. Set the volume with **Gain** and the room sound with **Reverb**.

## Recording

1. Load a beat and connect your instrument.
2. Click **Start Recording** or press the `→` key.
3. The app counts in for 2 bars. The click isn't recorded.
4. Then the beat and the recording start together. You don't need to click Play
   separately.
5. Click **Stop Recording** or press the `←` key.
6. Wait a moment. Don't close the app while it shows "Saving your last take".

Your recording contains everything together: drums, guitar and vocals. It's
saved as an MP3 in your Windows **Downloads** folder and appears in the list
below the record button.

### Managing recordings

| Control | What it does |
| --- | --- |
| Player | Plays the recording right in the app |
| File name | Saves a copy of the recording |
| **Rename** | Renames the recording |
| **Archive** | Hides the recording, the file is kept |
| **Show archived** | Shows hidden recordings, **Unarchive** brings them back |
| **🗑** | Moves the file to the Windows Recycle Bin after asking you |

**Careful when renaming:** After a restart, the app only lists files whose name
starts with `pocket-studio-riff-`. Keep that beginning if you want the recording
to stay in the list. A file with a different name isn't lost, it's still in your
Downloads folder.

### Recording loops

Tick **Loop recording** before you record. The app then cuts the recording at
the end of the last complete bar, so it repeats cleanly.

For these recordings, the 🔁 box in the list is already ticked. You can tick it
for any other recording too. That gives you these options:

- **▶ Loop** plays the recording in an endless loop without a gap.
- The time display sets the length of the loop.
- The waveform lets you set where the loop starts and ends.

### If guitar and drums don't line up exactly

Use the **Guitar/Mic Sync** slider to fix this. The app remembers the value for
your next recordings.

| In the recording, the guitar comes in … | Move the slider … |
| --- | --- |
| too late | left (towards minus) |
| too early | right (towards plus) |

Change the value in small steps and make a short test recording each time. The
slider only affects new recordings.

## Keyboard shortcuts

| Key | Function |
| --- | --- |
| `→` | Start recording with count-in |
| `←` | Stop recording |
| `Ctrl` + `Z` | Undo the last change to the beat |

The keys don't work while you're typing in a text field.

## Troubleshooting

**I can't hear the drums.**
Check the **Drums** slider and the Windows volume. The drums play through the
Windows default output device. If your headphones are plugged into the
interface, set the interface as the output device in Windows.

**The app can't find my interface.**
Install the manufacturer's ASIO driver, connect the interface and restart the
app. Then select your driver via the gear icon.

**Connect Guitar works, but I can't hear anything.**
Check the **Guitar Input Channel** via the gear icon. Then click **Disconnect**
and connect again. Also check the **Gain** and **Output** controls in the
**Amp** card and the volume on your interface.

**The Amp and Microphone cards are empty.**
Click **Connect Guitar** first. Both cards only become active after that.

**The microphone is silent.**
Check that **Enable** is ticked and check the **Mic Input Channel** via the gear
icon. Turn on the 48V button on the interface if your microphone needs it.

**Generate a Beat doesn't find anything.**
Name a genre, for example `punk`, `funk` or `reggae`, or search the **Beat
Library** directly.

**Guitar and drums are slightly off in the recording.**
Adjust the **Guitar/Mic Sync** slider, see
[above](#if-guitar-and-drums-dont-line-up-exactly).

**A recording is missing from the list.**
Look under **Show archived**, then in your Windows **Downloads** folder. Renamed
recordings may only be found there after a restart.

**The Edit button in the song is grayed out.**
The song is currently playing. Stop it with **⏸ Stop Song**, then you can edit
again.

## Your data

- **Recordings** stay on your device and are never uploaded.
- **Beats, songs and presets** are stored locally on your device. They're only
  available there, there's no cloud and no automatic backup. It's a good idea to
  back up important beats with **Export MIDI** as well.
- **Online AI features** only send the text you type to the AI provider. For
  **Generate a Beat**, this can also include a few of your saved beats as a style
  reference. Audio is never sent.

The full details are in the app under **Privacy & Credits** at the bottom.

## Help, feedback and license

Found a bug or have an idea? Click **Send Feedback** at the bottom of the app.
Your email program opens with a ready-made draft. You can also write directly to
feedback.pocketstudio@gmail.com.

Pocket Studio is free software under the GNU General Public License version 3
(GPL-3.0-only) and comes with absolutely no warranty. You can find the source
code on [GitHub](https://github.com/hendrikel80-ai/PcktDrmmr).

ASIO is a trademark of Steinberg Media Technologies GmbH, registered in Europe
and other countries.

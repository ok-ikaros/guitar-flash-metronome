# Guitar Flash Metronome

A metronome that deals CAGED flash cards on the downbeat, for drilling the
"Naming Chords by Form and Position" idea: start counting with the letter of
the form you're holding, count one half step per fret up to the bar, and
that's the chord.

No build step. Open `index.html` in a browser, or host the folder as a static
site (GitHub Pages works: Settings → Pages → deploy from branch, root folder).

`node scripts/build-artifact.js` writes `dist/artifact.html`, a single-file
fragment of the same app for hosts that take one HTML snippet, such as a
Claude artifact.

## Two modes

| Mode | Next strip shows | You work out | Card shows |
| --- | --- | --- | --- |
| **Name it** | Form + position, with the shape | The chord name | Form, position, diagram and the chord name |
| **Find the position** | Chord name + form, shape with the fret number hidden | Where to bar it | Chord name, form, diagram and the position (both of them if the range goes past the 12th fret) |

The metronome counts in one measure (configurable, 0–4) before the first
card, and again when you resume after a pause, landing back on the card you
paused on.

The **Next** strip is the quiz: it shows the coming card's question side
only (form + position, or chord name + form), and you work out the answer
while the current card plays. When the card lands it shows the answer, so
you confirm and move on without stopping the click. Turn off **Show the
answer on the card** to hide it until you press **Reveal** (R).

Each card lasts *N* measures (default 1). The previous card is shown with
its answer in a **Prev** strip, and **Back** (B or ←) re-deals it for a
fresh measure if you fumbled it; the card you left becomes "Next" again.
**Pause** (Space) and **Next** (N) round out the transport.

## Controls

- **Tempo**: 30–240 BPM via slider, number box, ± buttons, Tap, or the ↑/↓ keys (Shift for ±5).
- **Beats per measure**: 1–12, beat 1 accented (optional).
- **Count-in**: 0–4 measures.
- **New card every** 1–16 measures.
- **Forms in rotation**: any subset of C, A, G, E, D. Starts with the C form only.
- **Highest position**: 1–15. Position 0 (open) is always included.
- **Naming**: sharps (counting up), flats (counting down), or mixed.
- **Click sound / volume / screen flash / keep screen awake**.

Settings are saved in the browser.

## Fret diagrams

Diagrams follow the book's convention: open forms are fingered with 2-3-4 so
the shape does not change when it moves up and the index finger becomes the
bar. Position is the fret the bar is on.

## Tests

```
npm test
```

The chord-naming engine (`chords.js`) is checked against every diagram in the
chapter, including the flat names going down the neck.

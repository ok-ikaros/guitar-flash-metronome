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

| Mode | You see | You answer | Reveal shows |
| --- | --- | --- | --- |
| **Name it** | Form + position, with the fret diagram | The chord name | The chord name |
| **Find the position** | Chord name + form, diagram with the fret number hidden | Where to bar it | The position (both of them if the range goes past the 12th fret) |

The metronome counts in one measure (configurable, 0–4) before the first
card. The upcoming card is previewed in a "Next" strip during the count-in
and while the current card is playing, so you can get your hand ready. The
preview only shows the question side, never the answer. The previous card
is shown with its answer in a "Prev" strip, and **Back** (B or ←) re-deals
it for a fresh measure if you fumbled it; the card you left becomes "Next"
again. Each card lives for *N* measures (default 1). With **Auto-reveal** on, the
answer appears on the last beat of the card's last measure, so in 4/4 you
answer on beats 1 to 3, check on beat 4, and the next card arrives on the
downbeat. You never have to stop the click. **Pause** (Space), **Reveal** (R), **Back** (B) and **Next** (N) are
there for when you do.

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

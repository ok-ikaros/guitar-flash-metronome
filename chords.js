/*
 * Chord engine: naming chords by form and position (CAGED).
 *
 * Rule from the chapter: start counting with the letter of the form you are
 * using at the open position, then count one half step per fret up to the bar.
 * Position 0 = open, position 12 = the same chord as open.
 *
 * Works both as a browser global (window.ChordEngine) and as a CommonJS module
 * so the logic can be unit tested with node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ChordEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SHARPS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
  const FLATS  = ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab'];

  // Shapes are listed low E (6th string) to high E (1st string).
  // fret: offset from the bar / nut. 0 = under the bar (open when position is 0).
  // 'x' = muted. finger: 1 is the bar finger, fingers 2-4 are the "last three".
  // Finger numbers match the chapter (open forms are played with fingers 2, 3, 4
  // so the shape does not change when you move it up and add the bar).
  const FORMS = {
    C: {
      letter: 'C',
      frets:   ['x', 3, 2, 0, 1, 0],
      fingers: [null, 4, 3, 1, 2, 1],
    },
    A: {
      letter: 'A',
      frets:   ['x', 0, 2, 2, 2, 0],
      fingers: [null, 1, 2, 3, 4, 1],
    },
    G: {
      letter: 'G',
      frets:   [3, 2, 0, 0, 0, 3],
      fingers: [3, 2, 1, 1, 1, 4],
    },
    E: {
      letter: 'E',
      frets:   [0, 2, 2, 1, 0, 0],
      fingers: [1, 3, 4, 2, 1, 1],
    },
    D: {
      letter: 'D',
      frets:   ['x', 'x', 0, 2, 3, 2],
      fingers: [null, null, 1, 2, 4, 3],
    },
  };

  const FORM_ORDER = ['C', 'A', 'G', 'E', 'D'];

  function noteIndex(name) {
    let i = SHARPS.indexOf(name);
    if (i < 0) i = FLATS.indexOf(name);
    if (i < 0) throw new Error('Unknown note: ' + name);
    return i;
  }

  /**
   * Name of the chord you get from `form` played at `position`.
   * accidentals: 'sharps' | 'flats'
   */
  function chordName(form, position, accidentals) {
    const f = FORMS[form];
    if (!f) throw new Error('Unknown form: ' + form);
    if (!Number.isInteger(position) || position < 0) {
      throw new Error('Position must be a non-negative integer');
    }
    const idx = (noteIndex(f.letter) + position) % 12;
    return (accidentals === 'flats' ? FLATS : SHARPS)[idx];
  }

  /**
   * Every position (0..maxPosition) where `form` produces the chord `note`.
   * Usually one answer, two when the range reaches past the 12th fret.
   */
  function positionsFor(form, note, maxPosition) {
    const f = FORMS[form];
    if (!f) throw new Error('Unknown form: ' + form);
    const base = (noteIndex(note) - noteIndex(f.letter) + 12) % 12;
    const out = [];
    for (let p = base; p <= maxPosition; p += 12) out.push(p);
    return out;
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /** "Open" or "5th Pos." in the chapter's wording. */
  function positionLabel(position) {
    return position === 0 ? 'Open' : ordinal(position) + ' Pos.';
  }

  /** "A Form 5th Pos." */
  function formLabel(form, position) {
    return form + ' Form ' + positionLabel(position);
  }

  return {
    SHARPS,
    FLATS,
    FORMS,
    FORM_ORDER,
    noteIndex,
    chordName,
    positionsFor,
    ordinal,
    positionLabel,
    formLabel,
  };
});

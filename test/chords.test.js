const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../chords.js');

// Every example diagrammed in the chapter.
const CHAPTER_EXAMPLES = [
  // A form, pages 8-9, counting up with sharps
  ['A', 0, 'sharps', 'A'], ['A', 1, 'sharps', 'A#'], ['A', 2, 'sharps', 'B'],
  ['A', 3, 'sharps', 'C'], ['A', 4, 'sharps', 'C#'], ['A', 5, 'sharps', 'D'],
  ['A', 6, 'sharps', 'D#'], ['A', 7, 'sharps', 'E'], ['A', 8, 'sharps', 'F'],
  ['A', 9, 'sharps', 'F#'], ['A', 10, 'sharps', 'G'], ['A', 11, 'sharps', 'G#'],
  ['A', 12, 'sharps', 'A'], ['A', 13, 'sharps', 'A#'], ['A', 14, 'sharps', 'B'],
  // E and C forms, page 10
  ['E', 0, 'sharps', 'E'], ['E', 1, 'sharps', 'F'], ['E', 2, 'sharps', 'F#'],
  ['E', 3, 'sharps', 'G'], ['E', 4, 'sharps', 'G#'],
  ['C', 0, 'sharps', 'C'], ['C', 1, 'sharps', 'C#'], ['C', 2, 'sharps', 'D'],
  ['C', 3, 'sharps', 'D#'], ['C', 4, 'sharps', 'E'],
  // E form counted down with flats, pages 11-12
  ['E', 12, 'flats', 'E'], ['E', 11, 'flats', 'Eb'], ['E', 10, 'flats', 'D'],
  ['E', 9, 'flats', 'Db'], ['E', 8, 'flats', 'C'], ['E', 7, 'flats', 'B'],
  ['E', 6, 'flats', 'Bb'], ['E', 5, 'flats', 'A'], ['E', 4, 'flats', 'Ab'],
  ['E', 3, 'flats', 'G'], ['E', 2, 'flats', 'Gb'], ['E', 1, 'flats', 'F'],
  ['E', 0, 'flats', 'E'],
  // G form with flats, page 12
  ['G', 12, 'flats', 'G'], ['G', 11, 'flats', 'Gb'], ['G', 10, 'flats', 'F'],
  ['G', 9, 'flats', 'E'], ['G', 8, 'flats', 'Eb'],
];

test('chord names match every diagram in the chapter', () => {
  for (const [form, pos, acc, expected] of CHAPTER_EXAMPLES) {
    assert.equal(C.chordName(form, pos, acc), expected, `${form} form ${pos} (${acc})`);
  }
});

test('the D form counts from D', () => {
  assert.equal(C.chordName('D', 0, 'sharps'), 'D');
  assert.equal(C.chordName('D', 3, 'sharps'), 'F');
  assert.equal(C.chordName('D', 10, 'flats'), 'C');
});

test('positionsFor is the inverse of chordName', () => {
  for (const form of C.FORM_ORDER) {
    for (let p = 0; p <= 15; p++) {
      const name = C.chordName(form, p, 'sharps');
      assert.ok(C.positionsFor(form, name, 15).includes(p), `${form} ${name} -> ${p}`);
    }
  }
  assert.deepEqual(C.positionsFor('A', 'C', 12), [3]);
  assert.deepEqual(C.positionsFor('A', 'B', 14), [2, 14]);
  assert.deepEqual(C.positionsFor('E', 'E', 12), [0, 12]);
  assert.deepEqual(C.positionsFor('E', 'Bb', 12), [6]);
});

test('labels use the chapter wording', () => {
  assert.equal(C.formLabel('A', 0), 'A Form Open');
  assert.equal(C.formLabel('A', 1), 'A Form 1st Pos.');
  assert.equal(C.formLabel('E', 2), 'E Form 2nd Pos.');
  assert.equal(C.formLabel('C', 3), 'C Form 3rd Pos.');
  assert.equal(C.formLabel('G', 11), 'G Form 11th Pos.');
  assert.equal(C.formLabel('D', 12), 'D Form 12th Pos.');
});

test('every form shape has six strings and a bar finger on every open string', () => {
  for (const form of C.FORM_ORDER) {
    const f = C.FORMS[form];
    assert.equal(f.frets.length, 6);
    assert.equal(f.fingers.length, 6);
    f.frets.forEach((fret, i) => {
      if (fret === 'x') assert.equal(f.fingers[i], null);
      else if (fret === 0) assert.equal(f.fingers[i], 1, `${form} string ${6 - i} should be under the bar`);
      else assert.ok(f.fingers[i] >= 2 && f.fingers[i] <= 4);
    });
  }
});

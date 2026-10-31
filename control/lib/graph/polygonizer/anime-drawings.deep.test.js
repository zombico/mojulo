// The 7G drawings' deep sweep (anime-drawings.js on anime-form.js `drawing`): every drawing of the catalog (on the default
// head, in its form, and on the head before it), every brow drawing with its socket (anime-sockets.js), and every
// word at both ends of its range, built on the default anime hero's head: the topology kept, only its layer moved, no
// face turned over.
import { describe, it, expect } from 'vitest';
import { DRAWINGS, DRAWING_RANGES } from './anime-drawings.js';
import { checkDrawing, studio, headOf, browClearance, build, moved, folds } from './anime-drawings.fixture.js';
import { drawingWords } from './anime-drawings.js';
import { ANIME_STYLE_NAMES } from './anime-styles.js';
import { SOCKETS, withSocket } from './anime-sockets.js';

const LAYER_OF = { brow: 'brows', socket: 'brows', lid: 'lids', gaze: 'gaze', pupil: 'gaze', mouth: 'mouth' };
// (a socket word alone: the brows' layer may move the brows and the face, as the skull's words do)

describe('the 7G drawings, swept', () => {
  it('every drawing of the catalog', () => {
    for (const [name, D] of Object.entries(DRAWINGS)) if (D.words) checkDrawing(name, D.layer, D.words);
  });
  it('every brow and lid drawing with its socket (anime-sockets.js, hero laws 20)', () => {
    for (const name of Object.keys(SOCKETS)) {
      const words = withSocket(name, DRAWINGS[name].words, true);
      if (DRAWINGS[name].layer === 'brows') { checkDrawing(`${name} socketed`, 'brows', words); continue; }
      // (a lid's socket is the cheek under the eye and the skull's masses round it, outside the lid's own region: against
      // its plain drawing, the face alone moved (and the brows, riding a mass the socket slides), the topology kept,
      // nothing turned over)
      const A = build(words), P = build(DRAWINGS[name].words);
      for (const n of Object.keys(A)) expect(A[n].faces, `${name} ${n}`).toEqual(P[n].faces);
      expect(Object.keys(moved(A, P)).sort(), `${name} socket moves`).toEqual(SOCKETS[name].rise ? ['browL', 'browR', 'face'] : ['face']);
      expect(folds(A, P), `${name} socket folds`).toEqual([]);
    }
  });
  it('every drawing of the catalog on the head before its form (a row stamped hero laws 18)', () => {
    for (const [name, D] of Object.entries(DRAWINGS)) if (D.words) studio.checkDrawing(`laws 18 ${name}`, D.layer, D.words);
  });
  it('every word at both ends of its range', () => {
    for (const [k, R] of Object.entries(DRAWING_RANGES)) {
      const ends = Array.isArray(R) ? R.map((v) => [`${k} ${v}`, { [k]: v }]) : Object.entries(R).flatMap(([q, [lo, hi]]) => [lo, hi].map((v) => [`${k}.${q} ${v}`, { [k]: { [q]: v } }]));
      // (an end at the word's neutral draws nothing: 0, the shut lips' opening included)
      for (const [label, words] of ends) if (!/ 0$/.test(label)) checkDrawing(label, LAYER_OF[k], words);
    }
  });
  it('the brow never covers the eye: every brow over every lid, on each base, plain and in each style, with its socket and without', () => {
    const brows = Object.keys(DRAWINGS).filter((n) => DRAWINGS[n].layer === 'brows'), lids = Object.keys(DRAWINGS).filter((n) => DRAWINGS[n].layer === 'lids');
    for (const cast of ['male', 'female']) for (const animeStyle of [undefined, ...ANIME_STYLE_NAMES]) for (const b of brows) for (const l of lids) for (const sockets of [false, true]) {
      const m = headOf({ cast, ...(animeStyle ? { animeStyle } : {}) }, withSocket(b, drawingWords({ brows: b, lids: l }), sockets));
      expect(browClearance(m), `${cast} ${animeStyle ?? ''} ${b} ${l}${sockets ? ' socketed' : ''}`).toBeGreaterThan(0);
    }
  });
}, 600000);

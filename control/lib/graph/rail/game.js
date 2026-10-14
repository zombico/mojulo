// The game rail: a composed game (`kind: 'game'`, create_game, a gameworld's run, a pixelizer reducer). It has no
// outcomes of its own: whether its levels can be finished is answered when it is made (create_game's audits) and is
// not kept on the game. Its parts are its levels; it is played in its shell and playtested with every level open (a
// pixelizer game has no levels to open). Its page is where what it was exported as is listed.
import { registerRail, sketchHref } from './rail.js';

const levelRefs = (m) => [...new Set((Array.isArray(m.levels) ? m.levels : []).map((l) => l && l.ref).filter((r) => typeof r === 'string'))];

export default registerRail({
  id: 'game',
  test: (m) => m.kind === 'game',
  outcomes: [],
  read(m, { ref, row }) {
    return {
      concerns: [],
      parts: levelRefs(m).map((r) => ({ ref: r, role: 'level', state: row(r) ? 'fresh' : 'missing' })),
      exits: ref
        ? [{ id: 'play', href: sketchHref(ref, 'game') }, ...(m.engine === 'pixelizer' ? [] : [{ id: 'playtest', href: sketchHref(ref, 'playtest') }])]
        : [],
    };
  },
});

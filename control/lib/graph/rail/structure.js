// The structure rail: a house, a room, and the store, restaurant, mall, school and office that mint_building takes.
// Its outcomes and concerns are structure/open.js's (the table `next` and the book's Open tab read); its parts are the
// pieces a room places by ref; it is looked at in its book and walked in its World.
import { registerRail, sketchHref } from './rail.js';
import { readStructure } from '../structure/read.js';
import { OUTCOMES, concernStates, openConcerns } from '../structure/open.js';
import { occupancyOf } from '../structure/programs.js';

// every room of a flat plan or of a stack, and the pieces placed in it by ref
function pieceRefs(m) {
  const rooms = [...(Array.isArray(m.rooms) ? m.rooms : []), ...(Array.isArray(m.levels) ? m.levels.flatMap((l) => (Array.isArray(l?.rooms) ? l.rooms : [])) : [])];
  const refs = rooms.flatMap((r) => (Array.isArray(r?.items) ? r.items : [])).map((i) => i && i.ref).filter((r) => typeof r === 'string');
  return [...new Set(refs)];
}

export default registerRail({
  id: 'structure',
  test: (m) => !!occupancyOf(m),
  outcomes: OUTCOMES.map(({ id, name }) => ({ id, name })),
  read(m, { ref, row }) {
    const read = readStructure(m);
    // the book's anchor: a card the Open tab carries, else the Open tab for one not arisen yet, else its own tab
    const carded = new Set(openConcerns(m, read).map((c) => c.id));
    const anchor = (c) => (carded.has(c.id) ? `open-${c.id}` : c.state === 'open' ? 'open' : c.tab.toLowerCase());
    return {
      concerns: concernStates(m, read).map((c) => ({ ...c, anchor: anchor(c) })),
      parts: pieceRefs(m).map((r) => ({ ref: r, role: 'piece', state: row(r) ? 'fresh' : 'missing' })),
      exits: ref ? [{ id: 'book', href: sketchHref(ref, 'bible') }, { id: 'walk', href: sketchHref(ref, 'world') }] : [],
    };
  },
});

// fabricator/capabilities — what a need's situation allows, measured from its numbers.
//
// The fauna resolver measures a body from its skeleton; the fabricator measures a need from what the operator says
// about it: what the work is made of, the load in newtons, how often it is opened, the shaft it turns on, what it has
// to fit. Each capability is a small closed set of values a strategy's `needs` can name.
import { BEARINGS, BOARDS } from './mech-tables.js';

export const CAPABILITIES = Object.freeze({
  host:    { values: ['printed', 'wood', 'metal', 'sheet', 'extrusion'], line: 'what the work being joined is made of (default printed)' },
  load:    { values: ['light', 'medium', 'heavy'], line: 'the working load: up to 50 N, up to 500 N, more' },
  cycles:  { values: ['few', 'many'], line: 'opened or moved fewer than 50 times, or more (serviceable means many)' },
  access:  { values: ['both', 'one'], line: 'both faces reachable at assembly, or one face only' },
  shaft:   { values: ['none', 'small', 'mid', 'large'], line: 'the shaft ⌀: none, up to 6 mm, up to 20 mm, more' },
  bearing: { values: ['stock', 'none'], line: 'a ball bearing in the library has this bore' },
  linear:  { values: ['stock', 'none'], line: 'a linear bearing in the library runs on this rod' },
  axes:    { values: ['parallel', 'crossed', 'intersecting', 'linear'], line: 'how input and output axes sit: side by side, skew at 90°, meeting at 90°, rotary to straight' },
  span:    { values: ['near', 'far'], line: 'centre distance up to 60 mm, or more' },
  to:      { values: ['none', 'vesa', 't-slot', 'board', 'wall', 'camera', 'action-cam', 'pegboard', 'brick', 'grid'], line: 'the standard host it mounts to' },
  board:   { values: ['none', 'rpi', 'arduino', 'other'], line: 'the circuit board it carries or mounts, by hole pattern' },
  rim:     { values: ['round', 'rect'], line: 'the joint a seal follows: round (`sealD`, default) or a rectangular rim (`rim: [w, d]` mm)' },
  through: { values: ['none', 'cable', 'vent'], line: 'what passes through a sealed wall: nothing, a cable, or air (a breather)' },
});

const near = (d, list) => list.some((v) => Math.abs(v - d) < 0.01);

/** A need → its capability values. `need` is the operator's description; nothing here reads geometry. */
export function capabilitiesOf(need, tags = new Set()) {
  const N = need.loadN ?? 20;
  const d = need.shaftD ?? 0;
  const ball = Object.values(BEARINGS).filter((b) => !b.linear).map((b) => b.bore);
  const lin = Object.values(BEARINGS).filter((b) => b.linear).map((b) => b.bore);
  const board = need.board ? (/^rpi/.test(need.board) ? 'rpi' : /^arduino/.test(need.board) ? 'arduino' : 'other') : 'none';
  return {
    host: need.host || 'printed',
    load: N <= 50 ? 'light' : N <= 500 ? 'medium' : 'heavy',
    cycles: (need.cycles ?? 10) >= 50 || tags.has('serviceable') ? 'many' : 'few',
    access: need.access || 'both',
    shaft: d <= 0 ? 'none' : d <= 6 ? 'small' : d <= 20 ? 'mid' : 'large',
    bearing: d > 0 && near(d, ball) ? 'stock' : 'none',
    linear: d > 0 && near(d, lin) ? 'stock' : 'none',
    axes: need.axes || 'parallel',
    span: (need.span ?? 0) > 60 ? 'far' : 'near',
    to: need.to || 'none',
    board: board === 'other' || board === 'none' || BOARDS.includes(need.board) ? board : 'other',
    rim: Array.isArray(need.rim) && need.rim.length === 2 ? 'rect' : 'round',
    through: need.through === 'cable' || need.through === 'vent' ? need.through : 'none',
  };
}

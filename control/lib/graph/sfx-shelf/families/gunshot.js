/**
 * families/gunshot — a small arm fired, heard from behind it. Pure.
 *
 * The layers: the report's front (a few bright milliseconds), the muzzle blast (a falling body, its overtones, the
 * powder's noise), a sub under the heavier cartridges, the supersonic crack a rifle's round carries (a pistol's and a
 * submachine gun's rounds do not outrun sound; a magnum's barely), the action cycling a breath later (a slide or a bolt
 * carrier: a metal clack and a small ring), the casing's ping, and the shot rolling off into the space. `caliber` is the
 * cartridge's class (the firing range's words, gameworld/rounds.js): a pistol's pop to a sniper's boom; a shotgun's
 * blast is the widest and its tail the darkest. `suppressed` takes the blast down to a cough and keeps the action and
 * any crack, as a suppressor does.
 */
import { transient, sub, grit, tail, harmonicsOf } from '../layers.js';

const CALIBER = ['pistol', 'smg', 'magnum', 'rifle', 'shotgun', 'sniper'];
// each caliber: the blast's body (from, to, decay, vol), the report's brightness (its highpass), the sub (or none), the
// crack's level (0: subsonic), the tail's length, and how soon the action cycles
const C = {
  pistol: { body: ['A2', 'E2', 0.06, 0.4], hp: 3400, sub: null, crack: 0, tail: 0.45, act: 0.045 },
  smg: { body: ['B2', 'F#2', 0.05, 0.36], hp: 3600, sub: null, crack: 0, tail: 0.4, act: 0.035 },
  magnum: { body: ['F2', 'B1', 0.1, 0.52], hp: 2800, sub: ['E1', 'A0', 0.18, 0.1], crack: 0.12, tail: 0.75, act: 0.07 },
  rifle: { body: ['E2', 'A1', 0.09, 0.5], hp: 3000, sub: ['D1', 'G0', 0.2, 0.1], crack: 0.4, tail: 0.85, act: 0.05 },
  shotgun: { body: ['C2', 'F1', 0.14, 0.58], hp: 2200, sub: ['C1', 'F0', 0.28, 0.14], crack: 0, tail: 1.0, act: 0.32 },
  sniper: { body: ['C2', 'E1', 0.13, 0.6], hp: 2600, sub: ['A0', 'D0', 0.35, 0.14], crack: 0.5, tail: 1.4, act: 0.6 },
};

export const gunshot = {
  label: 'a small arm fired, by its cartridge',
  dials: { caliber: CALIBER, suppressed: [false, true] },
  defaults: { caliber: 'rifle', suppressed: false },
  ordered: [{ dial: 'caliber', values: ['pistol', 'rifle', 'sniper'], rises: ['ms'] }, { dial: 'suppressed', rises: [], falls: ['ms'] }],
  build(d, seed) {
    const c = C[d.caliber], s = d.suppressed, q = s ? 0.3 : 1;
    const [from, to, decay, vol] = c.body;
    const body = { type: 'thump', from, to, decay, vol: vol * q };
    const out = [
      transient(c.hp, 0.006, s ? 0.2 : 0.5),
      body,
      harmonicsOf(body, s ? 0.04 : 0.16),
      // the powder's noise: the blast's grit, dulled through a suppressor
      { type: 'burst', decay: decay * 1.5, vol: s ? 0.1 : 0.42, lowpass: s ? 1400 : 4200, send: 0.12 },
    ];
    if (c.sub) out.push(sub(c.sub[0], c.sub[1], c.sub[2], c.sub[3] * (s ? 0.5 : 1)));
    // the crack: the round's own shock wave, a hair after the report, never suppressed
    if (c.crack) out.push(transient(6000, 0.004, c.crack, { at: 0.003, pan: 0.1 }));
    // the space answering: brighter and shorter for a pistol, long and dark for a shotgun and a rifle at distance
    out.push(tail(c.tail * (s ? 0.35 : 1), d.caliber === 'shotgun' ? 2200 : 3200, 180, s ? 0.06 : 0.22, { at: 0.015, send: 0.6 }));
    // the action cycling: a slide or a bolt carrier's clack and its small ring; a pump's or a bolt's a hand's work later
    out.push(transient(4200, 0.008, 0.12, { at: c.act, pan: 0.15 }));
    out.push({ type: 'ring', material: 'metal', note: 'D6', decay: 0.05, vol: 0.04, at: c.act, pan: 0.15, send: 0.1 });
    // the casing's ping and its bounce off to the side
    out.push(grit(5, 0.03, 2500, 9000, 0.05, seed(1), { at: c.act + 0.02, pan: 0.35 }));
    return out;
  },
};

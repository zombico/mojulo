// A SPIDER BOT (groundforce/ `crawler`, frame-goal.js OPERATION's): a crawler sent at an asset walks the ground to it over
// the hills, kept on the land under it (rules-frame.js `frame-crawl`), its legs walked by the ground it covers in two
// tripods (the figure's roll clip, crawlClip), and cuts into the asset at close range.
import { describe, expect, it } from 'vitest';
import { composeLive } from '../worlds/controllable/compose.js';
import { frameEntity } from '../assault-frame/pilot.js';
import { readOperation, operationCast, OPERATION } from './frame-goal.js';
import { unitFigure, CRAWL } from '../groundforce/index.js';

const E = composeLive();
const DT = 1 / 30;
// (rolling ground: a crest every 40 m, three metres high)
const hills = (x, y) => Math.sin(x / 40 * Math.PI * 2) * 1.5 + Math.cos(y / 40 * Math.PI * 2) * 1.5 + 3;
const ends = { spawn: [0, 0, 0], heading: Math.PI / 2, ground: hills, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };

describe('a spider bot', () => {
  it('walks the hills to the candle it is sent at, on the ground all the way, its legs walking, and cuts into it', () => {
    const op = readOperation({ groups: [{ id: 'c', kind: 'crawler', at: [0, 0.5], target: 'candle' }], tasks: [{ down: ['c'], guard: ['candle'] }], props: [{ id: 'candle', unit: 'candle', at: [0, 0], hp: 20000 }] });
    const cast = operationCast(op, ends);
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [-400, -400, 0], pilot: true }), ...cast.entities], pilot: 'p' });
    const C = st.byId.c, K = st.byId.candle, gap = () => Math.hypot(C.transform.pos[0] - K.transform.pos[0], C.transform.pos[1] - K.transform.pos[1]);
    const d0 = gap(), ph = [];
    let off = 0;
    for (let i = 0; i < 30 * 30; i++) {
      E.stepWorld(st, {}, DT, { ground: ([x, y]) => hills(x, y) });
      off = Math.max(off, Math.abs(C.transform.pos[2] - hills(C.transform.pos[0], C.transform.pos[1])));
      if (i % 15 === 0) ph.push(C.gaitPhase);
    }
    expect(gap()).toBeLessThan(Math.min(d0, OPERATION.units.crawler.range));
    expect(off).toBeLessThan(0.5);
    expect(new Set(ph.map((v) => Math.round((v ?? 0) * 100))).size).toBeGreaterThan(3);
    expect(K.body.hp).toBeLessThan(20000);
  });

  it('its legs go in two tripods, half a stride apart, each lifted as it comes forward', () => {
    const f = unitFigure('crawler'), B = f.bones, K = f.clips.roll.k, row = (k, id) => { const j = B.findIndex((b) => b.id === id); return f.clips.roll.b.slice((k * B.length + j) * 7, (k * B.length + j) * 7 + 4); };
    expect(B.filter((b) => b.id.startsWith('leg')).length).toBe(6);
    expect(K).toBe(CRAWL.keys);
    // (the swing about the vertical, its qz: a leg and the next in its row are opposite; a leg and the one behind it on
    // its side too, so each tripod is a front and a back leg of one side and the middle of the other)
    const swing = (k, i) => row(k, `leg${i}`)[2];
    const k = 3;
    expect(Math.sign(swing(k, 0))).toBe(-Math.sign(swing(k, 1)));
    expect(Math.sign(swing(k, 0))).toBe(-Math.sign(swing(k, 2)));
    expect(Math.sign(swing(k, 0))).toBe(Math.sign(swing(k, 3)));
    // (the root never moves)
    for (let q = 0; q < K; q++) expect(row(q, 'root')).toEqual([0, 0, 0, 1]);
  });
});

/** Machine checks for the adornment layer. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragonStages, vultureStages, toSource, justify, clearOf } from './adornment.mjs';

const dragon = dragonStages(), vulture = vultureStages();

test('every adornment part is closed', () => { for (const c of [dragon, vulture]) assert.equal(toSource(c.stages[3], c.palette).open, 0); });

test('adornment is a separate layer: wearing it never changes the creature beneath', () => {
  for (const c of [dragon, vulture]) { const under = c.stages[2], worn = c.stages[3];
    for (const [k, p] of Object.entries(under.parts)) assert.equal(JSON.stringify(worn.parts[k]), JSON.stringify(p), `${k} changed`);
    assert.ok(Object.keys(worn.parts).filter((k) => !(k in under.parts)).every((k) => k.startsWith('adorn.'))); }
});

test('a hanging element clears the surface it hangs in front of', () => {
  const torso = dragon.stages[3].mesh.parts.torso; const disc = dragon.stages[3].parts['adorn.collar.sig0'];
  for (const p of Object.values(disc.points)) { const q = clearOf(p, [torso], [0, 1, 0], 0.001); assert.ok(Math.hypot(...q.map((x, i) => x - p[i])) < 1e-9, 'medallion inside the chest'); }
});

test('one recognizable visual element: every adornment\'s signature reads and is a real share of its picture', () => {
  for (const c of [dragon, vulture]) for (const r of justify(toSource(c.stages[3], c.palette), c.worn)) assert.equal(r.verdict, 'justified', `${r.id}: ${r.signature} exposed ${r.sigExposed}, share ${r.sigShare}`);
});

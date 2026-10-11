// The part's machine gate without mojulo: pure, every default inside its range, and the program it writes leads
// with the params as variables. Rendering through OpenSCAD is control/lib/mcp/tools/scad-part.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, source } from './builder.js';

const defaults = Object.fromEntries(Object.entries(part.params).map(([k, p]) => [k, p.default]));
const program = (p) => { const out = source(p); return typeof out === 'string' ? out : out.source; };

test('every param has a default inside its own range', () => {
  assert.equal(part.id, 'lidded-box');
  for (const [k, p] of Object.entries(part.params)) {
    if (p.one_of) assert.ok(p.one_of.includes(p.default), k);
    else if (typeof p.default === 'number') assert.ok(p.default >= p.min && p.default <= p.max, k);
  }
});

test('the same params write the same program, and the program names them', () => {
  assert.equal(program(defaults), program({ ...defaults }));
  assert.match(program(defaults), /recipe-book part/);
});

test('a changed param changes the program', () => {
  const [k, p] = Object.entries(part.params).find(([, q]) => typeof q.default === 'number');
  const other = p.default === p.max ? p.min : p.max;
  assert.notEqual(program({ ...defaults, [k]: other }), program(defaults));
});

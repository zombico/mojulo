/**
 * THE COMIC HERO PACK: the first pack of game cubes (a "tesseract" in the plan's word; a pack of game cubes to the
 * agent). Comic-book and superhero worlds: their gameplay as cubes (cubes.js), their look as one dial of three registers
 * (anime, the frontier film at golden hour, the realistic film: looks.js), and the resonance between the two as advice (resonance.js). Data, no builder: the
 * cube runner (gameworld/intent.js) reads a pack cube as it reads a core fixture, and a level takes a look's geocube as
 * it takes any. What a pack value needs that this registry holds only as planned is the pack's `wants`, reported as
 * gaps by `packReport`, never thrown.
 *
 *   PACK                    { id, name, reads, cubes, looks, dial, laws, wants }
 *   packReport()            { cubes: [{ id, verdict, blocked, gaps, wants: [{ value, status }] }], wants: [{ value, status, pkg }] }
 *                           every cube dry-run and each want's status in the registry today; a want the registry does not
 *                           hold at all is `status: 'unknown'` (a pack written for another registry), reported, not thrown
 *   qaOrders(lookId)        the orders that put one stop of the dial in front of the operator: a `create_sketch` of a
 *                           gameworld (the tree's own example world, gameworld/examples.js, with the pack cube that suits
 *                           the look as its intent, the look's hero direction, and a level painted by the look's geocube
 *                           at its hour: a downtown city under its clouds, or a field's trail where the look's light is the
 *                           isekai shell's, qaLevel), and the `mint_solid` hero the world's own hero page orders
 *                           (hero-looks.js heroOrders: `via: 'hero'`, the realistic body at the realistic stop, the anime
 *                           head at the anime stop). The QA hero wears plain looks. The eyes gate is the operator's; this
 *                           only sets the table
 */
import { PACK_CUBES } from './cubes.js';
import { LOOKS, DIAL, lookOf } from './looks.js';
import { LAWS, resonance } from './resonance.js';
import { dryRun } from '../../cosmos.js';
import { capabilityRegistry } from '../../registry.js';
import { MEADOWMARK_HERO } from '../../../gameworld/examples.js';
import { readGameworld, heroOrders } from '../../../gameworld/index.js';

export const PACK = Object.freeze({
  id: 'comic-hero',
  name: 'The comic hero pack',
  reads: 'comic-book and superhero worlds: their gameplay as cubes, their look on one dial of three registers (anime, the frontier film at golden hour, the realistic film), and the advice between the two',
  cubes: PACK_CUBES,
  looks: LOOKS,
  dial: DIAL,
  laws: LAWS,
  wants: Object.freeze([...new Set(PACK_CUBES.flatMap((c) => c.wants))].sort()),
});

const at = (r) => `${r.facet}.${r.setting}=${r.value}`;

function statusOf(reg, want) {
  const m = /^([^.=]+)\.([^.=]+)=(.+)$/.exec(want);
  const row = m && reg[m[1]]?.[m[2]]?.values[m[3]];
  return row ? { value: want, status: row.status, ...(row.pkg ? { pkg: row.pkg } : {}) } : { value: want, status: 'unknown' };
}

export function packReport() {
  const reg = capabilityRegistry();
  const wants = PACK.wants.map((w) => statusOf(reg, w));
  const byValue = Object.fromEntries(wants.map((w) => [w.value, w]));
  const cubes = PACK_CUBES.map((c) => {
    const r = dryRun(c.cube);
    return { id: c.id, verdict: r.verdict, blocked: r.blocked.map(at), gaps: r.gaps.map(at), wants: c.wants.map((w) => byValue[w]), advice: resonance(c.cube).map((a) => a.law) };
  });
  return { cubes, wants };
}

// the QA hero's looks: plain, so they read on the landmark head and the anime head alike
const QA_LOOKS = Object.freeze({ body: { cast: 'male', tune: 'athletic' }, head: {}, hair: ['crop'], colour: { palette: { Trim: '#e03a2f' } } });

/** The QA level a look is seen on: open ground for a look whose light is the isekai shell's (the city kind lights itself),
 * else a downtown painted by the look's cube. */
export const qaLevel = (L) => (L.level === 'trail' ? 'field' : 'downtown');

export function qaOrders(lookId) {
  const L = lookOf(lookId), { form, ...direction } = L.hero;
  const cube = PACK_CUBES.find((c) => c.look === lookId) || PACK_CUBES[0];
  const world = {
    ...MEADOWMARK_HERO,
    id: `comic-hero-qa-${lookId}`, name: `Comic hero QA: ${lookId}`,
    intent: { cube: cube.cube, why: `the ${L.stop} stop of the comic hero dial: ${L.reads}` },
    characters: { ...MEADOWMARK_HERO.characters, direction, hero: { ...MEADOWMARK_HERO.characters.hero, looks: QA_LOOKS } },
    levels: { ...MEADOWMARK_HERO.levels, [qaLevel(L)]: L.level === 'trail'
      ? { name: 'The field', seed: 4, style: { geocube: L.geocube, hour: L.paint.hour }, walk: { nodes: { trailhead: { trail: true }, approach: { trail: true } } } }
      : { name: 'Downtown', city: { board: { cols: 12, rows: 9 }, seed: 4, paint: { geocube: L.geocube, ...(L.paint || {}) } } } },
  };
  const hero = heroOrders(readGameworld(world)).mint;
  return [
    { tool: 'create_sketch', args: { title: world.name, manifest: { kind: 'gameworld', ...world } } },
    // (a toon the character book puts beside the spec is left out: mint_solid drops a key beside the spec, and the anime
    // head takes its character light at read time, station-loft-shade.js)
    { ...hero, args: { ...(({ toon: _t, ...a }) => a)(hero.args), title: `Comic hero QA: ${lookId} hero`, ...(form ? { spec: { ...hero.args.spec, form } } : {}) } },
  ];
}

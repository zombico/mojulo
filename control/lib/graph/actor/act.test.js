// the actor's act end to end: a persona's read played in a style → personaHero's `acts` → the export's pack (`acts`,
// apart from the clips, on the read's own clock) → the skinned GLB's `act:<take>` (the joints alone, `moj:act`). A read
// with no style has no act, and the World page's payload never carries one.
import { describe, expect, it } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { personaManifest, personaReads } from '../persona/persona.js';
import { personaHero } from '../persona/bundle.js';
import { actsOf } from './act.js';
import { STYLE_NAMES, STYLES } from './style.js';
import { FPS } from './tracks.js';

const glbJson = (bytes) => { const jl = bytes.readUInt32LE(12); return JSON.parse(bytes.subarray(20, 20 + jl).toString('utf8')); };
const heroManifest = (hero) => { const h = heroRecord(hero); return { ...expandLayeredManifest({ kind: 'layered', title: 'actor', hero: h }), hero: h }; };
const resolve = async (manifest, opts = {}) => (await resolveWorldScene({ ref: 'sk_act', title: 'act', manifest }, opts)).payload;
const glb = (payload) => Buffer.from(facesToGlb(payload, { generator: 'mojulo act', clips: '_all', skinned: true }).bytes);
// (a style that gestures, chosen by its card)
const STYLE = STYLE_NAMES.find((n) => STYLES[n].gesture.vocab.length);
const SCRIPT = 'You kept the *key*. Three years, and not one *letter*.';
const HERO = heroManifest({ cast: 'female' });
const persona = (reads) => personaManifest({ hero: 'h', register: 'speech', reads }).persona;

describe('the act', () => {
  it('is a read played in a style; a read with none has no act, and the hero is carried as before', () => {
    const P = persona({ plain: { script: SCRIPT }, acted: { script: SCRIPT, style: STYLE } }), R = personaReads(P);
    expect(Object.keys(actsOf(P, R))).toEqual(['acted']);
    const plain = persona({ plain: { script: SCRIPT } });
    expect(personaHero(plain, HERO)).toBe(HERO);
    expect(Object.keys(personaHero(P, HERO).hero.acts)).toEqual(['acted']);
  });

  it('packs for an export on the read\'s clock, apart from the clips; the World page carries none', async () => {
    const P = persona({ lead: { script: SCRIPT, style: STYLE } }), R = personaReads(P).lead, M = personaHero(P, HERO);
    const exported = await resolve(M, { face: true }), body = exported.figures.body;
    const A = body.acts.lead;
    expect(A.once).toBe(true);
    expect(A.s).toBe(R.seconds);
    expect(A.k).toBe(Math.round(R.seconds * FPS) + 1);
    expect(A.act.style).toBe(STYLE);
    expect(A.cw).toBeUndefined();
    expect(Object.keys(body.clips)).not.toContain('lead');
    expect(body.preview.clips).not.toContain('lead');
    // (the page: the same payload as the hero's with no act at all)
    const page = await resolve(M), bare = await resolve(HERO);
    expect(JSON.stringify(page.figures)).toBe(JSON.stringify(bare.figures));
  });

  it('writes act:<take> into the skinned GLB: the joints alone, one-shot over the read\'s seconds, moj:act its gestures', async () => {
    const P = persona({ lead: { script: SCRIPT, style: STYLE } }), M = personaHero(P, HERO);
    const json = glbJson(glb(await resolve(M, { face: true })));
    const act = json.animations.find((a) => a.name === 'act:lead');
    expect(act).toBeTruthy();
    expect(new Set(act.channels.map((c) => c.target.path))).toEqual(new Set(['rotation', 'translation']));
    const input = json.accessors[act.samplers[0].input];
    expect(input.max[0]).toBeCloseTo(personaReads(P).lead.seconds, 4);
    expect(act.extras['moj:act'].style).toBe(STYLE);
    expect(act.extras['moj:act'].gestures.length).toBeGreaterThan(0);
    // (and an export of the hero with no act has no act animation)
    expect(glbJson(glb(await resolve(HERO, { face: true }))).animations.some((a) => a.name.startsWith('act:'))).toBe(false);
  });
});

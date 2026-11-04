// In-memory SQLite + no semantic index — must run before importing db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// XENO MAKE-UP (lib/graph/xeno): the word's form, the appliance builders' solids (closed, the ridge's base under the
// skin), nothing at all without the word, and on a hero of each game head the appliances pinned to that head's carrier,
// coated, placed on its skin; a bald cap under the head-tails. (The realistic head runs the same frame on `headSkin`;
// it is drawn by the field run in the plan's log, minted there in minutes, not here.)
import { describe, expect, it } from 'vitest';

import { getDb } from '@/lib/db/index.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createCharacterHandler } from '@/lib/mcp/tools/create-character';
import { XENO_SPECIES, validateXenoSpecies, speciesReadout, wornHeaddress } from './index.js';
import { APPENDAGE_FAMILIES, SKULL_SHAPES, XENO_CARDS, XENO_CARD_IDS, appendage, skullMesh, validateXenoHeaddress, withXeno, xenoWorn } from './index.js';
import { bladeMesh, ridgeMesh, tubeMesh } from './appliances.js';
import { xenoFrame } from './frame.js';

getDb();

/** every edge of a closed mesh is used by exactly two faces */
const closed = (M) => { const n = new Map(); for (const f of M.faces) for (let e = 0; e < 3; e++) { const a = f[e], b = f[(e + 1) % 3], k = a < b ? `${a}|${b}` : `${b}|${a}`; n.set(k, (n.get(k) || 0) + 1); } return [...n.values()].every((c) => c === 2); };

describe('the word', () => {
  it('takes a card or a card with its words, and refuses the rest naming where', () => {
    expect(validateXenoHeaddress(['forehead-ridges', { card: 'head-tails', size: 1.2, coat: 'snake', replaces: false }])).toEqual([]);
    expect(validateXenoHeaddress(['tentacle-crown']).join(' ')).toMatch(/xenoHeaddress\[0\]: a card/);
    expect(validateXenoHeaddress([{ card: 'nose-ridges', size: 4 }]).join(' ')).toMatch(/\[0\]\.size/);
    expect(validateXenoHeaddress([{ card: 'nose-ridges', coat: { pattern: [{ kind: 'zigzag' }] } }]).join(' ')).toMatch(/\[0\]\.coat\.pattern\[0\]\.kind/);
    expect(validateXenoHeaddress([{ card: 'nose-ridges', glue: true }]).join(' ')).toMatch(/glue: not an appliance word/);
    expect(validateXenoHeaddress(Array(13).fill('nose-ridges')).join(' ')).toMatch(/at most 12/);
    expect(XENO_CARD_IDS).toEqual(expect.arrayContaining(['forehead-ridges', 'nose-ridges', 'head-tails', 'swept-horns', 'front-tails', 'horned-tails']));
  });

  it('takes an appendage written whole, and refuses its words naming where', () => {
    expect(validateXenoHeaddress([{ family: 'horn', at: { az: 0, el: 70 }, length: 0.12, lift: 1, sweep: -20 }, { family: 'tail', at: { az: 90, el: 0 }, pair: true, fall: 'front', replaces: 'hair' }])).toEqual([]);
    expect(validateXenoHeaddress([{ family: 'fin', at: { az: 0, el: 0 } }]).join(' ')).toMatch(/\[0\]\.family: horn \| tail/);
    expect(validateXenoHeaddress([{ family: 'horn', at: { az: 0, el: 120 } }]).join(' ')).toMatch(/\[0\]\.at:/);
    expect(validateXenoHeaddress([{ family: 'horn', at: { az: 0, el: 0 }, lift: 2, fall: 'up', curl: 1 }]).join(' ')).toMatch(/\.lift: -1 … 1.*\.fall: 'back' \| 'front'|\.curl: not an appendage word/);
    expect(validateXenoHeaddress([{ family: 'lobe', at: { az: 14, el: 62 }, over: { az: 100, el: -25 }, plates: 8, shell: 'banded', stand: 0.04 }])).toEqual([]);
    expect(validateXenoHeaddress([{ family: 'horn', at: { az: 0, el: 0 }, plates: 4 }]).join(' ')).toMatch(/a lobe's words/);
    expect(validateXenoHeaddress([{ family: 'lobe', at: { az: 0, el: 0 }, over: { az: 0 } }]).join(' ')).toMatch(/\[0\]\.over:/);
    expect(validateXenoHeaddress([{ card: 'chitin-crest', shell: { cover: 'fins' } }]).join(' ')).toMatch(/\[0\]\.shell\.cover/);
    expect(validateXenoHeaddress(['tall-cranium', 'cone-skull']).join(' ')).toMatch(/one skull at most/);
    expect(xenoWorn({ hair: 'bob', xenoHeaddress: ['domed-brow'] }).hair).toBe('none');
    expect(xenoWorn({ hair: 'bob', xenoHeaddress: [{ family: 'tail', at: { az: 180, el: 0 }, replaces: 'hair' }] }).hair).toBe('none');
  });
});

describe('the builders', () => {
  it('lay a ridge on the skin as a closed solid, its base under the skin and its crest at its peak', () => {
    const S = Array.from({ length: 8 }, (_, i) => ({ p: [0, 0, i * 0.01], n: [0, 1, 0] }));
    const M = ridgeMesh(S, { height: (t) => 0.01 * Math.sin(Math.PI * t), width: () => 0.02, sink: 0.002 });
    expect(closed(M)).toBe(true);
    const ys = M.vertices.map((v) => v[1]);
    expect(Math.min(...ys)).toBeLessThan(0);                // the base sunk under the skin (y 0)
    expect(Math.max(...ys)).toBeGreaterThan(0.009);          // the crest stands proud by its height
  });

  it('flatten a lobe into a closed blade, its broad front toward the face it is given', () => {
    const line = Array.from({ length: 6 }, (_, i) => [0, 0, -i * 0.05]);
    const M = bladeMesh(line, { radius: () => 0.04, flat: 0.25, face: () => [0, 1, 0] });
    expect(closed(M)).toBe(true);
    const xs = M.vertices.map((v) => Math.abs(v[0])), ys = M.vertices.map((v) => Math.abs(v[1]));
    expect(Math.max(...xs)).toBeCloseTo(0.04, 6); expect(Math.max(...ys)).toBeLessThanOrEqual(0.01 + 1e-12); expect(Math.max(...ys)).toBeGreaterThan(0.0095);
    expect(M.front[2][1]).toBeCloseTo(1, 9);
  });

  it('build a tail as a closed tube along its line, tapering', () => {
    const line = Array.from({ length: 6 }, (_, i) => [0, 0, -i * 0.05]);
    const M = tubeMesh(line, { radius: (t) => 0.03 * (1 - t) + 0.005 });
    expect(closed(M)).toBe(true);
    const near = M.vertices.filter((v) => Math.abs(v[2]) < 1e-9 && Math.hypot(v[0], v[1]) > 1e-6), far = M.vertices.filter((v) => Math.abs(v[2] + 0.2) < 1e-9);
    expect(Math.hypot(near[0][0], near[0][1])).toBeGreaterThan(Math.hypot(far[0][0], far[0][1]));
  });
});

describe('the appendage', () => {
  // a ball of a head (radius 0.1, its centre at the brow line) on a body whose front is y 0.08 and back y −0.08
  const F = { centre: [0, 0, 0], chinZ: -0.1, browZ: 0, height: 0.23,
    toward: (az, el) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, n = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)]; return { p: n.map((v) => v * 0.1), n }; },
    frontOfBodyAt: () => 0.08, backOfBodyAt: () => -0.08 };
  const grow = (A) => appendage(F, 1, { ...APPENDAGE_FAMILIES[A.family], ...A });

  it('grows a horn up and back from its address, a closed tube tapering to its point', () => {
    const [h] = grow({ family: 'horn', at: { az: 0, el: 60 } }), L = h.mesh.line;
    expect(closed(h.mesh)).toBe(true);
    expect(L.at(-1)[2]).toBeGreaterThan(L[1][2] + 0.1);       // risen
    expect(L.at(-1)[1]).toBeLessThan(L[1][1]);                // swept back
  });

  it('pairs a piece with its mirror, and hangs a tail off the body on its side', () => {
    const P = grow({ family: 'tail', at: { az: 90, el: 0 }, pair: true, fall: 'front' });
    expect(P.map((p) => p.name)).toEqual(['R', 'L']);
    expect(P[0].mesh.line.at(-1)[0]).toBeCloseTo(-P[1].mesh.line.at(-1)[0], 9);
    for (const { mesh } of P) {
      expect(mesh.line.at(-1)[2]).toBeLessThan(F.chinZ);
      for (const p of mesh.line) if (p[2] < F.chinZ) expect(p[1]).toBeGreaterThan(0.08);   // in front of the chest, never in it
    }
    const [back] = grow({ family: 'tail', at: { az: 180, el: 0 } });
    for (const p of back.mesh.line) if (p[2] < F.chinZ) expect(p[1]).toBeLessThan(-0.08);
  });

  it('hugs the head over the cap, standing off it, and lays a lobe\'s hard plates across its front', () => {
    const P = grow({ family: 'lobe', at: { az: 14, el: 62 }, plates: 5, pair: true }), lobe = P.find((p) => p.name === 'R'), plates = P.filter((p) => p.role === 'shell' && p.name.startsWith('R'));
    expect(closed(lobe.mesh)).toBe(true);
    expect(plates.map((p) => p.name)).toEqual(['RPlate0', 'RPlate1', 'RPlate2', 'RPlate3', 'RPlate4']);
    for (const { mesh } of plates) expect(closed(mesh)).toBe(true);
    const hug = lobe.mesh.line.slice(2, 12);
    for (const p of hug) expect(Math.hypot(...p)).toBeGreaterThan(0.1 + 0.005);                // off the skin, never in it
    expect(hug.at(-1)[0]).toBeGreaterThan(0.05);                                                // carried round to its side
  });
});

describe('the skull', () => {
  const F = { centre: [0, 0, 0], chinZ: -0.1, browZ: 0, height: 0.23,
    toward: (az, el) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, n = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)]; return { p: n.map((v) => v * 0.1), n }; } };
  const volume = (M) => M.faces.reduce((a, [i, j, k]) => { const [p, q, r] = [M.vertices[i], M.vertices[j], M.vertices[k]];
    return a + (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6; }, 0);

  it('is a closed shell over the cap, turned outward, its edge feathered into the skin, swollen to its shape', () => {
    // (one case per kind of swelling: a lobe of growth along an axis, a groove between two)
    for (const shape of ['tall-cranium', 'bilobed-brain']) {
      const M = skullMesh(F, 1, SKULL_SHAPES[shape]);
      expect(closed(M), shape).toBe(true);
      expect(volume(M), shape).toBeGreaterThan(0);                                   // outward: a positive volume
      const r = M.vertices.map((v) => Math.hypot(...v));
      expect(Math.min(...r)).toBeLessThan(0.1);                                     // its underside sunk under the skin
      expect(Math.min(...r)).toBeGreaterThan(0.1 - 0.002);
      expect(M.coatFrame.uv.length).toBe(M.vertices.length);
    }
    const tall = skullMesh(F, 1, SKULL_SHAPES['tall-cranium']), crown = Math.max(...tall.vertices.map((v) => v[2]));
    expect(crown).toBeGreaterThan(0.1 + 0.04);                                       // swollen up past the crown
    const back = Math.min(...tall.vertices.map((v) => v[1]));
    expect(back).toBeLessThan(-0.1 - 0.02);                                          // and back
    expect(Object.values(XENO_CARDS).filter((c) => c.family === 'skull').every((c) => c.replaces === 'hair')).toBe(true);
  });
});

describe('a starter species', () => {
  it('lowers into the hero\'s own words, which win: its appliances first, a skull the hero names in its place, its skin where the hero names none', () => {
    expect(validateXenoSpecies('grey-visitor')).toEqual([]);
    expect(validateXenoSpecies('wookiee').join(' ')).toMatch(/a starter species \(/);
    expect(wornHeaddress({ xenoSpecies: 'ridged-warrior', xenoHeaddress: ['nose-ridges'] })).toEqual(['keeled-skull', 'forehead-ridges', 'nose-ridges']);
    expect(wornHeaddress({ xenoSpecies: 'ridged-warrior', xenoHeaddress: ['cone-skull'] })).toEqual(['forehead-ridges', 'cone-skull']);
    const W = xenoWorn({ cast: 'female', hair: 'bob', xenoSpecies: 'grey-visitor' });
    expect([W.palette.Skin, W.hair, W.xenoSpecies, W.xenoHeaddress]).toEqual([XENO_SPECIES['grey-visitor'].skin, 'none', undefined, ['tall-cranium']]);
    expect(xenoWorn(W)).toEqual(W);                                                                    // worn twice: the same hero
    expect(xenoWorn({ xenoSpecies: 'grey-visitor', palette: { Skin: '#123456' } }).palette.Skin).toBe('#123456');
    const real = xenoWorn({ form: 'realistic', xenoSpecies: 'grey-visitor' });
    expect([real.skin.tone, real.palette.Skin]).toEqual([XENO_SPECIES['grey-visitor'].skin, undefined]);         // its skin on skin.tone, never the palette's Skin
    expect(xenoWorn({ hair: 'bob', xenoSpecies: 'ridge-nosed' }).hair).toBe('bob');                 // a species with no bald cap keeps the hair
    expect(speciesReadout({ xenoSpecies: 'grey-visitor' })).toMatchObject({ species: 'grey-visitor', also: expect.any(String) });
  });

  it('sets its eyes and its build in the words of the head the hero wears, under the hero\'s own', () => {
    const S = XENO_SPECIES['grey-visitor'];
    // the landmark head: its face and its tune; the anime head: its face and the anime body for the hero's pole
    const eyes = { Sclera: S.eyes.sclera, Iris: S.eyes.iris, Pupil: S.eyes.pupil };
    expect(xenoWorn({ cast: 'female', xenoSpecies: 'grey-visitor' })).toMatchObject({ face: S.heads.landmark.face, tune: S.heads.landmark.tune, palette: eyes });
    expect(xenoWorn({ cast: 'female', head: 'anime', xenoSpecies: 'grey-visitor' })).toMatchObject({ face: S.heads.anime.face, animeBody: 'maki' });
    expect(xenoWorn({ cast: 'male', head: 'anime', xenoSpecies: 'grey-visitor' }).animeBody).toBe('satoru');
    // the realistic head: its face's words and its physique, its eyes' colours too (its skin's colour on its own word)
    const real = xenoWorn({ cast: 'female', form: 'realistic', xenoSpecies: 'grey-visitor', face: { want: { chin: 'soft' } } });
    expect([real.face.want, real.physique, real.palette, real.skin.tone]).toEqual([{ eyes: 'large', chin: 'soft' }, 'skinny', eyes, S.skin]);
    // the hero's own: its face laid after the species' (its keys win), its build in place of the species'
    const own = xenoWorn({ cast: 'female', head: 'anime', xenoSpecies: 'grey-visitor', face: 'tsurime', animeBody: 'kale' });
    expect([own.face, own.animeBody]).toEqual([[S.heads.anime.face, 'tsurime'], 'kale']);
    expect(xenoWorn({ cast: 'female', xenoSpecies: 'grey-visitor', tune: 'long-legs', palette: { Iris: '#00ff00' } })).toMatchObject({ tune: 'long-legs', palette: { Iris: '#00ff00', Sclera: S.eyes.sclera, Pupil: S.eyes.pupil } });
    // a blank trunk wears no head's words
    expect(xenoWorn({ cast: 'female', head: 'none', xenoSpecies: 'grey-visitor' }).face).toBeUndefined();
    expect(speciesReadout({ cast: 'female', head: 'anime', xenoSpecies: 'grey-visitor' }).anime).toEqual({ face: S.heads.anime.face, animeBody: 'maki' });
  });

  it('mints a hero wearing it, and says what it gave', async () => {
    const out = await createCharacterHandler({ as: 'hero', title: 'species', spec: { cast: 'female', xenoSpecies: 'plated-insectoid' } });
    expect(out.hero.xenoSpecies).toMatchObject({ species: 'plated-insectoid' });
    expect(out.hero.xeno.map((x) => [x.card, x.pieces > 0])).toEqual([['segmented-skull', true], ['horn', true], ['cheek-ridges', true]]);
    const R = SketchRepository.getByRef(out.ref).manifest;
    expect(R.hero.xenoSpecies).toBe('plated-insectoid');                                               // the record keeps the word alone
    expect(R.hero.xenoHeaddress).toBeUndefined();
    expect(R.recipe.palette.Skin).toBe(XENO_SPECIES['plated-insectoid'].skin);
  }, 120_000);
});

describe('on a hero', () => {
  it('adds nothing without the word: the recipe itself', () => {
    const R = { parts: { a: {} } };
    expect(withXeno(R, {})).toBe(R);
    expect(withXeno(R, { xenoHeaddress: [] })).toBe(R);
  });

  it.each([['landmark', { cast: 'female' }], ['anime', { cast: 'female', head: 'anime' }]])('pins each appliance to the %s head\'s carrier, coated, on its skin', async (head, spec) => {
    const out = await createCharacterHandler({ as: 'hero', title: head, spec: { ...spec, xenoHeaddress: ['forehead-ridges', 'nose-ridges', 'head-tails', 'swept-horns', { family: 'tail', at: { az: 180, el: 20 }, length: 0.3 }, 'chitin-crest', 'cheek-ridges', 'tall-cranium'] } });
    const R = SketchRepository.getByRef(out.ref).manifest.recipe, F = xenoFrame(R);
    expect(F.head).toBe(head);
    const xeno = Object.entries(R.parts).filter(([n]) => n.startsWith('xeno'));
    expect(xeno.map(([n]) => n)).toEqual(expect.arrayContaining(['xenoForeheadRidges0Mid', 'xenoNoseRidges1Bar0', 'xenoHeadTails2R', 'xenoHeadTails2L', 'xenoSweptHorns3HornR', 'xenoSweptHorns3HornL', 'xenoTail4Tail', 'xenoChitinCrest5LobeR', 'xenoChitinCrest5LobeRPlate0', 'xenoCheekRidges6L', 'xenoTallCranium7Skull']));
    for (const [n, P] of xeno) {
      expect(P.pin.parent, n).toBe(F.carrier);
      expect(Object.keys(P.coat.uv), n).toEqual(Object.keys(P.offsets));
      expect(P.coat.spec.color).toBe('Skin');
      expect(!!P.coat.spec.cover, n).toBe(/Plate\d+$/.test(n));                                  // the shell's chitin on its plates alone
    }
    // (the head-tails' bald cap: no hair part left, the brows kept)
    expect(Object.keys(R.parts).filter((n) => /^hair/.test(n) && !/^hair(Brows|Lashes)/.test(n))).toEqual([]);
    expect(out.hero.xeno.map((x) => [x.card, x.pieces > 0])).toEqual([['forehead-ridges', true], ['nose-ridges', true], ['head-tails', true], ['swept-horns', true], ['tail', true], ['chitin-crest', true], ['cheek-ridges', true], ['tall-cranium', true]]);
    // (the skull laid first, and the frame found again on it: the rest is glued on the new skull)
    expect(xenoFrame(R, { skin: ['xenoTallCranium7Skull'] }).crownZ).toBeGreaterThan(F.crownZ + 0.03);
    expect(out.hero.xeno[1].pieces).toBe(Object.keys(R.parts).filter((n) => n.startsWith('xenoNoseRidges1')).length);
    expect(out.hero.xeno[4].written).toBe(true);
  }, 120_000);
});

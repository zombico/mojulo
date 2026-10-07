/**
 * figure-gate: the skinned figure's GLB declaration is the expectation the Godot figure probe is compared against —
 * one skin with its joints and every clip under Godot's names; the probe's one line parsed; each check its own. The
 * anime face adds its own: the blend shapes, the authored face at ready, the face tracks, the durations, the layer.
 */
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { compareFigure, declaredFigure, godotName, parseFigureLine } from './figure-gate.js';
import { FACE_TARGETS } from '../polygonizer/anime-face-rig.js';

// the fast hero (no head, lowpoly): a 19-joint skin (18 before the structured core's `lumbar` bone) and its own three clips
const hero = async () => (await resolveWorldScene({ ref: 'fg', title: 'fg', manifest: expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'none', register: 'lowpoly' }) }) }, {})).payload;

// the probe's line, as it printed on the docs heroine's pack (Godot 4.7.2)
const LINE = '[mojulo-figure] skeletons=1 bones=18 players=1 animations=body_gesture,body_greet,body_idle,body_idleRelaxed,body_run,body_victory,body_walk,body_wave compressed=0 lods=0 playing=body_idle loop=1 camera=View1';
const HEROINE = {
  skins: 1, joints: 18,
  animations: ['body_gesture', 'body_idle', 'body_walk', 'body_wave', 'body_greet', 'body_idleRelaxed', 'body_run', 'body_victory'],
};
const FIGURE = { name: 'body', clip: 'idle', view: 1 };

describe('declaredFigure', () => {
  it('reads the skinned export: one skin of 19 joints, the clips under Godot names; the static export has none', async () => {
    const payload = await hero();
    expect(declaredFigure(facesToGlb(payload, { clips: '_all', skinned: true }).bytes)).toEqual({ skins: 1, joints: 49, animations: ['body_idle', 'body_walk', 'body_wave'] });   // + lumbar (18 before the structured core), + the hands' thirty finger bones
    expect(declaredFigure(facesToGlb(payload).bytes)).toEqual({ skins: 0, joints: 0, animations: [] });
  }, 60000);

  it("renames as Godot's importer does", () => {
    expect(godotName('body:idleRelaxed')).toBe('body_idleRelaxed');
    expect(godotName('a.b@c/d"e%f')).toBe('a_b_c_d_e_f');
  });
});

describe('parseFigureLine', () => {
  it('reads every field of the line', () => {
    expect(parseFigureLine(`Godot Engine v4.7.2\n${LINE}\n`)).toEqual({
      skeletons: 1, bones: 18, players: 1,
      animations: ['body_gesture', 'body_greet', 'body_idle', 'body_idleRelaxed', 'body_run', 'body_victory', 'body_walk', 'body_wave'],
      compressed: 0, lods: 0, playing: 'body_idle', loop: 1, camera: 'View1',
    });
  });

  it('an empty value reads empty; an error reads as the error; no line reads null', () => {
    const p = parseFigureLine('[mojulo-figure] skeletons=0 bones=0 players=0 animations= compressed=0 lods=0 playing= loop=-1 camera=');
    expect(p.animations).toEqual([]);
    expect(p.playing).toBe('');
    expect(p.camera).toBe('');
    expect(p.loop).toBe(-1);
    expect(parseFigureLine('[mojulo-figure] error=model_glb_not_a_scene')).toEqual({ error: 'model_glb_not_a_scene' });
    expect(parseFigureLine('Godot Engine v4.7.2')).toBeNull();
  });
});

describe('compareFigure', () => {
  it('passes every check on the heroine line', () => {
    const cmp = compareFigure({ declared: HEROINE, built: parseFigureLine(LINE), figure: FIGURE });
    expect(cmp.ok).toBe(true);
    expect(Object.keys(cmp.checks)).toEqual(['skeleton', 'bones', 'animation_player', 'clips_listed', 'uncompressed', 'no_lods', 'clip_playing', 'clip_loops', 'view_current']);
    for (const [k, c] of Object.entries(cmp.checks)) expect(c.ok, k).toBe(true);
  });

  it('each failure flips its own check', () => {
    const flips = {
      skeleton: LINE.replace('skeletons=1', 'skeletons=0'),
      bones: LINE.replace('bones=18', 'bones=17'),
      animation_player: LINE.replace('players=1', 'players=0'),
      clips_listed: LINE.replace('body_greet,', ''),
      uncompressed: LINE.replace('compressed=0', 'compressed=1'),
      no_lods: LINE.replace('lods=0', 'lods=5'),
      clip_playing: LINE.replace('playing=body_idle', 'playing='),
      clip_loops: LINE.replace('loop=1', 'loop=0'),
      view_current: LINE.replace('camera=View1', 'camera=Head'),
    };
    for (const [check, line] of Object.entries(flips)) {
      const cmp = compareFigure({ declared: HEROINE, built: parseFigureLine(line), figure: FIGURE });
      expect(cmp.ok, check).toBe(false);
      expect(Object.entries(cmp.checks).filter(([, c]) => c.ok === false).map(([k]) => k), check).toEqual([check]);
    }
  });

  it('an unmeasured run decides nothing, and nothing decided is not a pass', () => {
    for (const built of [null, { error: 'scene_not_loaded' }]) {
      const cmp = compareFigure({ declared: HEROINE, built, figure: FIGURE });
      expect(cmp.ok).toBe(false);
      expect(Object.values(cmp.checks).every((c) => c.ok === null)).toBe(true);
    }
  });
});

// the probe's line on the docs heroine's pack with her face (Godot 4.7.2; figure_face.gd, clip body:walk: the ambient
// layer's run), and what her GLB declares
const FACE_LINE = '[mojulo-figure] skeletons=1 bones=18 players=1 animations=body_gesture,body_greet,body_idle,body_idleRelaxed,body_run,body_victory,body_walk,body_wave,face_ambientBlink compressed=0 lods=0 playing=body_walk loop=1 camera=View1 shapes=blink,blinkLeft,blinkRight,smile,mouthOpen,browInnerRaise,browInnerLower,blinkFix10L,blinkFix10R,blinkFix12L,blinkFix12R,blinkFix18L,blinkFix18R,blinkFix20L,blinkFix20R,blinkFix50L,blinkFix50R face_tracks=body_gesture:17,body_greet:17,body_idle:17,body_idleRelaxed:17,body_run:17,body_victory:17,body_walk:17,body_wave:17,face_ambientBlink:17 lengths=body_gesture:1.0,body_greet:2.0,body_idle:4.0,body_idleRelaxed:4.0,body_run:0.8,body_victory:2.0,body_walk:1.0,body_wave:2.0,face_ambientBlink:12.0 face=0.12,0.0,0.0,1.0,0.3,0.0,0.3,0.0,0.0,1.0,1.0,0.0,0.0,0.0,0.0,0.0,0.0 tree=1';
const AUTHORED = [0.12, 0, 0, 1, 0.3, 0, 0.3, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0];
const HEROINE_FACE = {
  ...HEROINE, animations: [...HEROINE.animations, 'face_ambientBlink'],
  face: { targets: FACE_TARGETS, authored: AUTHORED, ambientClip: 'face_ambientBlink', ambientOver: ['body_gesture', 'body_walk', 'body_wave'] },
};
const SECONDS = { gesture: 1, idle: 4, walk: 1, wave: 2, greet: 2, idleRelaxed: 4, run: 0.8, victory: 2 };
const WALK = { name: 'body', clip: 'walk', view: 1, seconds: SECONDS };

describe('the anime face', () => {
  it("declaredFigure reads the face off the lowpoly anime hero's skinned export", async () => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'anime', register: 'lowpoly', expression: ['smile', { open: 0.3 }] }) });
    const { payload } = await resolveWorldScene({ ref: 'fg-anime', title: 'fg', manifest: m }, { face: true });
    const d = declaredFigure(facesToGlb(payload, { clips: '_all', skinned: true }).bytes);
    expect(d.animations).toEqual(['body_gesture', 'body_idle', 'body_walk', 'body_wave', 'face_ambientBlink']);
    expect(d.face).toEqual({ targets: FACE_TARGETS, authored: AUTHORED, ambientClip: 'face_ambientBlink', ambientOver: ['body_gesture', 'body_walk', 'body_wave'] });
  }, 60000);

  it('parseFigureLine reads the face fields; a line without them has none', () => {
    const b = parseFigureLine(FACE_LINE);
    expect(b.shapes).toEqual(FACE_TARGETS);
    expect(b.face).toEqual(AUTHORED);
    expect(b.faceTracks.body_walk).toBe(17);
    expect(b.lengths).toMatchObject({ body_run: 0.8, body_idle: 4, face_ambientBlink: 12 });
    expect(b.tree).toBe(1);
    expect(Object.keys(parseFigureLine(LINE))).not.toContain('shapes');
  });

  it("passes every check on the heroine's face line, the face's checks after the figure's", () => {
    const cmp = compareFigure({ declared: HEROINE_FACE, built: parseFigureLine(FACE_LINE), figure: WALK });
    expect(Object.keys(cmp.checks).slice(9)).toEqual(['blend_shapes', 'authored_face', 'face_tracks', 'durations', 'ambient_layer']);
    for (const [k, c] of Object.entries(cmp.checks)) expect(c.ok, k).toBe(true);
    expect(cmp.ok).toBe(true);
  });

  it('each failure flips its own check: a neutral head at ready, a missing track, a clip at one second, the layer off', () => {
    const flips = {
      blend_shapes: FACE_LINE.replace('blink,blinkLeft,', 'blinkLeft,blink,'),
      authored_face: FACE_LINE.replace(/face=[^ ]*/, `face=${AUTHORED.map(() => '0.0').join(',')}`),
      face_tracks: FACE_LINE.replace('body_run:17', 'body_run:0'),
      durations: FACE_LINE.replace('body_idle:4.0', 'body_idle:1.0'),
      ambient_layer: FACE_LINE.replace('tree=1', 'tree=0'),
    };
    for (const [check, line] of Object.entries(flips)) {
      const cmp = compareFigure({ declared: HEROINE_FACE, built: parseFigureLine(line), figure: WALK });
      expect(cmp.ok, check).toBe(false);
      expect(Object.entries(cmp.checks).filter(([, c]) => c.ok === false).map(([k]) => k), check).toEqual([check]);
    }
    // the layer belongs to the clips whose eyes hold: idle plays with none
    const idle = compareFigure({ declared: HEROINE_FACE, built: parseFigureLine(FACE_LINE.replace('playing=body_walk', 'playing=body_idle').replace('tree=1', 'tree=0')), figure: { ...WALK, clip: 'idle' } });
    expect(idle.checks.ambient_layer).toEqual({ expected: 0, got: 0, ok: true });
    expect(idle.ok).toBe(true);
  });
});

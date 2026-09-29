/**
 * figure-gate: the skinned figure's GLB declaration is the expectation the Godot figure probe is compared against —
 * one skin with its joints and every clip under Godot's names; the probe's one line parsed; each check its own.
 */
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { compareFigure, declaredFigure, godotName, parseFigureLine } from './figure-gate.js';

// the fast hero (no head, lowpoly): an 18-joint skin and the hero's own three clips
const hero = async () => (await resolveWorldScene({ ref: 'fg', title: 'fg', manifest: expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'none', register: 'lowpoly' }) }) }, {})).payload;

// the probe's line, as it printed on the docs heroine's pack (Godot 4.7.2)
const LINE = '[mojulo-figure] skeletons=1 bones=18 players=1 animations=body_gesture,body_greet,body_idle,body_idleRelaxed,body_run,body_victory,body_walk,body_wave compressed=0 lods=0 playing=body_idle loop=1 camera=View1';
const HEROINE = {
  skins: 1, joints: 18,
  animations: ['body_gesture', 'body_idle', 'body_walk', 'body_wave', 'body_greet', 'body_idleRelaxed', 'body_run', 'body_victory'],
};
const FIGURE = { name: 'body', clip: 'idle', view: 1 };

describe('declaredFigure', () => {
  it('reads the skinned export: one skin of 18 joints, the clips under Godot names; the static export has none', async () => {
    const payload = await hero();
    expect(declaredFigure(facesToGlb(payload, { clips: '_all', skinned: true }).bytes)).toEqual({ skins: 1, joints: 18, animations: ['body_idle', 'body_walk', 'body_wave'] });
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

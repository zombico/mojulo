process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintWorkbench } from './workbench.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';

// A light rig through the MINT path: mintWorkbench destructures an explicit key list, so `crystalLight` and `events`
// must be named there or they never reach the World.

const fields = [{ id: 'room', cells: 40, terms: [
  { id: 'back', op: 'add', shape: { kind: 'box', center: [0, 13, 5], size: [40, 1, 10] } },
  { id: 'prism', op: 'add', shape: { kind: 'crystal', gem: 'diamond', center: [8, 0, 3], size: 2.2 } }] }];
const crystalLight = { lamps: [{ at: [22, -1, 3.4], aim: [8, 0, 3] }], targets: [{ id: 'socket', at: [0, 12, 3], r: 1, want: { color: 'green' } }] };

describe('mintWorkbench — crystalLight', () => {
  it('stores the rig and its events, and the World page runs it', async () => {
    const res = mintWorkbench({ title: 'fan', fields, crystalLight, events: { reactions: [{ on: 'lit', do: 'set', var: 'open', to: 1 }], hud: [{ on: 'lit', text: 'Lit' }] } });
    const stored = SketchRepository.getByRef(res.ref);
    expect(stored.manifest.crystalLight.lamps).toHaveLength(1); expect(stored.manifest.events.reactions).toHaveLength(1);
    const { payload } = await resolveWorldScene(stored);
    expect(payload.crystalLight).toEqual(crystalLight); expect(payload.events.hud).toHaveLength(1);
    expect(emitThreeWorld(payload)).toContain('stepCrystalLight(t)');
  });
  it('refuses a HUD row or style the World would refuse, at mint, naming what is wrong', () => {
    const events = { reactions: [{ on: 'lit', do: 'set', var: 'open', to: 1 }] };
    expect(() => mintWorkbench({ title: 'bad hud', fields, crystalLight, events: { ...events, hud: [{ kind: 'bogus', slot: 'nowhere' }] } })).toThrow(/events\.hud is invalid[\s\S]*slot must be one of/);
    expect(() => mintWorkbench({ title: 'bad style', fields, crystalLight, events: { ...events, style: { font: 3 } } })).toThrow(/events\.style is invalid[\s\S]*font must be one of/);
  });
  it('refuses a rig that does not resolve, naming what is wrong', () => {
    expect(() => mintWorkbench({ title: 'bad', fields, crystalLight: { lamps: [{ at: [0, 0, 0] }] } })).toThrow(/Light rigs[\s\S]*aim/);
  });
  it('world resolve refuses a stored rig that does not resolve (an update_sketch replace)', async () => {
    const res = mintWorkbench({ title: 'ok', fields });
    const sk = SketchRepository.getByRef(res.ref);
    await expect(resolveWorldScene({ ...sk, manifest: { ...sk.manifest, crystalLight: { lamps: [] } } })).rejects.toThrow(/crystalLight is invalid/);
  });
});

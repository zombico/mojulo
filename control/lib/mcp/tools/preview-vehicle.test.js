import { describe, it, expect } from 'vitest';
import { readVehicleWord, previewVehicleInstanceHandler } from '@/lib/mcp/tools/preview-vehicle';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { VEHICLES, handlesOf } from '@/lib/graph/vehicle-registry/roster';
import { buildsOf } from '@/lib/graph/vehicle-registry/builds';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { MILITARY_CLASSES } from '@/lib/graph/car-designer/road-military';
import { CAMO_IDS } from '@/lib/graph/car-designer/livery-cut';

// rows chosen in code by what they carry: a scenery net named by a word that is not its key, the racer grammar,
// and a row the studio grid has no build of
const ids = Object.keys(VEHICLES);
const scenery = ids.find((id) => handlesOf(id).scenery && !handlesOf(id).scenery.includes(id) && !handlesOf(id).racer);
const racer = ids.find((id) => handlesOf(id).racer);
const unseen = ids.find((id) => buildsOf(id).every((b) => !['scenery', 'racer', 'supercar', 'loft'].includes(b.via)));
// a road class with no net, its only body the realistic loft
const lofted = ids.find((id) => buildsOf(id).some((b) => b.via === 'loft') && !buildsOf(id).some((b) => ['scenery', 'racer', 'supercar'].includes(b.via)));

describe('mint_solid vehicle: the registry is the way in', () => {
  it('reads a registry word to the build its row has', () => {
    expect(readVehicleWord({ vehicle: VEHICLES[scenery].label })).toMatchObject({ instance: { type: handlesOf(scenery).scenery[0] }, id: scenery, asked: true });
    expect(readVehicleWord({ vehicle: racer })).toMatchObject({ instance: { racer: {} }, id: racer });
  });
  it('reads a legacy type that is not a scenery key as a registry word, and keeps a scenery key\'s own path', () => {
    expect(readVehicleWord({ type: VEHICLES[scenery].label }).id).toBe(scenery);
    const key = handlesOf(scenery).scenery[0];
    expect(readVehicleWord({ type: key })).toMatchObject({ instance: { type: key }, id: scenery, asked: false });
  });
  it('refuses a row it cannot show, naming its builds; a word it does not know, naming near rows; a tier it does not have', () => {
    expect(() => readVehicleWord({ vehicle: unseen })).toThrow(new RegExp(`registry's ${unseen}.*Its builds`));
    expect(() => readVehicleWord({ vehicle: 'flying stealth jet' })).toThrow(/vehicle registry has/);
    expect(() => readVehicleWord({ vehicle: scenery, tier: 'photoreal' })).toThrow(/toy, stylised, realistic/);
  });
  it('refuses a race machine\'s recipe under another row', () => {
    expect(() => readVehicleWord({ vehicle: scenery, racer: {} })).toThrow(/racer recipe is the/);
  });

  it('mints a registry word as the legacy build\'s keys plus the row, and reads out the registry', async () => {
    const out = await previewVehicleInstanceHandler({ vehicle: VEHICLES[scenery].label, title: 'registry preview' });
    const m = SketchRepository.getByRef(out.ref).manifest;
    expect(m).toMatchObject({ kind: 'vehicle-instance', vehicle: scenery, type: handlesOf(scenery).scenery[0] });
    expect(out.registry).toMatchObject({ id: scenery, tier: 'stylised', build: 'scenery' });
  });
  it('mints a road class with no net as its realistic loft, at true dimensions', async () => {
    const out = await previewVehicleInstanceHandler({ vehicle: VEHICLES[lofted].label, title: 'a loft' });
    const cls = handlesOf(lofted).physics[0];
    expect(SketchRepository.getByRef(out.ref).manifest).toMatchObject({ vehicle: lofted, loft: { class: cls } });
    expect(out.stats).toMatchObject({ family: 'loft', class: cls });
    expect(out.stats.census.against.L).toBeCloseTo(1, 1);
    expect(out.registry).toMatchObject({ id: lofted, tier: 'realistic', build: 'loft' });
    // and the world route draws it on the studio grid
    const row = SketchRepository.getByRef(out.ref);
    const { payload } = await resolveWorldScene({ ref: row.ref, title: row.title, manifest: row.manifest });
    expect(payload.title).toMatch(/a loft/);
  });
  it('carries a field vehicle\'s livery in its loft\'s recipe, and refuses one on a build its words do not paint', async () => {
    const field = ids.find((id) => (handlesOf(id).physics ?? []).some((k) => MILITARY_CLASSES[k]) && buildsOf(id).some((b) => b.via === 'loft'));
    const camo = CAMO_IDS[0];
    const out = await previewVehicleInstanceHandler({ vehicle: VEHICLES[field].label, livery: camo, title: 'a painted field vehicle' });
    expect(SketchRepository.getByRef(out.ref).manifest.loft).toMatchObject({ class: handlesOf(field).physics[0], livery: camo });
    await expect(previewVehicleInstanceHandler({ vehicle: VEHICLES[lofted].label, livery: camo })).rejects.toThrow(/a livery paints a field vehicle/);
    await expect(previewVehicleInstanceHandler({ vehicle: VEHICLES[field].label, livery: 'paisley' })).rejects.toThrow(/no pattern/);
  });
  it('mints a legacy type exactly as before, with the registry beside it in the readout only', async () => {
    const key = handlesOf(scenery).scenery[0];
    const out = await previewVehicleInstanceHandler({ type: key, title: 'legacy preview' });
    expect(SketchRepository.getByRef(out.ref).manifest).toEqual({ kind: 'vehicle-instance', type: key, title: 'legacy preview' });
    expect(out.registry.id).toBe(scenery);
  });
});

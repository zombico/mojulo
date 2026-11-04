import { describe, it, expect } from 'vitest';
import { readVehicleWord, previewVehicleInstanceHandler } from '@/lib/mcp/tools/preview-vehicle';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { VEHICLES, handlesOf } from '@/lib/graph/vehicle-registry/roster';
import { buildsOf } from '@/lib/graph/vehicle-registry/builds';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { MILITARY_CLASSES } from '@/lib/graph/car-designer/road-military';
import { CAMO_IDS } from '@/lib/graph/car-designer/livery-cut';
import { CYCLE_LOOKS } from '@/lib/graph/cycle-shelf/cycle-looks';

// rows chosen in code by what they carry: a scenery net named by a word that is not its key, the racer grammar,
// and a row the studio grid has no build of
const ids = Object.keys(VEHICLES);
const scenery = ids.find((id) => handlesOf(id).scenery && !handlesOf(id).scenery.includes(id) && !handlesOf(id).racer);
const racer = ids.find((id) => handlesOf(id).racer);
const unseen = ids.find((id) => buildsOf(id).every((b) => !['scenery', 'racer', 'supercar', 'loft', 'cycle', 'construction', 'mecha'].includes(b.via)));
// a legged frame, its only body the mecha shelf's
const walked = ids.find((id) => buildsOf(id).some((b) => b.via === 'mecha'));
// a machine ridden astride, its only body the cycle shelf's
const cycled = ids.find((id) => buildsOf(id).some((b) => b.via === 'cycle') && !buildsOf(id).some((b) => ['scenery', 'racer', 'supercar', 'loft'].includes(b.via)));
// a site machine, its only body the construction shelf's, one with a named pose besides its rest
const sited = ids.find((id) => buildsOf(id).some((b) => b.via === 'construction') && !buildsOf(id).some((b) => ['scenery', 'racer', 'supercar', 'loft', 'cycle'].includes(b.via)));
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
  it('mints a machine ridden astride as its cycle shelf machine, dressed by a look, and refuses a look on any other build', async () => {
    const archetype = handlesOf(cycled).cycle[0], look = Object.keys(CYCLE_LOOKS).find((k) => k !== 'stock');
    expect(readVehicleWord({ vehicle: cycled })).toMatchObject({ instance: { cycle: { archetype } }, id: cycled, tier: 'realistic' });
    const out = await previewVehicleInstanceHandler({ vehicle: VEHICLES[cycled].label, look, title: 'a cycle' });
    const row = SketchRepository.getByRef(out.ref);
    expect(row.manifest).toMatchObject({ vehicle: cycled, cycle: { archetype, look } });
    expect(out.stats).toMatchObject({ family: 'cycle', archetype, laws: true });
    expect(out.registry).toMatchObject({ id: cycled, tier: 'realistic', build: 'cycle' });
    const { payload } = await resolveWorldScene({ ref: row.ref, title: row.title, manifest: row.manifest });
    expect(payload.title).toMatch(/a cycle/);
    await expect(previewVehicleInstanceHandler({ vehicle: VEHICLES[lofted].label, look })).rejects.toThrow(/a look dresses a machine ridden astride/);
    await expect(previewVehicleInstanceHandler({ vehicle: cycled, look: 'tartan' })).rejects.toThrow(/expected one of: stock/);
  });
  it('mints a site machine as its construction shelf machine at a pose, and refuses a site\'s words on any other build', async () => {
    const archetype = handlesOf(sited).construction[0], { CON_ARCHETYPES } = await import('@/lib/graph/construction-shelf/index.js');
    const pose = Object.keys(CON_ARCHETYPES[archetype].poses).find((k) => k !== 'rest');
    expect(readVehicleWord({ vehicle: sited })).toMatchObject({ instance: { construction: { archetype } }, id: sited, tier: 'realistic' });
    const out = await previewVehicleInstanceHandler({ vehicle: VEHICLES[sited].label, pose, title: 'a site machine' });
    const row = SketchRepository.getByRef(out.ref);
    expect(row.manifest).toMatchObject({ vehicle: sited, construction: { archetype, pose } });
    expect(row.manifest.pose).toBeUndefined();
    expect(out.stats).toMatchObject({ family: 'construction', archetype, pose, laws: true });
    expect(out.registry).toMatchObject({ id: sited, tier: 'realistic', build: 'construction' });
    const { payload } = await resolveWorldScene({ ref: row.ref, title: row.title, manifest: row.manifest });
    expect(payload.title).toMatch(/a site machine/);
    await expect(previewVehicleInstanceHandler({ vehicle: sited, pose: 'cartwheel' })).rejects.toThrow(/is one of/);
    await expect(previewVehicleInstanceHandler({ vehicle: VEHICLES[lofted].label, tool: 'breaker' })).rejects.toThrow(/a tool is a site machine's/);
  });
  it('mints a legged frame as its mecha shelf frame at a stance, and refuses another build\'s words on it', async () => {
    const archetype = handlesOf(walked).mecha[0], { MECHA_ARCHETYPES } = await import('@/lib/graph/mecha-shelf/index.js');
    const pose = Object.keys(MECHA_ARCHETYPES[archetype].stances).find((k) => k !== MECHA_ARCHETYPES[archetype].rest);
    expect(readVehicleWord({ vehicle: walked })).toMatchObject({ instance: { mecha: { archetype } }, id: walked, tier: 'realistic' });
    const out = await previewVehicleInstanceHandler({ vehicle: VEHICLES[walked].label, pose, palette: 'fieldOlive', title: 'a legged frame' });
    const row = SketchRepository.getByRef(out.ref);
    expect(row.manifest).toMatchObject({ vehicle: walked, mecha: { archetype, pose, palette: 'fieldOlive' } });
    expect(row.manifest.pose).toBeUndefined();
    expect(out.stats).toMatchObject({ family: 'mecha', archetype, pose, laws: true });
    expect(out.registry).toMatchObject({ id: walked, tier: 'realistic', build: 'mecha' });
    const { payload } = await resolveWorldScene({ ref: row.ref, title: row.title, manifest: row.manifest });
    expect(payload.title).toMatch(/a legged frame/);
    await expect(previewVehicleInstanceHandler({ vehicle: walked, pose: 'cartwheel' })).rejects.toThrow(/is one of/);
    await expect(previewVehicleInstanceHandler({ vehicle: walked, tool: 'breaker' })).rejects.toThrow(/a tool is a site machine's/);
  });
  it('carries a dressed legged frame\'s livery and wear in its recipe, and refuses them on a frame with no dress', async () => {
    const { MECHA_ARCHETYPES } = await import('@/lib/graph/mecha-shelf/index.js');
    const dressed = ids.find((id) => (handlesOf(id).mecha ?? []).some((k) => MECHA_ARCHETYPES[k].dress)), plain = ids.find((id) => (handlesOf(id).mecha ?? []).some((k) => !MECHA_ARCHETYPES[k].dress));
    const camo = CAMO_IDS[0];
    const out = await previewVehicleInstanceHandler({ vehicle: VEHICLES[dressed].label, livery: camo, wear: 'battered', title: 'a dressed legged frame' });
    expect(SketchRepository.getByRef(out.ref).manifest.mecha).toMatchObject({ archetype: handlesOf(dressed).mecha[0], livery: camo, wear: 'battered' });
    await expect(previewVehicleInstanceHandler({ vehicle: VEHICLES[plain].label, livery: camo })).rejects.toThrow(/wears no dress/);
    const cabin = Object.keys(MECHA_ARCHETYPES[handlesOf(dressed).mecha[0]].cabins ?? {}).find((k) => k !== 'open');
    if (cabin) {
      const shut = await previewVehicleInstanceHandler({ vehicle: VEHICLES[dressed].label, cabin, slits: 'shut', title: 'a closed legged frame' });
      expect(SketchRepository.getByRef(shut.ref).manifest.mecha).toMatchObject({ cabin, slits: 'shut' });
    }
    // (a frame on wheels collapsed onto them by its stance's word)
    const rolling = ids.find((id) => (handlesOf(id).mecha ?? []).some((k) => MECHA_ARCHETYPES[k].wheels));
    if (rolling) {
      const arch = MECHA_ARCHETYPES[handlesOf(rolling).mecha[0]], roll = Object.keys(arch.stances).find((k) => arch.stances[k].roll);
      const rolled = await previewVehicleInstanceHandler({ vehicle: VEHICLES[rolling].label, pose: roll, title: 'a legged frame rolling' });
      expect(rolled.stats).toMatchObject({ pose: roll, laws: true });
    }
    const backpack = MECHA_ARCHETYPES[handlesOf(dressed).mecha[0]].backpacks?.[0];
    if (backpack) {
      const packed = await previewVehicleInstanceHandler({ vehicle: VEHICLES[dressed].label, backpack, title: 'a legged frame with a backpack' });
      expect(SketchRepository.getByRef(packed.ref).manifest.mecha).toMatchObject({ backpack });
      expect(packed.stats.laws).toBe(true);
    }
  });
  it('carries a field vehicle\'s livery and wear in its loft\'s recipe, and refuses them on a build their words do not paint', async () => {
    const field = ids.find((id) => (handlesOf(id).physics ?? []).some((k) => MILITARY_CLASSES[k]) && buildsOf(id).some((b) => b.via === 'loft'));
    const camo = CAMO_IDS[0];
    const out = await previewVehicleInstanceHandler({ vehicle: VEHICLES[field].label, livery: camo, title: 'a painted field vehicle' });
    expect(SketchRepository.getByRef(out.ref).manifest.loft).toMatchObject({ class: handlesOf(field).physics[0], livery: camo });
    await expect(previewVehicleInstanceHandler({ vehicle: VEHICLES[lofted].label, livery: camo })).rejects.toThrow(/a livery paints a field vehicle/);
    await expect(previewVehicleInstanceHandler({ vehicle: VEHICLES[field].label, livery: 'paisley' })).rejects.toThrow(/no pattern/);
    const worn = await previewVehicleInstanceHandler({ vehicle: VEHICLES[field].label, wear: 'battered', title: 'a worn field vehicle' });
    expect(SketchRepository.getByRef(worn.ref).manifest.loft).toMatchObject({ wear: 'battered' });
    await expect(previewVehicleInstanceHandler({ vehicle: VEHICLES[lofted].label, wear: 'battered' })).rejects.toThrow(/a wear weathers a field vehicle/);
  });
  it('mints a legacy type exactly as before, with the registry beside it in the readout only', async () => {
    const key = handlesOf(scenery).scenery[0];
    const out = await previewVehicleInstanceHandler({ type: key, title: 'legacy preview' });
    expect(SketchRepository.getByRef(out.ref).manifest).toEqual({ kind: 'vehicle-instance', type: key, title: 'legacy preview' });
    expect(out.registry.id).toBe(scenery);
  });
});

describe('a loft\'s words beside the name', () => {
  it('a brief or a paint with no class takes the row\'s own class: a tracked body by its words', () => {
    const tracked = Object.keys(MILITARY_CLASSES).find((k) => buildsOf(Object.keys(VEHICLES).find((id) => handlesOf(id).physics?.includes(k)))?.some((b) => b.via === 'loft' && !b.uses.includes('driven')));
    const id = Object.keys(VEHICLES).find((r) => handlesOf(r).physics?.includes(tracked));
    expect(readVehicleWord({ vehicle: VEHICLES[id].label, loft: { brief: 'a short gun' } })).toMatchObject({ id, instance: { loft: { class: tracked, brief: 'a short gun' } } });
  });
});

import { describe, it, expect } from 'vitest';
import { planRoadway, viewCamera, assembleRoadwayScene } from './roadway.js';
import { roadwayMapData, renderRoadwayMap } from './roadway-map.js';

const plan = planRoadway({ length: 2400 });
const data = roadwayMapData(plan, { title: 'Test <road>' });

describe('roadway map — the inspectable world map', () => {
  it('extracts what the diagram draws: bands, lanes, stations, elements, curves, structures, vehicles', () => {
    expect(data.lanes).toHaveLength(18);
    expect(data.lanes[0].centreline).toBeUndefined();          // the page carries the graph, not the polylines
    expect(data.stations[0]).toHaveLength(7);
    expect(data.stations[data.stations.length - 1][0]).toBeCloseTo(plan.length, 0);
    expect(data.elements.map((e) => e.type)).toEqual(['tangent', 'spiral', 'arc', 'spiral', 'tangent']);
    expect(data.vcurves.map((c) => c.type)).toEqual(expect.arrayContaining(['crest', 'sag']));
    expect(data.structures.every((s) => !s.soffits && s.clearanceMin >= 5.0)).toBe(true);
    expect(data.vehicles.length).toBe(plan.traffic.vehicles.length);
    expect(Object.keys(data.fleet)).toContain('tractorTrailer');
  });
  it('renders one self-contained, deterministic page whose script parses', () => {
    const html = renderRoadwayMap(data, { worldHref: '/api/sketches/sk_r/world' });
    expect(renderRoadwayMap(roadwayMapData(planRoadway({ length: 2400 }), { title: 'Test <road>' }), { worldHref: '/api/sketches/sk_r/world' })).toBe(html);
    expect(html).toContain('Test &lt;road&gt;');                // titles are escaped
    expect(html).not.toMatch(/<script[^>]+src=/);             // no external scripts
    const body = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
    expect(() => new Function(body)).not.toThrow();
    for (const n of plan.cameras.map((c) => c.name)) expect(html).toContain(`/api/sketches/sk_r/world?view=${n}`);
  });
});

describe('?view= deep links into the world', () => {
  it('a preset name opens on that preset; an unknown view changes nothing', () => {
    expect(assembleRoadwayScene({ length: 2400 }, { view: 'aerial' }).cameras[0].name).toBe('aerial');
    expect(assembleRoadwayScene({ length: 2400 }, { view: 'nope' }).cameras[0].name).toBe('driver');
  });
  it('s<station>-<lane> puts a driver eye 1.15 m over that lane, looking down it in travel order', () => {
    const cam = viewCamera(plan, 's1200-wb-collector-2');
    expect(cam.name).toBe('here:1200:wb:collector:2');
    const lane = plan.lanes.find((l) => l.id === 'wb:collector:2');
    const near = lane.centreline.find((p) => Math.abs(p[0] - 1200) < 1e-6);
    const [x, y, z] = cam.worldFraming.cameraPosition;
    expect(Math.hypot(x - near[1], y - near[2])).toBeLessThan(0.05);
    expect(z - near[3]).toBeCloseTo(1.15, 2);
    expect(cam.worldFraming.lookAt[0]).toBeLessThan(x);        // westbound looks toward lower stations
  });
});

import { describe, it, expect } from 'vitest';
import { BASELINE } from './baseline.js';
import { actScene } from './scene.js';
import { coverScene } from './coverage.js';
import { directorsNotes } from './notes.js';
import { coverageCameraAt } from './scene-film.js';
import { storyboardOf, storyboardHtml, storyboardJson, animaticSegments, animaticFrameSvg, mannequinForms, panelStation, spoken, shotTitle } from './storyboard.js';
import { readPlate, stationRig } from '../book/drawn-plate.js';

// the storyboard: a panel a coverage shot, drawn from the scene, never stored. Tested on the baseline's blocked
// two-hander (a cross, a turn, closes and overs), drawn small: the concept is the mapping, not the drawing's grain.
const S = actScene(BASELINE.blocked), C = coverScene(S), notes = directorsNotes(S, C);
const small = { width: 128, height: 72, res: 1 };
const board = storyboardOf(S, C, { notes, title: 'The key', ...small });

describe('the storyboard', () => {
  it('is a panel a coverage shot, its words the lines and crosses inside it', () => {
    expect(board.panels.map((p) => p.name)).toEqual(C.shots.map((s) => s.name));
    for (const p of board.panels) {
      for (const L of p.lines) expect(L.at < p.span[1] && L.end > p.span[0]).toBe(true);
      for (const X of p.crosses) expect(X.start < p.span[1] && X.end > p.span[0]).toBe(true);
    }
    // every line of the scene is in a panel, and the cross is said where it is walked, to its mark by name
    expect(new Set(board.panels.flatMap((p) => p.lines.map((L) => L.text)))).toEqual(new Set(S.turns.map((T) => T.text)));
    expect(board.panels.flatMap((p) => p.crosses).map((X) => `${X.who} ${X.to}`)).toContain('mara table');
  });

  it('pins each director\'s note with a moment to the panel it falls in, the rest to the board', () => {
    const pinned = board.panels.flatMap((p) => p.notes), withAt = notes.filter((N) => N.at !== undefined);
    expect(pinned.length).toBe(withAt.length);
    expect(board.notes.length + pinned.length).toBe(notes.length);
  });

  it('sees each panel from its shot\'s own camera: the world turned so the plate\'s station stands at 45 degrees', () => {
    const p = board.panels[1], s = C.shots[1], { framing } = coverageCameraAt(C, p.at, s), { turn, station } = panelStation(framing);
    expect(station.turn).toBe(45);
    // the camera, turned with the world about what it looks at, stands where the station's eye does
    const a = (turn * Math.PI) / 180, [lx, ly] = framing.lookAt, X = framing.cameraPosition[0] - lx, Y = framing.cameraPosition[1] - ly;
    const rig = stationRig({ width: 128, height: 72, station });
    expect(X * Math.cos(a) + Y * Math.sin(a)).toBeCloseTo(rig.origin.x, 2);
    expect(-X * Math.sin(a) + Y * Math.cos(a)).toBeCloseTo(rig.origin.y, 2);
    expect(rig.origin.z).toBeCloseTo(framing.cameraPosition[2], 2);
  });

  it('stands a mannequin for each actor, a plate the press accepts, its stature the part\'s', () => {
    const forms = mannequinForms(S, 1, { heights: { jon: 1.9 } });
    expect(forms.map((f) => f.id)).toEqual(Object.keys(S.actors));
    expect(() => readPlate({ forms })).not.toThrow();
    const top = (f) => Math.max(...f.terms.map((t) => (t.shape.center ?? t.shape.b)[2] + t.shape.radius));
    expect(top(forms[1]) / top(forms[0])).toBeCloseTo(1.9 / 1.7, 2);
  });

  it('holds each panel its shot\'s length on screen in the animatic, the line spoken under it', () => {
    const segs = animaticSegments(board);
    const total = segs.reduce((a, g) => a + g.seconds, 0);
    expect(total).toBeCloseTo(board.screen, 1);
    expect(segs.some((g) => g.caption === `MARA: ${spoken(S.turns[0].text)}`)).toBe(true);
    const svg = animaticFrameSvg(board, segs.find((g) => g.caption), small);
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 128 72"/);
    expect(svg).toContain(shotTitle(board.panels[segs.find((g) => g.caption).panel].name));
  });

  it('is one self-contained page, its words out of the read\'s markup, and the same bytes every time', () => {
    const html = storyboardHtml(board);
    expect(html).not.toMatch(/<script|\s(?:href|src)=/);
    expect(html).not.toContain('*key*');
    expect(html.match(/<article class="panel">/g)).toHaveLength(C.shots.length);
    expect(storyboardHtml(storyboardOf(S, C, { notes, title: 'The key', ...small }))).toBe(html);
    expect(JSON.stringify(storyboardJson(board))).not.toContain('<svg');
  });
});

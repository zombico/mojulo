import { describe, it, expect } from 'vitest';
import { BASELINE } from './baseline.js';
import { actScene } from './scene.js';
import { coverScene } from './coverage.js';
import { directorsNotes } from './notes.js';
import { coverageCameraAt } from './scene-film.js';
import { storyboardOf, storyboardHtml, storyboardJson, animaticSegments, animaticFrameSvg, mannequinForms, roomForms, groundForms, panelStation, spoken, shotTitle } from './storyboard.js';
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

  // a set with a walled room (a decorated room: interior/places.js) is drawn round the cast
  const ROOM = { id: 'lounge', min: [-3, -2.5], max: [3, 2.5], walled: true, h: 2.6, blocks: [{ min: [1.5, 1], max: [2.6, 1.8], h: 0.8 }, { min: [-2.8, 1], max: [-2, 2], h: 2 }, { min: [0, -2], max: [1, -1.5] }] };

  it('draws a walled room round the cast: its four walls and each piece at its height, a plate the press accepts', () => {
    const forms = roomForms([ROOM]);
    // (a piece that says no height is not drawn; a room with no walls gives nothing)
    expect(forms.map((f) => f.id)).toEqual(['lounge-wall-s', 'lounge-wall-n', 'lounge-wall-w', 'lounge-wall-e', 'lounge-piece-1', 'lounge-piece-2']);
    const top = (t) => t.shape.center[2] + t.shape.size[2] / 2, foot = (t) => t.shape.center[2] - t.shape.size[2] / 2;
    expect(top(forms[4].terms[0])).toBeCloseTo(0.8, 3);
    expect(top(forms[0].terms[0])).toBeCloseTo(2.6, 3);
    expect(() => readPlate({ forms })).not.toThrow();
    expect(roomForms([{ id: 'yard', min: [0, 0], max: [4, 4] }])).toEqual([]);
    // a door and a window are cut through the wall they lie on, between sill and head; one off every wall is left out
    const cut = roomForms([{ ...ROOM, openings: [{ kind: 'door', min: [-1, 2.5], max: [-0.1, 2.5], sill: 0, head: 2 }, { kind: 'window', min: [-3, -1], max: [-3, 0.5], sill: 0.9, head: 2.1 }, { kind: 'window', min: [0, 0], max: [1, 0], sill: 1, head: 2 }] }]);
    const holes = (id) => cut.find((f) => f.id === id).terms.filter((t) => t.op === 'subtract');
    expect(holes('lounge-wall-n')).toHaveLength(1);
    expect(foot(holes('lounge-wall-w')[0])).toBeCloseTo(0.9, 3);
    expect(top(holes('lounge-wall-w')[0])).toBeCloseTo(2.1, 3);
    expect(holes('lounge-wall-s').length + holes('lounge-wall-e').length).toBe(0);
    expect(() => readPlate({ forms: cut })).not.toThrow();
    // turned with the world, as the mannequins are: a quarter turn swaps the piece's sides
    expect(roomForms([ROOM], { turn: 90 })[4].terms[0].shape.size.slice(0, 2)).toEqual([0.8, 1.1]);
  });

  it('boards the room: the panels change, the plan shows what stands on the floor, and an open set keeps its bytes', () => {
    const inRoom = storyboardOf(S, C, { notes, title: 'The key', ...small, rooms: [ROOM], set: { ref: 'sk_x', title: 'Lounge' } });
    expect(inRoom.set.drawn).toBe(true);
    expect(inRoom.panels[0].frame).not.toBe(board.panels[0].frame);
    expect(inRoom.panels[0].blocking.match(/class="piece"/g).length).toBeGreaterThan(0);
    expect(storyboardHtml(inRoom)).toContain('doors, windows and furniture');
    const doored = storyboardOf(S, C, { notes, title: 'The key', ...small, rooms: [{ ...ROOM, openings: [{ kind: 'door', min: [-1, 2.5], max: [-0.1, 2.5], sill: 0, head: 2 }, { kind: 'window', min: [-3, -1], max: [-3, 0.5], sill: 0.9, head: 2.1 }] }] });
    expect(doored.panels[0].blocking).toMatch(/class="door"/);
    expect(doored.panels[0].blocking).toMatch(/class="window".*class="pane"/);
    // a set whose rooms have no walls is boarded as before: the same panels, no pieces
    const open = storyboardOf(S, C, { notes, title: 'The key', ...small, rooms: [{ id: 'hall', min: [-3, -2.5], max: [3, 2.5] }], set: { ref: 'sk_y' } });
    expect(open.set.drawn).toBeUndefined();
    expect(open.panels.map((p) => p.frame)).toEqual(board.panels.map((p) => p.frame));
    expect(open.panels[0].blocking).not.toContain('class="piece"');
  });

  // any set: what stands on its ground (actor/ground.js, read from the world's faces) is drawn the same way
  const GROUND = [{ min: [1.5, 1], max: [2.6, 1.8], h: 0.8 }, { min: [-2.8, 2.2], max: [3, 2.4], h: 3 }, { min: [40, 40], max: [41, 41], h: 2 }];

  it('draws what stands on any set\'s ground: one form of boxes near what the panel looks at, a plate the press accepts', () => {
    const [g] = groundForms(GROUND, { about: [0, 0] });
    expect(g.terms).toHaveLength(2);   // (the far block is past the panel's reach)
    expect(g.terms.every((t) => t.shape.kind === 'box')).toBe(true);
    expect(() => readPlate({ forms: [g] })).not.toThrow();
    expect(groundForms([], { about: [0, 0] })).toEqual([]);
    const onGround = storyboardOf(S, C, { notes, title: 'The key', ...small, blocks: GROUND, set: { ref: 'sk_z' } });
    expect(onGround.set.ground).toBe(true);
    expect(onGround.panels[0].frame).not.toBe(board.panels[0].frame);
    expect(onGround.panels[0].blocking).toMatch(/class="piece"/);
    expect(storyboardHtml(onGround)).toContain('what stands on its ground');
  });

  it('turns the world by quarter turns only when a set is drawn, the station taking the rest inside 1 to 89 degrees', () => {
    for (const s of C.shots) {
      const { framing } = coverageCameraAt(C, (s.span[0] + s.span[1]) / 2, s), { turn, station } = panelStation(framing, { square: true });
      expect(Math.abs(turn % 90)).toBe(0);
      expect(station.turn).toBeGreaterThanOrEqual(1);
      expect(station.turn).toBeLessThanOrEqual(89);
      // the camera stands where it did, turned with the world (to the degree the station is held inside its range)
      const free = panelStation(framing);
      expect(Math.abs(((station.turn - turn) - (free.station.turn - free.turn) + 540) % 360 - 180)).toBeLessThanOrEqual(1.001);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildBoardCamera, boardCameraInit, boardCameraRotate, boardCameraZoom, boardCameraTilt, boardCameraFocus, boardCameraPan,
  boardCameraStep, boardCameraPose, boardCameraScreenStep,
} from './board-camera.js';

const bounds = [0, 0, 20, 16];
const settle = (C, s = 3) => { for (let k = 0; k < s * 60; k++) boardCameraStep(C, 1 / 60); return C; };
const dist = (p) => Math.hypot(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]);
// the screen's up and right at a pose: the look's ground direction, and the right of it
const screenAxes = (C) => { const p = boardCameraPose(C), f = [p.target[0] - p.pos[0], p.target[1] - p.pos[1]], n = Math.hypot(...f); return { up: [f[0] / n, f[1] / n], right: [f[1] / n, -f[0] / n] }; };

describe('the tactical camera: a locked pitch, quarter turns, zoom stops, the focus held to the board', () => {
  it('runs alone from its source, as the page emits it', () => {
    const page = new Function(`return (${buildBoardCamera.toString()})();`)();
    const a = settle(boardCameraRotate(boardCameraInit({ bounds }), 1)), b = page.init({ bounds });
    page.rotate(b, 1);
    for (let k = 0; k < 180; k++) page.step(b, 1 / 60);
    expect(page.pose(b)).toEqual(boardCameraPose(a));
  });

  it('looks down a diagonal at its pitch, the whole board in frame, and comes to rest on a quarter turn', () => {
    const C = settle(boardCameraInit({ bounds }));
    const p = boardCameraPose(C);
    expect(p.target).toEqual([10, 8, 0]);
    expect(Math.atan2(p.target[1] - p.pos[1], p.target[0] - p.pos[0])).toBeCloseTo(Math.PI / 4, 6);
    expect(Math.asin((p.pos[2] - p.target[2]) / dist(p))).toBeCloseTo(Math.PI / 6, 6);
    for (const turns of [1, 2, -1, 5]) {
      const D = settle(boardCameraRotate(boardCameraInit({ bounds }), turns));
      const q = boardCameraPose(D), yaw = Math.atan2(q.target[1] - q.pos[1], q.target[0] - q.pos[0]);
      const k = (yaw - Math.PI / 4) / (Math.PI / 2);
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
      expect(dist(q)).toBeCloseTo(dist(p), 6);
    }
  });

  it('zooms by stops, closer each, never past the last; tilts between its pitches', () => {
    const C = boardCameraInit({ bounds }), d = [];
    for (let k = 0; k < 4; k++) { d.push(dist(boardCameraPose(settle(C)))); boardCameraZoom(C, 1); }
    expect(d[1]).toBeLessThan(d[0]);
    expect(d[2]).toBeLessThan(d[1]);
    expect(d[3]).toBeCloseTo(d[2], 6);
    boardCameraTilt(C);
    const p = boardCameraPose(settle(C));
    expect(Math.asin((p.pos[2] - p.target[2]) / dist(p))).toBeCloseTo(Math.PI / 4, 6);
  });

  it('holds its focus to the board, and the RTS form pans by the screen instead of turning', () => {
    const C = settle(boardCameraFocus(boardCameraZoom(boardCameraZoom(boardCameraInit({ bounds }), 1), 1), [99, -5, 1]));
    expect(boardCameraPose(C).target).toEqual([20, 0, 1]);
    // the widest stop holds the whole board in the middle, wherever the cursor is; the next leans part way to it
    const W = settle(boardCameraFocus(boardCameraInit({ bounds }), [20, 0, 0]));
    expect(boardCameraPose(W).target).toEqual([10, 8, 0]);
    expect(boardCameraPose(settle(boardCameraZoom(W, 1))).target).toEqual([17.5, 2, 0]);
    const R = boardCameraInit({ bounds, rotate: false, edge: true }), before = boardCameraPose(settle(R));
    boardCameraRotate(R, 1);
    expect(boardCameraPose(settle(R))).toEqual(before);
    const { up } = screenAxes(R);
    boardCameraPan(R, 0, 1, 0.1);
    const after = boardCameraPose(settle(R)).target, moved = [after[0] - before.target[0], after[1] - before.target[1]];
    expect(moved[0] * up[0] + moved[1] * up[1]).toBeGreaterThan(0);
    expect(Math.abs(moved[0] * up[1] - moved[1] * up[0])).toBeLessThan(1e-6);
  });

  it('reads a key as the board step that goes that way on screen, at every quarter turn, mid-turn included', () => {
    for (let turns = 0; turns < 4; turns++) {
      const C = settle(boardCameraRotate(boardCameraInit({ bounds }), turns)), { up, right } = screenAxes(C);
      const s = Object.fromEntries(['up', 'down', 'left', 'right'].map((k) => [k, boardCameraScreenStep(C, k)]));
      expect(s.up[0] * up[0] + s.up[1] * up[1]).toBeGreaterThan(0.5);
      expect(s.right[0] * right[0] + s.right[1] * right[1]).toBeGreaterThan(0.5);
      expect(s.down).toEqual([-s.up[0], -s.up[1]]);
      expect(s.left).toEqual([-s.right[0], -s.right[1]]);
      expect(Math.abs(s.up[0] * s.right[0] + s.up[1] * s.right[1])).toBe(0);
    }
    // a key pressed mid-turn already means the view it is turning to
    const C = boardCameraRotate(boardCameraInit({ bounds }), 1), D = settle(boardCameraRotate(boardCameraInit({ bounds }), 1));
    boardCameraStep(C, 1 / 60);
    expect(boardCameraScreenStep(C, 'up')).toEqual(boardCameraScreenStep(D, 'up'));
  });
});

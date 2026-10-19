// The screen a game is made for (game/screen.js), carried by its exports: the desktop window, Godot's [display] and its
// kernel's cameras, the score's cameras, the Unity and Unreal guides. Absent, every export as it was.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { desktopWindow, desktopMainJs } from '../game/desktop-shell.js';
import { emitGodotGame } from './godot-project.js';
import { emitUnityGame } from './unity-project.js';
import { emitUnrealGame } from './unreal-project.js';
import { levelCameras } from './scene-gltf-level.js';

const KERNEL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'godot-kernel');
const score = {
  ref: 'lv-a', title: 'A', kind: 'controllable', frame: 'z-up', units: '1 mojulo unit = 1 meter', spawn: [0, 0, 0], eye: 1.7, ground: 0,
  colliders: [], cameras: [{ name: 'view 0', translation: [6, -9, 5] }], entities: [], mechanics: [{ kind: 'reach-exit' }], ledger: {},
};
const lv = { ref: 'lv-a', title: 'A', gate: null, score };
const file = (out, name) => out.files.find((f) => f.file === name).text;

describe('the screen in the exports', () => {
  it('the desktop window: the frame fitted inside 1280×800; without one, 1280×800 as it was', () => {
    expect(desktopWindow(null)).toEqual({ width: 1280, height: 800 });
    expect(desktopWindow('phone')).toEqual({ width: 450, height: 800 });
    expect(desktopWindow('screen')).toEqual({ width: 1280, height: 720 });
    expect(desktopWindow({ pole: 'tablet', orientation: 'portrait' })).toEqual({ width: 600, height: 800 });
    const app = { title: 'Coin Run', ref: 'g' };
    expect(desktopMainJs({ ...app, screen: 'phone' })).toContain('width: 450,\n    height: 800,');
    expect(desktopMainJs(app)).toContain('width: 1280,\n    height: 800,');
  });

  it('Godot: [display] holds the frame, its orientation for the kernel; the ledger says what stays on the web', () => {
    const game = (screen) => emitGodotGame({ ref: 'g', title: 'G', manifestHash: 'h', levels: [lv], kernelVersion: '0.23.0', ...(screen ? { screen } : {}) });
    const phone = game('phone'), plain = game(null);
    const P = file(phone, 'project.godot');
    expect(P).toContain('[display]\n\nwindow/size/viewport_width=720\nwindow/size/viewport_height=1280\nwindow/size/window_width_override=450\nwindow/size/window_height_override=800\nwindow/stretch/mode="canvas_items"\nwindow/stretch/aspect="expand"\nwindow/handheld/orientation=1\n');
    expect(file(game('tablet'), 'project.godot')).toContain('window/size/viewport_width=1280\nwindow/size/viewport_height=960\nwindow/size/window_width_override=1067\nwindow/size/window_height_override=800\n');
    expect(file(game('tablet'), 'project.godot')).toContain('window/handheld/orientation=0');
    expect(phone.ledger.screen_carried.note).toMatch(/a phone \(9:16, portrait\).*cameras keep its width/);
    expect(file(plain, 'project.godot')).not.toContain('[display]');
    expect(plain.ledger.screen_carried).toBeUndefined();
    // the kernel reads the orientation and holds an upright frame's width
    const level = fs.readFileSync(path.join(KERNEL, 'level.gd'), 'utf8');
    expect(level).toContain('ProjectSettings.get_setting("display/window/handheld/orientation", 0)) == 1');
    expect(level).toContain('node.keep_aspect = Camera3D.KEEP_WIDTH');
  });

  it('the score\'s cameras: the frame\'s own vertical fov when the screen names one; absent, the solve as it was', () => {
    const cams = [{ worldFraming: { cameraPosition: [0, -10, 2], lookAt: [0, 0, 1], horizontalFov: 75 } }];
    const plain = levelCameras({ cameras: cams, viewBox: { width: 630, height: 1120 } })[0];
    const named = levelCameras({ cameras: cams, viewBox: { width: 630, height: 1120 }, screen: { aspect: 0.5625, portrait: true, reach: 1.3333, v0: 66 } })[0];
    expect(plain.yfov).toBeCloseTo(2 * Math.atan(Math.tan((75 * Math.PI) / 360) / 0.5625), 9);
    expect(named.yfov).toBeCloseTo((66 * Math.PI) / 180, 9);
    expect(named.aspectRatio).toBeCloseTo(0.5625, 9);
  });

  it('Unity and Unreal: the guide matches the editor\'s play view and the build\'s orientation; absent, no section', () => {
    const unity = (screen) => file(emitUnityGame({ ref: 'g', title: 'G', manifestHash: 'ffff0000ffff0000', levels: [lv], ...(screen ? { screen } : {}) }), 'IMPORT-GUIDE.md');
    const u = unity('phone');
    expect(u).toContain('## The screen it is made for');
    expect(u).toContain('Width 9, Height 16');
    expect(u).toContain('Default Orientation > `Portrait`');
    expect(unity(null)).not.toContain('The screen it is made for');
    const unreal = (screen) => file(emitUnrealGame({ ref: 'g', manifest: { kind: 'game', title: 'G', levels: [{ ref: 'lv-a' }], ...(screen ? { screen } : {}) }, levels: [{ ref: 'lv-a', score }], manifestHash: 'abcd1234abcd1234' }), 'IMPORT-GUIDE.md');
    const r = unreal('screen');
    expect(r).toContain('New Viewport Resolution > 1280 × 720');
    expect(r).toContain('Orientation > landscape only');
    expect(unreal(null)).not.toContain('The screen it is made for');
    for (const g of [u, r]) for (const line of g.split('\n').filter((l) => /^T\d/.test(l))) expect(line).toMatch(/^T(\d{3})(?:\.(\d{2}))? \S/);
  });
});

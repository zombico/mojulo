// @vitest-environment jsdom
// THE FRAME'S HUD (frame-hud.js): its weapons' names shown as the level opens and when a weapon's state turns (a
// reload), then gone after FRAME_HUD.names s, so the fight is the screen; the rounds stay.
import { describe, expect, it } from 'vitest';
import { frameHudScript, FRAME_HUD } from './frame-hud.js';

function page() {
  let now = 0, frame = null;
  const slot = { name: 'rifle', mag: 30 };
  const P = { id: 'p', rule: { type: 'frame', slots: { armR: slot }, en: { max: 3000 } }, en: 3000, body: { hp: 9000, hpMax: 9000 }, slotState: { armR: { ammo: 30 } }, transform: { pos: [0, 0, 0] } };
  window.__mojCtrl = { world: { pilotId: 'p', byId: { p: P } } };
  new Function('window', 'document', 'performance', 'requestAnimationFrame', 'innerWidth', 'innerHeight', frameHudScript())(window, document, { now: () => now }, (f) => { frame = f; }, 1280, 720);
  const step = (s) => { const n = Math.ceil(s / 0.1); for (let i = 0; i < n; i++) { now += 100; const f = frame; frame = null; f(); } };
  const name = () => document.querySelector('.fh .armR b');
  return { P, step, name, count: () => document.querySelector('.fh .armR span').textContent };
}

describe('the frame\'s HUD', () => {
  it('shows its weapons\' names as the level opens, then lets them go; a reload brings them back a while', () => {
    const H = page();
    H.step(1);
    expect(H.name().textContent).toBe('R ARM RIFLE');
    expect(Number(H.name().style.opacity)).toBe(1);
    H.step(FRAME_HUD.names + FRAME_HUD.fade + 0.5);
    expect(Number(H.name().style.opacity)).toBe(0);
    expect(H.count()).toBe('30');                                  // (the rounds stay)
    H.P.slotState.armR = { ammo: 0, reloading: true };
    H.step(0.5);
    expect(Number(H.name().style.opacity)).toBe(1);
    expect(H.count()).toBe('RELOAD');
  });

  it('stands down while a scene plays', () => {
    const H = page();
    H.step(0.5);
    const all = document.querySelectorAll('.fh'), root = all[all.length - 1];
    expect(root.style.display).toBe('');
    window.__mojScenes = { on: () => true };
    H.step(0.2);
    expect(root.style.display).toBe('none');
    window.__mojScenes = { on: () => false };
    H.step(0.2);
    expect(root.style.display).toBe('');
    delete window.__mojScenes;
  });
});

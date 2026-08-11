import { describe, it, expect } from 'vitest';
import {
  buildSolo, buildPractice, buildFfa, buildTeam, buildWatch, lightenMatchLevel,
  DUEL_KILLS, FFA_KILLS, TEAM_KILLS, WATCH_KILLS, FFA_RIVALS,
} from './match-modes.js';
import { applyMapRef } from './map-ref.js';

// PACK-ABSENT tripwire: this file imports ONLY engine modules — the generic mode builders must
// serve any controllable world with pilotable entities, with no mobile-suit content in reach.
// A minimal map source: terrain + a two-body pilotable roster + the keys a proving ground pins
// (ai:'off', pilot, note) that the builders must clear (and the light form must tombstone).
const mapSrc = () => ({
  kind: 'controllable', title: 'proving ground', note: 'map note', bg: '#101820',
  ai: 'off', pilot: 'red',
  faces: [
    { corners: [[-300, -300, 0], [300, -300, 0], [300, 300, 0], [-300, 300, 0]], fill: '#565' },
    { corners: [[-300, -300, 0], [-300, -300, 40], [-300, 300, 40], [-300, 300, 0]], fill: '#434' },
  ],
  colliders: [{ min: [-8, -8, 0], max: [8, 8, 30] }],
  camera: { rule: 'follow', dist: 38, height: 28 },
  entities: [
    { id: 'red', pilotable: true, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [6, 6, 12], color: '#c33' },
      rule: { collideRadius: 6, collideHeight: 14 }, ambient: { type: 'ai', speed: 24, turn: 2.2 } },
    { id: 'blue', pilotable: true, transform: { pos: [30, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [6, 6, 12], color: '#36c' },
      rule: { collideRadius: 6, collideHeight: 14 }, ambient: { type: 'ai', speed: 26, turn: 2.0 } },
  ],
});

const opts = (ref) => ({ ref, title: 'Bout · Flats', space: false });

describe('generic match-mode builders (no pack content)', () => {
  it('solo: player options + one enemy seat per roster body, duel match, career contract', () => {
    const src = mapSrc();
    const m = buildSolo(src, opts('sk_g_solo'));
    expect(m.entities.filter((e) => e.seat === 'player').map((e) => e.id)).toEqual(['red', 'blue']);
    expect(m.entities.filter((e) => e.seat === 'enemy').map((e) => e.id)).toEqual(['en_red', 'en_blue']);
    expect(m.match.killTarget).toBe(DUEL_KILLS);
    expect(m.match.spawns).toHaveLength(8);
    expect(m.match.names.en_red).toBe('RED');           // default nameOf: id upper-cased
    expect(m.game.consumes.map((c) => c.slice)).toEqual(['suits', 'duel_enemy']);
    expect(m.ai).toBeUndefined();                       // the map's pinned 'off' never rides in
    expect(m.camera.dist).toBe(38);                     // NO pack prelude: stock camera untouched
    expect(JSON.stringify(src)).toBe(JSON.stringify(mapSrc()));   // source untouched
  });

  it('practice: non-destructive drill, passive ai, no career', () => {
    const m = buildPractice(mapSrc(), opts('sk_g_practice'));
    expect(m.match.practice).toBe(true);
    expect(m.ai).toBe('off');
    expect(m.game.produces.results).toEqual(['success', 'abort']);
  });

  it('ffa: rival pool hunts all', () => {
    const m = buildFfa(mapSrc(), opts('sk_g_ffa'));
    const rivals = m.entities.filter((e) => e.seat === 'opponent');
    expect(rivals).toHaveLength(FFA_RIVALS);
    expect(rivals.every((e) => e.rule.target === 'all')).toBe(true);
    expect(m.match.killTarget).toBe(FFA_KILLS);
  });

  it('team: two team pools, team victory, team-aware targeting', () => {
    const m = buildTeam(mapSrc(), opts('sk_g_team'));
    expect(m.entities.filter((e) => e.seat === 'ally').every((e) => e.team === 'a' && e.rule.target === 'enemy')).toBe(true);
    expect(m.entities.filter((e) => e.seat === 'enemy').every((e) => e.team === 'b' && e.rule.target === 'enemy')).toBe(true);
    expect(m.match.killTarget).toBe(TEAM_KILLS);
    expect(m.match.teamNames).toEqual({ a: 'BLUE', b: 'RED' });
  });

  it('watch: no pilot, glide camera, spectate contract, per-mode casts', () => {
    for (const mode of ['solo', 'team', 'ffa']) {
      const m = buildWatch(mapSrc(), { ...opts(`sk_g_w_${mode}`), mode });
      expect(m.spectate, mode).toBe(true);
      expect(m.pilot, mode).toBeUndefined();
      expect(m.camera.rule, mode).toBe('glide');
      expect(m.match.killTarget, mode).toBe(WATCH_KILLS);
      expect(m.game.spectate, mode).toBe(true);
      expect(m.entities.every((e) => e.seat === 'ai'), mode).toBe(true);
    }
  });

  it('builder knobs: killTarget / rivals / team shape are per-call overrides', () => {
    expect(buildSolo(mapSrc(), { ...opts('sk_g_k'), killTarget: 7 }).match.killTarget).toBe(7);
    expect(buildFfa(mapSrc(), { ...opts('sk_g_r'), rivals: 3 }).entities.filter((e) => e.seat === 'opponent')).toHaveLength(3);
    expect(buildTeam(mapSrc(), { ...opts('sk_g_t'), teamNames: { a: 'ONI', b: 'RONIN' } }).match.teamNames).toEqual({ a: 'ONI', b: 'RONIN' });
  });

  it('prelude hook runs on the clone before seats derive (a repaint flows into AI bodies)', () => {
    const m = buildSolo(mapSrc(), { ...opts('sk_g_p'), prelude: (w) => { for (const e of w.entities) e.body.color = '#000'; return w; } });
    expect(m.entities.find((e) => e.id === 'en_red').body.color).toBe('#000');
  });
});

describe('lightenMatchLevel + applyMapRef', () => {
  it.each(['solo', 'ffa', 'team'])('%s: merge(JSON(lighten(full))) ≡ full', (which) => {
    const src = mapSrc();
    const build = { solo: buildSolo, ffa: buildFfa, team: buildTeam }[which];
    const full = build(src, opts(`sk_g_${which}`));
    const light = lightenMatchLevel(full, 'sk_g_map');
    expect(light.faces).toBeUndefined();
    const merged = applyMapRef(JSON.parse(JSON.stringify(light)), src);
    expect(merged).toEqual(JSON.parse(JSON.stringify(full)));
  });

  it('tombstones delete the map\'s pinned ai/pilot/note through the merge', () => {
    const src = mapSrc();
    const light = JSON.parse(JSON.stringify(lightenMatchLevel(
      buildWatch(src, { ...opts('sk_g_wt'), mode: 'solo' }), 'sk_g_map')));
    const merged = applyMapRef(light, src);
    expect('ai' in merged).toBe(false);
    expect('pilot' in merged).toBe(false);
    expect('note' in merged).toBe(false);
  });
});

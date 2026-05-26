// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js. Same pattern as meta-context.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { commitOperatorKyc } from './meta-context.js';
import { buildForwardContextBody, forwardContextHandler } from './context.js';
import {
  VOCABULARY_REGISTERS,
  PROCEDURAL_DISCLOSURES,
  DEFAULT_VOCABULARY_REGISTER,
  DEFAULT_PROCEDURAL_DISCLOSURE,
} from './meta-context.js';

beforeEach(() => {
  closeDb();
});

// Phrases that must appear in every register × disclosure cell — they're
// the four-gate floor rule and the dual-purpose preamble. If any cell drops
// these, the design contract is broken.
const FLOOR_PHRASES = [
  'proposed',
  'materialized',
  'dry-run',
  'promoted',
  'watched',
  'read-once',
  'audit trail',
];
const PREAMBLE_MARKER = 'This document plays two roles';

describe('buildForwardContextBody — variant composition', () => {
  it('renders every register × disclosure cell without throwing', () => {
    for (const register of VOCABULARY_REGISTERS) {
      for (const disclosure of PROCEDURAL_DISCLOSURES) {
        const body = buildForwardContextBody({ register, disclosure });
        expect(typeof body).toBe('string');
        expect(body.length).toBeGreaterThan(500);
      }
    }
  });

  it('floor rule (four gates) survives in every register × disclosure cell', () => {
    for (const register of VOCABULARY_REGISTERS) {
      for (const disclosure of PROCEDURAL_DISCLOSURES) {
        const body = buildForwardContextBody({ register, disclosure });
        for (const phrase of FLOOR_PHRASES) {
          expect(body, `cell ${register}+${disclosure} missing "${phrase}"`).toContain(phrase);
        }
      }
    }
  });

  it('dual-purpose preamble appears in every cell', () => {
    for (const register of VOCABULARY_REGISTERS) {
      for (const disclosure of PROCEDURAL_DISCLOSURES) {
        const body = buildForwardContextBody({ register, disclosure });
        expect(body).toContain(PREAMBLE_MARKER);
      }
    }
  });

  it('opening paragraph branches: plain says "Gmail, your calendar, Drive"; mojulo strips ramp prose', () => {
    const plain = buildForwardContextBody({ register: 'plain', disclosure: 'reflective' });
    expect(plain).toMatch(/Gmail.*Drive/);
    expect(plain).toMatch(/Don't surface to the user/i);

    const mojulo = buildForwardContextBody({ register: 'mojulo', disclosure: 'reflective' });
    expect(mojulo).toMatch(/control plane for solutions composed over installed MCPs/);
    expect(mojulo).not.toMatch(/Gmail, your calendar, Drive/);
  });

  it('concept glossary branches: plain marks "Don\'t surface" on concept terms; mojulo strips prose', () => {
    const plain = buildForwardContextBody({ register: 'plain', disclosure: 'reflective' });
    expect(plain).toMatch(/Don't surface the bold terms to the user/);

    const mojulo = buildForwardContextBody({ register: 'mojulo', disclosure: 'reflective' });
    expect(mojulo).toMatch(/stackable bot capability/);
    expect(mojulo).not.toMatch(/Don't surface/);
  });

  it('disclosure directive branches: terse / reflective / pedagogical each insert their own paragraph', () => {
    const terse = buildForwardContextBody({ register: 'mixed', disclosure: 'terse' });
    const reflective = buildForwardContextBody({ register: 'mixed', disclosure: 'reflective' });
    const pedagogical = buildForwardContextBody({ register: 'mixed', disclosure: 'pedagogical' });
    expect(terse).toMatch(/Procedural disclosure: terse/);
    expect(reflective).toMatch(/Procedural disclosure: reflective/);
    expect(pedagogical).toMatch(/Procedural disclosure: pedagogical/);
    // Only one disclosure paragraph per body.
    expect(terse).not.toMatch(/Procedural disclosure: reflective/);
    expect(reflective).not.toMatch(/Procedural disclosure: terse/);
  });

  it('communication settings notice reports the active register + disclosure cell', () => {
    const body = buildForwardContextBody({
      register: 'plain',
      disclosure: 'pedagogical',
      source: 'operator_anchor',
    });
    expect(body).toMatch(/vocabulary_register: plain/);
    expect(body).toMatch(/procedural_disclosure: pedagogical/);
    expect(body).toMatch(/read from the operator anchor/);
  });

  it('concept names are invariant — same identifiers in every register variant', () => {
    const names = ['Bot', 'Deployment', 'Protocol', 'Chain', 'Catalyst', 'Host adapter'];
    for (const register of VOCABULARY_REGISTERS) {
      const body = buildForwardContextBody({ register, disclosure: 'reflective' });
      for (const n of names) {
        expect(body, `cell ${register} missing concept name "${n}"`).toContain(`**${n}**`);
      }
    }
  });

  it('tool index stays single-source — same tool descriptions in every register', () => {
    // Pick a representative tool one-liner that should appear verbatim
    // regardless of register.
    const marker = '`bind_primitives` — **the primitive-binding composer';
    for (const register of VOCABULARY_REGISTERS) {
      const body = buildForwardContextBody({ register, disclosure: 'reflective' });
      expect(body, `cell ${register} missing tool index line`).toContain(marker);
    }
  });

  it('falls back to defaults when register / disclosure are invalid', () => {
    const body = buildForwardContextBody({ register: 'nope', disclosure: 'whatever' });
    expect(body).toMatch(new RegExp(`vocabulary_register: ${DEFAULT_VOCABULARY_REGISTER}`));
    expect(body).toMatch(new RegExp(`procedural_disclosure: ${DEFAULT_PROCEDURAL_DISCLOSURE}`));
  });
});

describe('forwardContextHandler — register resolution', () => {
  it('uses defaults when no operator anchor exists', async () => {
    const { content } = await forwardContextHandler({});
    const text = content[0].text;
    expect(text).toMatch(new RegExp(`vocabulary_register: ${DEFAULT_VOCABULARY_REGISTER}`));
    expect(text).toMatch(new RegExp(`procedural_disclosure: ${DEFAULT_PROCEDURAL_DISCLOSURE}`));
    expect(text).toMatch(/defaults — no operator anchor/);
  });

  it('reads register + disclosure from the operator anchor when no override is passed', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'pedagogical',
    });
    const { content } = await forwardContextHandler({});
    const text = content[0].text;
    expect(text).toMatch(/vocabulary_register: plain/);
    expect(text).toMatch(/procedural_disclosure: pedagogical/);
    expect(text).toMatch(/read from the operator anchor/);
    // plain opening should appear.
    expect(text).toMatch(/Don't surface to the user/i);
    // pedagogical disclosure should appear.
    expect(text).toMatch(/Procedural disclosure: pedagogical/);
  });

  it('per-call override beats the operator anchor', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'reflective',
    });
    const { content } = await forwardContextHandler({
      register: 'mojulo',
      disclosure: 'terse',
    });
    const text = content[0].text;
    expect(text).toMatch(/vocabulary_register: mojulo/);
    expect(text).toMatch(/procedural_disclosure: terse/);
    expect(text).toMatch(/set via this call/);
  });

  it('per-call override composes per-axis with the anchor — one axis overridden, the other read from anchor', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'reflective',
    });
    const { content } = await forwardContextHandler({ disclosure: 'pedagogical' });
    const text = content[0].text;
    // Anchor's register survives.
    expect(text).toMatch(/vocabulary_register: plain/);
    // Override's disclosure wins.
    expect(text).toMatch(/procedural_disclosure: pedagogical/);
  });

  it('rejects invalid register override', async () => {
    await expect(forwardContextHandler({ register: 'casual' })).rejects.toThrow(/register/);
  });

  it('rejects invalid disclosure override', async () => {
    await expect(forwardContextHandler({ disclosure: 'verbose' })).rejects.toThrow(/disclosure/);
  });

  it('handler output still contains the floor rule', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'terse',
    });
    const { content } = await forwardContextHandler({});
    const text = content[0].text;
    for (const phrase of FLOOR_PHRASES) {
      expect(text, `handler output missing "${phrase}"`).toContain(phrase);
    }
  });
});

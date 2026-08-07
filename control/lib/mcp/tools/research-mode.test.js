process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintMechanicsView } from './mechanics-view.js';
import {
  startResearchHandler,
  bindResearchItemHandler,
  synthesizeAbstractHandler,
  getResearchHandler,
  _internals,
} from './research-mode.js';

beforeEach(() => {
  closeDb();
});

async function freshBook(title = 'range vs gravity') {
  const { research_ref } = await startResearchHandler({ title });
  return research_ref;
}

function mintProjectile(overrides = {}) {
  return mintMechanicsView({ scenario: 'projectile', v0: 18, angle: 55, g: 9.8, ...overrides });
}

async function bindExperiment(research_ref, minted, { stats = minted.stats, title } = {}) {
  return bindResearchItemHandler({
    research_ref,
    kind: 'experiment',
    title: title || `projectile g=${minted.recipe.g ?? 9.8}`,
    media_ref: minted.ref,
    metadata: { recipe: minted.recipe, stats },
  });
}

describe('experiment items — the provenance-carrying kind', () => {
  it('binds a science-view sketch with { recipe, stats } and round-trips through get_research', async () => {
    const research_ref = await freshBook();
    const minted = mintProjectile();
    const bound = await bindExperiment(research_ref, minted);
    expect(bound.ok).toBe(true);
    expect(bound.kind).toBe('experiment');

    const book = await getResearchHandler({ research_ref });
    const item = book.items.find((it) => it.item_id === bound.item_id);
    expect(item.media_ref).toBe(minted.ref);
    expect(item.metadata.recipe).toEqual(minted.recipe);
    expect(item.metadata.stats).toEqual(minted.stats);
  });

  it('gates: experiment without media_ref is rejected', async () => {
    const research_ref = await freshBook();
    const minted = mintProjectile();
    await expect(
      bindResearchItemHandler({ research_ref, kind: 'experiment', metadata: { recipe: minted.recipe } }),
    ).rejects.toThrow(/requires media_ref/);
  });

  it('gates: experiment without metadata.recipe (or with a kindless recipe) is rejected', async () => {
    const research_ref = await freshBook();
    const minted = mintProjectile();
    await expect(
      bindResearchItemHandler({ research_ref, kind: 'experiment', media_ref: minted.ref }),
    ).rejects.toThrow(/requires metadata\.recipe/);
    await expect(
      bindResearchItemHandler({
        research_ref, kind: 'experiment', media_ref: minted.ref,
        metadata: { recipe: { scenario: 'projectile' } },   // no kind
      }),
    ).rejects.toThrow(/requires metadata\.recipe/);
  });

  it('metadata.stats stays optional — a recipe alone still reproduces the run', async () => {
    const research_ref = await freshBook();
    const minted = mintProjectile();
    const bound = await bindResearchItemHandler({
      research_ref, kind: 'experiment', media_ref: minted.ref, metadata: { recipe: minted.recipe },
    });
    expect(bound.ok).toBe(true);
  });

  it('the other kinds are untouched by the gate', async () => {
    const research_ref = await freshBook();
    const bound = await bindResearchItemHandler({ research_ref, kind: 'note', body: 'hypothesis: range ∝ 1/g' });
    expect(bound.ok).toBe(true);
  });

  it('the brief documents the numerical-experiment workflow', () => {
    expect(_internals.KNOWN_KINDS.has('experiment')).toBe(true);
    expect(_internals.RESEARCH_BRIEF).toMatch(/Numerical experiments/);
    expect(_internals.RESEARCH_BRIEF).toMatch(/measure_view/);
  });
});

describe('synthesize_abstract({ review: true }) — the deterministic reviewer', () => {
  it('a clean book reviews consistent, and the review is recorded with the abstract snapshot', async () => {
    const research_ref = await freshBook();
    await bindExperiment(research_ref, mintProjectile({ g: 9.8 }));
    await bindExperiment(research_ref, mintProjectile({ g: 1.62 }));

    const out = await synthesizeAbstractHandler({ research_ref, abstract: 'range ∝ 1/g', review: true });
    expect(out.review).toMatchObject({ items_checked: 2, items_skipped: 0, consistent: true });
    expect(out.review.discrepancies).toEqual([]);

    const book = await getResearchHandler({ research_ref });
    expect(book.abstracts[0].assessment.review.consistent).toBe(true);
  });

  it('flags artifact_missing when the bound sketch no longer exists', async () => {
    const research_ref = await freshBook();
    await bindResearchItemHandler({
      research_ref, kind: 'experiment', media_ref: 'sk_gone',
      metadata: { recipe: { kind: 'mechanics-view', scenario: 'projectile' } },
    });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.consistent).toBe(false);
    expect(out.review.discrepancies[0].code).toBe('artifact_missing');
  });

  it('flags recipe_drift when the artifact was edited after binding', async () => {
    const research_ref = await freshBook();
    const minted = mintProjectile();
    await bindExperiment(research_ref, minted);
    SketchRepository.update({ ref: minted.ref, manifest: { ...minted.recipe, v0: 40 } });

    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.consistent).toBe(false);
    expect(out.review.discrepancies.map((d) => d.code)).toContain('recipe_drift');
  });

  it('flags stats_mismatch when the bound snapshot no longer matches a recompute', async () => {
    const research_ref = await freshBook();
    const minted = mintProjectile();
    await bindExperiment(research_ref, minted, { stats: { ...minted.stats, flightTime: minted.stats.flightTime + 1 } });

    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.consistent).toBe(false);
    expect(out.review.discrepancies).toEqual([
      expect.objectContaining({ code: 'stats_mismatch', detail: expect.stringContaining('flightTime') }),
    ]);
  });

  it('experiments with a non-reviewable recipe kind are skipped, not failed', async () => {
    const research_ref = await freshBook();
    await bindResearchItemHandler({
      research_ref, kind: 'experiment', media_ref: 'sk_whatever',
      metadata: { recipe: { kind: 'wavepacket-view', scenario: 'free' } },
    });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review).toMatchObject({ items_checked: 0, items_skipped: 1, consistent: true });
  });

  it('review with no experiment items is a no-op result, not an error', async () => {
    const research_ref = await freshBook();
    await bindResearchItemHandler({ research_ref, kind: 'note', body: 'just a note' });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review).toMatchObject({ items_checked: 0, consistent: true });
  });

  it('review composes with evaluate — both recorded in the same assessment_json', async () => {
    const research_ref = await freshBook();
    await bindExperiment(research_ref, mintProjectile());
    const out = await synthesizeAbstractHandler({
      research_ref, abstract: 'a tractable spike', review: true, evaluate: true,
      suggested_lens: 'spike', recommendation: 'keep_researching', missing: ['more sweep points'],
    });
    expect(out.evaluated).toBe(true);
    expect(out.review.consistent).toBe(true);

    const book = await getResearchHandler({ research_ref });
    const recorded = book.abstracts[0].assessment;
    expect(recorded.recommendation).toBe('keep_researching');
    expect(recorded.review.items_checked).toBe(1);
  });

  it('without review, the response and the recorded assessment are unchanged (back-compat)', async () => {
    const research_ref = await freshBook();
    await bindExperiment(research_ref, mintProjectile());
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't' });
    expect(out).not.toHaveProperty('review');
    const book = await getResearchHandler({ research_ref });
    expect(book.abstracts[0].assessment).toBeNull();
  });
});

describe('quote integrity — the reviewer, generalized past physics', () => {
  const ARTICLE = 'Kepler showed that planets sweep out equal areas in equal times.\nThe orbit is an ellipse with the sun at a focus.';

  async function bindArticleAndQuote(research_ref, { quote, anchor = true } = {}) {
    const art = await bindResearchItemHandler({ research_ref, kind: 'article', title: 'Kepler', body: ARTICLE, source_url: 'https://example.org/kepler' });
    const q = await bindResearchItemHandler({
      research_ref, kind: 'quote', body: quote ?? 'planets sweep out equal areas in equal times',
      ...(anchor ? { metadata: { source_item_id: art.item_id } } : {}),
    });
    return { art, q };
  }

  it('article bodies are content-hashed automatically at bind time', async () => {
    const research_ref = await freshBook();
    await bindResearchItemHandler({ research_ref, kind: 'article', body: ARTICLE });
    const book = await getResearchHandler({ research_ref });
    expect(book.items[0].metadata.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('an anchored verbatim quote reviews clean (whitespace-normalized containment)', async () => {
    const research_ref = await freshBook();
    // quote re-wrapped across lines — words match, whitespace differs
    await bindArticleAndQuote(research_ref, { quote: 'planets sweep out\nequal areas   in equal times' });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review).toMatchObject({ quotes_checked: 1, consistent: true });
  });

  it('flags quote_drift when the quoted words are not in the source', async () => {
    const research_ref = await freshBook();
    await bindArticleAndQuote(research_ref, { quote: 'planets sweep out unequal areas' });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.consistent).toBe(false);
    expect(out.review.discrepancies[0].code).toBe('quote_drift');
  });

  it('flags quote_source_missing when the anchor points at nothing usable', async () => {
    const research_ref = await freshBook();
    await bindResearchItemHandler({
      research_ref, kind: 'quote', body: 'equal areas', metadata: { source_item_id: 99999 },
    });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.discrepancies[0].code).toBe('quote_source_missing');
  });

  it('flags source_hash_mismatch when the article body was edited out-of-band', async () => {
    const research_ref = await freshBook();
    const { art } = await bindArticleAndQuote(research_ref, { quote: 'equal areas in equal times' });
    const { getDb } = await import('@/lib/db/index');
    getDb().prepare('UPDATE research_items SET body_md = ? WHERE id = ?')
      .run(`${ARTICLE} equal areas in equal times [edited]`, art.item_id);

    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.consistent).toBe(false);
    expect(out.review.discrepancies.map((d) => d.code)).toContain('source_hash_mismatch');
  });

  it('unanchored quotes are left alone, not false-flagged', async () => {
    const research_ref = await freshBook();
    await bindArticleAndQuote(research_ref, { anchor: false, quote: 'text from some external paper' });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review).toMatchObject({ quotes_checked: 0, consistent: true });
  });
});

describe('prediction items — falsification, formalized', () => {
  const SPRING_T = (2 * Math.PI) / Math.sqrt(12 / 1);   // T = 2π√(m/k), exact

  async function bindSpringExperiment(research_ref) {
    const minted = mintMechanicsView({ scenario: 'spring', k: 12, mass: 1 });
    return bindResearchItemHandler({
      research_ref, kind: 'experiment', media_ref: minted.ref,
      metadata: { recipe: minted.recipe, stats: minted.stats },
    });
  }

  it('gates: prediction requires an anchor and >= 1 finite expected value', async () => {
    const research_ref = await freshBook();
    await expect(
      bindResearchItemHandler({ research_ref, kind: 'prediction', metadata: { expected: { flightTime: 1.8 } } }),
    ).rejects.toThrow(/requires metadata\.experiment_item_id/);
    await expect(
      bindResearchItemHandler({ research_ref, kind: 'prediction', metadata: { experiment_item_id: 1, expected: { note: 'not a number' } } }),
    ).rejects.toThrow(/requires metadata\.expected/);
  });

  it('a correct closed-form prediction is confirmed', async () => {
    const research_ref = await freshBook();
    const exp = await bindSpringExperiment(research_ref);
    await bindResearchItemHandler({
      research_ref, kind: 'prediction', body: 'SHM: T = 2π√(m/k)',
      metadata: { experiment_item_id: exp.item_id, expected: { flightTime: SPRING_T } },
    });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.predictions).toMatchObject({ checked: 1, confirmed: 1, falsified: 0 });
    expect(out.review.predictions.results[0].verdict).toBe('confirmed');
    expect(out.review.consistent).toBe(true);
  });

  it('a wrong prediction is FALSIFIED — a result, never an inconsistency', async () => {
    const research_ref = await freshBook();
    const exp = await bindSpringExperiment(research_ref);
    await bindResearchItemHandler({
      research_ref, kind: 'prediction', body: 'wrong theory: T = 10',
      metadata: { experiment_item_id: exp.item_id, expected: { flightTime: 10 } },
    });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.predictions).toMatchObject({ confirmed: 0, falsified: 1 });
    expect(out.review.consistent).toBe(true);        // integrity is intact; the theory was just wrong
    expect(out.review.discrepancies).toEqual([]);
  });

  it('an expected key the experiment never measured is unmeasurable', async () => {
    const research_ref = await freshBook();
    const exp = await bindSpringExperiment(research_ref);
    await bindResearchItemHandler({
      research_ref, kind: 'prediction',
      metadata: { experiment_item_id: exp.item_id, expected: { warpFactor: 9 } },
    });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.predictions).toMatchObject({ unmeasurable: 1, confirmed: 0, falsified: 0 });
  });

  it('a broken anchor IS an integrity discrepancy (prediction_source_missing)', async () => {
    const research_ref = await freshBook();
    await bindResearchItemHandler({
      research_ref, kind: 'prediction',
      metadata: { experiment_item_id: 424242, expected: { flightTime: 1 } },
    });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.consistent).toBe(false);
    expect(out.review.discrepancies[0].code).toBe('prediction_source_missing');
  });

  it('tolerance is respected — a near-miss confirms within a declared looser bar', async () => {
    const research_ref = await freshBook();
    const exp = await bindSpringExperiment(research_ref);
    await bindResearchItemHandler({
      research_ref, kind: 'prediction',
      metadata: { experiment_item_id: exp.item_id, expected: { flightTime: SPRING_T * 1.04 }, tolerance: 0.05 },
    });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 't', review: true });
    expect(out.review.predictions).toMatchObject({ confirmed: 1, falsified: 0 });
  });
});

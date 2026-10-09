/**
 * THE TUNNEL — a thing is not templated, it is tunnelled through: an INTENT ("a modular sci-fi habitat") is read into
 * TRAITS, each a measure on the result; each trait PULLS what can show it from what the civilization (or the land)
 * already has; the candidate is COMBINED and built; it is ASSESSED (every trait's measure and the domain's laws);
 * what fails is TWEAKED inside its rails and the candidate is built and assessed again, a bounded number of passes,
 * every pass logged; then it goes on the PLAN with its log. A trait nothing can show is a GAP: named, with why and
 * what would close it, never filled silently. The eyes gate is the creator's: nothing here claims it.
 *
 * One loop, any scale: a DOMAIN brings its traits and how to start, pull, build, measure, tweak and plan.
 *
 *   domain = {
 *     id, TRAITS: { <trait>: { words: [..], read, ... } },      words may be phrases ("small windows")
 *     start(seed, base) → candidate
 *     pull(candidate, trait, id) → { candidate, changed: [..] } | { gap: { why, proposal } }
 *     build(candidate, seed) → built
 *     measure(trait, id, built, candidate) → { ok, value }
 *     laws(built, candidate) → [{ law, ok, value }]
 *     tweak(candidate, { traits, laws }, pass, seed) → { candidate, changed: [..] }
 *     plan(candidate, built) → what goes in the recipe
 *   }
 *   readIntent(domain, intent) → { words, traits: [{ id, word }], unread }
 *   tunnel(domain, { intent, seed, base, passes }) → { intent, read, gaps, passes, held, complete, candidate, built, plan }
 *
 * Pure: the same intent, seed and base tunnel the same way.
 */

/** An intent's words read against a domain's traits: phrases first, each trait once, the first word to name it. */
export function readIntent(domain, intent) {
  if (typeof intent !== 'string' || !intent.trim()) throw new Error(`tunnel: ${domain.id}: an intent is a few words about the thing`);
  const words = intent.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean), byWord = new Map();
  for (const [id, T] of Object.entries(domain.TRAITS)) for (const w of T.words) { const k = w.toLowerCase(); if (!byWord.has(k)) byWord.set(k, []); byWord.get(k).push(id); }
  const traits = [], seen = new Set(), used = new Set();
  const take = (key, at) => { for (const id of byWord.get(key) ?? []) if (!seen.has(id)) { seen.add(id); traits.push({ id, word: key }); } for (const i of at) used.add(i); };
  for (let i = 0; i < words.length; i++) {
    const two = words[i + 1] ? `${words[i]} ${words[i + 1]}` : null;
    // a phrase names its own trait, and each of its words still says what it says alone ("basalt cliffs": a colour on
    // the cliffs, and basalt's geology)
    if (two && byWord.has(two)) { take(two, [i, i + 1]); for (const w of [words[i], words[i + 1]]) if (byWord.has(w)) take(w, []); i++; continue; }
    const one = byWord.has(words[i]) ? words[i] : byWord.has(words[i].replace(/s$/, '')) ? words[i].replace(/s$/, '') : null;
    if (one) take(one, [i]);
  }
  const unread = [...new Set(words.filter((w, i) => !used.has(i) && w.length > 3))];
  return { words, traits, unread };
}

/** Tunnel an intent through a domain: read, pull, combine, assess, tweak, reassess, plan. */
export function tunnel(domain, { intent, seed = 1, base, passes = 6 } = {}) {
  const read = readIntent(domain, intent), gaps = [], log = [];
  let cand = domain.start(seed, base);
  const pulled = [];
  for (const t of read.traits) {
    const r = domain.pull(cand, domain.TRAITS[t.id], t.id);
    if (r.gap) { gaps.push({ trait: t.id, word: t.word, read: domain.TRAITS[t.id].read, ...r.gap }); continue; }
    cand = r.candidate;
    pulled.push({ trait: t.id, changed: r.changed });
  }
  const live = read.traits.filter((t) => !gaps.some((g) => g.trait === t.id));
  let built, held = false, s = seed;
  for (let p = 0; p < passes; p++) {
    built = domain.build(cand, s);
    const traits = live.map((t) => ({ id: t.id, ...domain.measure(domain.TRAITS[t.id], t.id, built, cand) }));
    const laws = domain.laws(built, cand);
    const failed = { traits: traits.filter((t) => !t.ok), laws: laws.filter((l) => !l.ok) };
    const entry = { pass: p + 1, seed: s, traits: { held: traits.filter((t) => t.ok).map((t) => t.id), failed: failed.traits.map((t) => ({ id: t.id, value: t.value })) }, laws: { failed: failed.laws.map((l) => ({ law: l.law, value: l.value })) } };
    log.push(entry);
    if (!failed.traits.length && !failed.laws.length) { held = true; break; }
    if (p === passes - 1) break;
    const tw = domain.tweak(cand, failed, p + 1, s);
    cand = tw.candidate;
    entry.changed = tw.changed;
    if (tw.reseed) s = tw.reseed;
  }
  // held: what was pulled holds; complete: held, and no trait was left a gap
  const complete = held && !gaps.length;
  return { domain: domain.id, intent, seed, read, pulled, gaps, passes: log, held, complete, candidate: cand, built, plan: domain.plan(cand, built, { intent, read, gaps, passes: log, held, complete }) };
}

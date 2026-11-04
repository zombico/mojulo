/**
 * capture_reference target 'character': a read of a picture the person gave the agent, made into a hero and filed.
 *
 * The first pass mints the hero through the hero door (create_character as 'hero') with the lowered words
 * (lib/reference/character-lower.js), so it is the hero those words make, stamped with the read's `reference`; the read
 * is filed in a reference stash with what the pass set (`lowered`) and the hero it left (`minted`). A refining pass
 * (`stash_ref`, a second picture) moves the hero by word through update_character, and never moves a word the person
 * changed since the last pass: the sculpting outranks the picture. `replace` takes the new read whole.
 *
 * Nothing here judges what the picture depicts: the likeness verdict is the model's, recorded on the hero.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { createCharacterHandler, updateCharacterHandler } from '@/lib/mcp/tools/create-character';
import { lowerCharacterRead, refineCharacterWords } from '@/lib/reference/character-lower';

const TARGET = 'character';

/** the last character pass filed in a stash, or null */
function lastPass(stashRef) {
  const full = StashRepository.getFull(stashRef);
  const items = (full?.items || []).filter((it) => it.type === 'sketch' && it.metadata?.reference_target === TARGET);
  return { item: items.at(-1) ?? null, passes: items.length };
}

function caption(L, passes, { kept = [], moved = [] } = {}) {
  return [
    `**Character reference** — look \`${L.look}\`, register \`${L.register}\`, likeness \`${L.likeness.likeness}\`${L.likeness.like ? ` (like ${L.likeness.like})` : ''}, pass ${passes}.`,
    ...(L.thesis ? [`Thesis: ${L.thesis}`] : []),
    ...(L.unseen.length ? [`Unseen (invented): ${L.unseen.join(', ')}`] : []),
    ...(L.gaps.length ? [`Gaps: ${L.gaps.join('; ')}`] : []),
    ...(moved.length ? [`Moved: ${moved.join(', ')}`] : []),
    ...(kept.length ? [`Kept (the person's): ${kept.join(', ')}`] : []),
  ].join('\n\n');
}

function said(L) {
  return {
    look: L.look,
    register: L.register,
    ...(L.chosen ? { chosen: L.chosen } : {}),
    likeness: L.likeness,
    ...(L.view ? { view: L.view } : {}),
    unseen: L.unseen,
    gaps: L.gaps,
    ...(L.overridden.length ? { overridden: L.overridden } : {}),
  };
}

export async function captureCharacter({ insights, fidelity, label, title, stash_ref: stashRef, replace }) {
  const labelText = label || title || 'character reference';
  if (stashRef && !StashRepository.getByRef(stashRef)) throw new Error(`Stash '${stashRef}' not found.`);
  const prior = stashRef ? lastPass(stashRef) : null;
  if (prior && !prior.item) throw new Error(`capture_reference (character): stash '${stashRef}' holds no character pass to refine; omit stash_ref to make a hero`);

  // ── the first pass: the hero those words make ─────────────────────────────
  if (!prior) {
    // the read is lowered (its form checked) before anything is made; a hero the door refuses leaves no live stash
    const L = lowerCharacterRead(insights);
    const stash = StashRepository.mint({ title: title || labelText });
    L.spec.reference = { ...L.spec.reference, stash: stash.stashRef };
    L.likeness = L.spec.reference;
    let out;
    try { out = await createCharacterHandler({ as: 'hero', spec: L.spec, ...(title ? { title } : {}) }); }
    catch (err) { StashRepository.archive(stash.stashRef); throw err; }
    const row = SketchRepository.getByRef(out.ref);
    const item = StashRepository.gather({
      stashRef: stash.stashRef, type: 'sketch', title: labelText, bodyMd: caption(L, 1),
      metadata: { sketch_ref: out.ref, hero_ref: out.ref, label: labelText, reference_target: TARGET, fidelity, passes: 1, insights, lowered: L.spec, minted: row.manifest.hero },
    });
    return {
      ...out,
      stash_ref: stash.stashRef, item_id: item.id, target: TARGET, fidelity, passes: 1, ...said(L),
      next: `Set the hero beside the picture (the views drawn after this answer, or its World page ${out.worldUrl ?? `/api/sketches/${out.ref}/world`}): judge the silhouette and the read at a normal distance, then move ONE word with update_character({ ref: '${out.ref}', spec: { <a word> } }). Tell the person the look, the register and why, the likeness verdict, what is unseen and the gaps. A second picture refines it: capture_reference({ target: 'character', stash_ref: '${stash.stashRef}', insights }) moves only the words they have not changed.`,
    };
  }

  // ── a refining pass: by word, the person's words kept ────────────────────
  const meta = prior.item.metadata, heroRef = meta.hero_ref;
  const row = SketchRepository.getByRef(heroRef);
  if (!row?.manifest?.hero) throw new Error(`capture_reference (character): the hero '${heroRef}' this stash made is gone; omit stash_ref to make a new one`);
  const L = lowerCharacterRead(insights, { stash: stashRef });
  const R = refineCharacterWords({ next: L.spec, prior: meta.lowered ?? {}, current: row.manifest.hero, minted: meta.minted ?? {}, replace: replace === true });
  const out = Object.keys(R.spec).length
    ? await updateCharacterHandler({ ref: heroRef, spec: R.spec, note: `capture_reference pass ${prior.passes + 1}: ${R.moved.join(', ')}` })
    : { ok: true, ref: heroRef, unchanged: true };
  const after = SketchRepository.getByRef(heroRef);
  const passes = prior.passes + 1;
  const item = StashRepository.gather({
    stashRef, type: 'sketch', title: labelText, bodyMd: caption(L, passes, R),
    metadata: { sketch_ref: heroRef, hero_ref: heroRef, label: labelText, reference_target: TARGET, fidelity, passes, insights, lowered: L.spec, minted: after.manifest.hero, moved: R.moved, kept: R.kept },
  });
  return {
    ...out,
    ref: heroRef, stash_ref: stashRef, item_id: item.id, target: TARGET, fidelity, passes, ...said(L),
    moved: R.moved, kept: R.kept,
    next: R.kept.length
      ? `Pass ${passes} moved ${R.moved.length ? R.moved.join(', ') : 'nothing'}; it kept ${R.kept.join(', ')} as the person left them (changed since the last pass). Say so; replace: true takes this read whole.`
      : `Pass ${passes} moved ${R.moved.length ? R.moved.join(', ') : 'nothing'}. Set the hero beside the pictures again and move one word at a time with update_character({ ref: '${heroRef}', spec }).`,
  };
}

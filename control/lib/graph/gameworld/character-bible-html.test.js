import { describe, it, expect } from 'vitest';
import { characterBibleHtml, gameworldBibleHtml, MEADOWMARK, MEADOWMARK_HERO, HALDEN_REACH, approveCharacter } from './index.js';

describe('the character bible', () => {
  const html = characterBibleHtml(MEADOWMARK_HERO);

  it('is the same page for the same world, and names the character book\'s every page', () => {
    expect(characterBibleHtml(MEADOWMARK_HERO)).toBe(html);
    for (const id of ['cover', 'gate', 'characters-direction', 'hero-looks', 'hero-body', 'hero-head', 'hero-hair', 'hero-colour', 'hero-base', 'hero-motion', 'hero-actions', 'open']) expect(html, id).toContain(`id="${id}"`);
    expect(html).toContain('Character bible');
  });

  it('draws the direction: the tradition, the world it comes from, the motif, the elements', () => {
    expect(html).toMatch(/<b>anime<\/b>: the anime tradition/);
    expect(html).toMatch(/isekai-meadow · banded pole/);
    expect(html).toContain('spiral');
    expect(html).toMatch(/leading element<\/dt><dd>wind/);
    expect(html).toMatch(/supporting element<\/dt><dd>brass/);
  });

  it('draws the actions: the system, the power set, the escalation, and nothing numbered open', () => {
    expect(html).toMatch(/<b>unlock<\/b>/);
    for (const p of ['gust-step', 'wind-orb', 'cyclone']) expect(html).toContain(`<b>${p}</b>`);
    expect(html).toMatch(/look spiral/);
    expect(html).toMatch(/attack orb/);
    for (const s of ['early', 'mid', 'late']) expect(html).toContain(`<span class="eyebrow">${s}</span>`);
  });

  it('draws the motion: the vibe and what each word decided, the axes, the gaits\' dials that moved, the stand', () => {
    expect(html).toMatch(/vibe<\/dt><dd>bouncy, bold/);
    expect(html).toContain('bouncy → energy +0.7');
    expect(html).toContain('The axes');
    expect(html).toContain('The gaits it sets');
    expect(html).toMatch(/<b>walk<\/b><\/td><td>[^<]*strideLength/);
    expect(html).toMatch(/stand<\/dt><dd>guard/);
    expect(html).not.toMatch(/Not laid out yet\. Say how it should feel/);
    const bare = characterBibleHtml({ ...MEADOWMARK_HERO, characters: { ...MEADOWMARK_HERO.characters, hero: { ...MEADOWMARK_HERO.characters.hero, motion: undefined } } });
    expect(bare).toMatch(/Not laid out yet\. Say how it should feel/);
  });

  it('draws the adornment: the body\'s powers, the item with the powers it serves, its tiers by stage and its alternate use', () => {
    expect(html).toContain('id="hero-adornment"');
    expect(html).toMatch(/the body carries<\/dt><dd>gust-step, cyclone/);
    expect(html).toContain('<b>wind-staff</b>');
    expect(html).toMatch(/staff · quartz/);
    expect(html).toContain('late · ornament 3, mass 1.25');
    expect(html).toContain('<b>vault-pole</b> a pole to vault gaps with');
    expect(html).not.toMatch(/Nothing is laid out yet\. Proposed from the loop/);
  });

  it('draws the equipment table: the staff seeded from the hero, the other classes the creator\'s to fill, made once the stats exist', () => {
    expect(html).toContain('id="equipment"');
    expect(html).toMatch(/<td><b>staff<\/b><\/td><td class="">from the hero<\/td>/);
    expect(html).toContain('hero:wind-staff');
    expect(html).toMatch(/<td><b>sword<\/b><\/td><td class="muted">to fill<\/td>/);
    expect(html).toMatch(/To fill<\/h4><p class="muted">dagger, sword, greatsword, bow, shield/);
    expect(html).toMatch(/Not made yet: waiting on .*mechanics \(not built\)/);
    expect(html).not.toMatch(/The orders that make them/);
    expect(html).not.toMatch(/variation/i);
  });

  it('a hero with no adornment page shows what the loop proposes, not adopted', () => {
    const bare = characterBibleHtml({ ...MEADOWMARK_HERO, characters: { ...MEADOWMARK_HERO.characters, hero: { ...MEADOWMARK_HERO.characters.hero, adornment: undefined } } });
    expect(bare).toMatch(/Nothing is laid out yet\. Proposed from the loop \(not adopted\)/);
    expect(bare).toMatch(/staff: the leading element wind → a quartz/);
    // nothing adopted: no class is seeded, so every row is the creator's
    expect(bare).toMatch(/<td><b>staff<\/b><\/td><td class="muted">to fill<\/td>/);
  });

  it('is the approval gate: every part waits; the eyes gate is left to the creator; a later step waits on its parts', () => {
    expect((html.match(/class="stamp st-proposed"/g) || []).length).toBeGreaterThanOrEqual(8);
    expect(html).toMatch(/whether each plate reads right is yours to judge/);
    expect(html).toMatch(/Next · waiting/);
    expect(html).not.toMatch(/class="stamp st-approved"/);
  });

  it('shows the orders to run when the hero is not drawn, and the views when they are, fenced as plates', () => {
    expect(html).toMatch(/Not drawn yet/);
    expect(html).toContain('&quot;tool&quot;: &quot;mint_solid&quot;');
    const drawn = characterBibleHtml(MEADOWMARK_HERO, { renders: { front: '<svg id="f"/>', three: '<svg id="t"/>', back: '<svg id="b"/>' } });
    expect(drawn).toContain('<!--plate:hero-front--><svg id="f"/><!--/plate-->');
    expect(drawn).not.toMatch(/Not drawn yet/);
    // the live view rides in an iframe, its page escaped into srcdoc so the bible stays one file
    const live = characterBibleHtml(MEADOWMARK_HERO, { renders: { world: '<html a="b">&</html>' } });
    expect(live).toContain('<iframe sandbox="allow-scripts"');
    expect(live).toContain('srcdoc="&lt;html a=&quot;b&quot;&gt;&amp;&lt;/html&gt;"');
    expect(html).not.toContain('<iframe');
  });

  it('an approval shows as approved, and readiness follows the creator\'s verdicts', () => {
    const w = { ...MEADOWMARK_HERO, review: approveCharacter(MEADOWMARK_HERO, 'hero:actions') };
    const page = characterBibleHtml(w);
    expect(page).toMatch(/class="stamp st-approved"/);
    expect(page).toMatch(/hero-actions[^>]*>[^<]*<\/a><span class="stamp st-approved"/);
  });

  it('says what is wrong with a world that has no character book, and the world bible still names it open', () => {
    expect(() => characterBibleHtml(MEADOWMARK)).toThrow(/no character book/);
    expect(gameworldBibleHtml(MEADOWMARK)).toMatch(/<h3>Characters<\/h3>/);
  });

  it('the same hero stands in a world whose kit is a tunnelled look, with no outdoor card to hand down', () => {
    const page = characterBibleHtml({ ...HALDEN_REACH, characters: MEADOWMARK_HERO.characters });
    expect(page).toContain('Character bible');
  });
});

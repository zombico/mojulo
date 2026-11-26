import { describe, it, expect } from 'vitest';
import { manaUi } from '../../../mana-ui/kernel.js';
import { treesSpec, treesScript } from './trees-channel.js';

// THE TREES channel (trees-channel.js): the hero's skills and techs as one mana-ui screen on T, emitted only for a page
// whose world has trees.
describe('the trees channel', () => {
  it('draws mana\'s skill tree, a tab a tree, learning the node in focus on accept', () => {
    const spec = treesSpec();
    expect(() => manaUi.readSpec(spec)).not.toThrow();
    const tabs = spec.screens.trees.children.find((c) => c.use === 'window').children[0];
    const tree = tabs.props.page.children[0];
    expect(tree.use).toBe('tree');
    expect(tree.on.accept).toEqual({ emit: 'learn', skill: { item: 'id' } });
  });

  it('is in a page only when its world has trees', () => {
    expect(treesScript(null)).toBe('');
    expect(treesScript({ nodes: [] }, null, { shared: 'window.__mojMana' })).toContain('window.__mojTrees');
  });
});

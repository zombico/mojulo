import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';
import { PLAY_GRADE, POSE_GRADE, gradeBudget, gradeAdvice, figureTris, crossGradeErrors, poseCast } from './figure-grades.js';

// FIGURE GRADES: one character baked twice from one recipe. The play grade carries far fewer triangles; the two are one
// character (the same bones in order, the same clips, the same height).

// (one anime hero, the head whose sampling the grade lowers, in a shaped hairstyle: its locks, cap and lenses all lowered)
const hero = heroRecord({ cast: 'female', head: 'anime', hair: 'spiky', detail: 'clothed' });
const bake = async (grade) => {
  const m = expandLayeredManifest({ kind: 'layered', title: 't', hero: grade === PLAY_GRADE ? { ...hero, grade } : hero });
  return (await WORLD_KINDS.layered.resolve(m, { title: 't' })).figures.body;
};

describe('a character at two grades', () => {
  it('the play grade is a fraction of the pose grade, the same skeleton, clips and height', async () => {
    const [pose, play] = [await bake(POSE_GRADE), await bake(PLAY_GRADE)];
    const a = figureTris(pose), b = figureTris(play);
    expect(b).toBeLessThan(a * 0.6);
    expect(crossGradeErrors(pose, play)).toEqual([]);
    // (and the play bake is within the play camera's budget for a hero)
    expect(gradeAdvice(b, PLAY_GRADE, 'hero')).toBe(null);
  }, 120000);

  it('the laws see a skeleton, a clip or a height apart, and a figure over its budget', () => {
    const f = { bones: [{ id: 'pelvis' }, { id: 'spine' }], clips: { idle: {}, walk: {} }, figH: 1.7 };
    expect(crossGradeErrors(f, { ...f, bones: [{ id: 'pelvis' }] })[0]).toMatch(/bones differ/);
    expect(crossGradeErrors(f, { ...f, clips: { idle: {} } })[0]).toMatch(/clips differ/);
    expect(crossGradeErrors(f, { ...f, figH: 1.5 })[0]).toMatch(/heights differ/);
    expect(gradeAdvice(gradeBudget(PLAY_GRADE, 'folk') + 1, PLAY_GRADE, 'folk')).toMatch(/over its 30k budget/);
    expect(gradeAdvice(1, PLAY_GRADE, 'folk')).toBe(null);
  });

  it('the pose grade is baked for the figures a close shot reaches: the party, the battles\' foes, a scene\'s close shots', () => {
    const e = (id, figure) => ({ id, body: { type: 'figure-rig', figure } });
    const m = {
      figures: { hero: {}, 'party-1': {}, goblin: {}, keeper: {}, townie: {}, farmer: {} },
      entities: [e('hero', 'hero'), e('party-1', 'party-1'), e('foe-1', 'goblin'), e('foe-2', 'goblin'), e('keeper', 'keeper'), e('townie', 'townie'), e('farmer', 'farmer')],
      play: {
        rpg: { party: [{ id: 'hero' }, { id: 'party-1' }, { id: 'party-2' }], encounters: [{ who: ['foe-1', 'foe-2'] }] },
        scenes: [{ beats: [{ shot: { frame: 'close', on: ['keeper'] } }, { shot: { frame: 'wide', on: ['townie'] } }, { banter: { with: ['hero', 'farmer'] } }] }],
      },
    };
    // (a member not on this stage, party-2, has no figure; a wide shot's townie is played at the play grade)
    expect([...poseCast(m)].sort()).toEqual(['farmer', 'goblin', 'hero', 'keeper', 'party-1']);
    expect(poseCast({}).size).toBe(0);
    // a script's speakers: its coverage frames each close or over the shoulder (playscape/ui/scene-script.js)
    expect([...poseCast({ ...m, play: { scenes: [{ beats: [{ script: 'TOWNIE: Morning.\nKEEPER (tired): Is it?\nTownie crosses to exit.' }] }] } })].sort()).toEqual(['keeper', 'townie']);
  });
});

// The exhibit's intake: what the person brought, recorded as placed or set aside, and which of the producer's questions
// their own material already answered, so none is asked twice. It records and never authors.
import { describe, it, expect } from 'vitest';
import { QUESTION_IDS, EXHIBIT_PLACES, EXHIBIT_INTAKE, EXHIBIT_INTAKE_IDS, readExhibitIntake, exhibitIntakeReport } from './intake.js';
import { EXHIBIT_QUESTIONS, exhibitStart, needsProducer } from './producer.js';
import { readBrief } from './brief.js';

// one kind that answers questions and one that answers none, picked from the table
const answering = EXHIBIT_INTAKE_IDS.find((k) => EXHIBIT_INTAKE[k].answers.length > 1);
const silent = EXHIBIT_INTAKE_IDS.find((k) => !EXHIBIT_INTAKE[k].answers.length);
const item = (id, kind, more = {}) => ({ id, kind, says: `what ${id} says`, placed: EXHIBIT_INTAKE[kind].place, ...more });

describe('the exhibit\'s intake', () => {
  it('its kinds name places and questions that exist', () => {
    expect(QUESTION_IDS).toEqual(EXHIBIT_QUESTIONS.map((q) => q.id));
    for (const k of EXHIBIT_INTAKE_IDS) {
      const K = EXHIBIT_INTAKE[k];
      expect(EXHIBIT_PLACES[K.place], `${k}: place`).toBeTruthy(); expect(K.name).toMatch(/\S/); expect(K.goes).toMatch(/\S/);
      for (const q of K.answers) { expect(QUESTION_IDS, `${k}: ${q}`).toContain(q); expect(q).not.toBe('brought'); }
    }
  });

  it('reads nothing brought, or each thing as placed or set aside, never dropped', () => {
    expect(readExhibitIntake('none')).toEqual({ none: true });
    const R = readExhibitIntake([item('plan', answering), { id: 'photo', kind: silent, says: ' a photo ', aside: 'no part of the exhibit shows it yet' }]);
    expect(R.items[0]).toEqual({ id: 'plan', kind: answering, says: 'what plan says', placed: EXHIBIT_INTAKE[answering].place, answers: [...EXHIBIT_INTAKE[answering].answers], basis: 'stated' });
    expect(R.items[1]).toMatchObject({ says: 'a photo', aside: 'no part of the exhibit shows it yet', answers: [] });
    expect(() => readExhibitIntake([])).toThrow(/'none'/);
    expect(() => readExhibitIntake([{ id: 'a', kind: answering, says: 'x' }])).toThrow(/nothing brought is dropped/);
    expect(() => readExhibitIntake([{ ...item('a', answering), aside: 'also' }])).toThrow(/one of the two/);
    expect(() => readExhibitIntake([{ ...item('a', answering), kind: 'a-film' }])).toThrow(/kind is what was brought/);
    expect(() => readExhibitIntake([item('a', answering, { placed: 'somewhere' })])).toThrow(/placed is where it went/);
    expect(() => readExhibitIntake([item('a', answering, { answers: ['brought'] })])).toThrow(/answers are the questions/);
    expect(() => readExhibitIntake([item('a', answering), item('a', silent)])).toThrow(/said twice/);
    expect(() => readExhibitIntake([item('a', answering, { basis: 'guessed' })])).toThrow(/basis is/);
    expect(() => readExhibitIntake([item('A b', answering)])).toThrow(/short lowercase id/);
  });

  it('reports what was placed where and the questions it answered; a thing set aside answers nothing', () => {
    const R = exhibitIntakeReport([item('plan', answering, { basis: 'inferred' }), item('refs', silent), { id: 'old', kind: answering, says: 'last year\'s plan', aside: 'superseded' }]);
    const A = EXHIBIT_INTAKE[answering].answers;
    expect(R.items).toBe(3);
    expect(R.answered).toEqual(Object.fromEntries(A.map((q) => [q, ['plan']])));
    expect(R.open).toEqual(QUESTION_IDS.filter((q) => q !== 'brought' && !A.includes(q)));
    expect(R.placed[EXHIBIT_INTAKE[answering].place]).toContain('plan');
    expect(R.aside).toEqual([{ id: 'old', says: 'last year\'s plan', aside: 'superseded' }]); expect(R.inferred).toEqual(['plan']);
    expect(exhibitIntakeReport('none')).toEqual({ none: true }); expect(exhibitIntakeReport(undefined)).toBeNull();
    // an item may say its own answers
    expect(exhibitIntakeReport([item('x', silent, { answers: ['concept'] })]).answered).toEqual({ concept: ['x'] });
  });

  it('a question their own material answered is read, never asked: the producer skips to the next', () => {
    const A = EXHIBIT_INTAKE[answering].answers, brought = [item('plan', answering)];
    const out = exhibitStart({ brought });
    for (const q of A) { const s = out.next.find((x) => x.step === q); expect(s.read, q).toEqual(['plan']); expect(s.ask).toBeUndefined(); expect(s.says).toMatch(/do not ask them again/); }
    const asked = out.next.filter((x) => typeof x.ask === 'string').map((x) => x.step);
    expect(asked).toEqual(QUESTION_IDS.filter((q) => q !== 'brought' && !A.includes(q)));
    expect(out.producer?.step ?? null).toBe(asked[0] ?? null);
    expect(out.intake).toEqual(exhibitIntakeReport(brought)); expect(needsProducer({ brought })).toBe(true);
    // once the agent has written the answer from the item, the step is gone
    expect(exhibitStart({ brought, [A[0]]: A[0] === 'concept' ? 'what the plan says' : A[0] === 'people' ? ['general'] : 'visit' }).next.find((x) => x.step === A[0])).toBeUndefined();
    // nothing brought, and not asked yet
    expect(exhibitStart({ brought: 'none' }).intake).toEqual({ none: true }); expect(exhibitStart({}).intake).toBeUndefined();
    expect(() => exhibitStart({ brought: [{ id: 'a', kind: answering, says: 'x' }] })).toThrow(/create_exhibit: start\.brought/);
  });

  it('is kept with the exhibit on its curation; a brief without one is as it was', () => {
    const base = { aims: ['what a dam does'] };
    expect(readBrief(base)).toEqual({ aims: ['what a dam does'] });
    expect(readBrief({ ...base, brought: 'none' }).brought).toBe('none');
    expect(readBrief({ ...base, brought: [item('plan', answering)] }).brought).toEqual(readExhibitIntake([item('plan', answering)]).items);
    expect(() => readBrief({ ...base, brought: [{ id: 'a', kind: answering, says: 'x' }] })).toThrow(/^curation: brought/);
  });
});

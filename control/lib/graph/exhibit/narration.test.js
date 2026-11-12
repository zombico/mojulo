// Narration: the caption spoken, a layer over the truth. A WAV's path is kept as a recording at write; the page gets each
// held recording inline; a recording this machine lacks leaves the page quiet, never broken.
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stampNarration, readNarration, voiceOf, attachVoices, VOICE_RATE } from './narration.js';
import { readTour } from './tour.js';
import { auditTour } from './audit.js';
import { catalogueHtml } from './catalogue.js';
import { tourScript } from '../scene/channels/tour.js';

// a stand-in voice: a WAV of `seconds` at 24 kHz, as Kokoro writes them
function wav(file, seconds, hz = 220, rate = 24000) {
  const n = Math.round(seconds * rate), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8, 'ascii'); b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36, 'ascii'); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 8000), 44 + i * 2);
  writeFileSync(file, b);
  return file;
}

let dir;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'narration-'));
  process.env.MOJULO_OUTCOMES_DIR = join(dir, 'outcomes');
});

const fail = (at, says) => { throw new Error(`tour: ${at} ${says}`); };
const world = { cameras: [{ name: 'wide', pos: [0, -5, 2], target: [0, 0, 0], vfov: 45 }], groups: ['dam'] };

describe('stamping at write', () => {
  it('keeps a recording for each WAV path (a path alone is everyone\'s), the same bytes the same recording', () => {
    const a = wav(join(dir, 'a.wav'), 2), b = wav(join(dir, 'b.wav'), 1.5, 330), again = wav(join(dir, 'a-again.wav'), 2);
    const m = stampNarration({ kind: 'x', tour: { stops: [{ caption: 'One two.', camera: 'wide', narration: a }, { caption: 'Three.', camera: 'wide', narration: { general: { audio: b }, child: again } }, { caption: 'Four.', camera: 'wide' }] } });
    const [s1, s2, s3] = m.tour.stops;
    expect(s1.narration).toEqual({ general: { recording: expect.stringMatching(/^[0-9a-f]{16}$/), seconds: 2 } });
    expect(s2.narration.child.recording).toBe(s1.narration.general.recording);
    expect(s3.narration).toBeUndefined();
    // stamping a stamped recipe changes nothing
    expect(stampNarration(m)).toEqual(m);
    expect(() => stampNarration({ tour: { stops: [{ narration: join(dir, 'nope.wav') }] } })).toThrow(/tour: stops\[0\]\.narration\.general no audio at/);
  });

  it('reads only what is kept, and says how a path becomes a recording', () => {
    expect(readNarration({ general: { recording: '0123456789abcdef', seconds: 2 } }, 'n', fail)).toEqual({ general: { recording: '0123456789abcdef', seconds: 2 } });
    expect(() => readNarration({ general: 'a.wav' }, 'n', fail)).toThrow(/a WAV's path is kept when the recipe is written/);
    expect(() => readNarration({ adults: { recording: '0123456789abcdef', seconds: 1 } }, 'n', fail)).toThrow(/has 'adults'/);
    const t = readTour({ stops: [{ caption: 'x', camera: 'wide', narration: { general: { recording: '0123456789abcdef', seconds: 2 } } }] }, world);
    expect(t.stops[0].narration.general.seconds).toBe(2);
  });
});

describe('the page\'s voice', () => {
  it('is a held recording at 16 kHz inline, deterministic; a recording not held is quiet', () => {
    const m = stampNarration({ tour: { stops: [{ caption: 'x', camera: 'wide', narration: wav(join(dir, 'c.wav'), 1.25) }] } });
    const id = m.tour.stops[0].narration.general.recording;
    const src = voiceOf(id);
    expect(src).toMatch(/^data:audio\/wav;base64,/);
    const bytes = Buffer.from(src.split(',')[1], 'base64');
    expect(bytes.readUInt32LE(24)).toBe(VOICE_RATE);
    expect((bytes.length - 44) / 2).toBe(1.25 * VOICE_RATE);
    expect(voiceOf(id)).toBe(src);
    expect(voiceOf('ffffffffffffffff')).toBe(null);
    const tour = readTour({ stops: [m.tour.stops[0], { caption: 'y', camera: 'wide', narration: { general: { recording: 'ffffffffffffffff', seconds: 1 } } }] }, world);
    const { tour: paged, missing } = attachVoices(tour);
    expect(paged.narrated).toBe(true);
    expect(paged.stops[0].voice.general.src).toBe(src);
    expect(paged.stops[1].voice).toBeUndefined();
    expect(paged.stops[0].narration).toBeUndefined();
    expect(missing).toEqual(['ffffffffffffffff']);
  });

  it('is a toggle the visitor turns on, never in a capture', () => {
    const t = { narrated: true, stops: [{ id: 's1', caption: 'x', camera: { cam: 0 }, voice: { general: { src: 'data:audio/wav;base64,', seconds: 1 } } }] };
    expect(tourScript(t)).toContain('const NARR = !!TR.narrated && !false;');
    expect(tourScript(t, { capture: true })).toContain('const NARR = !!TR.narrated && !true;');
    expect(tourScript(t)).toContain("'tour-sound'");
  });
});

describe('the audit and the catalogue', () => {
  it('notices a quiet stop among voiced ones, a recording not held, and a voice that is likely another caption\'s', () => {
    const tour = { stops: [
      { id: 'a', caption: 'One two three four five six.', camera: 'x', grade: 'depicted', narration: { general: { recording: '0000000000000001', seconds: 2 } } },
      { id: 'b', caption: 'Seven.', camera: 'y', grade: 'depicted', narration: { general: { recording: '0000000000000002', seconds: 30 } } },
      { id: 'c', caption: 'Eight.', camera: 'z', grade: 'depicted' },
    ] };
    const held = (id) => id !== '0000000000000002';
    const codes = auditTour(tour, null, { held }).findings.map((f) => `${f.level}:${f.code}:${f.at}`);
    expect(codes).toEqual(expect.arrayContaining(['advice:unnarrated-stop:c', 'warn:missing-recording:b']));
    // a: six words in two seconds is speech; b is not held, so its pace is not read
    expect(codes.filter((c) => c.includes('narration-pace'))).toEqual([]);
    const slow = auditTour({ stops: [{ id: 'a', caption: 'One two.', camera: 'x', grade: 'depicted', narration: { general: { recording: '0000000000000001', seconds: 9 } } }] }).findings.map((f) => f.code);
    expect(slow).toContain('narration-pace');
  });

  it('the catalogue marks a narrated stop', () => {
    const html = catalogueHtml({ title: 'T', rooms: [{ title: 'R', tour: { stops: [{ caption: 'x', narration: { general: { recording: '0000000000000001', seconds: 1 } } }] } }] });
    expect(html).toContain('class="vo" title="narrated: Everyone">narrated');
  });
});

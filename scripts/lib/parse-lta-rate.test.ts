import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyBody,
  estimateCostCents,
  parseClockToHHMM,
  parseDayRate,
  parseTimeWindow,
  splitSegments,
} from './parse-lta-rate';

describe('parseClockToHHMM', () => {
  it('parses am/pm with hours only', () => {
    assert.equal(parseClockToHHMM('7am'), '07:00');
    assert.equal(parseClockToHHMM('6pm'), '18:00');
    assert.equal(parseClockToHHMM('12am'), '00:00');
    assert.equal(parseClockToHHMM('12pm'), '12:00');
  });
  it('parses am/pm with minutes (dot or colon)', () => {
    assert.equal(parseClockToHHMM('7.30am'), '07:30');
    assert.equal(parseClockToHHMM('3:30 pm'), '15:30');
    assert.equal(parseClockToHHMM('11:45pm'), '23:45');
  });
  it('parses noon/midnight tokens', () => {
    assert.equal(parseClockToHHMM('12noon'), '12:00');
    assert.equal(parseClockToHHMM('12 midnight'), '00:00');
    assert.equal(parseClockToHHMM('12mn'), '00:00');
  });
  it('returns null for garbage', () => {
    assert.equal(parseClockToHHMM('soon'), null);
    assert.equal(parseClockToHHMM('25pm'), null);
  });
});

describe('parseTimeWindow', () => {
  it('finds a hyphen-separated band', () => {
    assert.deepEqual(parseTimeWindow('7am-6pm'), {
      startTime: '07:00',
      endTime: '18:00',
    });
  });
  it('handles "to" connector and dot-separated minutes', () => {
    assert.deepEqual(parseTimeWindow('7.30am to 6.45pm'), {
      startTime: '07:30',
      endTime: '18:45',
    });
  });
  it('preserves crosses-midnight (endTime < startTime)', () => {
    assert.deepEqual(parseTimeWindow('6pm-3.30am'), {
      startTime: '18:00',
      endTime: '03:30',
    });
  });
  it('returns null with no clock tokens', () => {
    assert.equal(parseTimeWindow('Mon - Fri'), null);
  });
});

describe('splitSegments', () => {
  it('splits on ";" and extracts per-segment windows', () => {
    const out = splitSegments(
      '7am-6pm: $1.20 for 1st hr; 6pm-3.30am: $3 per entry',
    );
    assert.equal(out.length, 2);
    assert.equal(out[0].rawWindow, '7am-6pm');
    assert.equal(out[0].rawBody, '$1.20 for 1st hr');
    assert.equal(out[1].rawWindow, '6pm-3.30am');
    assert.equal(out[1].rawBody, '$3 per entry');
  });
  it('does not split inside decimal prices like "$1.20"', () => {
    const out = splitSegments('$1.20 / 30 min');
    assert.equal(out.length, 1);
    assert.equal(out[0].rawBody, '$1.20 / 30 min');
  });
});

describe('classifyBody', () => {
  it('detects "Free"', () => {
    assert.deepEqual(classifyBody('Free'), { isFree: true });
  });
  it('detects tiered first-hour + subsequent block', () => {
    const c = classifyBody('$1.20 for 1st hr, $0.60 for sub. 30 mins');
    assert.deepEqual(c, {
      firstHourCents: 120,
      firstBlockMinutes: 60,
      perBlockCents: 60,
      blockMinutes: 30,
    });
  });

  it('detects "1st 2 hrs" extended first-tier (firstBlockMinutes = 120)', () => {
    const c = classifyBody('$2.14 for 1st 2 hrs, $0.32 for sub. 15 mins');
    assert.deepEqual(c, {
      firstHourCents: 214,
      firstBlockMinutes: 120,
      perBlockCents: 32,
      blockMinutes: 15,
    });
  });

  it('normalises ½ to 30 mins so the per-block regex matches', () => {
    const c = classifyBody('$1.50 per ½ hr');
    assert.deepEqual(c, { perBlockCents: 150, blockMinutes: 30 });
  });

  it('detects "$X per hr" form', () => {
    const c = classifyBody('$1.07 per hr');
    assert.deepEqual(c, { perBlockCents: 107, blockMinutes: 60 });
  });
  it('detects flat per-entry', () => {
    assert.deepEqual(classifyBody('$3 per entry'), { perEntryCents: 300 });
  });
  it('detects flat "$X / 30 min" form', () => {
    assert.deepEqual(classifyBody('$1.50 per 30 min'), {
      perBlockCents: 150,
      blockMinutes: 30,
    });
  });
  it('detects daily cap', () => {
    const c = classifyBody('$10 max per day');
    assert.equal(c?.capCents, 1000);
  });
  it('returns null for purely descriptive text', () => {
    assert.equal(classifyBody('See operator'), null);
    assert.equal(classifyBody('TBA'), null);
  });
});

describe('parseDayRate', () => {
  it('returns no rows for empty / NA inputs', () => {
    assert.deepEqual(parseDayRate(''), { ok: true, rows: [] });
    assert.deepEqual(parseDayRate('NA'), { ok: true, rows: [] });
    assert.deepEqual(parseDayRate(null), { ok: true, rows: [] });
  });

  it('parses a tiered first-hour + subsequent string', () => {
    const r = parseDayRate('$1.20 for 1st hr, $0.60 for sub. 30 mins');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.rows.length, 1);
    const row = r.rows[0];
    assert.equal(row.source, 'LTA_DATAGOV');
    assert.equal(row.firstHourCents, 120);
    assert.equal(row.perBlockCents, 60);
    assert.equal(row.blockMinutes, 30);
    assert.equal(row.rate, '$1.20 / 1st hr · $0.60 / 30 min');
  });

  it('parses a flat per-entry string', () => {
    const r = parseDayRate('$3 per entry');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].perEntryCents, 300);
    assert.equal(r.rows[0].rate, '$3.00 / entry');
  });

  it('parses two bands separated by ";" and preserves crosses-midnight end', () => {
    const r = parseDayRate(
      '7am-6pm: $1.20 for 1st hr; 6pm-3.30am: $3 per entry',
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.rows.length, 2);
    assert.equal(r.rows[0].startTime, '07:00');
    assert.equal(r.rows[0].endTime, '18:00');
    assert.equal(r.rows[0].firstHourCents, 120);
    assert.equal(r.rows[1].startTime, '18:00');
    assert.equal(r.rows[1].endTime, '03:30'); // crosses midnight
    assert.equal(r.rows[1].perEntryCents, 300);
  });

  it('parses standalone "Free"', () => {
    const r = parseDayRate('Free');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].rate, 'Free');
  });

  it('returns ok:false for a deliberately malformed segment without crashing', () => {
    const r = parseDayRate('Something completely garbled with no numbers');
    assert.equal(r.ok, false);
  });

  it('stamps every row with effectiveFrom 2018-11-01', () => {
    const r = parseDayRate('$1.50 / 30 min');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.rows[0].effectiveFrom, '2018-11-01');
  });
});

describe('estimateCostCents', () => {
  it('returns the per-entry charge for a flat per-entry row', () => {
    const r = parseDayRate('$3 per entry');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(estimateCostCents(r.rows, 1), 300);
    assert.equal(estimateCostCents(r.rows, 2), 300);
  });

  it('computes tiered first-hour + subsequent blocks', () => {
    const r = parseDayRate('$1.20 for 1st hr, $0.60 for sub. 30 mins');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    // 1h = 120
    assert.equal(estimateCostCents(r.rows, 1), 120);
    // 2h = 120 + 2 × 60 = 240
    assert.equal(estimateCostCents(r.rows, 2), 240);
    // 30 min = 120 (rounds up to first-hour minimum)
    assert.equal(estimateCostCents(r.rows, 0.5), 120);
  });

  it('honors a cap on per-block rows', () => {
    // Synthesize a row with a low cap
    const rows = [
      {
        window: '7am – 11pm',
        rate: '$1.50 / 30 min',
        source: 'LTA_DATAGOV' as const,
        perBlockCents: 150,
        blockMinutes: 30,
        capCents: 500,
      },
    ];
    assert.equal(estimateCostCents(rows, 8), 500);
  });

  it('returns null when no row has structured info', () => {
    const rows = [
      { window: 'See operator', rate: 'See operator', source: 'MANUAL' as const },
    ];
    assert.equal(estimateCostCents(rows, 1), null);
  });
});

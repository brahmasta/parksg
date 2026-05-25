import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDollarsToCents,
  parseMinutes,
  parseSystem,
  parseUraRows,
  parseUraTime,
  parseVehCat,
} from '../../src/lib/ura';
import type { UraRawRow } from '../../src/lib/api/uraDetails';

describe('parseDollarsToCents', () => {
  it('parses "$1.20" → 120', () => {
    assert.equal(parseDollarsToCents('$1.20'), 120);
  });
  it('parses bare "1.20" → 120', () => {
    assert.equal(parseDollarsToCents('1.20'), 120);
  });
  it('parses "$0" → 0', () => {
    assert.equal(parseDollarsToCents('$0'), 0);
  });
  it('returns null for blank / garbage', () => {
    assert.equal(parseDollarsToCents(''), null);
    assert.equal(parseDollarsToCents(undefined), null);
    assert.equal(parseDollarsToCents('TBC'), null);
  });
});

describe('parseMinutes', () => {
  it('parses "30mins" / "30 min" / "30"', () => {
    assert.equal(parseMinutes('30mins'), 30);
    assert.equal(parseMinutes('30 min'), 30);
    assert.equal(parseMinutes('30'), 30);
  });
  it('returns null for blank / 0', () => {
    assert.equal(parseMinutes(''), null);
    assert.equal(parseMinutes('0mins'), null);
  });
});

describe('parseUraTime', () => {
  it('parses URA dotted 12h to 24h "HH:mm"', () => {
    assert.equal(parseUraTime('08.30 AM'), '08:30');
    assert.equal(parseUraTime('05.00 PM'), '17:00');
    assert.equal(parseUraTime('12.00 AM'), '00:00');
    assert.equal(parseUraTime('12.30 PM'), '12:30');
  });
  it('also accepts colon separator', () => {
    assert.equal(parseUraTime('08:30 AM'), '08:30');
  });
  it('returns undefined for blank / unparseable', () => {
    assert.equal(parseUraTime(undefined), undefined);
    assert.equal(parseUraTime(''), undefined);
    assert.equal(parseUraTime('NA'), undefined);
  });
});

describe('parseSystem / parseVehCat', () => {
  it('parses C / B → COUPON / EPS', () => {
    assert.equal(parseSystem('C'), 'COUPON');
    assert.equal(parseSystem('B'), 'EPS');
    assert.equal(parseSystem('?'), undefined);
  });
  it('parses vehCat case-insensitively', () => {
    assert.equal(parseVehCat('Car'), 'CAR');
    assert.equal(parseVehCat('Motorcycle'), 'MOTORCYCLE');
    assert.equal(parseVehCat('Heavy Vehicle'), 'HEAVY');
  });
});

describe('parseUraRows', () => {
  it('emits one structured RateRow per non-zero day in a multi-band row', () => {
    // A typical URA Suntec-style row: $1.20/30min weekday, $0.60/30min Sat,
    // free on Sun (so sunPHRate=0). One raw row → two RateRows.
    const raw: UraRawRow[] = [
      {
        ppCode: 'A0004',
        ppName: 'SUNTEC CITY (BASEMENT)',
        vehCat: 'Car',
        parkingSystem: 'B',
        startTime: '07.00 AM',
        endTime: '05.00 PM',
        weekdayRate: '$1.20',
        weekdayMin: '30 mins',
        satdayRate: '$0.60',
        satdayMin: '30 mins',
        sunPHRate: '$0',
        sunPHMin: '0 mins',
        parkCapacity: 1200,
      },
    ];
    const out = parseUraRows(raw);
    assert.equal(out.size, 1);
    const entry = out.get('A0004');
    assert.ok(entry);
    assert.equal(entry.weekday.length, 1);
    assert.equal(entry.saturday.length, 1);
    assert.equal(entry.sundayPH.length, 0);

    const wd = entry.weekday[0];
    assert.equal(wd.source, 'URA');
    assert.equal(wd.dayType, 'WEEKDAY');
    assert.equal(wd.startTime, '07:00');
    assert.equal(wd.endTime, '17:00');
    assert.equal(wd.perBlockCents, 120);
    assert.equal(wd.blockMinutes, 30);
    assert.equal(wd.system, 'EPS');
    assert.equal(wd.vehCat, 'CAR');

    const sat = entry.saturday[0];
    assert.equal(sat.perBlockCents, 60);
    assert.equal(sat.dayType, 'SAT');
  });

  it('collects multiple raw rows into the same ppCode (different time bands)', () => {
    // Same carpark, peak + off-peak. Two raw rows, three RateRows total
    // (weekday peak, weekday off-peak, Sat off-peak).
    const raw: UraRawRow[] = [
      {
        ppCode: 'A0004',
        ppName: 'SUNTEC CITY',
        vehCat: 'Car',
        parkingSystem: 'B',
        startTime: '07.00 AM',
        endTime: '05.00 PM',
        weekdayRate: '$1.20',
        weekdayMin: '30',
        satdayRate: '$0',
        satdayMin: '0',
        sunPHRate: '$0',
        sunPHMin: '0',
      },
      {
        ppCode: 'A0004',
        ppName: 'SUNTEC CITY',
        vehCat: 'Car',
        parkingSystem: 'B',
        startTime: '05.00 PM',
        endTime: '07.00 AM',
        weekdayRate: '$0.60',
        weekdayMin: '30',
        satdayRate: '$0.60',
        satdayMin: '30',
        sunPHRate: '$0',
        sunPHMin: '0',
      },
    ];
    const out = parseUraRows(raw);
    const entry = out.get('A0004');
    assert.ok(entry);
    assert.equal(entry.weekday.length, 2);
    assert.equal(entry.saturday.length, 1);
    assert.equal(entry.sundayPH.length, 0);
    // The first weekday row is the peak 07-17.
    assert.equal(entry.weekday[0].perBlockCents, 120);
    // The second is the off-peak 17-07.
    assert.equal(entry.weekday[1].perBlockCents, 60);
    assert.equal(entry.weekday[1].startTime, '17:00');
    assert.equal(entry.weekday[1].endTime, '07:00'); // crosses midnight
  });

  it('emits "COUPON" for parkingSystem "C"', () => {
    const raw: UraRawRow[] = [
      {
        ppCode: 'M0078',
        ppName: 'Maritime Square D Off Street',
        vehCat: 'Car',
        parkingSystem: 'C',
        startTime: '07.00 AM',
        endTime: '07.00 PM',
        weekdayRate: '$0.60',
        weekdayMin: '30 mins',
        satdayRate: '$0.60',
        satdayMin: '30 mins',
        sunPHRate: '$0.60',
        sunPHMin: '30 mins',
      },
    ];
    const out = parseUraRows(raw);
    const entry = out.get('M0078');
    assert.ok(entry);
    assert.equal(entry.weekday[0].system, 'COUPON');
  });

  it('filters out non-CAR vehCats in v1', () => {
    const raw: UraRawRow[] = [
      {
        ppCode: 'X0001',
        ppName: 'Test',
        vehCat: 'Motorcycle',
        parkingSystem: 'B',
        weekdayRate: '$0.50',
        weekdayMin: '30',
      },
    ];
    const out = parseUraRows(raw);
    assert.equal(out.size, 0);
  });

  it('routes a malformed row to skipped without crashing', () => {
    const raw: UraRawRow[] = [
      // Missing ppCode — skipped silently.
      {
        ppName: 'Phantom carpark',
        vehCat: 'Car',
        weekdayRate: '$1.20',
        weekdayMin: '30',
      },
      // ppCode present but ALL rate strings are blank / garbage — yields 0
      // rows, but the carpark is still created with empty buckets so the
      // joiner can decide what to do.
      {
        ppCode: 'GARBLED',
        ppName: 'Garbled',
        vehCat: 'Car',
        weekdayRate: 'TBC',
        weekdayMin: 'TBC',
        satdayRate: '',
        satdayMin: '',
        sunPHRate: undefined,
        sunPHMin: undefined,
      },
      // A clean row alongside — proves no cascading damage from the bad ones.
      {
        ppCode: 'OK',
        ppName: 'Healthy carpark',
        vehCat: 'Car',
        parkingSystem: 'B',
        weekdayRate: '$0.80',
        weekdayMin: '30',
      },
    ];
    const out = parseUraRows(raw);
    assert.equal(out.size, 2); // GARBLED entry exists but with 0 rows; OK has rates
    assert.equal(out.get('OK')?.weekday[0].perBlockCents, 80);
    const garbled = out.get('GARBLED');
    assert.ok(garbled);
    assert.equal(garbled.weekday.length, 0);
    assert.equal(garbled.saturday.length, 0);
    assert.equal(garbled.sundayPH.length, 0);
  });
});

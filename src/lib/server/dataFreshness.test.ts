import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateFreshness,
  type FreshnessReport,
  type RunReport,
  type SourceReport,
} from './dataFreshness.ts';

const NOW = new Date('2026-10-10T04:00:00Z');

function src(source: string, ratesWrittenAt: string | null): SourceReport {
  return {
    source,
    carparks: 10,
    carparks_without_rates: 0,
    last_synced: '2026-05-26T00:00:00Z',
    rate_rows: ratesWrittenAt ? 100 : 0,
    rated_carparks: ratesWrittenAt ? 10 : 0,
    rates_written_at: ratesWrittenAt,
    rates_effective_from: null,
  };
}

function run(ok: boolean, error: string | null = null): RunReport {
  return {
    job: 'ura-rates-ingest',
    source: 'URA',
    started_at: '2026-10-09T18:00:00Z',
    finished_at: '2026-10-09T18:02:00Z',
    ok,
    rows: ok ? 5076 : null,
    error,
    last_ok_at: ok ? '2026-10-09T18:02:00Z' : '2026-10-08T18:02:00Z',
  };
}

function report(sources: SourceReport[], runs: RunReport[] = []): FreshnessReport {
  return { generated_at: NOW.toISOString(), sources, runs };
}

const level = (r: FreshnessReport, source: string) =>
  evaluateFreshness(r, NOW).find((v) => v.source === source)!.level;

test('URA written last night is ok', () => {
  assert.equal(level(report([src('URA', '2026-10-09T18:02:00Z')], [run(true)]), 'URA'), 'ok');
});

test('URA older than 2 days is stale even with no run log', () => {
  assert.equal(level(report([src('URA', '2026-10-06T18:02:00Z')]), 'URA'), 'stale');
});

test('a failed latest URA run is stale even when rows are fresh', () => {
  const v = evaluateFreshness(
    report([src('URA', '2026-10-09T18:02:00Z')], [run(false, 'URA token: 401')]),
    NOW,
  )[0];
  assert.equal(v.level, 'stale');
  assert.match(v.reason, /URA token: 401/);
});

test('URA with no rate rows at all is stale', () => {
  assert.equal(level(report([src('URA', null)]), 'URA'), 'stale');
});

test('HDB only asks for review after a year, never alerts', () => {
  assert.equal(level(report([src('HDB', '2026-05-31T00:00:00Z')]), 'HDB'), 'ok');
  assert.equal(level(report([src('HDB', '2025-05-31T00:00:00Z')]), 'HDB'), 'review');
});

test('the 2018 LTA CSV and manual curation are never flagged', () => {
  const r = report([src('LTA_DATAGOV', '2026-05-26T00:00:00Z'), src('MANUAL', null)]);
  assert.equal(level(r, 'LTA_DATAGOV'), 'ok');
  assert.equal(level(r, 'MANUAL'), 'ok');
});

// ── Upstream: the publisher changed the dataset after our last sync ─────────

function withUpstream(source: string, updatedAt: string, lastSynced = '2026-05-26T00:00:00Z') {
  const r = report([{ ...src(source, '2026-05-31T00:00:00Z'), last_synced: lastSynced }]);
  r.upstream = { [source]: updatedAt };
  return evaluateFreshness(r, NOW)[0];
}

test('a source updated upstream after our sync alerts once the grace period is over', () => {
  const v = withUpstream('HDB', '2026-09-20T03:00:00+08:00');
  assert.equal(v.level, 'stale');
  assert.match(v.reason, /source updated 2026-09-20, last synced 2026-05-26; run the HDB sync/);
});

test('a recent upstream update is a review nudge, not yet an alert', () => {
  assert.equal(withUpstream('HDB', '2026-10-08T11:06:29+08:00').level, 'review');
});

test('an upstream update older than our sync changes nothing', () => {
  const v = withUpstream('JTC', '2025-07-03T16:20:46+08:00');
  assert.equal(v.level, 'ok');
  assert.equal(v.reason, 'no automated feed');
});

test('a source that was never synced is behind any upstream update', () => {
  const r = report([{ ...src('JTC', null), last_synced: null }]);
  r.upstream = { JTC: '2025-07-03T16:20:46+08:00' };
  const v = evaluateFreshness(r, NOW)[0];
  assert.equal(v.level, 'stale');
  assert.match(v.reason, /last synced never/);
});

test('without upstream data the existing rules stand', () => {
  assert.equal(evaluateFreshness(report([src('HDB', '2026-05-31T00:00:00Z')]), NOW)[0].level, 'ok');
});

// Geo helpers for the Singapore use case.
// SVY21 → WGS84 conversion implemented from the public SVY21 spec
// (the same formulas LTA / HDB / URA datasets ship with). Walking time
// is a flat 5 km/h estimate — fine for a first cut; OneMap routing can
// upgrade it later.

const RAD = Math.PI / 180;

// Earth radius in metres — for haversine
const EARTH_R = 6371_000;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}

// Average walking speed ≈ 5 km/h. We round up so 50m doesn't read as "0 min".
export function walkMinutesFromMeters(meters: number): number {
  if (meters <= 0) return 1;
  const minutes = meters / (5000 / 60);
  return Math.max(1, Math.round(minutes));
}

// ── SVY21 → WGS84 ─────────────────────────────────────────────────────────
// Constants per the SVY21 spec (origin: 1°22'02.9N 103°50'00.0E).
// Reference: SLA SVY21 documentation, used widely in SG civic-tech projects.
const SVY21 = {
  a: 6378137.0,
  f: 1 / 298.257223563,
  oLat: 1.366666 * RAD,
  oLng: 103.833333 * RAD,
  oN: 38744.572,
  oE: 28001.642,
  k: 1.0,
};

export function svy21ToWgs84(
  northing: number,
  easting: number,
): { lat: number; lng: number } {
  const { a, f, oLat, oLng, oN, oE, k } = SVY21;
  const b = a * (1 - f);
  const e2 = 2 * f - f * f;
  const n = (a - b) / (a + b);
  const n2 = n * n;
  const n3 = n2 * n;
  const n4 = n3 * n;

  const A0 = 1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256;
  const A2 = (3 / 8) * (e2 + (e2 * e2) / 4 + (15 * e2 * e2 * e2) / 128);
  const A4 = (15 / 256) * (e2 * e2 + (3 * e2 * e2 * e2) / 4);
  const A6 = (35 * e2 * e2 * e2) / 3072;

  const calcM = (lat: number) =>
    a *
    (A0 * lat -
      A2 * Math.sin(2 * lat) +
      A4 * Math.sin(4 * lat) -
      A6 * Math.sin(6 * lat));

  // Foot-point latitude via the mu = N' / (k·a·A0) series — the
  // canonical SLA SVY21 formulation.
  const Nprime = northing - oN + k * calcM(oLat);
  const mu = Nprime / (k * a * A0);
  const latP =
    mu +
    ((3 * n) / 2 - (27 * n3) / 32) * Math.sin(2 * mu) +
    ((21 * n2) / 16 - (55 * n4) / 32) * Math.sin(4 * mu) +
    ((151 * n3) / 96) * Math.sin(6 * mu) +
    ((1097 * n4) / 512) * Math.sin(8 * mu);

  const sinLatP = Math.sin(latP);
  const cosLatP = Math.cos(latP);
  const rho =
    (a * (1 - e2)) / Math.pow(1 - e2 * sinLatP * sinLatP, 1.5);
  const nu = a / Math.sqrt(1 - e2 * sinLatP * sinLatP);
  const psi = nu / rho;
  const t = Math.tan(latP);
  const t2 = t * t;
  const t4 = t2 * t2;
  const psi2 = psi * psi;
  const psi3 = psi2 * psi;
  const psi4 = psi3 * psi;
  const dE = easting - oE;
  const x = dE / (k * nu);
  const x3 = x * x * x;
  const x5 = x3 * x * x;
  const x7 = x5 * x * x;

  const lat =
    latP -
    (t / (rho * k)) *
      ((dE * x) / 2 -
        ((dE * x3) / 24) *
          (-4 * psi2 + 9 * psi * (1 - t2) + 12 * t2) +
        ((dE * x5) / 720) *
          (8 * psi4 * (11 - 24 * t2) -
            12 * psi3 * (21 - 71 * t2) +
            15 * psi2 * (15 - 98 * t2 + 15 * t4) +
            180 * psi * (5 * t2 - 3 * t4) +
            360 * t4) -
        ((dE * x7) / 40320) * (1385 - 3633 * t2 + 4095 * t4 + 1575 * t2 * t4));

  const lng =
    oLng +
    (1 / cosLatP) *
      (x -
        (x3 / 6) * (psi + 2 * t2) +
        (x5 / 120) *
          (-4 * psi3 * (1 - 6 * t2) +
            psi2 * (9 - 68 * t2) +
            72 * psi * t2 +
            24 * t4) -
        (x7 / 5040) * (61 + 662 * t2 + 1320 * t4 + 720 * t2 * t4));

  return { lat: lat / RAD, lng: lng / RAD };
}

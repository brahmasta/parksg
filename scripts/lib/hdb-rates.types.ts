/** Mirrors the Supabase enums for the rate_rows / carparks tables. Kept in
 * a small file so scripts/lib/hdb-rates.ts can be imported by the test
 * runner without dragging in any I/O. */

export type DayType = 'WEEKDAY' | 'SAT' | 'SUN_PH';
export type ParkingSystem = 'EPS' | 'COUPON' | 'GANTRY_PRIVATE' | 'FLAT';
export type VehCat = 'CAR' | 'MOTORCYCLE' | 'HEAVY';
export type Source =
  | 'URA'
  | 'HDB'
  | 'LTA_DATAGOV'
  | 'LTA_DATAMALL'
  | 'CAG'
  | 'OPERATOR'
  | 'MANUAL';

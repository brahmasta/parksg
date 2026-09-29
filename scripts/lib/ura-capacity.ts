/**
 * URA "Capacity of URA Parking Places" (data.gov.sg) → carpark lot-type
 * columns. Pure, so the mapping is unit-testable; the network/DB side lives in
 * scripts/ingest-ura-capacity.ts.
 */

export type UraCapacityEntry = {
  ppCode: string;
  name: string | null;
  car: number;
  motorcycle: number;
  heavy: number;
  /** YYYYMMDD the record was last updated by URA. */
  updated: string | null;
};

export type LotTypeCode = 'C' | 'M' | 'H';

export type CarparkLotTypeUpdate = {
  id: string;
  lot_types: LotTypeCode[];
  motorcycle_lots: number;
  heavy_lots: number;
};

/**
 * Lot-type columns for one URA parking place. Car capacity is deliberately
 * not written: total_lots already comes from URA's own Car_Park_Details feed.
 */
export function toLotTypeUpdate(e: UraCapacityEntry): CarparkLotTypeUpdate {
  const lotTypes: LotTypeCode[] = [];
  if (e.car > 0) lotTypes.push('C');
  if (e.motorcycle > 0) lotTypes.push('M');
  if (e.heavy > 0) lotTypes.push('H');
  return {
    id: `URA:${e.ppCode}`,
    lot_types: lotTypes,
    motorcycle_lots: e.motorcycle,
    heavy_lots: e.heavy,
  };
}

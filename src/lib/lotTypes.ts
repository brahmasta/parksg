import type { LotType } from './types';
import type { VehicleFilter } from './resultsView';

/** Spelled-out vehicle names — single letters (C/M/H) only explained
 * themselves on mouse hover, which phones don't have. */
export const LOT_TYPE_LABEL: Record<LotType, string> = {
  C: 'Car',
  M: 'Motorcycle',
  H: 'Heavy vehicle',
};

/** "motorcycle", "heavy-vehicle", or "motorcycle and heavy-vehicle" — for
 * copy like "… lots". */
export function vehiclePhrase(vehicles: VehicleFilter[]): string {
  return vehicles
    .map((t) => LOT_TYPE_LABEL[t].toLowerCase().replace(' ', '-'))
    .join(' and ');
}

/**
 * The note under the filters while a vehicle filter is on. Lot types come
 * from HDB (live feed + the community motorcycle list) and URA's capacity
 * data; motorcycle lots also come from rider-reported mall and office prices.
 * Card prices and free-lot counts stay car figures.
 */
export function vehicleCaveat(vehicles: VehicleFilter[]): string {
  const sources = vehicles.includes('M') ? 'HDB, URA and rider reports' : 'HDB and URA';
  return (
    `Showing carparks known to have ${vehiclePhrase(vehicles)} lots, from ${sources}. ` +
    'Others may have them too. Prices and free-lot counts on the cards are for cars.'
  );
}

/** Title + hint for the "vehicle filter emptied the list" state. */
export function vehicleEmptyCopy(vehicles: VehicleFilter[]): { title: string; hint: string } {
  const phrase = vehiclePhrase(vehicles);
  return {
    title: `No carparks with ${phrase} lots here`,
    hint: `No carpark nearby is known to have ${phrase} lots. Others may still have them — we just don't have that data yet.`,
  };
}

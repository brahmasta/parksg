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

/** Title + hint for the "vehicle filter emptied the list" state. */
export function vehicleEmptyCopy(vehicles: VehicleFilter[]): { title: string; hint: string } {
  const phrase = vehiclePhrase(vehicles);
  return {
    title: `No carparks with ${phrase} lots here`,
    hint: `No HDB or URA carpark nearby reports ${phrase} lots. Other carparks may still have them — we just don't have that data yet.`,
  };
}

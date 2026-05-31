/**
 * Singapore postal *sector* (first two digits of the 6-digit code) → a
 * recognizable locality name. This is the official URA postal-district guide,
 * collapsed to the general-location label people actually recognize (e.g.
 * "Orchard", "Tampines") rather than the numeric district. Sectors that map to
 * the same district share the same name. Sectors with no residential
 * allocation (e.g. 74) are simply absent and resolve to null.
 */
export const POSTAL_SECTOR_AREA: Record<string, string> = {
  '01': 'Raffles Place', '02': 'Raffles Place', '03': 'Raffles Place',
  '04': 'Raffles Place', '05': 'Raffles Place', '06': 'Raffles Place',
  '07': 'Tanjong Pagar', '08': 'Tanjong Pagar',
  '09': 'Harbourfront', '10': 'Harbourfront',
  '11': 'Pasir Panjang', '12': 'Pasir Panjang', '13': 'Clementi',
  '14': 'Queenstown', '15': 'Tiong Bahru', '16': 'Tiong Bahru',
  '17': 'City Hall',
  '18': 'Bugis', '19': 'Bugis',
  '20': 'Little India', '21': 'Little India',
  '22': 'Orchard', '23': 'Orchard',
  '24': 'Bukit Timah', '25': 'Bukit Timah', '26': 'Bukit Timah', '27': 'Bukit Timah',
  '28': 'Novena', '29': 'Novena', '30': 'Novena',
  '31': 'Toa Payoh', '32': 'Toa Payoh', '33': 'Toa Payoh',
  '34': 'Macpherson', '35': 'Macpherson', '36': 'Macpherson', '37': 'Macpherson',
  '38': 'Geylang', '39': 'Geylang', '40': 'Geylang', '41': 'Geylang',
  '42': 'Katong', '43': 'Katong', '44': 'Katong', '45': 'Katong',
  '46': 'Bedok', '47': 'Bedok', '48': 'Bedok',
  '49': 'Changi', '50': 'Changi', '81': 'Changi',
  '51': 'Tampines', '52': 'Tampines',
  '53': 'Hougang', '54': 'Hougang', '55': 'Hougang', '82': 'Punggol',
  '56': 'Ang Mo Kio', '57': 'Bishan',
  '58': 'Upper Bukit Timah', '59': 'Upper Bukit Timah',
  '60': 'Jurong', '61': 'Jurong', '62': 'Jurong', '63': 'Jurong', '64': 'Jurong',
  '65': 'Bukit Panjang', '66': 'Bukit Panjang', '67': 'Choa Chu Kang', '68': 'Choa Chu Kang',
  '69': 'Tengah', '70': 'Tengah', '71': 'Tengah',
  '72': 'Kranji', '73': 'Kranji',
  '75': 'Yishun', '76': 'Sembawang',
  '77': 'Upper Thomson', '78': 'Upper Thomson',
  '79': 'Seletar', '80': 'Seletar',
};

/**
 * Read the locality for the first 6-digit SG postal code embedded in a
 * free-text address. Returns null when there's no postal code or its sector
 * isn't allocated.
 */
export function areaFromPostal(text: string | undefined | null): string | null {
  if (!text) return null;
  const m = /\b(\d{6})\b/.exec(text);
  if (!m) return null;
  return POSTAL_SECTOR_AREA[m[1].slice(0, 2)] ?? null;
}

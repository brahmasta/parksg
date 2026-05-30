/**
 * Curated high-value Singapore areas for the `/parking-near/:area` SEO
 * landing pages. Each entry is a real place people search "parking near …"
 * for, with a centre coordinate the page uses to pull nearby carparks from
 * Supabase (bounding box + haversine).
 *
 * Slugs are URL-safe and stable — they appear in the sitemap and in internal
 * links from carpark pages, so don't rename one without a redirect.
 */

export type SeoArea = {
  slug: string;
  /** Display name, e.g. "Orchard Road". */
  name: string;
  /** Short blurb used in the meta description + intro paragraph. */
  blurb: string;
  lat: number;
  lng: number;
  /** Search radius in metres for "nearby" carparks. */
  radiusM: number;
};

export const SEO_AREAS: SeoArea[] = [
  { slug: 'orchard', name: 'Orchard Road', blurb: "Singapore's main shopping belt — ION, Ngee Ann City, 313@Somerset.", lat: 1.3036, lng: 103.8318, radiusM: 700 },
  { slug: 'marina-bay', name: 'Marina Bay', blurb: 'Marina Bay Sands, Gardens by the Bay and the CBD waterfront.', lat: 1.2834, lng: 103.8607, radiusM: 900 },
  { slug: 'harbourfront', name: 'HarbourFront', blurb: 'VivoCity, HarbourFront Centre and the Sentosa gateway.', lat: 1.2653, lng: 103.8220, radiusM: 700 },
  { slug: 'cbd', name: 'the CBD (Raffles Place)', blurb: 'Raffles Place, Shenton Way and the central business district.', lat: 1.2840, lng: 103.8510, radiusM: 800 },
  { slug: 'bugis', name: 'Bugis', blurb: 'Bugis Junction, Bugis+ and the Arab Street precinct.', lat: 1.3008, lng: 103.8559, radiusM: 700 },
  { slug: 'chinatown', name: 'Chinatown', blurb: 'Chinatown, Tanjong Pagar and Outram.', lat: 1.2829, lng: 103.8443, radiusM: 700 },
  { slug: 'little-india', name: 'Little India', blurb: 'Tekka Centre, Mustafa and the Serangoon Road belt.', lat: 1.3066, lng: 103.8497, radiusM: 700 },
  { slug: 'tiong-bahru', name: 'Tiong Bahru', blurb: 'Tiong Bahru Plaza, the market and the heritage estate.', lat: 1.2847, lng: 103.8270, radiusM: 700 },
  { slug: 'novena', name: 'Novena', blurb: 'Velocity, United Square and the health-city medical hub.', lat: 1.3203, lng: 103.8439, radiusM: 700 },
  { slug: 'toa-payoh', name: 'Toa Payoh', blurb: 'Toa Payoh HDB Hub, the town centre and the MRT interchange.', lat: 1.3329, lng: 103.8470, radiusM: 800 },
  { slug: 'ang-mo-kio', name: 'Ang Mo Kio', blurb: 'AMK Hub, Jubilee Square and the central town.', lat: 1.3691, lng: 103.8454, radiusM: 900 },
  { slug: 'bishan', name: 'Bishan', blurb: 'Junction 8 and the Bishan interchange.', lat: 1.3508, lng: 103.8485, radiusM: 800 },
  { slug: 'serangoon', name: 'Serangoon', blurb: 'NEX mall and the Serangoon interchange.', lat: 1.3500, lng: 103.8720, radiusM: 800 },
  { slug: 'paya-lebar', name: 'Paya Lebar', blurb: 'Paya Lebar Quarter, SingPost Centre and the interchange.', lat: 1.3179, lng: 103.8927, radiusM: 800 },
  { slug: 'tampines', name: 'Tampines', blurb: 'Tampines Mall, Century Square and the regional centre.', lat: 1.3525, lng: 103.9447, radiusM: 1000 },
  { slug: 'bedok', name: 'Bedok', blurb: 'Bedok Mall and the town centre.', lat: 1.3240, lng: 103.9300, radiusM: 900 },
  { slug: 'changi-airport', name: 'Changi Airport & Jewel', blurb: 'Jewel Changi, the airport terminals and Changi City Point.', lat: 1.3592, lng: 103.9894, radiusM: 1500 },
  { slug: 'jurong-east', name: 'Jurong East', blurb: 'JEM, Westgate, IMM and the Jurong regional centre.', lat: 1.3331, lng: 103.7422, radiusM: 1000 },
  { slug: 'clementi', name: 'Clementi', blurb: 'Clementi Mall and the town centre near NUS.', lat: 1.3151, lng: 103.7644, radiusM: 800 },
  { slug: 'buona-vista', name: 'Buona Vista', blurb: 'one-north, Star Vista and the Rochester precinct.', lat: 1.3072, lng: 103.7900, radiusM: 800 },
  { slug: 'woodlands', name: 'Woodlands', blurb: 'Causeway Point, Woods Square and the northern regional centre.', lat: 1.4360, lng: 103.7865, radiusM: 1000 },
  { slug: 'yishun', name: 'Yishun', blurb: 'Northpoint City and the town centre.', lat: 1.4294, lng: 103.8350, radiusM: 900 },
  { slug: 'punggol', name: 'Punggol', blurb: 'Waterway Point and the Punggol town centre.', lat: 1.4053, lng: 103.9020, radiusM: 900 },
  { slug: 'sengkang', name: 'Sengkang', blurb: 'Compass One and the Sengkang interchange.', lat: 1.3915, lng: 103.8954, radiusM: 900 },
  { slug: 'hougang', name: 'Hougang', blurb: 'Hougang Mall and the town centre.', lat: 1.3712, lng: 103.8924, radiusM: 900 },
  { slug: 'bukit-merah', name: 'Bukit Merah', blurb: 'Tiong Bahru, Redhill and the Bukit Merah estates.', lat: 1.2819, lng: 103.8239, radiusM: 900 },
  { slug: 'queenstown', name: 'Queenstown', blurb: 'Anchorpoint, IKEA Alexandra and the Queenstown estate.', lat: 1.2946, lng: 103.8059, radiusM: 800 },
  { slug: 'kallang', name: 'Kallang', blurb: 'Singapore Sports Hub, Kallang Wave and Leisure Park.', lat: 1.3030, lng: 103.8740, radiusM: 900 },
  { slug: 'dhoby-ghaut', name: 'Dhoby Ghaut', blurb: 'Plaza Singapura, The Cathay and the museum district.', lat: 1.2993, lng: 103.8455, radiusM: 600 },
  { slug: 'somerset', name: 'Somerset', blurb: '313@Somerset, Orchard Central and the Killiney enclave.', lat: 1.3006, lng: 103.8388, radiusM: 600 },
];

export function findArea(slug: string): SeoArea | undefined {
  const s = slug.toLowerCase();
  return SEO_AREAS.find((a) => a.slug === s);
}

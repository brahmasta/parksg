/**
 * Hero copy rotation for the Home screen.
 *
 * One pair is picked at random per app load (see HomeScreen.tsx's
 * useMemo). Deliberately generic — no operator names (HDB/URA/LTA/JTC)
 * and no EV connector types — so the copy stays accurate as data
 * sources evolve.
 */

export type HeroCopy = {
  header: string;
  sub: string;
};

export const HERO_COPY: HeroCopy[] = [
  {
    header: 'Skip the circling.',
    sub: 'Live availability and real prices for carparks across Singapore — before you drive.',
  },
  {
    header: 'Cheapest spot first.',
    sub: 'We rank nearby carparks by true cost and walk time, the moment you search.',
  },
  {
    header: 'Know the price before the ramp.',
    sub: 'Real rates for thousands of Singapore carparks — no more bill shock at the barrier.',
  },
  {
    header: 'Charging? Sorted too.',
    sub: 'Find carparks with live EV charger availability, right next to the cheapest lot.',
  },
  {
    header: 'Stop praying for a lot.',
    sub: 'See live availability across thousands of carparks the moment you search.',
  },
  {
    header: 'All your options. One view.',
    sub: 'Live lots, real prices and EV charging for parking across Singapore.',
  },
];

export function pickHeroCopy(): HeroCopy {
  return HERO_COPY[Math.floor(Math.random() * HERO_COPY.length)];
}

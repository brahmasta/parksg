import type {
  Carpark,
  Destination,
  DurationOption,
  RecentDestination,
} from './types';

export const DESTINATION: Destination = {
  label: 'Vivocity',
  address: '1 HarbourFront Walk, Singapore 098585',
  area: 'HarbourFront',
};

export const CARPARKS: Carpark[] = [
  {
    id: 'tbr-mscp',
    name: 'Telok Blangah Rise',
    block: 'Blk 78 MSCP',
    operator: 'HDB',
    lotTypes: ['C', 'M'],
    lotsAvailable: 42,
    lotsTotal: 184,
    walkMin: 8,
    walkMeters: 620,
    grace: 10,
    coords: { entrance: [1.2701, 103.8175] },
    rates: {
      weekday: [
        { window: '7am – 10:30pm', rate: '$0.60 / 30 min' },
        { window: '10:30pm – 7am', rate: '$2.00 cap' },
      ],
      saturday: [
        { window: '7am – 10:30pm', rate: '$0.60 / 30 min' },
        { window: '10:30pm – 7am', rate: '$2.00 cap' },
      ],
      sundayPH: [{ window: 'All day', rate: '$0.60 / 30 min' }],
    },
    estByHours: { 0.5: 0.6, 1: 1.2, 1.5: 1.8, 2: 2.4, 3: 3.6, 4: 4.8 },
  },
  {
    id: 'bmv-c11',
    name: 'Bukit Merah View',
    block: 'Blk 11',
    operator: 'HDB',
    lotTypes: ['C', 'M'],
    lotsAvailable: 156,
    lotsTotal: 312,
    walkMin: 12,
    walkMeters: 950,
    grace: 10,
    coords: { entrance: [1.2738, 103.8156] },
    rates: {
      weekday: [
        { window: '7am – 10:30pm', rate: '$0.60 / 30 min' },
        { window: '10:30pm – 7am', rate: '$2.00 cap' },
      ],
      saturday: [{ window: '7am – 10:30pm', rate: '$0.60 / 30 min' }],
      sundayPH: [{ window: 'All day', rate: '$0.60 / 30 min' }],
    },
    estByHours: { 0.5: 0.6, 1: 1.2, 1.5: 1.8, 2: 2.4, 3: 3.6, 4: 4.8 },
  },
  {
    id: 'tbc-osc',
    name: 'Telok Blangah Cres',
    block: 'Off-street lot OSC-12',
    operator: 'URA',
    lotTypes: ['C'],
    lotsAvailable: 3,
    lotsTotal: 48,
    walkMin: 6,
    walkMeters: 450,
    grace: 0,
    coords: { entrance: [1.2712, 103.8189] },
    rates: {
      weekday: [
        { window: '7am – 5pm', rate: '$1.20 / 30 min', cap: '$4.80 / 2h max' },
        { window: '5pm – 10pm', rate: '$0.60 / 30 min' },
        { window: '10pm – 7am', rate: 'Free' },
      ],
      saturday: [
        { window: '7am – 5pm', rate: '$1.20 / 30 min' },
        { window: '5pm – 10pm', rate: '$0.60 / 30 min' },
      ],
      sundayPH: [{ window: 'All day', rate: '$0.60 / 30 min' }],
    },
    estByHours: { 0.5: 1.2, 1: 2.4, 1.5: 3.6, 2: 4.8, 3: 5.4, 4: 6.0 },
  },
  {
    id: 'hbf-pl',
    name: 'HarbourFront Place',
    block: 'Multi-storey, Tower B',
    operator: 'LTA',
    lotTypes: ['C', 'M', 'H'],
    lotsAvailable: 87,
    lotsTotal: 420,
    walkMin: 3,
    walkMeters: 220,
    grace: 0,
    coords: { entrance: [1.2654, 103.8226] },
    rates: {
      weekday: [
        { window: '7am – 6pm', rate: '$1.80 / 30 min' },
        { window: '6pm – 11pm', rate: '$0.90 / 30 min' },
        { window: '11pm – 7am', rate: '$3.00 cap' },
      ],
      saturday: [{ window: '7am – 11pm', rate: '$1.80 / 30 min' }],
      sundayPH: [{ window: '7am – 11pm', rate: '$1.20 / 30 min' }],
    },
    estByHours: { 0.5: 1.8, 1: 3.6, 1.5: 5.4, 2: 7.2, 3: 10.8, 4: 14.4 },
  },
  {
    id: 'hen-mscp',
    name: 'Henderson Road',
    block: 'Blk 95A MSCP',
    operator: 'HDB',
    lotTypes: ['C'],
    lotsAvailable: 0,
    lotsTotal: 220,
    walkMin: 14,
    walkMeters: 1100,
    grace: 10,
    coords: { entrance: [1.2785, 103.8160] },
    rates: {
      weekday: [{ window: '7am – 10:30pm', rate: '$0.60 / 30 min' }],
      saturday: [{ window: '7am – 10:30pm', rate: '$0.60 / 30 min' }],
      sundayPH: [{ window: 'All day', rate: '$0.60 / 30 min' }],
    },
    estByHours: { 0.5: 0.6, 1: 1.2, 1.5: 1.8, 2: 2.4, 3: 3.6, 4: 4.8 },
  },
];

export const DURATIONS: DurationOption[] = [
  { value: 0.5, label: '30 min' },
  { value: 1, label: '1 hr' },
  { value: 1.5, label: '1.5 hr' },
  { value: 2, label: '2 hr' },
  { value: 3, label: '3 hr' },
  { value: 4, label: '4 hr+' },
];

export const RECENT: RecentDestination[] = [
  { name: 'Vivocity', hint: 'HarbourFront' },
  { name: '313 Somerset', hint: 'Orchard' },
  { name: 'Jewel Changi', hint: 'Airport' },
  { name: 'Tiong Bahru Plaza', hint: 'Bukit Merah' },
];

export interface ParcelRecord {
  id: string;
  ulpin: string;
  owner: string;
  areaSqM: number;
  confidence: number;
  status: 'harmonized' | 'conflict' | 'pending';
  conflictType?: 'sliver-gap' | 'overlap' | 'mismatch' | 'orphan';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  centroid: [number, number];
  legacyArea?: number;
  harmonizedArea?: number;
  zone: string;
  lastUpdated: string;
}

export interface UploadItem {
  id: string;
  name: string;
  type: 'geotiff' | 'shapefile' | 'csv';
  size: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  progress: number;
  records?: number;
}

export interface MapBounds {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface HarmonizationRun {
  status: 'idle' | 'running' | 'complete' | 'error';
  progress: number;
  stage: string;
  parcelsProcessed: number;
  totalParcels: number;
  conflictsFound: number;
  confidenceAvg: number;
}

export const PARCEL_DATA: ParcelRecord[] = [
  {
    id: 'p-001',
    ulpin: 'ULPIN-28A-00117',
    owner: 'M. Ramesh Patil',
    areaSqM: 1842.5,
    confidence: 94.2,
    status: 'harmonized',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78.0321, 27.1583],
          [78.0338, 27.1583],
          [78.0338, 27.1601],
          [78.0321, 27.1601],
          [78.0321, 27.1583],
        ],
      ],
    },
    centroid: [78.03295, 27.1592],
    legacyArea: 1851.2,
    harmonizedArea: 1842.5,
    zone: 'Sector 28A',
    lastUpdated: '2026-09-03T14:22:00Z',
  },
  {
    id: 'p-002',
    ulpin: 'ULPIN-28A-00118',
    owner: 'Lakshmi Estates Pvt. Ltd.',
    areaSqM: 3267.0,
    confidence: 71.3,
    status: 'conflict',
    conflictType: 'sliver-gap',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78.0338, 27.1583],
          [78.0362, 27.1583],
          [78.0362, 27.1601],
          [78.0338, 27.1601],
          [78.0338, 27.1583],
        ],
      ],
    },
    centroid: [78.0350, 27.1592],
    legacyArea: 3341.5,
    harmonizedArea: 3267.0,
    zone: 'Sector 28A',
    lastUpdated: '2026-09-03T14:25:00Z',
  },
  {
    id: 'p-003',
    ulpin: 'ULPIN-28A-00119',
    owner: 'Govt. Primary School',
    areaSqM: 5210.8,
    confidence: 88.7,
    status: 'harmonized',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78.0362, 27.1583],
          [78.0395, 27.1583],
          [78.0395, 27.1601],
          [78.0362, 27.1601],
          [78.0362, 27.1583],
        ],
      ],
    },
    centroid: [78.03785, 27.1592],
    legacyArea: 5210.8,
    harmonizedArea: 5210.8,
    zone: 'Sector 28A',
    lastUpdated: '2026-09-03T14:28:00Z',
  },
  {
    id: 'p-004',
    ulpin: 'ULPIN-28A-00120',
    owner: 'S. Kaur & Sons',
    areaSqM: 953.4,
    confidence: 62.1,
    status: 'conflict',
    conflictType: 'overlap',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78.0321, 27.1601],
          [78.0338, 27.1601],
          [78.0338, 27.1618],
          [78.0321, 27.1618],
          [78.0321, 27.1601],
        ],
      ],
    },
    centroid: [78.03295, 27.16095],
    legacyArea: 910.2,
    harmonizedArea: 953.4,
    zone: 'Sector 28A',
    lastUpdated: '2026-09-03T14:30:00Z',
  },
  {
    id: 'p-005',
    ulpin: 'ULPIN-28A-00121',
    owner: 'Greenfield Agritech LLP',
    areaSqM: 7420.0,
    confidence: 91.5,
    status: 'harmonized',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78.0338, 27.1601],
          [78.0362, 27.1601],
          [78.0362, 27.1618],
          [78.0338, 27.1618],
          [78.0338, 27.1601],
        ],
      ],
    },
    centroid: [78.0350, 27.16095],
    legacyArea: 7380.5,
    harmonizedArea: 7420.0,
    zone: 'Sector 28A',
    lastUpdated: '2026-09-03T14:32:00Z',
  },
  {
    id: 'p-006',
    ulpin: 'ULPIN-28B-00043',
    owner: 'Anand Cooperative Housing',
    areaSqM: 2156.3,
    confidence: 79.8,
    status: 'conflict',
    conflictType: 'mismatch',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78.0362, 27.1601],
          [78.0395, 27.1601],
          [78.0395, 27.1618],
          [78.0362, 27.1618],
          [78.0362, 27.1601],
        ],
      ],
    },
    centroid: [78.03785, 27.16095],
    legacyArea: 2103.8,
    harmonizedArea: 2156.3,
    zone: 'Sector 28B',
    lastUpdated: '2026-09-03T14:35:00Z',
  },
  {
    id: 'p-007',
    ulpin: 'ULPIN-28B-00044',
    owner: 'Bharat Petroleum Retail',
    areaSqM: 612.7,
    confidence: 55.4,
    status: 'conflict',
    conflictType: 'orphan',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78.0321, 27.1618],
          [78.0338, 27.1618],
          [78.0338, 27.1635],
          [78.0321, 27.1635],
          [78.0321, 27.1618],
        ],
      ],
    },
    centroid: [78.03295, 27.16265],
    legacyArea: 612.7,
    harmonizedArea: 598.1,
    zone: 'Sector 28B',
    lastUpdated: '2026-09-03T14:38:00Z',
  },
  {
    id: 'p-008',
    ulpin: 'ULPIN-28B-00045',
    owner: 'Municipal Drainage Reserve',
    areaSqM: 3890.0,
    confidence: 97.1,
    status: 'harmonized',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78.0338, 27.1618],
          [78.0362, 27.1618],
          [78.0362, 27.1635],
          [78.0338, 27.1635],
          [78.0338, 27.1618],
        ],
      ],
    },
    centroid: [78.0350, 27.16265],
    legacyArea: 3890.0,
    harmonizedArea: 3890.0,
    zone: 'Sector 28B',
    lastUpdated: '2026-09-03T14:40:00Z',
  },
  {
    id: 'p-009',
    ulpin: 'ULPIN-28B-00046',
    owner: 'R. Ibrahim Trust',
    areaSqM: 1284.6,
    confidence: 83.9,
    status: 'harmonized',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78.0362, 27.1618],
          [78.0395, 27.1618],
          [78.0395, 27.1635],
          [78.0362, 27.1635],
          [78.0362, 27.1618],
        ],
      ],
    },
    centroid: [78.03785, 27.16265],
    legacyArea: 1265.3,
    harmonizedArea: 1284.6,
    zone: 'Sector 28B',
    lastUpdated: '2026-09-03T14:42:00Z',
  },
];

export function getConflictLabel(type?: ParcelRecord['conflictType']): string {
  switch (type) {
    case 'sliver-gap':
      return 'Sliver Gap';
    case 'overlap':
      return 'Boundary Overlap';
    case 'mismatch':
      return 'Area Mismatch';
    case 'orphan':
      return 'Orphan Record';
    default:
      return 'Unknown';
  }
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 85) return 'text-emerald-400';
  if (confidence >= 70) return 'text-amber-400';
  return 'text-rose-400';
}

export function getConfidenceBg(confidence: number): string {
  if (confidence >= 85) return 'bg-emerald-500';
  if (confidence >= 70) return 'bg-amber-500';
  return 'bg-rose-500';
}

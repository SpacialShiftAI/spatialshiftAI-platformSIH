'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Map as MLMap,
  type Map as MLMapType,
  type MapMouseEvent,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ZoomIn,
  ZoomOut,
  Compass,
  Eye,
  Layers,
  Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PARCEL_DATA, type ParcelRecord } from '@/lib/parcels';

interface DualMapProps {
  harmonized: boolean;
  selectedParcelId: string | null;
  onSelectParcel: (id: string | null) => void;
}

// Dark raster-like style without external tiles — uses a synthetic dark canvas
// with a GeoJSON grid + parcel overlays to avoid tile dependency.
function buildStyle(harmonized: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {
      parcels: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection' as const,
          features: PARCEL_DATA.map((p) => ({
            type: 'Feature' as const,
            properties: {
              id: p.id,
              ulpin: p.ulpin,
              owner: p.owner,
              confidence: p.confidence,
              status: p.status,
              conflictType: p.conflictType || 'none',
              area: p.areaSqM,
            },
            geometry: {
              type: 'Polygon' as const,
              coordinates: harmonized
                ? p.geometry.coordinates
                : jitterGeometry(p.geometry.coordinates, p),
            },
          })),
        },
      },
      grid: {
        type: 'geojson',
        data: generateGrid(),
      },
      roads: {
        type: 'geojson',
        data: generateRoads(),
      },
    },
    layers: [
      // Background
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': harmonized ? '#0a1420' : '#1a1208',
        },
      },
      // Subtle grid
      {
        id: 'grid-lines',
        type: 'line',
        source: 'grid',
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': harmonized ? '#0d2840' : '#2a1e10',
          'line-width': 0.5,
          'line-opacity': 0.4,
        },
      },
      // Roads
      {
        id: 'roads',
        type: 'line',
        source: 'roads',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': harmonized ? '#1a3a5c' : '#3a2a14',
          'line-width': 2,
          'line-opacity': 0.6,
        },
      },
      // Road outlines
      {
        id: 'roads-core',
        type: 'line',
        source: 'roads',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': harmonized ? '#2a4a6c' : '#4a3a24',
          'line-width': 0.8,
          'line-opacity': 0.8,
        },
      },
      // Parcel fills
      {
        id: 'parcel-fills',
        type: 'fill',
        source: 'parcels',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'status'], 'conflict'],
            harmonized ? '#7a3a1a' : '#5a2a0a',
            harmonized ? '#0d3a5c' : '#1a2a3a',
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'status'], 'conflict'],
            0.35,
            0.22,
          ],
        },
      },
      // Parcel borders
      {
        id: 'parcel-borders',
        type: 'line',
        source: 'parcels',
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'status'], 'conflict'],
            harmonized ? '#f59e0b' : '#d97706',
            harmonized ? '#38bdf8' : '#64748b',
          ],
          'line-width': harmonized ? 1.5 : 1,
          'line-opacity': 0.8,
        },
      },
      // Confidence labels (harmonized only)
      ...(harmonized
        ? [
            {
              id: 'parcel-labels',
              type: 'symbol' as const,
              source: 'parcels',
              layout: {
                'text-field': [
                  'concat',
                  ['to-string', ['get', 'confidence']],
                  '%',
                ] as unknown as string,
                'text-size': 10,
                'text-allow-overlap': true,
                'text-font': ['Noto Sans Regular'],
              },
              paint: {
                'text-color': '#e2e8f0',
                'text-halo-color': '#0a1420',
                'text-halo-width': 2,
              },
            },
          ]
        : []),
    ],
  };
}

function jitterGeometry(
  coords: number[][][],
  parcel: ParcelRecord
): number[][][] {
  // Simulate legacy map inaccuracies — shift and distort
  const shift = parcel.conflictType ? 0.0015 : 0.0008;
  const noise = parcel.conflictType === 'sliver-gap' ? 0.002 : 0.001;
  return coords.map((ring) =>
    ring.map(([lng, lat]) => [
      lng + (Math.sin(lat * 1000) * noise - shift * 0.3),
      lat + (Math.cos(lng * 1000) * noise + shift * 0.2),
    ])
  );
}

function generateGrid(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const minLng = 78.030;
  const maxLng = 78.041;
  const minLat = 27.157;
  const maxLat = 27.164;
  const step = 0.001;

  for (let lng = minLng; lng <= maxLng; lng += step) {
    features.push({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [lng, minLat],
          [lng, maxLat],
        ],
      },
    });
  }
  for (let lat = minLat; lat <= maxLat; lat += step) {
    features.push({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [minLng, lat],
          [maxLng, lat],
        ],
      },
    });
  }
  return { type: 'FeatureCollection' as const, features };
}

function generateRoads(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [78.030, 27.1601],
            [78.041, 27.1601],
          ],
        },
      },
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [78.0338, 27.157],
            [78.0338, 27.164],
          ],
        },
      },
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [78.0362, 27.157],
            [78.0362, 27.164],
          ],
        },
      },
    ],
  };
}

export function DualMap({
  harmonized,
  selectedParcelId,
  onSelectParcel,
}: DualMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftContainerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);
  const leftMapRef = useRef<MLMapType | null>(null);
  const rightMapRef = useRef<MLMapType | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const isDragging = useRef(false);
  const syncRef = useRef(true);

  // Initialize maps
  useEffect(() => {
    if (!containerRef.current || leftMapRef.current) return;

    const center: [number, number] = [78.0358, 27.1609];
    const zoom = 15.5;

    const leftMap = new MLMap({
      container: leftContainerRef.current!,
      style: buildStyle(false),
      center,
      zoom,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      dragRotate: false,
      touchZoomRotate: false,
    });

    const rightMap = new MLMap({
      container: rightContainerRef.current!,
      style: buildStyle(true),
      center,
      zoom,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      dragRotate: false,
      touchZoomRotate: false,
    });

    leftMapRef.current = leftMap;
    rightMapRef.current = rightMap;

    // Sync maps
    leftMap.on('move', () => {
      if (!syncRef.current || !rightMapRef.current) return;
      syncRef.current = false;
      rightMapRef.current.jumpTo({
        center: leftMap.getCenter(),
        zoom: leftMap.getZoom(),
        bearing: leftMap.getBearing(),
        pitch: leftMap.getPitch(),
      });
      syncRef.current = true;
    });

    rightMap.on('move', () => {
      if (!syncRef.current || !leftMapRef.current) return;
      syncRef.current = false;
      leftMapRef.current.jumpTo({
        center: rightMap.getCenter(),
        zoom: rightMap.getZoom(),
        bearing: rightMap.getBearing(),
        pitch: rightMap.getPitch(),
      });
      syncRef.current = true;
    });

    // Click handling
    const handleParcelClick = (
      e: MapMouseEvent & {
        features?: MapGeoJSONFeature[];
      }
    ) => {
      if (e.features && e.features.length > 0) {
        const id = e.features[0].properties?.id as string;
        onSelectParcel(id);
      } else {
        onSelectParcel(null);
      }
    };

    leftMap.on('click', 'parcel-fills', handleParcelClick);
    rightMap.on('click', 'parcel-fills', handleParcelClick);

    // Cursor
    leftMap.on('mouseenter', 'parcel-fills', () => {
      leftMap.getCanvas().style.cursor = 'pointer';
    });
    leftMap.on('mouseleave', 'parcel-fills', () => {
      leftMap.getCanvas().style.cursor = '';
    });
    rightMap.on('mouseenter', 'parcel-fills', () => {
      rightMap.getCanvas().style.cursor = 'pointer';
    });
    rightMap.on('mouseleave', 'parcel-fills', () => {
      rightMap.getCanvas().style.cursor = '';
    });

    return () => {
      leftMap.remove();
      rightMap.remove();
      leftMapRef.current = null;
      rightMapRef.current = null;
    };
  }, [onSelectParcel]);

  // Update styles when harmonization toggles
  useEffect(() => {
    if (rightMapRef.current && harmonized) {
      rightMapRef.current.setStyle(buildStyle(true));
      // Re-attach click after style load
      rightMapRef.current.once('sourcedata', () => {
        rightMapRef.current?.on('click', 'parcel-fills', (e) => {
          if (e.features && e.features.length > 0) {
            onSelectParcel(e.features[0].properties?.id as string);
          }
        });
      });
    }
  }, [harmonized, onSelectParcel]);

  // Highlight selected parcel
  useEffect(() => {
    [leftMapRef.current, rightMapRef.current].forEach((map) => {
      if (!map) return;
      if (map.getLayer('parcel-highlight')) {
        map.removeLayer('parcel-highlight');
        map.removeSource('highlight');
      }
      if (!selectedParcelId) return;

      const parcel = PARCEL_DATA.find((p) => p.id === selectedParcelId);
      if (!parcel) return;

      map.addSource('highlight', {
        type: 'geojson',
        data: {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: parcel.geometry.coordinates,
          },
        },
      });
      map.addLayer({
        id: 'parcel-highlight',
        type: 'line',
        source: 'highlight',
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': '#fbbf24',
          'line-width': 3,
          'line-opacity': 0.9,
          'line-dasharray': [2, 1],
        },
      });
    });
  }, [selectedParcelId]);

  // Swipe slider handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.max(5, Math.min(95, pct)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.max(5, Math.min(95, pct)));
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }, []);

  // Zoom controls
  const zoomIn = () => {
    leftMapRef.current?.zoomIn();
  };
  const zoomOut = () => {
    leftMapRef.current?.zoomOut();
  };
  const resetNorth = () => {
    leftMapRef.current?.resetNorth();
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* Map containers */}
      <div ref={containerRef} className="relative h-full w-full">
        {/* Left (legacy) map */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
        >
          <div ref={leftContainerRef} className="absolute inset-0" />
        </div>

        {/* Right (harmonized) map */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 0 0 ${splitPercent}%)` }}
        >
          <div ref={rightContainerRef} className="absolute inset-0" />
        </div>

        {/* Swipe slider handle */}
        <div
          className="absolute top-0 bottom-0 z-20 cursor-ew-resize"
          style={{ left: `${splitPercent}%`, transform: 'translateX(-50%)' }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_12px_rgba(56,189,248,0.6)]" />
          <div className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-card/90 backdrop-blur-sm shadow-lg animate-pulse-ring">
            <svg
              className="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7l-4 5 4 5M16 7l4 5-4 5"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Map controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <MapControlButton onClick={zoomIn} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </MapControlButton>
        <MapControlButton onClick={zoomOut} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </MapControlButton>
        <MapControlButton onClick={resetNorth} title="Reset north">
          <Compass className="h-4 w-4" />
        </MapControlButton>
      </div>

      {/* Layer labels */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2">
        <div
          className={cn(
            'rounded-md border border-border bg-card/80 px-2.5 py-1.5 backdrop-blur-sm'
          )}
          style={{ opacity: splitPercent > 15 ? 1 : 0.3 }}
        >
          <div className="flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Legacy Cadastral
            </span>
          </div>
          <p className="text-[9px] text-muted-foreground">Raw uncorrected</p>
        </div>
        <div
          className="rounded-md border border-border bg-card/80 px-2.5 py-1.5 backdrop-blur-sm"
          style={{ opacity: splitPercent < 85 ? 1 : 0.3 }}
        >
          <div className="flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-sky-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
              AI Harmonized
            </span>
          </div>
          <p className="text-[9px] text-muted-foreground">Confidence-scored</p>
        </div>
      </div>

      {/* Crosshair / coordinates badge */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 backdrop-blur-sm">
          <Crosshair className="h-3 w-3 text-primary" />
          <span className="font-mono text-[10px] text-muted-foreground">
            78.0358°E, 27.1609°N
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            WGS84 • UTM 43N
          </span>
        </div>
      </div>

      {/* Split percentage indicator */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-10">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card/80 px-2.5 py-1.5 backdrop-blur-sm">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${splitPercent}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {Math.round(splitPercent)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function MapControlButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/50 hover:text-primary"
    >
      {children}
    </button>
  );
}

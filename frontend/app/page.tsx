'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/dashboard/sidebar';
import { ConflictInspector } from '@/components/dashboard/conflict-inspector';
import { TopBar } from '@/components/dashboard/top-bar';
import { PARCEL_DATA, type UploadItem, type HarmonizationRun } from '@/lib/parcels';
import { runHarmonization as requestBackendHarmonization } from '@/lib/api';
import {
  BackendSessionProvider,
  useBackendSession,
} from '@/lib/backend-session';

const DualMap = dynamic(
  () => import('@/components/dashboard/dual-map').then((mod) => mod.DualMap),
  { ssr: false }
);

export default function Home() {
  return (
    <BackendSessionProvider>
      <HomeDashboard />
    </BackendSessionProvider>
  );
}

function HomeDashboard() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [harmonizationRun, setHarmonizationRun] = useState<HarmonizationRun>({
    status: 'idle',
    progress: 0,
    stage: '',
    parcelsProcessed: 0,
    totalParcels: PARCEL_DATA.length,
    conflictsFound: 0,
    confidenceAvg: 0,
  });
  const [harmonized, setHarmonized] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const { lastDatasetId, recordHarmonize, recordError } = useBackendSession();

  const handleRunHarmonization = useCallback(() => {
    if (harmonizationRun.status === 'running') return;

    const stages = [
      'Preprocessing drone orthomosaic…',
      'Extracting parcel boundaries from imagery…',
      'Matching cadastral shapefile geometries…',
      'Cross-referencing tax records (ULPIN)…',
      'Detecting sliver gaps & overlaps…',
      'Computing confidence scores…',
      'Generating harmonized parcel fabric…',
    ];

    setHarmonizationRun({
      status: 'running',
      progress: 0,
      stage: stages[0],
      parcelsProcessed: 0,
      totalParcels: PARCEL_DATA.length,
      conflictsFound: 0,
      confidenceAvg: 0,
    });

    let progress = 0;
    let stageIdx = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 5;

      const newStageIdx = Math.min(
        stages.length - 1,
        Math.floor((progress / 100) * stages.length)
      );
      if (newStageIdx !== stageIdx) {
        stageIdx = newStageIdx;
      }

      const parcelsProcessed = Math.min(
        PARCEL_DATA.length,
        Math.floor((progress / 100) * PARCEL_DATA.length)
      );
      const conflictsFound = PARCEL_DATA.slice(0, parcelsProcessed).filter(
        (p) => p.status === 'conflict'
      ).length;
      const processedParcels = PARCEL_DATA.slice(0, parcelsProcessed);
      const confidenceAvg =
        processedParcels.length > 0
          ? processedParcels.reduce((acc, p) => acc + p.confidence, 0) /
            processedParcels.length
          : 0;

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setHarmonizationRun({
          status: 'complete',
          progress: 100,
          stage: 'Harmonization complete',
          parcelsProcessed: PARCEL_DATA.length,
          totalParcels: PARCEL_DATA.length,
          conflictsFound: PARCEL_DATA.filter((p) => p.status === 'conflict')
            .length,
          confidenceAvg:
            PARCEL_DATA.reduce((acc, p) => acc + p.confidence, 0) /
            PARCEL_DATA.length,
        });
        setHarmonized(true);
      } else {
        setHarmonizationRun({
          status: 'running',
          progress,
          stage: stages[stageIdx],
          parcelsProcessed,
          totalParcels: PARCEL_DATA.length,
          conflictsFound,
          confidenceAvg,
        });
      }
    }, 500);

    const datasetId = lastDatasetId;
    if (datasetId) {
      void requestBackendHarmonization({
        dataset_id: datasetId,
        building_dataset_id: null,
        sliver_area_m2: 2,
        snap_tolerance_m: 0.75,
        overlap_area_m2: 0.5,
      })
        .then((data) => {
          recordHarmonize(data);
        })
        .catch((err: unknown) => {
          recordError(
            err instanceof Error ? err.message : 'Harmonization request failed'
          );
        });
    }
  }, [harmonizationRun.status, lastDatasetId, recordHarmonize, recordError]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        onRunHarmonization={handleRunHarmonization}
        harmonizationRun={harmonizationRun}
        uploads={uploads}
        onUploadsChange={setUploads}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <TopBar
          harmonizationStatus={harmonizationRun.status}
          parcelsProcessed={harmonizationRun.parcelsProcessed}
          conflictsFound={harmonizationRun.conflictsFound}
        />

        {/* Map + Inspector */}
        <div className="flex flex-1 overflow-hidden">
          {/* Map area */}
          <div className="relative flex-1 overflow-hidden">
            {!harmonized && harmonizationRun.status === 'idle' && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                <div className="pointer-events-auto rounded-xl border border-border bg-card/80 p-6 text-center backdrop-blur-md max-w-sm animate-fade-in">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <svg
                      className="h-6 w-6 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-foreground">
                    Awaiting Data Sources
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Upload drone GeoTIFF, cadastral shapefiles, and tax CSVs
                    from the sidebar, then run spatial harmonization to
                    visualize AI-corrected parcel boundaries.
                  </p>
                </div>
              </div>
            )}
            <DualMap
              harmonized={harmonized}
              selectedParcelId={selectedParcelId}
              onSelectParcel={setSelectedParcelId}
            />
          </div>

          {/* Conflict Inspector */}
          <ConflictInspector
            collapsed={inspectorCollapsed}
            onToggle={() => setInspectorCollapsed(!inspectorCollapsed)}
            selectedParcelId={selectedParcelId}
            onSelectParcel={setSelectedParcelId}
            harmonizationComplete={harmonizationRun.status === 'complete'}
          />
        </div>
      </div>
    </div>
  );
}

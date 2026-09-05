'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Plane,
  Shapes,
  FileSpreadsheet,
  Play,
  CheckCircle2,
  Loader2,
  UploadCloud,
  X,
  AlertCircle,
  Layers,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { UploadItem, HarmonizationRun } from '@/lib/parcels';
import { isBackendUploadFile, uploadFiles } from '@/lib/api';
import { useBackendSession } from '@/lib/backend-session';

interface SidebarProps {
  onRunHarmonization: () => void;
  harmonizationRun: HarmonizationRun;
  uploads: UploadItem[];
  onUploadsChange: React.Dispatch<React.SetStateAction<UploadItem[]>>;
}

const UPLOAD_ZONES = [
  {
    type: 'geotiff' as const,
    label: 'Drone GeoTIFF',
    description: 'Orthorectified aerial imagery',
    accept: '.tif,.tiff,.geotiff',
    icon: Plane,
    accent: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    hoverBorder: 'hover:border-sky-400/60',
  },
  {
    type: 'shapefile' as const,
    label: 'Cadastral Shapefile',
    description: 'Vector parcel boundaries (.shp)',
    accept: '.shp,.shx,.dbf,.prj,.cpg,.geojson,.json',
    icon: Shapes,
    accent: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    hoverBorder: 'hover:border-violet-400/60',
  },
  {
    type: 'csv' as const,
    label: 'Tax Records CSV',
    description: 'Revenue & ownership data',
    accept: '.csv,.xlsx',
    icon: FileSpreadsheet,
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    hoverBorder: 'hover:border-emerald-400/60',
  },
];



function randomSize(type: UploadItem['type']): string {
  const ranges = {
    geotiff: [120, 480],
    shapefile: [8, 45],
    csv: [2, 18],
  };
  const [min, max] = ranges[type];
  const val = (Math.random() * (max - min) + min).toFixed(1);
  return `${val} MB`;
}

function randomRecords(): number {
  return Math.floor(Math.random() * 4000 + 500);
}

export function Sidebar({
  onRunHarmonization,
  harmonizationRun,
  uploads,
  onUploadsChange,
}: SidebarProps) {
  const [dragActive, setDragActive] = useState<string | null>(null);
  const backend = useBackendSession();
  const fileInputRefs = useRef<Partial<Record<UploadItem['type'], HTMLInputElement | null>>>(
    {}
  );

  const sendSupportedFilesToBackend = useCallback(
    (files: File[]) => {
      const backendFiles = files.filter(isBackendUploadFile);
      if (backendFiles.length === 0) return;
      void uploadFiles(backendFiles)
        .then((data) => {
          backend.recordUpload(data);
        })
        .catch((err: unknown) => {
          backend.recordError(
            err instanceof Error ? err.message : 'Failed upload'
          );
        });
    },
    [backend]
  );

  const ingestRealFiles = useCallback(
    (files: File[], type: UploadItem['type']) => {
      files.forEach((file) => {
        const newItem: UploadItem = {
          id: `upload-${Date.now()}-${file.name}`,
          name: file.name,
          type,
          size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          status: 'processing',
          progress: 0,
        };
        simulateUpload(newItem, onUploadsChange, uploads);
      });
      sendSupportedFilesToBackend(files);
    },
    [uploads, onUploadsChange, sendSupportedFilesToBackend]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, type: UploadItem['type']) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(null);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) {
        const newItem: UploadItem = {
          id: `upload-${Date.now()}-${type}`,
          name: `synthetic_${type}_${Math.floor(Math.random() * 9000 + 1000)}.${
            type === 'geotiff' ? 'tif' : type === 'shapefile' ? 'shp' : 'csv'
          }`,
          type,
          size: randomSize(type),
          status: 'processing',
          progress: 0,
        };
        simulateUpload(newItem, onUploadsChange, uploads);
        return;
      }

      ingestRealFiles(files, type);
    },
    [uploads, onUploadsChange, ingestRealFiles]
  );

  const handleBrowse = (type: UploadItem['type']) => {
    const newItem: UploadItem = {
      id: `upload-${Date.now()}-${type}`,
      name: `synthetic_${type}_${Math.floor(Math.random() * 9000 + 1000)}.${
        type === 'geotiff' ? 'tif' : type === 'shapefile' ? 'shp' : 'csv'
      }`,
      type,
      size: randomSize(type),
      status: 'processing',
      progress: 0,
    };
    simulateUpload(newItem, onUploadsChange, uploads);
  };

  const removeUpload = (id: string) => {
    onUploadsChange(uploads.filter((u) => u.id !== id));
  };

  const isRunning = harmonizationRun.status === 'running';
  const readyCount = uploads.filter((u) => u.status === 'done').length;
  const canRun = readyCount >= 2 && !isRunning;

  return (
    <aside className="flex h-full w-[300px] flex-col border-r border-border bg-sidebar/80 backdrop-blur-sm">
      {/* Brand header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-sky-600 glow-primary">
          <Layers className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-foreground">
            SpatialShift <span className="text-primary">AI</span>
          </h1>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Land Record Harmonization
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
        {/* Upload section */}
        <div className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Data Sources
            </h2>
            {uploads.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {uploads.length} file{uploads.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            {UPLOAD_ZONES.map((zone) => {
              const zoneUploads = uploads.filter((u) => u.type === zone.type);
              return (
                <div key={zone.type}>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(zone.type);
                    }}
                    onDragLeave={() => setDragActive(null)}
                    onDrop={(e) => handleDrop(e, zone.type)}
                    onClick={() => handleBrowse(zone.type)}
                    className={cn(
                      'group cursor-pointer rounded-lg border-2 border-dashed p-3 transition-all',
                      zone.bg,
                      zone.border,
                      zone.hoverBorder,
                      dragActive === zone.type &&
                        'ring-2 ring-primary scale-[1.02]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background/50 transition-transform group-hover:scale-110',
                          zone.accent
                        )}
                      >
                        <zone.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">
                          {zone.label}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {zone.description}
                        </p>
                      </div>
                      <UploadCloud
                        className={cn(
                          'h-4 w-4 shrink-0 transition-opacity',
                          zone.accent,
                          'opacity-50 group-hover:opacity-100'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRefs.current[zone.type]?.click();
                        }}
                      />
                      <input
                        ref={(el) => {
                          fileInputRefs.current[zone.type] = el;
                        }}
                        type="file"
                        multiple
                        accept={zone.accept}
                        className="hidden"
                        aria-hidden="true"
                        tabIndex={-1}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          e.target.value = '';
                          if (files.length > 0) {
                            ingestRealFiles(files, zone.type);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Uploaded files for this zone */}
                  {zoneUploads.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {zoneUploads.map((item) => (
                        <UploadRow
                          key={item.id}
                          item={item}
                          accent={zone.accent}
                          onRemove={() => removeUpload(item.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Processing pipeline */}
        {isRunning && (
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 animate-fade-in">
            <div className="mb-2 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-xs font-semibold text-primary">
                Harmonizing…
              </span>
            </div>
            <Progress
              value={harmonizationRun.progress}
              className="h-1.5 bg-secondary"
            />
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-muted-foreground">
                {harmonizationRun.stage}
              </p>
              <p className="font-mono text-[10px] text-foreground/70">
                {harmonizationRun.parcelsProcessed} /{' '}
                {harmonizationRun.totalParcels} parcels •{' '}
                {harmonizationRun.conflictsFound} conflicts
              </p>
            </div>
          </div>
        )}

        {/* Stats summary */}
        {harmonizationRun.status === 'complete' && (
          <div className="mb-4 grid grid-cols-3 gap-2 animate-fade-in">
            <StatChip
              label="Parcels"
              value={harmonizationRun.totalParcels.toString()}
            />
            <StatChip
              label="Conflicts"
              value={harmonizationRun.conflictsFound.toString()}
              warning
            />
            <StatChip
              label="Avg Conf."
              value={`${harmonizationRun.confidenceAvg.toFixed(1)}%`}
            />
          </div>
        )}
      </div>

      {/* Run button */}
      <div className="border-t border-border p-4">
        <Button
          onClick={onRunHarmonization}
          disabled={!canRun}
          className={cn(
            'w-full gap-2 font-semibold',
            !canRun &&
              'cursor-not-allowed opacity-50',
            canRun &&
              'bg-gradient-to-r from-primary to-sky-600 text-white hover:from-primary/90 hover:to-sky-600/90 glow-primary'
          )}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Run Spatial Harmonization
            </>
          )}
        </Button>
        {!canRun && !isRunning && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Upload at least 2 data sources to begin
          </p>
        )}
      </div>
    </aside>
  );
}

function UploadRow({
  item,
  accent,
  onRemove,
}: {
  item: UploadItem;
  accent: string;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md border border-border bg-card/50 p-2 animate-fade-in">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {item.status === 'done' ? (
            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
          ) : item.status === 'error' ? (
            <AlertCircle className="h-3 w-3 shrink-0 text-rose-400" />
          ) : (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
          )}
          <p className="truncate text-[10px] font-medium text-foreground/90">
            {item.name}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Progress
            value={item.progress}
            className="h-1 flex-1 bg-secondary"
          />
          <span className="text-[9px] font-mono text-muted-foreground">
            {item.size}
          </span>
        </div>
        {item.status === 'done' && item.records && (
          <p className="mt-0.5 text-[9px] text-muted-foreground">
            {item.records.toLocaleString()} records indexed
          </p>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function StatChip({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-2 text-center">
      <p
        className={cn(
          'text-sm font-bold font-mono',
          warning ? 'text-amber-400' : 'text-foreground'
        )}
      >
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function simulateUpload(
  item: UploadItem,
  onUploadsChange: React.Dispatch<React.SetStateAction<UploadItem[]>>,
  currentUploads: UploadItem[]
) {
  const updated = [...currentUploads, item];
  onUploadsChange(updated);

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 18 + 7;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      onUploadsChange((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? { ...u, progress: 100, status: 'done', records: randomRecords() }
            : u
        )
      );
    } else {
      onUploadsChange((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, progress } : u))
      );
    }
  }, 400);
}

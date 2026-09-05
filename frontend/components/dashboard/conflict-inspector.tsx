'use client';

import { useMemo } from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  AlertTriangle,
  FileText,
  Download,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  MapPin,
  Ruler,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  TriangleAlert,
  ScanSearch,
  Layers2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  PARCEL_DATA,
  getConflictLabel,
  getConfidenceColor,
  getConfidenceBg,
  type ParcelRecord,
} from '@/lib/parcels';
import { downloadBlob, exportPDF } from '@/lib/api';
import { useBackendSession } from '@/lib/backend-session';

interface ConflictInspectorProps {
  collapsed: boolean;
  onToggle: () => void;
  selectedParcelId: string | null;
  onSelectParcel: (id: string) => void;
  harmonizationComplete: boolean;
}

export function ConflictInspector({
  collapsed,
  onToggle,
  selectedParcelId,
  onSelectParcel,
  harmonizationComplete,
}: ConflictInspectorProps) {
  const selectedParcel = useMemo(
    () => PARCEL_DATA.find((p) => p.id === selectedParcelId) || null,
    [selectedParcelId]
  );

  const conflicts = useMemo(
    () => PARCEL_DATA.filter((p) => p.status === 'conflict'),
    []
  );

  const stats = useMemo(() => {
    const total = PARCEL_DATA.length;
    const harmonized = PARCEL_DATA.filter(
      (p) => p.status === 'harmonized'
    ).length;
    const avgConf =
      PARCEL_DATA.reduce((acc, p) => acc + p.confidence, 0) / total;
    const sliverGaps = conflicts.filter(
      (c) => c.conflictType === 'sliver-gap'
    ).length;
    return {
      total,
      harmonized,
      conflicts: conflicts.length,
      avgConf,
      sliverGaps,
    };
  }, [conflicts]);

  if (collapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-l border-border bg-sidebar/80 backdrop-blur-sm">
        <button
          onClick={onToggle}
          className="flex h-12 w-full items-center justify-center border-b border-border text-muted-foreground transition-colors hover:text-primary"
          title="Expand Conflict Inspector"
        >
          <PanelRightOpen className="h-5 w-5" />
        </button>
        <div className="mt-3 flex flex-col items-center gap-3">
          <div className="flex flex-col items-center">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="mt-1 rotate-90 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {stats.conflicts} Conflicts
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[340px] flex-col border-l border-border bg-sidebar/80 backdrop-blur-sm animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Conflict Inspector
          </h2>
        </div>
        <button
          onClick={onToggle}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          title="Collapse panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Selected parcel detail */}
        {selectedParcel ? (
          <ParcelDetail
            parcel={selectedParcel}
            harmonizationComplete={harmonizationComplete}
          />
        ) : (
          <OverviewPanel
            stats={stats}
            conflicts={conflicts}
            onSelectParcel={onSelectParcel}
          />
        )}
      </div>
    </aside>
  );
}

function OverviewPanel({
  stats,
  conflicts,
  onSelectParcel,
}: {
  stats: {
    total: number;
    harmonized: number;
    conflicts: number;
    avgConf: number;
    sliverGaps: number;
  };
  conflicts: ParcelRecord[];
  onSelectParcel: (id: string) => void;
}) {
  return (
    <div className="px-4 py-3">
      {/* Summary stats */}
      <div className="mb-4 space-y-3">
        <div className="rounded-lg border border-border bg-card/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Harmonization Progress
            </span>
            <span className="font-mono text-[10px] text-primary">
              {stats.harmonized}/{stats.total}
            </span>
          </div>
          <Progress
            value={(stats.harmonized / stats.total) * 100}
            className="h-1.5 bg-secondary"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Avg Confidence
              </span>
            </div>
            <p
              className={cn(
                'mt-1 text-xl font-bold font-mono',
                getConfidenceColor(stats.avgConf)
              )}
            >
              {stats.avgConf.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Conflicts
              </span>
            </div>
            <p className="mt-1 text-xl font-bold font-mono text-amber-400">
              {stats.conflicts}
            </p>
          </div>
        </div>
      </div>

      {/* Confidence distribution */}
      <div className="mb-4">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Confidence Distribution
        </h3>
        <div className="space-y-1.5">
          <ConfidenceBar
            label="High (85%+)"
            count={
              PARCEL_DATA.filter((p) => p.confidence >= 85).length
            }
            total={PARCEL_DATA.length}
            color="bg-emerald-500"
          />
          <ConfidenceBar
            label="Medium (70-85%)"
            count={
              PARCEL_DATA.filter((p) => p.confidence >= 70 && p.confidence < 85)
                .length
            }
            total={PARCEL_DATA.length}
            color="bg-amber-500"
          />
          <ConfidenceBar
            label="Low (<70%)"
            count={PARCEL_DATA.filter((p) => p.confidence < 70).length}
            total={PARCEL_DATA.length}
            color="bg-rose-500"
          />
        </div>
      </div>

      {/* Conflict list */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <TriangleAlert className="h-3 w-3 text-amber-400" />
          Active Conflicts ({conflicts.length})
        </h3>
        <div className="space-y-2">
          {conflicts.map((parcel) => (
            <ConflictCard
              key={parcel.id}
              parcel={parcel}
              onClick={() => onSelectParcel(parcel.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfidenceBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = (count / total) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-[10px] text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-4 text-right font-mono text-[10px] text-foreground/70">
        {count}
      </span>
    </div>
  );
}

function ConflictCard({
  parcel,
  onClick,
}: {
  parcel: ParcelRecord;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-lg border border-border bg-card/50 p-2.5 text-left transition-all hover:border-primary/40 hover:bg-card/80"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
            <span className="truncate font-mono text-[10px] font-semibold text-foreground">
              {parcel.ulpin}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {parcel.owner}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              'font-mono text-[10px] font-bold',
              getConfidenceColor(parcel.confidence)
            )}
          >
            {parcel.confidence}%
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[9px] text-amber-400"
        >
          {getConflictLabel(parcel.conflictType)}
        </Badge>
        <span className="text-[9px] text-muted-foreground">
          {parcel.zone}
        </span>
      </div>
    </button>
  );
}

function ParcelDetail({
  parcel,
  harmonizationComplete,
}: {
  parcel: ParcelRecord;
  harmonizationComplete: boolean;
}) {
  const isConflict = parcel.status === 'conflict';
  const areaDelta =
    parcel.legacyArea && parcel.harmonizedArea
      ? parcel.harmonizedArea - parcel.legacyArea
      : 0;
  const { lastDatasetId, recordError } = useBackendSession();

  return (
    <div className="animate-fade-in px-4 py-3">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            isConflict
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-emerald-500/10 text-emerald-400'
          )}
        >
          {isConflict ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </div>
        <div>
          <p className="font-mono text-xs font-bold text-foreground">
            {parcel.ulpin}
          </p>
          <p className="text-[10px] text-muted-foreground">{parcel.zone}</p>
        </div>
      </div>

      {/* Confidence score */}
      <div className="mb-4 rounded-lg border border-border bg-card/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              AI Confidence Score
            </span>
          </div>
          <span
            className={cn(
              'font-mono text-lg font-bold',
              getConfidenceColor(parcel.confidence)
            )}
          >
            {parcel.confidence}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              'h-full transition-all duration-700',
              getConfidenceBg(parcel.confidence)
            )}
            style={{ width: `${parcel.confidence}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
        </div>
      </div>

      {/* Conflict warning */}
      {isConflict && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">
              {getConflictLabel(parcel.conflictType)} Detected
            </span>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            {getConflictDescription(parcel.conflictType)}
          </p>
        </div>
      )}

      {/* Parcel metadata */}
      <div className="mb-4 space-y-2">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Parcel Details
        </h3>
        <DetailRow icon={User} label="Owner" value={parcel.owner} />
        <DetailRow
          icon={MapPin}
          label="Zone"
          value={parcel.zone}
        />
        <DetailRow
          icon={Ruler}
          label="Area"
          value={`${parcel.areaSqM.toLocaleString()} m²`}
        />
        {parcel.legacyArea && (
          <DetailRow
            icon={Layers2}
            label="Legacy Area"
            value={`${parcel.legacyArea.toLocaleString()} m²`}
          />
        )}
        {areaDelta !== 0 && (
          <div className="flex items-center justify-between rounded-md bg-card/30 px-2 py-1.5">
            <span className="text-[10px] text-muted-foreground">
              Area Adjustment
            </span>
            <span
              className={cn(
                'font-mono text-[10px] font-semibold',
                areaDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {areaDelta > 0 ? '+' : ''}
              {areaDelta.toFixed(1)} m²
            </span>
          </div>
        )}
        <DetailRow
          icon={Clock}
          label="Last Updated"
          value={new Date(parcel.lastUpdated).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        />
      </div>

      {/* Export section */}
      {harmonizationComplete && (
        <div className="space-y-2 animate-fade-in">
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                ULPIN Certificate
              </span>
            </div>
            <p className="mb-3 text-[10px] leading-relaxed text-muted-foreground">
              Generate a geo-referenced PDF with parcel boundaries, owner
              details, and confidence metadata for official records.
            </p>
            <Button
              className={cn(
                'w-full gap-2 font-semibold',
                'bg-gradient-to-r from-primary to-sky-600 text-white hover:from-primary/90 hover:to-sky-600/90',
                !isConflict && 'glow-primary'
              )}
              onClick={() => {
                if (!lastDatasetId) {
                  return;
                }
                void exportPDF({
                  dataset_id: lastDatasetId,
                  owner_name: parcel.owner,
                  survey_number: parcel.ulpin,
                })
                  .then(({ blob, filename }) => {
                    downloadBlob(blob, filename);
                  })
                  .catch((err: unknown) => {
                    recordError(
                      err instanceof Error ? err.message : 'Failed PDF request'
                    );
                  });
              }}
            >
              <Download className="h-4 w-4" />
              Approve & Export ULPIN PDF
            </Button>
            {isConflict && (
              <p className="mt-2 flex items-center gap-1 text-[9px] text-amber-400">
                <XCircle className="h-3 w-3" />
                Resolve conflict before exporting
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-card/30 px-2 py-1.5">
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="ml-auto truncate text-[10px] font-medium text-foreground/90">
        {value}
      </span>
    </div>
  );
}

function getConflictDescription(type?: ParcelRecord['conflictType']): string {
  switch (type) {
    case 'sliver-gap':
      return 'A narrow unclaimed gap exists between this parcel and its neighbor. The AI detected a 5-30cm sliver that falls outside both registered boundaries.';
    case 'overlap':
      return 'This parcel boundary overlaps with an adjacent cadastral record. Drone imagery confirms the true boundary lies between the two claims.';
    case 'mismatch':
      return 'The area recorded in the tax CSV does not match the shapefile geometry. Harmonization has adjusted the boundary to match drone-verified extents.';
    case 'orphan':
      return 'This parcel exists in the tax records but has no corresponding entry in the cadastral shapefile. A new geometry has been inferred from drone imagery.';
    default:
      return 'Unknown conflict type detected.';
  }
}

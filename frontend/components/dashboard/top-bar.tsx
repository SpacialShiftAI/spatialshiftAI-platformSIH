'use client';

import { useEffect } from 'react';
import {
  Activity,
  Bell,
  Search,
  Settings,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { checkBackendHealth } from '@/lib/api';
import { useBackendSession } from '@/lib/backend-session';

interface TopBarProps {
  harmonizationStatus: 'idle' | 'running' | 'complete' | 'error';
  parcelsProcessed: number;
  conflictsFound: number;
}

export function TopBar({
  harmonizationStatus,
  parcelsProcessed,
  conflictsFound,
}: TopBarProps) {
  const statusMap = {
    idle: { label: 'Standby', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
    running: { label: 'Processing', color: 'text-primary', dot: 'bg-primary animate-pulse' },
    complete: { label: 'Ready', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    error: { label: 'Error', color: 'text-rose-400', dot: 'bg-rose-400' },
  };

  const status = statusMap[harmonizationStatus];
  const { health, setHealth } = useBackendSession();

  useEffect(() => {
    let cancelled = false;

    const ping = () => {
      void checkBackendHealth()
        .then(() => {
          if (!cancelled) setHealth('ok');
        })
        .catch(() => {
          if (!cancelled) setHealth('down');
        });
    };

    ping();
    const timer = window.setInterval(ping, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setHealth]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/50 px-5 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <nav className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Projects</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-muted-foreground">Agra District</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="font-semibold text-foreground">Sector 28A/28B</span>
        </nav>
      </div>

      {/* Center status */}
      <div className="hidden items-center gap-4 md:flex">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${status.dot}`} />
          <span className={`text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
        {harmonizationStatus !== 'idle' && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Parcels
              </span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {parcelsProcessed}
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Conflicts
              </span>
              <span
                className={`font-mono text-xs font-semibold ${
                  conflictsFound > 0 ? 'text-amber-400' : 'text-foreground'
                }`}
              >
                {conflictsFound}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <div
          className="hidden items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 md:flex"
          title={
            health === 'ok'
              ? 'Backend API reachable'
              : health === 'down'
                ? 'Backend API unreachable — demo still works'
                : 'Checking backend API'
          }
        >
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              health === 'ok'
                ? 'bg-emerald-400'
                : health === 'down'
                  ? 'bg-rose-400'
                  : 'bg-muted-foreground'
            }`}
          />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            API
          </span>
        </div>
        <div className="hidden items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-1.5 lg:flex">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search ULPIN, owner, zone…"
            className="w-40 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Activity className="h-4 w-4" />
        </button>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <HelpCircle className="h-4 w-4" />
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Settings className="h-4 w-4" />
        </button>
        <div className="ml-2 h-8 w-8 rounded-full bg-gradient-to-br from-primary to-sky-600" />
      </div>
    </header>
  );
}

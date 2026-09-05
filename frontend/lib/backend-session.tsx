'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { HarmonizeData, UploadData } from '@/lib/api';

export type BackendHealthStatus = 'unknown' | 'ok' | 'down';

export type BackendSessionState = {
  health: BackendHealthStatus;
  lastDatasetId: string | null;
  lastUpload: UploadData | null;
  lastHarmonize: HarmonizeData | null;
  lastError: string | null;
};

type BackendSessionContextValue = BackendSessionState & {
  setHealth: (health: BackendHealthStatus) => void;
  recordUpload: (data: UploadData) => void;
  recordHarmonize: (data: HarmonizeData) => void;
  recordError: (message: string | null) => void;
};

const BackendSessionContext = createContext<BackendSessionContextValue | null>(
  null
);

const INITIAL: BackendSessionState = {
  health: 'unknown',
  lastDatasetId: null,
  lastUpload: null,
  lastHarmonize: null,
  lastError: null,
};

export function BackendSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BackendSessionState>(INITIAL);

  const setHealth = useCallback((health: BackendHealthStatus) => {
    setState((prev) => ({ ...prev, health }));
  }, []);

  const recordUpload = useCallback((data: UploadData) => {
    setState((prev) => ({
      ...prev,
      lastUpload: data,
      lastDatasetId: data.dataset_id,
      lastError: null,
    }));
  }, []);

  const recordHarmonize = useCallback((data: HarmonizeData) => {
    setState((prev) => ({
      ...prev,
      lastHarmonize: data,
      lastDatasetId: data.dataset_id,
      lastError: null,
    }));
  }, []);

  const recordError = useCallback((message: string | null) => {
    setState((prev) => ({ ...prev, lastError: message }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      setHealth,
      recordUpload,
      recordHarmonize,
      recordError,
    }),
    [state, setHealth, recordUpload, recordHarmonize, recordError]
  );

  return (
    <BackendSessionContext.Provider value={value}>
      {children}
    </BackendSessionContext.Provider>
  );
}

export function useBackendSession(): BackendSessionContextValue {
  const ctx = useContext(BackendSessionContext);
  if (!ctx) {
    throw new Error('useBackendSession must be used within BackendSessionProvider');
  }
  return ctx;
}

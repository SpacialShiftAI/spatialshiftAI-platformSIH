/**
 * Additive FastAPI client. Demo UI must not depend on these calls succeeding.
 * Base URL: NEXT_PUBLIC_API_URL (see .env.example).
 */

export type HealthData = {
  service: string;
  version: string;
  crs: string;
};

export type UploadData = {
  dataset_id: string;
  filename: string;
  source_format: string;
  feature_count: number;
  crs: string;
  bounds: number[];
  geometry_types: string[];
  columns: string[];
  created_at: string;
};

export type ConfidenceBreakdown = {
  geometry_validity: number;
  sliver_cleanliness: number;
  overlap_resolution: number;
  node_snap_quality: number;
  compactness: number;
  rule_based_score: number;
  xgboost_score: number | null;
  model: 'hybrid' | 'rule_based';
};

export type HarmonizeData = {
  dataset_id: string;
  feature_count: number;
  removed_slivers: number;
  overlap_fixes: number;
  snapped_nodes: number;
  simulated_wall_segments: number;
  mean_snap_distance_m: number;
  confidence: ConfidenceBreakdown;
  geojson: Record<string, unknown>;
};

export type HarmonizeRequestBody = {
  dataset_id: string;
  building_dataset_id?: string | null;
  sliver_area_m2?: number;
  snap_tolerance_m?: number;
  overlap_area_m2?: number;
};

export type ExportPdfRequestBody = {
  dataset_id: string;
  owner_name?: string;
  village?: string;
  district?: string;
  state?: string;
  survey_number?: string | null;
};

type OkEnvelope<T> = {
  ok: true;
  data: T;
  message?: string;
};

type ErrEnvelope = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};

export class BackendApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'BackendApiError';
    this.code = code;
    this.status = status;
  }
}

const BACKEND_UPLOAD_EXTS = new Set([
  '.shp',
  '.shx',
  '.dbf',
  '.prj',
  '.cpg',
  '.sbn',
  '.sbx',
  '.qix',
  '.fix',
  '.geojson',
  '.json',
  '.csv',
]);

export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw && raw.trim().length > 0) {
    return raw.replace(/\/$/, '');
  }
  return 'http://localhost:8000';
}

export function isBackendUploadFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf('.');
  if (dot < 0) return false;
  return BACKEND_UPLOAD_EXTS.has(name.slice(dot));
}

async function parseJsonEnvelope<T>(response: Response): Promise<T> {
  let payload: OkEnvelope<T> | ErrEnvelope | null = null;
  try {
    payload = (await response.json()) as OkEnvelope<T> | ErrEnvelope;
  } catch {
    throw new BackendApiError(
      'Invalid JSON response from backend',
      'INVALID_RESPONSE',
      response.status
    );
  }

  if (!payload || typeof payload !== 'object') {
    throw new BackendApiError(
      'Invalid response from backend',
      'INVALID_RESPONSE',
      response.status
    );
  }

  if (payload.ok === true) {
    return payload.data;
  }

  if (payload.ok === false && payload.error) {
    throw new BackendApiError(
      payload.error.message || 'Backend request failed',
      payload.error.code || 'HTTP_ERROR',
      response.status
    );
  }

  throw new BackendApiError(
    'Unexpected backend response shape',
    'INVALID_RESPONSE',
    response.status
  );
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${getApiBaseUrl()}${path}`;
  try {
    return await fetch(url, {
      ...init,
      credentials: 'omit',
    });
  } catch {
    throw new BackendApiError(
      'Backend unavailable (network error)',
      'NETWORK_ERROR',
      0
    );
  }
}

export async function checkBackendHealth(): Promise<HealthData> {
  const response = await apiFetch('/api/health', { method: 'GET' });
  if (!response.ok) {
    return parseJsonEnvelope<HealthData>(response);
  }
  return parseJsonEnvelope<HealthData>(response);
}

export async function uploadFiles(files: File[]): Promise<UploadData> {
  if (files.length === 0) {
    throw new BackendApiError('No files to upload', 'NO_FILES', 400);
  }
  const form = new FormData();
  for (const file of files) {
    form.append('files', file, file.name);
  }
  const response = await apiFetch('/api/upload', {
    method: 'POST',
    body: form,
  });
  if (!response.ok && response.status >= 500) {
    try {
      return await parseJsonEnvelope<UploadData>(response);
    } catch (err) {
      if (err instanceof BackendApiError) throw err;
      throw new BackendApiError('Failed upload', 'UPLOAD_FAILED', response.status);
    }
  }
  return parseJsonEnvelope<UploadData>(response);
}

export async function runHarmonization(
  body: HarmonizeRequestBody
): Promise<HarmonizeData> {
  const response = await apiFetch('/api/harmonize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJsonEnvelope<HarmonizeData>(response);
}

export async function exportPDF(body: ExportPdfRequestBody): Promise<{
  blob: Blob;
  filename: string;
  ulpin: string | null;
  datasetId: string | null;
}> {
  const response = await apiFetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/pdf')) {
    if (contentType.includes('application/json')) {
      await parseJsonEnvelope<never>(response);
    }
    throw new BackendApiError(
      'Failed PDF request',
      'PDF_FAILED',
      response.status
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return {
    blob,
    filename: match?.[1] || 'spatialshift-mutation.pdf',
    ulpin: response.headers.get('X-ULPIN'),
    datasetId: response.headers.get('X-Dataset-Id'),
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

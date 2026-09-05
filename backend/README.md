# SpatialShift AI

FastAPI backend for multi-source cadastral ingest, topological planarization, hybrid confidence scoring, and simulated ULPIN mutation certificates.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/upload` | Shapefile (multi-file), GeoJSON, or CSV → GeoPandas → **EPSG:32643** |
| `POST` | `/api/harmonize` | Sliver cleanup, overlap planarization, snap to building walls, rule-based + XGBoost score |
| `POST` | `/api/export-pdf` | Downloadable land mutation PDF (reportlab) with simulated ULPIN |
| `GET` | `/api/health` | Service probe for a Next.js frontend |

JSON responses use `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "code", "message" } }`. `/api/export-pdf` returns `application/pdf`.

## Run

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

GeoPandas on Windows is easiest with a recent Python 3.11+ wheel set (pyogrio is included). If a Shapefile sidecar is missing, upload fails with `INCOMPLETE_SHAPEFILE` / `SHAPEFILE_READ_ERROR`.

## Frontend calls

**Upload** (`multipart/form-data`, field name `files` — send every Shapefile sidecar together):

```ts
const form = new FormData();
for (const file of fileList) form.append("files", file);
const res = await fetch("http://localhost:8000/api/upload", { method: "POST", body: form });
const json = await res.json();
// json.data.dataset_id
```

**Harmonize**:

```ts
await fetch("http://localhost:8000/api/harmonize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    dataset_id,
    building_dataset_id: null,
    sliver_area_m2: 2,
    snap_tolerance_m: 0.75,
  }),
});
```

**PDF**:

```ts
const res = await fetch("http://localhost:8000/api/export-pdf", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dataset_id, owner_name: "A. Patil", village: "Khed", district: "Pune", state: "Maharashtra" }),
});
const blob = await res.blob();
```

CSV uploads need `lat`/`lon` (or aliases) or a WKT `geometry` column. Missing CRS is treated as EPSG:4326 before the UTM transform.

Datasets are kept in memory for the process lifetime — restarting the API clears them.

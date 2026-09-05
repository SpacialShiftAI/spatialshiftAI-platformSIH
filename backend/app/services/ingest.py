from __future__ import annotations

import json
import tempfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
from fastapi import UploadFile
from shapely import wkt
from shapely.geometry import Point, shape

from app.config import DEFAULT_ASSUMED_CRS, TARGET_CRS
from app.exceptions import SpatialShiftError
from app.store import DatasetRecord, store

SHAPEFILE_EXTS = {".shp", ".shx", ".dbf", ".prj", ".cpg", ".sbn", ".sbx", ".qix", ".fix"}
GEOJSON_EXTS = {".geojson", ".json"}
CSV_EXTS = {".csv"}

LAT_ALIASES = ("lat", "latitude", "y", "northing")
LON_ALIASES = ("lon", "lng", "long", "longitude", "x", "easting")
WKT_ALIASES = ("wkt", "geom", "geometry", "the_geom")


def _suffix(name: str) -> str:
    return Path(name).suffix.lower()


def _detect_format(files: list[UploadFile]) -> str:
    names = [f.filename or "" for f in files]
    exts = {_suffix(n) for n in names if n}
    if ".shp" in exts:
        return "shapefile"
    if exts & GEOJSON_EXTS:
        return "geojson"
    if exts & CSV_EXTS:
        return "csv"
    raise SpatialShiftError(
        "Unsupported upload. Provide GeoJSON, CSV, or a Shapefile set (.shp + sidecars).",
        code="UNSUPPORTED_FORMAT",
    )


async def _write_uploads(files: list[UploadFile], directory: Path) -> list[Path]:
    written: list[Path] = []
    for upload in files:
        name = Path(upload.filename or "upload.bin").name
        dest = directory / name
        content = await upload.read()
        if not content:
            continue
        dest.write_bytes(content)
        written.append(dest)
    if not written:
        raise SpatialShiftError("No non-empty files were uploaded.", code="EMPTY_UPLOAD")
    return written


def _find_column(columns: list[str], aliases: tuple[str, ...]) -> str | None:
    lower = {c.lower(): c for c in columns}
    for alias in aliases:
        if alias in lower:
            return lower[alias]
    return None


def _read_csv(path: Path) -> gpd.GeoDataFrame:
    df = pd.read_csv(path)
    if df.empty:
        raise SpatialShiftError("CSV file contains no rows.", code="EMPTY_DATASET")

    wkt_col = _find_column(list(df.columns), WKT_ALIASES)
    if wkt_col:
        try:
            geometry = df[wkt_col].map(wkt.loads)
        except Exception as exc:  # noqa: BLE001
            raise SpatialShiftError(
                "Could not parse WKT geometries from CSV.",
                code="INVALID_GEOMETRY",
            ) from exc
        return gpd.GeoDataFrame(df.drop(columns=[wkt_col]), geometry=geometry, crs=DEFAULT_ASSUMED_CRS)

    lat_col = _find_column(list(df.columns), LAT_ALIASES)
    lon_col = _find_column(list(df.columns), LON_ALIASES)
    if lat_col and lon_col:
        geometry = [Point(xy) for xy in zip(df[lon_col].astype(float), df[lat_col].astype(float))]
        return gpd.GeoDataFrame(df, geometry=geometry, crs=DEFAULT_ASSUMED_CRS)

    raise SpatialShiftError(
        "CSV must include lat/lon columns, or a WKT geometry column.",
        code="MISSING_COORDINATES",
    )


def _read_geojson(path: Path) -> gpd.GeoDataFrame:
    try:
        gdf = gpd.read_file(path)
    except Exception:
        payload = json.loads(path.read_text(encoding="utf-8"))
        features = payload.get("features", [])
        if not features:
            raise SpatialShiftError("GeoJSON contains no features.", code="EMPTY_DATASET")
        records = []
        geoms = []
        for feat in features:
            geoms.append(shape(feat["geometry"]))
            records.append(feat.get("properties") or {})
        gdf = gpd.GeoDataFrame(records, geometry=geoms, crs=DEFAULT_ASSUMED_CRS)

    if gdf.empty:
        raise SpatialShiftError("GeoJSON contains no features.", code="EMPTY_DATASET")
    return gdf


def _read_shapefile(directory: Path) -> gpd.GeoDataFrame:
    shp_files = list(directory.glob("*.shp"))
    if not shp_files:
        raise SpatialShiftError(
            "Shapefile upload is missing the required .shp file.",
            code="INCOMPLETE_SHAPEFILE",
        )
    try:
        gdf = gpd.read_file(shp_files[0])
    except Exception as exc:  # noqa: BLE001
        raise SpatialShiftError(
            "Failed to read Shapefile. Include .shp, .shx, .dbf, and ideally .prj.",
            code="SHAPEFILE_READ_ERROR",
        ) from exc
    if gdf.empty:
        raise SpatialShiftError("Shapefile contains no features.", code="EMPTY_DATASET")
    return gdf


def normalize_crs(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf = gdf.copy()
    gdf = gdf[~gdf.geometry.isna()].copy()
    if gdf.empty:
        raise SpatialShiftError("No valid geometries after ingest.", code="EMPTY_DATASET")

    if gdf.crs is None:
        gdf = gdf.set_crs(DEFAULT_ASSUMED_CRS)
    try:
        gdf = gdf.to_crs(TARGET_CRS)
    except Exception as exc:  # noqa: BLE001
        raise SpatialShiftError(
            f"Could not reproject geometries to {TARGET_CRS}.",
            code="CRS_TRANSFORM_ERROR",
        ) from exc
    gdf["geometry"] = gdf.geometry.make_valid()
    return gdf


async def ingest_uploads(files: list[UploadFile]) -> DatasetRecord:
    source_format = _detect_format(files)
    display_name = files[0].filename or f"upload.{source_format}"

    with tempfile.TemporaryDirectory(prefix="spatialshift-") as tmp:
        directory = Path(tmp)
        written = await _write_uploads(files, directory)

        if source_format == "shapefile":
            gdf = _read_shapefile(directory)
        elif source_format == "geojson":
            geojson_path = next(p for p in written if _suffix(p.name) in GEOJSON_EXTS)
            gdf = _read_geojson(geojson_path)
        else:
            csv_path = next(p for p in written if _suffix(p.name) in CSV_EXTS)
            gdf = _read_csv(csv_path)

        gdf = normalize_crs(gdf)
        record = DatasetRecord(
            gdf=gdf,
            source_format=source_format,
            filename=display_name,
        )
        return store.put(record)


def dataset_summary(record: DatasetRecord) -> dict:
    gdf = record.gdf
    bounds = [float(v) for v in gdf.total_bounds]
    types = sorted({geom.geom_type for geom in gdf.geometry if geom is not None})
    return {
        "dataset_id": record.id,
        "filename": record.filename,
        "source_format": record.source_format,
        "feature_count": int(len(gdf)),
        "crs": TARGET_CRS,
        "bounds": bounds,
        "geometry_types": types,
        "columns": [c for c in gdf.columns if c != "geometry"],
        "created_at": record.created_at,
    }

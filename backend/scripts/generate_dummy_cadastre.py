"""Generate 10 square parcels plus a distorted legacy cadastre layer.

Outputs (EPSG:32643, meter units so 1–3 m shifts are meaningful):
  samples/drone_survey_truth.geojson   — clean abutting squares
  samples/raw_legacy_cadastre.geojson  — jittered vertices, overlaps, sliver gaps
"""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import numpy as np
from shapely.geometry import Polygon

CRS = "EPSG:32643"
ORIGIN_X = 379_250.0
ORIGIN_Y = 2_048_200.0
PARCEL_SIZE_M = 25.0
N_PARCELS = 10
N_COLS = 5
RNG = np.random.default_rng(43)

SCRIPT_DIR = Path(__file__).resolve().parent
OUT_DIR = SCRIPT_DIR.parent / "samples"


def square_at(index: int) -> Polygon:
    row, col = divmod(index, N_COLS)
    x0 = ORIGIN_X + col * PARCEL_SIZE_M
    y0 = ORIGIN_Y + row * PARCEL_SIZE_M
    x1, y1 = x0 + PARCEL_SIZE_M, y0 + PARCEL_SIZE_M
    return Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)])


def _closed_ring(coords: np.ndarray) -> list[tuple[float, float]]:
    ring = [(float(x), float(y)) for x, y in coords]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def jitter_vertices(poly: Polygon, min_shift_m: float = 1.0, max_shift_m: float = 3.0) -> Polygon:
    verts = np.asarray(poly.exterior.coords[:-1], dtype=float)
    for i in range(len(verts)):
        mag = float(RNG.uniform(min_shift_m, max_shift_m))
        angle = float(RNG.uniform(0.0, 2.0 * np.pi))
        verts[i, 0] += mag * np.cos(angle)
        verts[i, 1] += mag * np.sin(angle)
    return Polygon(_closed_ring(verts))


def shift_edge(poly: Polygon, *, east: float = 0.0, west: float = 0.0) -> Polygon:
    """Move east/west vertices to force overlaps (positive east) or gaps (negative east)."""
    minx, _, maxx, _ = poly.bounds
    mid = (minx + maxx) / 2.0
    verts = np.asarray(poly.exterior.coords[:-1], dtype=float)
    for i, (x, _y) in enumerate(verts):
        if x >= mid:
            verts[i, 0] += east
        else:
            verts[i, 0] += west
    return Polygon(_closed_ring(verts))


def distort_parcels(truth: list[Polygon]) -> list[Polygon]:
    distorted = [jitter_vertices(p) for p in truth]

    # Shared east–west edges: overlap on even pairs, sliver gaps on odd pairs.
    for i in range(0, N_PARCELS, 2):
        neighbor = i + 1
        if neighbor >= N_PARCELS:
            break
        if (i // 2) % 2 == 0:
            distorted[i] = shift_edge(distorted[i], east=2.4)
            distorted[neighbor] = shift_edge(distorted[neighbor], west=-0.4)
        else:
            distorted[i] = shift_edge(distorted[i], east=-1.6)
            distorted[neighbor] = shift_edge(distorted[neighbor], west=0.5)

    return distorted


def to_gdf(polygons: list[Polygon], source: str) -> gpd.GeoDataFrame:
    records = []
    for i, geom in enumerate(polygons, start=1):
        records.append(
            {
                "parcel_id": f"P-{i:02d}",
                "survey_no": f"12/{i}",
                "source": source,
                "area_m2": round(geom.area, 3),
                "geometry": geom,
            }
        )
    return gpd.GeoDataFrame(records, geometry="geometry", crs=CRS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    truth = [square_at(i) for i in range(N_PARCELS)]
    legacy = distort_parcels(truth)

    truth_path = OUT_DIR / "drone_survey_truth.geojson"
    legacy_path = OUT_DIR / "raw_legacy_cadastre.geojson"
    to_gdf(truth, "drone_survey_truth").to_file(truth_path, driver="GeoJSON")
    to_gdf(legacy, "raw_legacy_cadastre").to_file(legacy_path, driver="GeoJSON")
    print(f"Wrote {truth_path}")
    print(f"Wrote {legacy_path}")


if __name__ == "__main__":
    main()

from __future__ import annotations

from dataclasses import dataclass

import geopandas as gpd
import numpy as np
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon
from shapely.ops import linemerge, polygonize, snap, unary_union
from shapely.validation import make_valid

from app.config import OVERLAP_AREA_M2, SLIVER_AREA_M2, SNAP_TOLERANCE_M, TARGET_CRS


@dataclass
class PlanarizeResult:
    gdf: gpd.GeoDataFrame
    removed_slivers: int
    overlap_fixes: int
    snapped_nodes: int
    simulated_wall_segments: int
    mean_snap_distance_m: float
    features: dict[str, float]


def _as_polygons(geom) -> list[Polygon]:
    if geom is None or geom.is_empty:
        return []
    geom = make_valid(geom)
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return [p for p in geom.geoms if not p.is_empty]
    polygons: list[Polygon] = []
    if hasattr(geom, "geoms"):
        for part in geom.geoms:
            polygons.extend(_as_polygons(part))
    return polygons


def _extract_rings(geoms: list[Polygon]) -> list[LineString]:
    lines: list[LineString] = []
    for poly in geoms:
        exterior = LineString(poly.exterior.coords)
        if exterior.length > 0:
            lines.append(exterior)
        for ring in poly.interiors:
            interior = LineString(ring.coords)
            if interior.length > 0:
                lines.append(interior)
    return lines


def simulate_building_walls(parcels: list[Polygon], offset: float = 1.2) -> list[LineString]:
    """Derive wall-like vectors from inset parcel edges when no building layer exists."""
    walls: list[LineString] = []
    for poly in parcels:
        inset = poly.buffer(-offset)
        if inset.is_empty:
            inset = poly.buffer(-max(offset * 0.25, 0.1))
        candidates = _as_polygons(inset) or [poly]
        for candidate in candidates:
            coords = list(candidate.exterior.coords)
            for start, end in zip(coords, coords[1:]):
                segment = LineString([start, end])
                if segment.length >= 1.0:
                    walls.append(segment)
    return walls


def walls_from_buildings(gdf: gpd.GeoDataFrame) -> list[LineString]:
    walls: list[LineString] = []
    for geom in gdf.geometry:
        for poly in _as_polygons(geom):
            coords = list(poly.exterior.coords)
            for start, end in zip(coords, coords[1:]):
                segment = LineString([start, end])
                if segment.length > 0:
                    walls.append(segment)
    return walls


def _snap_nodes_to_walls(
    polygons: list[Polygon],
    walls: list[LineString],
    tolerance: float,
) -> tuple[list[Polygon], int, float]:
    if not polygons:
        return [], 0, 0.0

    wall_union = unary_union(walls) if walls else None
    snapped = 0
    distances: list[float] = []
    result: list[Polygon] = []

    for poly in polygons:
        if wall_union is None or wall_union.is_empty:
            result.append(poly)
            continue

        coords = list(poly.exterior.coords)
        new_coords = []
        for x, y in coords:
            point = Point(x, y)
            dist = float(point.distance(wall_union))
            distances.append(dist)
            if dist <= tolerance:
                nearest = wall_union.interpolate(wall_union.project(point))
                snapped_geom = snap(point, wall_union, tolerance)
                target = nearest
                if getattr(snapped_geom, "geom_type", "") == "Point" and not snapped_geom.is_empty:
                    target = snapped_geom
                if (target.x, target.y) != (x, y):
                    snapped += 1
                new_coords.append((target.x, target.y))
            else:
                new_coords.append((x, y))

        if len(new_coords) >= 4:
            rebuilt = make_valid(Polygon(new_coords))
            result.extend(_as_polygons(rebuilt) or [poly])
        else:
            result.append(poly)

    mean_dist = float(np.mean(distances)) if distances else 0.0
    return result, snapped, mean_dist


def _planarize(polygons: list[Polygon]) -> tuple[list[Polygon], int]:
    """Build a clean planar partition: noded boundaries, polygonize, drop overlaps."""
    if not polygons:
        return [], 0

    rings = _extract_rings(polygons)
    noded = unary_union(rings)
    if isinstance(noded, LineString):
        noded = MultiLineString([noded])
    merged = linemerge(noded)
    faces = list(polygonize(merged))
    if not faces:
        faces = polygons

    valid_faces = []
    for face in faces:
        repaired = make_valid(face)
        valid_faces.extend(_as_polygons(repaired))

    overlap_fixes = 0
    cleaned: list[Polygon] = []
    unioned = unary_union(valid_faces)
    for poly in _as_polygons(unioned):
        cleaned.append(poly)

    original_overlap = 0.0
    for i, a in enumerate(polygons):
        for b in polygons[i + 1 :]:
            inter = a.intersection(b)
            if not inter.is_empty:
                original_overlap += float(inter.area)
    if original_overlap > OVERLAP_AREA_M2:
        overlap_fixes = 1
    return cleaned, overlap_fixes


def _drop_slivers(polygons: list[Polygon], min_area: float) -> tuple[list[Polygon], int]:
    kept = [p for p in polygons if p.area >= min_area]
    return kept, max(0, len(polygons) - len(kept))


def _feature_metrics(
    original: list[Polygon],
    result: list[Polygon],
    removed_slivers: int,
    overlap_fixes: int,
    snapped_nodes: int,
    mean_snap_distance_m: float,
) -> dict[str, float]:
    invalid = sum(1 for p in original if not p.is_valid)
    orig_count = max(len(original), 1)
    result_count = max(len(result), 1)
    areas = [p.area for p in result] or [0.0]
    compactness = []
    for p in result:
        if p.length > 0:
            compactness.append(float(4.0 * np.pi * p.area / (p.length ** 2)))
    return {
        "invalid_ratio": invalid / orig_count,
        "sliver_ratio": removed_slivers / orig_count,
        "overlap_fixed": float(overlap_fixes > 0),
        "snap_ratio": min(snapped_nodes / (orig_count * 4), 1.0),
        "mean_snap_distance_m": mean_snap_distance_m,
        "mean_area_m2": float(np.mean(areas)),
        "mean_compactness": float(np.mean(compactness)) if compactness else 0.0,
        "result_count": float(result_count),
        "validity": 1.0 if all(p.is_valid for p in result) else 0.0,
    }


def planarize_dataset(
    cadastral: gpd.GeoDataFrame,
    buildings: gpd.GeoDataFrame | None = None,
    sliver_area_m2: float = SLIVER_AREA_M2,
    snap_tolerance_m: float = SNAP_TOLERANCE_M,
) -> PlanarizeResult:
    original = []
    for geom in cadastral.geometry:
        original.extend(_as_polygons(geom))
    if not original:
        raise ValueError("Cadastral layer has no polygonal geometries to harmonize.")

    if buildings is not None and not buildings.empty:
        walls = walls_from_buildings(buildings)
    else:
        walls = simulate_building_walls(original)

    snapped_polys, snapped_nodes, mean_snap = _snap_nodes_to_walls(
        original, walls, snap_tolerance_m
    )
    planar, overlap_fixes = _planarize(snapped_polys)
    cleaned, removed_slivers = _drop_slivers(planar, sliver_area_m2)

    rows = []
    for i, poly in enumerate(cleaned):
        rows.append({"parcel_id": i + 1, "area_m2": round(poly.area, 3), "geometry": poly})

    gdf = gpd.GeoDataFrame(rows, geometry="geometry", crs=TARGET_CRS)
    features = _feature_metrics(
        original, cleaned, removed_slivers, overlap_fixes, snapped_nodes, mean_snap
    )
    return PlanarizeResult(
        gdf=gdf,
        removed_slivers=removed_slivers,
        overlap_fixes=overlap_fixes,
        snapped_nodes=snapped_nodes,
        simulated_wall_segments=len(walls),
        mean_snap_distance_m=round(mean_snap, 4),
        features=features,
    )
